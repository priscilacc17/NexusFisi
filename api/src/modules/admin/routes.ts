import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { autenticar, requiereRol } from "../../auth/middleware.js";
import { ROLES } from "../../db/schema.js";
import type { AppEnv, Deps } from "../../lib/context.js";
import { errores, IdParam, jsonBody, Ok, ok, pagina, Paginacion, Rol, UsuarioPublico } from "../../lib/openapi.js";
import { Area, obtenerTipo, TipoTramite } from "../catalogo/routes.js";
import {
  actualizarArea,
  actualizarTipo,
  actualizarUsuario,
  crearArea,
  crearTipo,
  crearUsuario,
  eliminarArea,
  eliminarTipo,
  guardarEscuela,
  guardarFacultad,
  listarFacultadesAdmin,
  listarUsuarios,
  restablecerPassword,
} from "./service.js";

const UsuarioCrear = z
  .object({
    nombre: z.string().trim().min(5).max(120),
    email: z.string().trim().email().max(160),
    rol: Rol,
    facultadId: z.number().int().positive().nullable().optional().openapi({ description: "Vacío solo para crear otro administrador central" }),
    areaId: z.number().int().positive().nullable().optional(),
    escuelaId: z.number().int().positive().nullable().optional(),
    codigoEstudiante: z.string().regex(/^\d{8}$/).nullable().optional(),
    password: z.string().min(8).max(72),
  })
  .openapi("UsuarioCrear");

const UsuarioEditar = z
  .object({
    nombre: z.string().trim().min(5).max(120).optional(),
    rol: Rol.optional(),
    areaId: z.number().int().positive().nullable().optional(),
    escuelaId: z.number().int().positive().nullable().optional(),
    codigoEstudiante: z.string().regex(/^\d{8}$/).nullable().optional(),
    activo: z.boolean().optional(),
  })
  .openapi("UsuarioEditar");

const AreaBody = z
  .object({
    facultadId: z.number().int().positive().optional(),
    nombre: z.string().trim().min(3).max(120),
    ubicacion: z.string().trim().min(3).max(200).openapi({ example: "Pabellón FISI, 1.er piso, oficina 102" }),
    activa: z.boolean().optional(),
  })
  .openapi("AreaInput");

const TipoBody = z
  .object({
    facultadId: z.number().int().positive().optional(),
    areaId: z.number().int().positive(),
    nombre: z.string().trim().min(4).max(120),
    descripcion: z.string().trim().min(10).max(500),
    requisitos: z.array(z.string().trim().min(3).max(200)).min(1).max(15),
    plazoDias: z.number().int().min(1).max(60),
    activo: z.boolean().optional(),
  })
  .openapi("TipoTramiteInput");

const FacultadAdmin = z
  .object({
    id: z.number().int(),
    codigo: z.string(),
    nombre: z.string(),
    activa: z.boolean(),
    escuelas: z.array(z.object({ id: z.number().int(), nombre: z.string(), activa: z.boolean() })),
    usuarios: z.record(z.string(), z.number().int()),
  })
  .openapi("FacultadAdmin");

const FacultadBody = z
  .object({ codigo: z.string().trim().regex(/^[A-Za-z]{2,12}$/, "Entre 2 y 12 letras"), nombre: z.string().trim().min(5).max(160), activa: z.boolean().optional() })
  .openapi("FacultadInput");
const EscuelaBody = z.object({ nombre: z.string().trim().min(3).max(160), activa: z.boolean().optional() }).openapi("EscuelaInput");

