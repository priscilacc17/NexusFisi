import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createMiddleware } from "hono/factory";
import { AppError } from "./errors.js";

// Límite de peticiones en memoria por IP. Suficiente para una sola instancia de
// la API; el gateway nginx aplica además su propio límite por delante.
export function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
  }
  try {
    return getConnInfo(c).remote.address ?? "desconocida";
  } catch {
    return "desconocida";
  }
}

// `porCuenta` agrega al conteo el correo enviado: en una universidad muchas
// personas comparten la IP pública del campus, y un límite solo por IP haría
// que unos bloqueen a otros.
export function rateLimit(opts: { ventanaMs: number; max: number; trustProxy: boolean; clave: string; porCuenta?: boolean }) {
  const hits = new Map<string, { n: number; reinicio: number }>();
  return createMiddleware(async (c, next) => {
    const ahora = Date.now();
    let cuenta = "";
    if (opts.porCuenta) {
      const body = (await c.req.json().catch(() => ({}))) as { email?: unknown };
      cuenta = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";
    }
    const key = `${opts.clave}:${clientIp(c, opts.trustProxy)}:${cuenta}`;
    const h = hits.get(key);
    if (!h || h.reinicio <= ahora) {
      hits.set(key, { n: 1, reinicio: ahora + opts.ventanaMs });
    } else if (++h.n > opts.max) {
      c.header("Retry-After", String(Math.ceil((h.reinicio - ahora) / 1000)));
      throw new AppError(429, "DEMASIADAS_PETICIONES", "Demasiados intentos. Espera un momento antes de volver a intentar.");
    }
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reinicio <= ahora) hits.delete(k);
    await next();
  });
}
