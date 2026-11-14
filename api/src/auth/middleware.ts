import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { cookieSegura } from "../config/env.js";
import { usuarios, type Rol } from "../db/schema.js";
import type { AppEnv, Deps } from "../lib/context.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { verificarToken } from "./jwt.js";

// La interfaz web usa una cookie HttpOnly (JavaScript no puede leer el token,
// así un XSS no lo roba). Los clientes de API (Swagger, curl, pruebas) pueden
// seguir enviando "Authorization: Bearer".
export const COOKIE_SESION = "nf_sesion";
// Cabecera que exige la API a toda petición con cookie que modifique datos. Un
// sitio ajeno no puede agregarla sin pasar por CORS, así que bloquea el CSRF.
export const CABECERA_CSRF = "x-nexusfisi";
const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

export function segundos(expiresIn: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(expiresIn.trim());
  if (!m) return 8 * 3600;
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as "s" | "m" | "h" | "d"];
}

export function fijarCookieSesion(c: Context, deps: Deps, token: string) {
  setCookie(c, COOKIE_SESION, token, {
    httpOnly: true,
    secure: cookieSegura(deps.env),
    sameSite: "Lax",
    path: "/api",
    maxAge: segundos(deps.env.JWT_EXPIRES_IN),
  });
}

export function borrarCookieSesion(c: Context, deps: Deps) {
  deleteCookie(c, COOKIE_SESION, { path: "/api", secure: cookieSegura(deps.env) });
}

// Verifica el token y RECARGA al usuario en cada petición: así una cuenta
// desactivada o con contraseña cambiada pierde el acceso al instante.
export const autenticar = (deps: Deps) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header("authorization");
    const porCookie = !header?.startsWith("Bearer ");
    const token = porCookie ? getCookie(c, COOKIE_SESION) : header!.slice(7);
    if (!token) throw unauthorized();
    if (porCookie && !METODOS_SEGUROS.has(c.req.method) && c.req.header(CABECERA_CSRF) !== "1") {
      throw forbidden("Petición rechazada por protección CSRF.");
    }
    const claims = await verificarToken(token, deps.env.JWT_SECRET);
    if (!claims) throw unauthorized("Tu sesión no es válida o expiró. Vuelve a iniciar sesión.");
    const [u] = await deps.db.select().from(usuarios).where(eq(usuarios.id, Number(claims.sub))).limit(1);
    if (!u || !u.activo || u.tokenVersion !== claims.tv) throw unauthorized("Tu sesión ya no es válida. Vuelve a iniciar sesión.");
    c.set("usuario", { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, facultadId: u.facultadId });
    await next();
  });

export const requiereRol = (...roles: Rol[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get("usuario").rol)) throw forbidden();
    await next();
  });
