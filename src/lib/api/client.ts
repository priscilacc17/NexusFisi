import { cerrarSesion, getSesion } from "../session";

// En producción la API está detrás del mismo gateway (/api/v1). En desarrollo,
// Vite redirige /api a la API local (ver vite.config.ts).
const BASE = ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "/api/v1").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface Opciones {
  json?: unknown;
  form?: FormData;
  query?: Query;
  auth?: boolean;
}

function url(path: string, query?: Query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {}))
    if (v !== undefined && v !== null && v !== "" && v !== false) qs.set(k, String(v));
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ""}`;
}

async function enviar(method: string, path: string, o: Opciones): Promise<Response> {
  // x-nexus: cabecera anti-CSRF que la API exige a toda petición con cookie que modifique datos.
  const headers: Record<string, string> = { accept: "application/json", "x-nexus": "1" };
  const conSesion = o.auth !== false && getSesion() !== null;
  if (o.json !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(url(path, o.query), {
      method,
      headers,
      credentials: "same-origin",
      body: o.form ?? (o.json !== undefined ? JSON.stringify(o.json) : null),
    });
  } catch {
    throw new ApiError(
      0,
      "SIN_CONEXION",
      "No se pudo conectar con el servidor de NEXUS. Revisa tu conexión e inténtalo de nuevo.",
    );
  }
  if (res.ok) return res;
  let problema: { title?: string; detail?: string; errors?: Record<string, string> } = {};
  try {
    problema = await res.json();
  } catch {
    /* respuesta sin cuerpo JSON */
  }
  // Sesión vencida, revocada o cuenta desactivada: se olvida el perfil local.
  if (res.status === 401 && conSesion) cerrarSesion();
  throw new ApiError(
    res.status,
    problema.title ?? "ERROR",
    problema.detail ?? `Error ${res.status} en la petición.`,
    problema.errors ?? {},
  );
}

export async function api<T>(method: string, path: string, o: Opciones = {}): Promise<T> {
  const res = await enviar(method, path, o);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Descarga un archivo protegido: necesita el token, así que no sirve un <a href>.
export async function descargar(path: string, nombre: string) {
  const res = await enviar("GET", path, {});
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export const mensajeDeError = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la acción.";
