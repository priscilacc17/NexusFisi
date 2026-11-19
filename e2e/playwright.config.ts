import { defineConfig, devices } from "@playwright/test";

// Pruebas de aceptación contra una instancia real (BASE_URL), con datos demo
// recién sembrados. Corren en serie: comparten la base de datos.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "informe" }]],
  use: {
    baseURL: process.env["BASE_URL"] ?? "http://localhost:8088",
    locale: "es-PE",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive/ },
    { name: "movil", use: { ...devices["Pixel 7"] }, testMatch: /responsive/ },
  ],
});
