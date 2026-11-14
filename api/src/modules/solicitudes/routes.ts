import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { autenticar } from "../../auth/middleware.js";
import { ETAPAS_ADJUNTO, ESTADOS, PRIORIDADES } from "../../db/schema.js";
import type { AppEnv, Deps } from "../../lib/context.js";
import { Accion, CodigoParam, Estado, errores, jsonBody, ok, pagina, Paginacion, Prioridad, Rol, TipoCierre } from "../../lib/openapi.js";
import { adjuntar, crear, descargar, detalle, enviarMensaje, listar, transicion, validarNueva } from "./service.js";

const fecha = z.string().openapi({ format: "date-time" });

const SolicitudResumen = z
  .object({
    codigo: z.string(),
    asunto: z.string(),
    estado: Estado,
    prioridad: Prioridad,
    createdAt: fecha,
    updatedAt: fecha,
    fechaLimite: fecha,
    vencida: z.boolean(),
    tipo: z.object({ id: z.number().int(), nombre: z.string() }),
    facultad: z.object({ id: z.number().int(), codigo: z.string() }),
    estudiante: z.object({ id: z.number().int(), nombre: z.string(), codigoEstudiante: z.string().nullable() }),
    responsable: z.object({ id: z.number().int(), nombre: z.string() }).nullable(),
  })
  .openapi("SolicitudResumen");

const Etapa = z.enum(ETAPAS_ADJUNTO).openapi("EtapaAdjunto");

const SolicitudDetalle = z
  .object({
    codigo: z.string(),
    version: z.number().int().openapi({ description: "Enviar en cada transición (bloqueo optimista)." }),
    asunto: z.string(),
    descripcion: z.string(),
    estado: Estado,
    estadoPrevio: Estado.nullable(),
    prioridad: Prioridad,
    respuesta: z.string().nullable(),
    tipoCierre: TipoCierre.nullable(),
    reaperturas: z.number().int(),
    createdAt: fecha,
    updatedAt: fecha,
    fechaLimite: fecha,
    resueltaAt: fecha.nullable(),
    cerradaAt: fecha.nullable(),
    vencida: z.boolean(),
    facultad: z.object({ id: z.number().int(), codigo: z.string(), nombre: z.string() }),
    tipo: z.object({
      id: z.number().int(),
      nombre: z.string(),
      requisitos: z.array(z.string()),
      plazoDias: z.number().int(),
      area: z.object({ id: z.number().int(), nombre: z.string(), ubicacion: z.string() }),
    }),
    estudiante: z.object({ id: z.number().int(), nombre: z.string(), email: z.string(), codigoEstudiante: z.string().nullable(), escuela: z.string().nullable() }),
    responsable: z.object({ id: z.number().int(), nombre: z.string(), rol: Rol, area: z.string().nullable() }).nullable(),
    adjuntos: z.array(z.object({ id: z.number().int(), nombre: z.string(), mime: z.string(), tamano: z.number().int(), etapa: Etapa, subidoPor: z.string(), createdAt: fecha })),
    observaciones: z.array(z.object({ id: z.number().int(), texto: z.string(), resuelta: z.boolean(), autor: z.string(), createdAt: fecha, resueltaAt: fecha.nullable() })),
    historial: z.array(z.object({ id: z.number().int(), accion: z.string(), estadoDesde: Estado.nullable(), estadoHasta: Estado.nullable(), nota: z.string().nullable(), autor: z.string(), rol: Rol, createdAt: fecha })),
    mensajes: z.array(z.object({ id: z.number().int(), texto: z.string(), autorId: z.number().int(), autor: z.string(), rol: Rol, createdAt: fecha })),
    acciones: z.array(Accion).openapi({ description: "Acciones que el usuario actual puede ejecutar ahora." }),
    puedeAdjuntar: Etapa.nullable(),
    puedeEnviarMensaje: z.boolean(),
    responsablesDisponibles: z.array(z.object({ id: z.number().int(), nombre: z.string(), rol: Rol, area: z.string().nullable(), delArea: z.boolean() })),
  })
  .openapi("SolicitudDetalle");

const Filtros = Paginacion.extend({
  q: z.string().max(80).optional().openapi({ description: "Código, asunto, nombre o código del estudiante" }),
  estado: z.enum(ESTADOS).optional(),
  tipoId: z.coerce.number().int().positive().optional(),
  prioridad: z.enum(PRIORIDADES).optional(),
  facultadId: z.coerce.number().int().positive().optional().openapi({ description: "Solo administrador central" }),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD").optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD").optional(),
  vencidas: z.enum(["true", "false"]).optional(),
  asignadasAMi: z.enum(["true", "false"]).optional(),
  orden: z.enum(["recientes", "prioridad", "vencimiento"]).optional(),
});

const Transicion = z
  .object({
    accion: Accion,
    version: z.number().int().min(0),
    nota: z.string().max(1500).optional(),
    responsableId: z.number().int().positive().optional(),
    prioridad: Prioridad.optional(),
    respuesta: z.string().max(3000).optional(),
  })
  .openapi("TransicionInput");

const Multipart = z
  .object({
    tipoId: z.string().openapi({ example: "1" }),
    asunto: z.string().openapi({ example: "Constancia para beca" }),
    descripcion: z.string(),
    archivos: z.array(z.string().openapi({ format: "binary" })).openapi({ description: "1 a 5 archivos PDF, JPG o PNG" }),
  })
  .openapi("NuevaSolicitudMultipart");

