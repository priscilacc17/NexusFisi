import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Despliegue sin gateway (Render): este mismo servidor reenvía /api/* a la API.
// Así navegador, interfaz, API y cookie de sesión comparten un solo origen.
// En la VM el gateway nginx atiende /api antes de llegar aquí.
// ---------------------------------------------------------------------------
const entorno = (k: string): string | undefined =>
  typeof process !== "undefined" ? process.env[k] : undefined;
// Acepta "http://host:puerto" o solo "host:puerto" (como lo entrega Render con fromService.hostport).
const apiInterna = entorno("API_INTERNAL_URL");
const API_INTERNAL_URL =
  apiInterna && !apiInterna.includes("://") ? `http://${apiInterna}` : apiInterna;
const PRODUCCION = entorno("NODE_ENV") === "production";

async function reenviarApi(request: Request, base: string): Promise<Response> {
  const entrada = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", entrada.host);
  headers.set(
    "x-forwarded-proto",
    request.headers.get("x-forwarded-proto") ?? entrada.protocol.replace(":", ""),
  );
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }
  try {
    const r = await fetch(new URL(entrada.pathname + entrada.search, base), init);
    const h = new Headers(r.headers);
    // fetch ya descomprimió el cuerpo: esas cabeceras dejarían de ser ciertas.
    h.delete("content-encoding");
    h.delete("content-length");
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  } catch (error) {
    console.error("API no disponible", error);
    return Response.json(
      {
        type: "about:blank",
        title: "API_NO_DISPONIBLE",
        status: 502,
        detail: "El servidor de NEXUS no está disponible. Intenta en unos minutos.",
      },
      { status: 502, headers: { "content-type": "application/problem+json" } },
    );
  }
}

// Cabeceras de seguridad. La CSP lleva un nonce distinto en cada petición: solo
// se ejecutan los scripts en línea que el propio servidor marcó (sin
// 'unsafe-inline'). En desarrollo no se aplica, porque Vite inyecta los suyos.
export function noncesPorPeticion(): WeakMap<Request, string> {
  const g = globalThis as { __nexusNonces?: WeakMap<Request, string> };
  return (g.__nexusNonces ??= new WeakMap());
}

function nonceNuevo(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function conCabecerasSeguras(response: Response, nonce: string, https: boolean): Response {
  const r = new Response(response.body, response);
  r.headers.set("X-Content-Type-Options", "nosniff");
  r.headers.set("X-Frame-Options", "DENY");
  r.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  r.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (https) r.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (PRODUCCION && (r.headers.get("content-type") ?? "").includes("text/html")) {
    r.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join("; "),
    );
  }
  return r;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (API_INTERNAL_URL && url.pathname.startsWith("/api/"))
      return reenviarApi(request, API_INTERNAL_URL);
    const https =
      (request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")) === "https";
    const nonce = nonceNuevo();
    // El router lo lee asociado a ESTA petición (ver router.tsx). No se clona la
    // petición: TanStack Start necesita el objeto original de su servidor.
    noncesPorPeticion().set(request, nonce);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return conCabecerasSeguras(await normalizeCatastrophicSsrResponse(response), nonce, https);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
