import { randomUUID } from "node:crypto";
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { sql } from "drizzle-orm";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv, Deps } from "./lib/context.js";
import { AppError } from "./lib/errors.js";
import { authRoutes } from "./modules/auth/routes.js";
import { catalogoRoutes } from "./modules/catalogo/routes.js";
import { solicitudesRoutes } from "./modules/solicitudes/routes.js";
import { notificacionesRoutes } from "./modules/notificaciones/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";

export const API_PREFIX = "/api/v1";

const problem = (status: number, title: string, detail: string, errors?: Record<string, string>) =>
  new Response(JSON.stringify({ type: "about:blank", title, status, detail, ...(errors ? { errors } : {}) }), {
    status,
    headers: { "content-type": "application/problem+json; charset=utf-8" },
  });

export function createApp(deps: Deps) {
  const app = new OpenAPIHono<AppEnv>({
    // Errores de validación (Zod) con el mismo formato que el resto: campo → mensaje.
    defaultHook: (result) => {
      if (!result.success) {
        const errors: Record<string, string> = {};
        for (const i of result.error.issues) {
          const key = i.path.join(".") || "_";
          errors[key] ??= i.message;
        }
        return problem(400, "SOLICITUD_INVALIDA", "Revisa los campos marcados.", errors);
      }
      return undefined;
    },
  });

  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    const inicio = performance.now();
    await next();
    deps.logger.info({ requestId, method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - inicio) }, "request");
  });
  app.use("*", secureHeaders({ crossOriginResourcePolicy: "same-site" }));
  app.use(`${API_PREFIX}/*`, cors({ origin: deps.env.CORS_ORIGINS, credentials: true, allowHeaders: ["Authorization", "Content-Type", "X-Request-Id", "X-NexusFisi"], exposeHeaders: ["X-Request-Id"], maxAge: 600 }));
  // Límite de cuerpo: JSON pequeño; los adjuntos tienen su propio límite más amplio.
  app.use(`${API_PREFIX}/*`, async (c, next) => {
    const esMultipart = c.req.header("content-type")?.includes("multipart/form-data");
    const max = esMultipart ? deps.env.MAX_UPLOAD_MB * 5 * 1024 * 1024 + 64 * 1024 : 256 * 1024;
    return bodyLimit({ maxSize: max, onError: () => { throw new AppError(413, "CUERPO_DEMASIADO_GRANDE", "El contenido enviado supera el tamaño permitido."); } })(c, next);
  });

  app.onError((err, c) => {
    if (err instanceof AppError) return problem(err.status, err.code, err.message, err.details);
    if (err instanceof HTTPException) return problem(err.status, "HTTP_ERROR", err.message || "Error en la petición.");
    deps.logger.error({ err, requestId: c.get("requestId") }, "error no controlado");
    return problem(500, "ERROR_INTERNO", "Ocurrió un error inesperado. Si persiste, informa el código " + c.get("requestId") + ".");
  });
  app.notFound((c) => problem(404, "NO_ENCONTRADO", `No existe la ruta ${c.req.method} ${c.req.path}.`));

  app.get(`${API_PREFIX}/health`, async (c) => {
    try {
      await deps.db.execute(sql`SELECT 1`);
      return c.json({ status: "ok", db: "ok", time: deps.now().toISOString() });
    } catch {
      return c.json({ status: "degraded", db: "error", time: deps.now().toISOString() }, 503);
    }
  });

  app.route(`${API_PREFIX}/auth`, authRoutes(deps));
  app.route(API_PREFIX, catalogoRoutes(deps));
  app.route(`${API_PREFIX}/solicitudes`, solicitudesRoutes(deps));
  app.route(`${API_PREFIX}/notificaciones`, notificacionesRoutes(deps));
  app.route(`${API_PREFIX}/dashboard`, dashboardRoutes(deps));
  app.route(`${API_PREFIX}/admin`, adminRoutes(deps));

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", { type: "http", scheme: "bearer", bearerFormat: "JWT" });
  app.doc31(`${API_PREFIX}/openapi.json`, {
    openapi: "3.1.0",
    info: {
      title: "NexusFisi API",
      version: "1.0.0",
      description: "API REST para registrar, gestionar y dar seguimiento a los trámites académicos de las facultades de la UNMSM.",
    },
    servers: [{ url: "/", description: "Mismo origen" }],
  });
  app.get("/api/docs", swaggerUI({ url: `${API_PREFIX}/openapi.json` }));

  return app;
}
