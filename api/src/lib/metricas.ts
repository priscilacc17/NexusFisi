import { sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import client from "prom-client";
import type { Db } from "../db/client.js";
import { solicitudes } from "../db/schema.js";
import { nombrarSpan } from "./traza.js";

// Métricas en formato Prometheus (/api/v1/metrics).
//  · Técnicas: peticiones y latencia por ruta y código, más las del proceso Node
//    (memoria, CPU, event loop, GC).
//  · De negocio: solicitudes por estado y vencidas, calculadas al momento de leerlas.
//
// La etiqueta de ruta es el PATRÓN (/api/v1/solicitudes/:codigo), nunca la URL
// real: con un código por expediente, la cantidad de series crecería sin límite.
export function crearMetricas(db: Db) {
  const registro = new client.Registry();
  registro.setDefaultLabels({ servicio: "nexusfisi-api" });
  client.collectDefaultMetrics({ register: registro, prefix: "nexusfisi_" });

  const peticiones = new client.Counter({
    name: "nexusfisi_http_peticiones_total",
    help: "Peticiones HTTP atendidas",
    labelNames: ["metodo", "ruta", "estado"] as const,
    registers: [registro],
  });
  const duracion = new client.Histogram({
    name: "nexusfisi_http_duracion_segundos",
    help: "Duración de las peticiones HTTP",
    labelNames: ["metodo", "ruta", "estado"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registro],
  });
  new client.Gauge({
    name: "nexusfisi_solicitudes",
    help: "Solicitudes por estado",
    labelNames: ["estado"] as const,
    registers: [registro],
    async collect() {
      this.reset();
      const filas = await db
        .select({ estado: solicitudes.estado, n: sql<number>`COUNT(*)` })
        .from(solicitudes)
        .groupBy(solicitudes.estado);
      for (const f of filas) this.set({ estado: f.estado }, Number(f.n));
    },
  });
  new client.Gauge({
    name: "nexusfisi_solicitudes_vencidas",
    help: "Solicitudes pendientes que superaron su plazo",
    registers: [registro],
    async collect() {
      const [f] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(solicitudes)
        .where(
          sql`${solicitudes.estado} NOT IN ('RESUELTA','CERRADA') AND ${solicitudes.fechaLimite} < UTC_TIMESTAMP(3)`,
        );
      this.set(Number(f?.n ?? 0));
    },
  });

  const medir = createMiddleware(async (c, next) => {
    const fin = duracion.startTimer();
    try {
      await next();
    } finally {
      // La última ruta que coincidió es el endpoint real (las anteriores son middlewares "/*").
      const rutas = c.req.matchedRoutes.filter((r) => r.method !== "ALL");
      const ruta = rutas.at(-1)?.path ?? "sin-ruta";
      const etiquetas = { metodo: c.req.method, ruta, estado: String(c.res.status) };
      peticiones.inc(etiquetas);
      if (rutas.length) nombrarSpan(c.req.method, ruta, c.get("requestId"));
      fin(etiquetas);
    }
  });

  return { registro, medir };
}