function archivosDe(valor: unknown): File[] {
  const lista = Array.isArray(valor) ? valor : valor === undefined ? [] : [valor];
  return lista.filter((v): v is File => v instanceof File);
}

export function solicitudesRoutes(deps: Deps) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", autenticar(deps));
  const seg = [{ bearerAuth: [] }];

  app.openapi(
    createRoute({
      method: "get", path: "/", tags: ["Solicitudes"], summary: "Listar solicitudes", security: seg,
      description: "El alcance depende del rol: el estudiante ve las suyas, el técnico las que tiene asignadas, supervisor y administrador las de su facultad, y el administrador central todas.",
      request: { query: Filtros },
      responses: { 200: ok(pagina(SolicitudResumen, "PaginaSolicitudes")), 400: errores[400], 401: errores[401] },
    }),
    async (c) => {
      const q = c.req.valid("query");
      return c.json(await listar(deps, c.get("usuario"), { ...q, vencidas: q.vencidas === "true", asignadasAMi: q.asignadasAMi === "true" }), 200);
    },
  );

  // Multipart: se documenta en el registro y se implementa a mano, porque los
  // archivos se validan por contenido y se guardan junto con la solicitud en una
  // sola operación (o se guarda todo, o nada).
  app.openAPIRegistry.registerPath({
    method: "post", path: "/api/v1/solicitudes", tags: ["Solicitudes"], summary: "Registrar solicitud con documentos", security: seg,
    request: { body: { required: true, content: { "multipart/form-data": { schema: Multipart } } } },
    responses: { 201: ok(SolicitudDetalle, "Solicitud registrada"), 400: errores[400], 403: errores[403], 422: errores[422] },
  });
  app.post("/", async (c) => {
    const body = await c.req.parseBody({ all: true });
    const input = validarNueva(body);
    const codigo = await crear(deps, c.get("usuario"), input, archivosDe(body["archivos"]));
    return c.json(await detalle(deps, c.get("usuario"), codigo), 201);
  });

  app.openapi(
    createRoute({
      method: "get", path: "/{codigo}", tags: ["Solicitudes"], summary: "Detalle del expediente", security: seg,
      request: { params: CodigoParam },
      responses: { 200: ok(SolicitudDetalle), 401: errores[401], 404: errores[404] },
    }),
    async (c) => c.json(await detalle(deps, c.get("usuario"), c.req.valid("param").codigo), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/{codigo}/transiciones", tags: ["Solicitudes"], summary: "Ejecutar una acción del flujo", security: seg,
      description: "EVALUAR, OBSERVAR, ASIGNAR, REASIGNAR, INICIAR_ATENCION, RESOLVER, CERRAR, CORREGIR, DESISTIR, REABRIR o PRIORIZAR. Devuelve 409 si la versión no coincide.",
      request: { params: CodigoParam, body: jsonBody(Transicion) },
      responses: { 200: ok(SolicitudDetalle), 400: errores[400], 404: errores[404], 409: errores[409], 422: errores[422] },
    }),
    async (c) => c.json(await transicion(deps, c.get("usuario"), c.req.valid("param").codigo, c.req.valid("json")), 200),
  );

  app.openAPIRegistry.registerPath({
    method: "post", path: "/api/v1/solicitudes/{codigo}/adjuntos", tags: ["Solicitudes"], summary: "Adjuntar documentos", security: seg,
    description: "El estudiante adjunta en la corrección (estado Observada); el personal a cargo adjunta el resultado (En atención).",
    request: { params: CodigoParam, body: { required: true, content: { "multipart/form-data": { schema: z.object({ archivos: Multipart.shape.archivos }) } } } },
    responses: { 201: ok(SolicitudDetalle), 400: errores[400], 404: errores[404], 422: errores[422] },
  });
  app.post("/:codigo/adjuntos", async (c) => {
    const body = await c.req.parseBody({ all: true });
    return c.json(await adjuntar(deps, c.get("usuario"), c.req.param("codigo"), archivosDe(body["archivos"])), 201);
  });

  app.openapi(
    createRoute({
      method: "get", path: "/{codigo}/adjuntos/{id}", tags: ["Solicitudes"], summary: "Descargar un adjunto", security: seg,
      request: { params: CodigoParam.extend({ id: z.coerce.number().int().positive() }) },
      responses: { 200: { description: "Archivo", content: { "application/octet-stream": { schema: z.string().openapi({ format: "binary" }) } } }, 404: errores[404] },
    }),
    async (c) => {
      const { codigo, id } = c.req.valid("param");
      const f = await descargar(deps, c.get("usuario"), codigo, id);
      return new Response(new Uint8Array(f.contenido), {
        status: 200,
        headers: {
          "content-type": f.mime,
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.nombre)}`,
          "x-content-type-options": "nosniff",
          "cache-control": "private, no-store",
        },
      });
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/{codigo}/mensajes", tags: ["Solicitudes"], summary: "Enviar mensaje en el expediente", security: seg,
      request: { params: CodigoParam, body: jsonBody(z.object({ texto: z.string().min(1).max(1000) }).openapi("MensajeInput")) },
      responses: { 201: ok(SolicitudDetalle), 400: errores[400], 403: errores[403], 404: errores[404], 422: errores[422] },
    }),
    async (c) => c.json(await enviarMensaje(deps, c.get("usuario"), c.req.valid("param").codigo, c.req.valid("json").texto), 201),
  );

  return app;
}
