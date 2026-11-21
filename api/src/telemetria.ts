// Trazas distribuidas con OpenTelemetry. Se carga ANTES que la aplicación
// (node --import ./dist/telemetria.js dist/index.js) para poder instrumentar
// http, mysql2 y pino cuando se importan.
//
// Solo se activa si hay un colector configurado (OTEL_EXPORTER_OTLP_ENDPOINT,
// p. ej. Jaeger u OpenTelemetry Collector). Sin él no se carga nada: en Render
// gratis la memoria es escasa y no hay colector.
import { register } from "node:module";

const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

if (endpoint && process.env["OTEL_SDK_DISABLED"] !== "true") {
  // Permite instrumentar módulos ESM (import), no solo los de require().
  register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
  const { resourceFromAttributes } = await import("@opentelemetry/resources");

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": process.env["OTEL_SERVICE_NAME"] ?? "nexus-api",
      "service.version": process.env["npm_package_version"] ?? "1.0.0",
      "deployment.environment": process.env["NODE_ENV"] ?? "development",
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Ruido sin valor diagnóstico para esta aplicación.
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
      }),
    ],
  });
  sdk.start();
  const apagar = () => void sdk.shutdown().catch(() => undefined);
  process.once("SIGTERM", apagar);
  process.once("SIGINT", apagar);
  console.log(`OpenTelemetry activo → ${endpoint}`);
}
