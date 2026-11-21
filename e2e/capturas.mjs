// Capturas de evidencia de la Fase IV (no es una prueba; se ejecuta a mano).
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
const out = path.resolve("../docs/evidencias/fase4");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const foto = async (n, full = false) => {
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${n}.png`, fullPage: full });
  console.log(n);
};

// Grafana
await p.goto("http://localhost:3001/login");
await p.fill('input[name="user"]', "admin");
await p.fill('input[name="password"]', process.env.GP);
await p.click('button[type="submit"]');
await p.waitForURL(/\/(\?|$)|change-password|home/, { timeout: 15000 }).catch(() => {});
if (p.url().includes("change-password")) await p.click("text=Skip").catch(() => {});
await p.goto("http://localhost:3001/d/nexus?orgId=1&from=now-30m&to=now");
await p.getByText("API disponible").first().waitFor({ timeout: 30000 });
await p.setViewportSize({ width: 1440, height: 1500 });
await p.waitForTimeout(8000);
await foto("grafana-tablero");
await p.setViewportSize({ width: 1440, height: 900 });

// Prometheus
await p.goto("http://localhost:9090/alerts?search=");
await foto("prometheus-alertas", true);
await p.goto("http://localhost:9090/targets");
await foto("prometheus-objetivos");

// Jaeger
await p.goto("http://localhost:16686/search?service=nexus-api&limit=20&lookback=1h");
await foto("jaeger-busqueda");
if (process.env.TRAZA) {
  await p.goto(`http://localhost:16686/trace/${process.env.TRAZA}`);
  await foto("jaeger-traza");
}

// Informes
await p.goto(pathToFileURL(path.resolve("../perf/zap/api.html")).href);
await foto("zap-api");
await p.goto(pathToFileURL(path.resolve("../perf/zap/baseline.html")).href);
await foto("zap-baseline");
await p.goto(pathToFileURL(path.resolve("informe/index.html")).href);
await foto("playwright-informe");
await b.close();
