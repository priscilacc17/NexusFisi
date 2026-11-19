import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, olvidarTokens, prepararApp, type Contexto } from "./helpers.js";

let ctx: Contexto;
beforeAll(async () => {
  olvidarTokens();
  ctx = await prepararApp();
});
afterAll(() => ctx.database.close());

describe("métricas Prometheus", () => {
  it("cuenta peticiones por PATRÓN de ruta (no por URL) y expone métricas de negocio", async () => {
    const sup = await login(ctx, "supervisor.fisi");
    await api(ctx, "GET", "/solicitudes/FISI-2026-00006", { token: sup });
    await api(ctx, "GET", "/solicitudes/FISI-2026-00005", { token: sup });
    const r = await ctx.app.request("/api/v1/metrics");
    const texto = await r.text();
    expect(r.status).toBe(200);
    expect(texto).toMatch(
      /nexusfisi_http_peticiones_total\{[^}]*ruta="\/api\/v1\/solicitudes\/:codigo"[^}]*\} 2/,
    );
    expect(texto).not.toContain("FISI-2026-00006");
    expect(texto).toMatch(/nexusfisi_solicitudes\{[^}]*estado="OBSERVADA"[^}]*\} \d+/);
    expect(texto).toMatch(/nexusfisi_solicitudes_vencidas\{[^}]*\} \d+/);
    expect(texto).toContain("nexusfisi_process_resident_memory_bytes");
  });
});

describe("identificador de petición", () => {
  it("reutiliza el X-Request-Id del gateway y descarta uno con forma inválida", async () => {
    const valido = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
    const r1 = await ctx.app.request("/api/v1/health", { headers: { "x-request-id": valido } });
    expect(r1.headers.get("x-request-id")).toBe(valido);
    const malo = 'x {"nivel":"fatal","msg":"falso"}';
    const r2 = await ctx.app.request("/api/v1/health", { headers: { "x-request-id": malo } });
    expect(r2.headers.get("x-request-id")).not.toBe(malo);
    expect(r2.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("protección del endpoint de métricas", () => {
  let prod: Contexto;
  beforeAll(async () => {
    prod = await prepararApp({
      NODE_ENV: "production",
      METRICS_TOKEN: "token-de-metricas-de-prueba",
    });
  });
  afterAll(() => prod.database.close());

  it("exige el token de Prometheus", async () => {
    expect((await prod.app.request("/api/v1/metrics")).status).toBe(401);
    const ok = await prod.app.request("/api/v1/metrics", {
      headers: { authorization: "Bearer token-de-metricas-de-prueba" },
    });
    expect(ok.status).toBe(200);
  });
});