export function adminRoutes(deps: Deps) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", autenticar(deps), requiereRol("ADMIN"));
  const t = ["Administración"];
  const seg = [{ bearerAuth: [] }];
  const comunes = { 400: errores[400], 401: errores[401], 403: errores[403], 404: errores[404], 409: errores[409], 422: errores[422] };

  const tipoPorId = async (id: number) => (await obtenerTipo(deps, id))!;

  // --- Usuarios -------------------------------------------------------------
  app.openapi(
    createRoute({
      method: "get", path: "/usuarios", tags: t, summary: "Listar usuarios", security: seg,
      request: { query: Paginacion.extend({ facultadId: z.coerce.number().int().positive().optional(), rol: z.enum(ROLES).optional(), q: z.string().max(80).optional() }) },
      responses: { 200: ok(pagina(UsuarioPublico, "PaginaUsuarios")), ...comunes },
    }),
    async (c) => c.json(await listarUsuarios(deps, c.get("usuario"), c.req.valid("query")), 200),
  );
  app.openapi(
    createRoute({ method: "post", path: "/usuarios", tags: t, summary: "Crear usuario", security: seg, request: { body: jsonBody(UsuarioCrear) }, responses: { 201: ok(UsuarioPublico), ...comunes } }),
    async (c) => c.json((await crearUsuario(deps, c.get("usuario"), c.req.valid("json")))!, 201),
  );
  app.openapi(
    createRoute({
      method: "put", path: "/usuarios/{id}", tags: t, summary: "Editar usuario, rol o estado", security: seg,
      description: "No se puede quitar el rol ni desactivar a personal con solicitudes en curso: primero hay que reasignarlas.",
      request: { params: IdParam, body: jsonBody(UsuarioEditar) },
      responses: { 200: ok(UsuarioPublico), ...comunes },
    }),
    async (c) => c.json((await actualizarUsuario(deps, c.get("usuario"), c.req.valid("param").id, c.req.valid("json")))!, 200),
  );
  app.openapi(
    createRoute({
      method: "post", path: "/usuarios/{id}/restablecer-password", tags: t, summary: "Asignar contraseña temporal", security: seg,
      request: { params: IdParam, body: jsonBody(z.object({ password: z.string().min(8).max(72) })) },
      responses: { 200: ok(Ok), ...comunes },
    }),
    async (c) => {
      await restablecerPassword(deps, c.get("usuario"), c.req.valid("param").id, c.req.valid("json").password);
      return c.json({ ok: true as const }, 200);
    },
  );

  // --- Áreas ----------------------------------------------------------------
  app.openapi(
    createRoute({ method: "post", path: "/areas", tags: t, summary: "Crear área responsable", security: seg, request: { body: jsonBody(AreaBody) }, responses: { 201: ok(Area), ...comunes } }),
    async (c) => c.json(await crearArea(deps, c.get("usuario"), c.req.valid("json")), 201),
  );
  app.openapi(
    createRoute({ method: "put", path: "/areas/{id}", tags: t, summary: "Editar área", security: seg, request: { params: IdParam, body: jsonBody(AreaBody.omit({ facultadId: true })) }, responses: { 200: ok(Area), ...comunes } }),
    async (c) => c.json(await actualizarArea(deps, c.get("usuario"), c.req.valid("param").id, c.req.valid("json")), 200),
  );
  app.openapi(
    createRoute({ method: "delete", path: "/areas/{id}", tags: t, summary: "Eliminar área sin uso", security: seg, request: { params: IdParam }, responses: { 204: { description: "Eliminada" }, ...comunes } }),
    async (c) => {
      await eliminarArea(deps, c.get("usuario"), c.req.valid("param").id);
      return c.body(null, 204);
    },
  );

  // --- Tipos de trámite -----------------------------------------------------
  app.openapi(
    createRoute({ method: "post", path: "/tipos-tramite", tags: t, summary: "Crear tipo de trámite", security: seg, request: { body: jsonBody(TipoBody) }, responses: { 201: ok(TipoTramite), ...comunes } }),
    async (c) => c.json(await tipoPorId(await crearTipo(deps, c.get("usuario"), c.req.valid("json"))), 201),
  );
  app.openapi(
    createRoute({
      method: "put", path: "/tipos-tramite/{id}", tags: t, summary: "Editar tipo de trámite", security: seg,
      description: "Un plazo nuevo aplica a las solicitudes que se registren desde ahora.",
      request: { params: IdParam, body: jsonBody(TipoBody.omit({ facultadId: true })) },
      responses: { 200: ok(TipoTramite), ...comunes },
    }),
    async (c) => c.json(await tipoPorId(await actualizarTipo(deps, c.get("usuario"), c.req.valid("param").id, c.req.valid("json"))), 200),
  );
  app.openapi(
    createRoute({
      method: "delete", path: "/tipos-tramite/{id}", tags: t, summary: "Eliminar tipo de trámite sin solicitudes", security: seg,
      description: "Con solicitudes registradas responde 409: hay que desactivarlo para conservar el historial.",
      request: { params: IdParam },
      responses: { 204: { description: "Eliminado" }, ...comunes },
    }),
    async (c) => {
      await eliminarTipo(deps, c.get("usuario"), c.req.valid("param").id);
      return c.body(null, 204);
    },
  );

  // --- Facultades y escuelas ------------------------------------------------
  app.openapi(
    createRoute({ method: "get", path: "/facultades", tags: t, summary: "Facultades (todas para el central, la propia para el resto)", security: seg, responses: { 200: ok(z.array(FacultadAdmin)), ...comunes } }),
    async (c) => c.json(await listarFacultadesAdmin(deps, c.get("usuario")), 200),
  );
  app.openapi(
    createRoute({ method: "post", path: "/facultades", tags: t, summary: "Crear facultad (central)", security: seg, request: { body: jsonBody(FacultadBody) }, responses: { 201: ok(Ok), ...comunes } }),
    async (c) => {
      await guardarFacultad(deps, c.get("usuario"), null, c.req.valid("json"));
      return c.json({ ok: true as const }, 201);
    },
  );
  app.openapi(
    createRoute({ method: "put", path: "/facultades/{id}", tags: t, summary: "Editar o desactivar facultad (central)", security: seg, request: { params: IdParam, body: jsonBody(FacultadBody) }, responses: { 200: ok(Ok), ...comunes } }),
    async (c) => {
      await guardarFacultad(deps, c.get("usuario"), c.req.valid("param").id, c.req.valid("json"));
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({ method: "post", path: "/facultades/{id}/escuelas", tags: t, summary: "Agregar escuela profesional (central)", security: seg, request: { params: IdParam, body: jsonBody(EscuelaBody) }, responses: { 201: ok(Ok), ...comunes } }),
    async (c) => {
      await guardarEscuela(deps, c.get("usuario"), c.req.valid("param").id, null, c.req.valid("json"));
      return c.json({ ok: true as const }, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "put", path: "/facultades/{id}/escuelas/{escuelaId}", tags: t, summary: "Editar escuela profesional (central)", security: seg,
      request: { params: IdParam.extend({ escuelaId: z.coerce.number().int().positive() }), body: jsonBody(EscuelaBody) },
      responses: { 200: ok(Ok), ...comunes },
    }),
    async (c) => {
      const { id, escuelaId } = c.req.valid("param");
      await guardarEscuela(deps, c.get("usuario"), id, escuelaId, c.req.valid("json"));
      return c.json({ ok: true as const }, 200);
    },
  );

  return app;
}
