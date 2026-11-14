import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, desc, eq } from "drizzle-orm";
import { autenticar } from "../../auth/middleware.js";
import { notificaciones, solicitudes } from "../../db/schema.js";
import type { AppEnv, Deps } from "../../lib/context.js";
import { errores, IdParam, Ok, ok } from "../../lib/openapi.js";
import { marcarLeidas } from "./service.js";

const Notificacion = z
  .object({ id: z.number().int(), texto: z.string(), leida: z.boolean(), createdAt: z.string(), solicitudCodigo: z.string().nullable() })
  .openapi("Notificacion");

export function notificacionesRoutes(deps: Deps) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", autenticar(deps));
  const seg = [{ bearerAuth: [] }];

  app.openapi(
    createRoute({
      method: "get", path: "/", tags: ["Notificaciones"], summary: "Últimas notificaciones del usuario", security: seg,
      responses: { 200: ok(z.object({ items: z.array(Notificacion), noLeidas: z.number().int() }).openapi("Notificaciones")), 401: errores[401] },
    }),
    async (c) => {
      const uid = c.get("usuario").id;
      const [items, [nl]] = await Promise.all([
        deps.db
          .select({ n: notificaciones, codigo: solicitudes.codigo })
          .from(notificaciones)
          .leftJoin(solicitudes, eq(solicitudes.id, notificaciones.solicitudId))
          .where(eq(notificaciones.usuarioId, uid))
          .orderBy(desc(notificaciones.createdAt), desc(notificaciones.id))
          .limit(30),
        deps.db.select({ n: count() }).from(notificaciones).where(and(eq(notificaciones.usuarioId, uid), eq(notificaciones.leida, false))),
      ]);
      return c.json(
        {
          items: items.map(({ n, codigo }) => ({ id: n.id, texto: n.texto, leida: n.leida, createdAt: n.createdAt.toISOString(), solicitudCodigo: codigo })),
          noLeidas: nl?.n ?? 0,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({ method: "post", path: "/{id}/leida", tags: ["Notificaciones"], summary: "Marcar una como leída", security: seg, request: { params: IdParam }, responses: { 200: ok(Ok) } }),
    async (c) => {
      // Solo marca si la notificación es del usuario: el filtro por usuario_id va en el WHERE.
      await marcarLeidas(deps.db, c.get("usuario").id, [c.req.valid("param").id]);
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({ method: "post", path: "/leer-todas", tags: ["Notificaciones"], summary: "Marcar todas como leídas", security: seg, responses: { 200: ok(Ok) } }),
    async (c) => {
      await marcarLeidas(deps.db, c.get("usuario").id);
      return c.json({ ok: true as const }, 200);
    },
  );

  return app;
}
