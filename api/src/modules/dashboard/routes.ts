import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { autenticar } from "../../auth/middleware.js";
import type { AppEnv, Deps } from "../../lib/context.js";
import { errores, ok } from "../../lib/openapi.js";
import { resumen } from "./service.js";

const Conteo = z.object({ clave: z.string(), total: z.number().int() });
const Resumen = z
  .object({
    total: z.number().int(),
    pendientes: z.number().int(),
    atendidas: z.number().int(),
    vencidas: z.number().int(),
    desistidas: z.number().int(),
    porcentajeResueltas: z.number().nullable(),
    tiempoPromedioHoras: z.number().nullable(),
    porEstado: z.array(Conteo),
    porPrioridad: z.array(Conteo),
    porTipo: z.array(Conteo),
    porResponsable: z.array(z.object({ id: z.number().int(), nombre: z.string(), total: z.number().int(), pendientes: z.number().int(), resueltas: z.number().int() })),
    porFacultad: z.array(Conteo),
  })
  .openapi("Dashboard");

export function dashboardRoutes(deps: Deps) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", autenticar(deps));
  app.openapi(
    createRoute({
      method: "get", path: "/", tags: ["Dashboard"], summary: "Indicadores de atención", security: [{ bearerAuth: [] }],
      request: { query: z.object({ facultadId: z.coerce.number().int().positive().optional() }) },
      responses: { 200: ok(Resumen), 401: errores[401] },
    }),
    async (c) => c.json(await resumen(deps, c.get("usuario"), c.req.valid("query").facultadId), 200),
  );
  return app;
}
