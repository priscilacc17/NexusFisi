import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { autenticar, borrarCookieSesion, fijarCookieSesion } from "../../auth/middleware.js";
import type { AppEnv, Deps } from "../../lib/context.js";
import { notFound } from "../../lib/errors.js";
import { errores, jsonBody, Ok, ok, UsuarioPublico } from "../../lib/openapi.js";
import { rateLimit } from "../../lib/rate-limit.js";
import { usuarioPublico } from "../usuarios/consultas.js";
import { cambiarPassword, login, registrar, restablecerConToken, solicitarRecuperacion } from "./service.js";

const RegistroBody = z
  .object({
    nombre: z.string().trim().min(5, "Ingresa tu nombre completo").max(120),
    email: z.string().trim().email("Correo inválido").max(160).openapi({ example: "nombre.apellido@unmsm.edu.pe" }),
    password: z.string().min(8).max(72),
    codigoEstudiante: z.string().regex(/^\d{8}$/, "El código de estudiante tiene 8 dígitos").openapi({ example: "20231234" }),
    facultadId: z.number().int().positive(),
    escuelaId: z.number().int().positive().optional(),
  })
  .openapi("RegistroInput");

const LoginBody = z
  .object({
    email: z.string().trim().email("Correo inválido").max(160),
    password: z.string().min(1, "Ingresa tu contraseña").max(200),
  })
  .openapi("LoginInput");

const Sesion = z.object({ token: z.string(), usuario: UsuarioPublico }).openapi("Sesion");

export function authRoutes(deps: Deps) {
  const app = new OpenAPIHono<AppEnv>();
  const comun = { ventanaMs: 60_000, trustProxy: deps.env.TRUST_PROXY };
  // Login: por IP + correo. Registro: por IP, con un tope más amplio (campus con IP compartida).
  app.use("/login", rateLimit({ ...comun, max: deps.env.AUTH_RATE_LIMIT, clave: "login", porCuenta: true }));
  app.use("/registro", rateLimit({ ...comun, max: deps.env.AUTH_RATE_LIMIT * 3, clave: "registro" }));
  app.use("/recuperar", rateLimit({ ...comun, max: 3, clave: "recuperar", porCuenta: true }));
  app.use("/restablecer", rateLimit({ ...comun, max: deps.env.AUTH_RATE_LIMIT, clave: "restablecer" }));
  app.use("/me", autenticar(deps));
  app.use("/cambiar-password", autenticar(deps));

  app.openapi(
    createRoute({
      method: "post", path: "/registro", tags: ["Autenticación"], summary: "Registro de estudiantes",
      description: "Crea una cuenta de ESTUDIANTE con correo institucional @unmsm.edu.pe. El personal lo crea un administrador.",
      request: { body: jsonBody(RegistroBody) },
      responses: { 201: ok(UsuarioPublico, "Cuenta creada"), 400: errores[400], 409: errores[409], 422: errores[422] },
    }),
    async (c) => c.json((await registrar(deps, c.req.valid("json")))!, 201),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/login", tags: ["Autenticación"], summary: "Inicio de sesión",
      description: "Abre la sesión en una cookie HttpOnly (la usa la interfaz web) y además devuelve el JWT para clientes de API. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.",
      request: { body: jsonBody(LoginBody) },
      responses: { 200: ok(Sesion), 400: errores[400], 401: errores[401], 403: errores[403], 423: { ...errores[403], description: "Cuenta bloqueada" } },
    }),
    async (c) => {
      const { email, password } = c.req.valid("json");
      const sesion = await login(deps, email, password);
      fijarCookieSesion(c, deps, sesion.token);
      return c.json(sesion, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get", path: "/me", tags: ["Autenticación"], summary: "Usuario de la sesión", security: [{ bearerAuth: [] }],
      responses: { 200: ok(UsuarioPublico), 401: errores[401] },
    }),
    async (c) => {
      const u = await usuarioPublico(deps.db, c.get("usuario").id);
      if (!u) throw notFound();
      return c.json(u, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/cambiar-password", tags: ["Autenticación"], summary: "Cambiar contraseña", security: [{ bearerAuth: [] }],
      description: "Invalida todas las sesiones anteriores y devuelve un token nuevo.",
      request: { body: jsonBody(z.object({ actual: z.string().min(1).max(200), nueva: z.string().min(8).max(72) }).openapi("CambioPassword")) },
      responses: { 200: ok(z.object({ token: z.string() })), 400: errores[400], 401: errores[401] },
    }),
    async (c) => {
      const { actual, nueva } = c.req.valid("json");
      const token = await cambiarPassword(deps, c.get("usuario").id, actual, nueva);
      fijarCookieSesion(c, deps, token);
      return c.json({ token }, 200);
    },
  );

  app.openapi(
    createRoute({ method: "post", path: "/logout", tags: ["Autenticación"], summary: "Cerrar sesión", description: "Borra la cookie de sesión.", responses: { 204: { description: "Sesión cerrada" } } }),
    (c) => {
      borrarCookieSesion(c, deps);
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/recuperar", tags: ["Autenticación"], summary: "Pedir un enlace para restablecer la contraseña",
      description: "Responde siempre lo mismo, exista o no la cuenta. Si existe, envía por correo un enlace válido 30 minutos y de un solo uso.",
      request: { body: jsonBody(z.object({ email: z.string().trim().email("Correo inválido").max(160) }).openapi("RecuperarInput")) },
      responses: { 200: ok(Ok), 400: errores[400], 429: { ...errores[400], description: "Demasiadas solicitudes" } },
    }),
    async (c) => {
      await solicitarRecuperacion(deps, c.req.valid("json").email);
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/restablecer", tags: ["Autenticación"], summary: "Fijar una contraseña nueva con el enlace del correo",
      description: "Cierra todas las sesiones abiertas y desbloquea la cuenta.",
      request: { body: jsonBody(z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(72) }).openapi("RestablecerInput")) },
      responses: { 200: ok(Ok), 400: errores[400] },
    }),
    async (c) => {
      const { token, password } = c.req.valid("json");
      await restablecerConToken(deps, token, password);
      return c.json({ ok: true as const }, 200);
    },
  );

  return app;
}
