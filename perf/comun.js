// Utilidades compartidas por los escenarios de k6.
import http from "k6/http";
import { check } from "k6";

export const BASE = __ENV.BASE_URL || "http://api:4000";
const USUARIOS = [
  "supervisor.fisi",
  "tecnico.fisi",
  "estudiante.fisi",
  "estudiante2.fisi",
  "admin.fisi",
  "supervisor.fm",
  "estudiante.fm",
];

// Un inicio de sesión por usuario al empezar (no por iteración): mide el uso
// normal del sistema, no el login, que tiene su propio límite de intentos.
export function iniciarSesiones() {
  const tokens = [];
  for (const u of USUARIOS) {
    const r = http.post(
      `${BASE}/api/v1/auth/login`,
      JSON.stringify({ email: `${u}@unmsm.edu.pe`, password: "Demo1234" }),
      { headers: { "content-type": "application/json" } },
    );
    if (r.status === 200) tokens.push({ usuario: u, token: r.json("token") });
  }
  if (tokens.length === 0) throw new Error("No se pudo iniciar sesión con ninguna cuenta demo");
  return { tokens };
}

// Recorrido típico de un usuario: bandeja o mis solicitudes, panel, detalle y notificaciones.
export function navegar(data) {
  const s = data.tokens[(__VU + __ITER) % data.tokens.length];
  const h = { headers: { authorization: `Bearer ${s.token}` }, tags: {} };
  const get = (ruta, nombre) => {
    h.tags.name = nombre;
    const r = http.get(`${BASE}/api/v1${ruta}`, h);
    check(r, { [`${nombre} 2xx`]: (x) => x.status >= 200 && x.status < 300 });
    return r;
  };
  const lista = get("/solicitudes?size=15&orden=prioridad", "GET /solicitudes");
  get("/dashboard", "GET /dashboard");
  const items = lista.status === 200 ? lista.json("items") : [];
  if (items && items.length)
    get(`/solicitudes/${items[__ITER % items.length].codigo}`, "GET /solicitudes/:codigo");
  get("/notificaciones", "GET /notificaciones");
  get("/tipos-tramite", "GET /tipos-tramite");
}

export function resumen(nombre) {
  return (data) => {
    const m = data.metrics;
    const v = (k, s) => (m[k] && m[k].values ? m[k].values[s] : null);
    const r = {
      escenario: nombre,
      fecha: new Date().toISOString(),
      peticiones: v("http_reqs", "count"),
      peticiones_por_segundo: v("http_reqs", "rate"),
      latencia_ms: {
        promedio: v("http_req_duration", "avg"),
        p90: v("http_req_duration", "p(90)"),
        p95: v("http_req_duration", "p(95)"),
        max: v("http_req_duration", "max"),
      },
      tasa_error: v("http_req_failed", "rate"),
      checks_ok: v("checks", "rate"),
      vus_max: v("vus_max", "max"),
      umbrales_ok: Object.values(m).every(
        (x) => !x.thresholds || Object.values(x.thresholds).every((t) => t.ok),
      ),
    };
    return {
      [`/resultados/${nombre}.json`]: JSON.stringify(r, null, 2),
      stdout: `\n${JSON.stringify(r, null, 2)}\n`,
    };
  };
}
