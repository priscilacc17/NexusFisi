import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { autenticar } from "../../auth/middleware.js";
import { areas, escuelas, facultades, tiposTramite } from "../../db/schema.js";
import { facultadDeAlcance } from "../../lib/alcance.js";
import type { AppEnv, Deps } from "../../lib/context.js";
import { errores, ok, Ref } from "../../lib/openapi.js";

const FacultadConEscuelas = z
  .object({ id: z.number().int(), codigo: z.string(), nombre: z.string(), activa: z.boolean(), escuelas: z.array(Ref) })
  .openapi("Facultad");

export const TipoTramite = z
  .object({
    id: z.number().int(),
    facultadId: z.number().int(),
    nombre: z.string(),
    descripcion: z.string(),
    requisitos: z.array(z.string()),
    plazoDias: z.number().int(),
    activo: z.boolean(),
    area: z.object({ id: z.number().int(), nombre: z.string(), ubicacion: z.string() }),
  })
  .openapi("TipoTramite");

export const Area = z
  .object({ id: z.number().int(), facultadId: z.number().int(), nombre: z.string(), ubicacion: z.string(), activa: z.boolean() })
  .openapi("Area");

const FiltroFacultad = z.object({
  facultadId: z.coerce.number().int().positive().optional().openapi({ description: "Solo administrador central; el resto ve su facultad." }),
  incluirInactivos: z.enum(["true", "false"]).optional(),
});

export async function obtenerTipo(deps: Deps, id: number) {
  return (await listarTipos(deps, null, true, id))[0];
}

export async function listarTipos(deps: Deps, facultadId: number | null, incluirInactivos: boolean, id?: number) {
  const filas = await deps.db
    .select({ t: tiposTramite, a: { id: areas.id, nombre: areas.nombre, ubicacion: areas.ubicacion } })
    .from(tiposTramite)
    .innerJoin(areas, eq(areas.id, tiposTramite.areaId))
    .where(and(id ? eq(tiposTramite.id, id) : undefined, facultadId ? eq(tiposTramite.facultadId, facultadId) : undefined, incluirInactivos ? undefined : eq(tiposTramite.activo, true)))
    .orderBy(asc(tiposTramite.nombre));
  return filas.map(({ t, a }) => ({ id: t.id, facultadId: t.facultadId, nombre: t.nombre, descripcion: t.descripcion, requisitos: t.requisitos, plazoDias: t.plazoDias, activo: t.activo, area: a }));
}

export function catalogoRoutes(deps: Deps) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("/tipos-tramite", autenticar(deps));
  app.use("/areas", autenticar(deps));

  app.openapi(
    createRoute({
      method: "get", path: "/facultades", tags: ["Catálogo"], summary: "Facultades activas con sus escuelas",
      description: "Público: lo usa el formulario de registro.",
      responses: { 200: ok(z.array(FacultadConEscuelas)) },
    }),
    async (c) => {
      const facs = await deps.db.select().from(facultades).where(eq(facultades.activa, true)).orderBy(asc(facultades.nombre));
      const escs = await deps.db.select().from(escuelas).where(eq(escuelas.activa, true)).orderBy(asc(escuelas.nombre));
      return c.json(
        facs.map((f) => ({ id: f.id, codigo: f.codigo, nombre: f.nombre, activa: f.activa, escuelas: escs.filter((e) => e.facultadId === f.id).map((e) => ({ id: e.id, nombre: e.nombre })) })),
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get", path: "/tipos-tramite", tags: ["Catálogo"], summary: "Tipos de trámite de la facultad", security: [{ bearerAuth: [] }],
      request: { query: FiltroFacultad },
      responses: { 200: ok(z.array(TipoTramite)), 401: errores[401] },
    }),
    async (c) => {
      const u = c.get("usuario");
      const q = c.req.valid("query");
      // Solo el personal y los administradores ven los inactivos (para gestionarlos).
      const inactivos = q.incluirInactivos === "true" && u.rol !== "ESTUDIANTE";
      return c.json(await listarTipos(deps, facultadDeAlcance(u, q.facultadId), inactivos), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get", path: "/areas", tags: ["Catálogo"], summary: "Áreas responsables de la facultad", security: [{ bearerAuth: [] }],
      request: { query: FiltroFacultad },
      responses: { 200: ok(z.array(Area)), 401: errores[401] },
    }),
    async (c) => {
      const u = c.get("usuario");
      const q = c.req.valid("query");
      const fac = facultadDeAlcance(u, q.facultadId);
      const filas = await deps.db
        .select()
        .from(areas)
        .where(and(fac ? eq(areas.facultadId, fac) : undefined, q.incluirInactivos === "true" ? undefined : eq(areas.activa, true)))
        .orderBy(asc(areas.nombre));
      return c.json(filas, 200);
    },
  );

  return app;
}
