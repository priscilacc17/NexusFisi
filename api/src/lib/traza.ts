import { SpanStatusCode, trace } from "@opentelemetry/api";

// Enriquecen la traza de la petición en curso. Sin OpenTelemetry activo (pruebas,
// o sin OTEL_EXPORTER_OTLP_ENDPOINT) no hay span y no hacen nada. El enlace
// log → traza lo pone la instrumentación de pino: cada línea lleva trace_id.

/** Nombra el span HTTP con la ruta de Hono ("GET /api/v1/solicitudes/:codigo"). */
export function nombrarSpan(metodo: string, ruta: string, requestId: string | undefined) {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.updateName(`${metodo} ${ruta}`);
  span.setAttribute("http.route", ruta);
  if (requestId) span.setAttribute("nexus.request_id", requestId);
}

/** Marca la traza como fallida con la excepción (se ve en rojo en Jaeger). */
export function registrarError(err: unknown) {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.recordException(err instanceof Error ? err : new Error(String(err)));
  span.setStatus({ code: SpanStatusCode.ERROR });
}
