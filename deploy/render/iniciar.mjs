// Arranque de la imagen combinada para Render: API + interfaz en un solo servicio.
// La interfaz escucha en $PORT (el que expone Render) y reenvía /api a la API,
// que escucha solo dentro del contenedor. Si cualquiera de los dos procesos se
// cae, se detiene el otro y el contenedor termina: Render lo reinicia completo.
import { spawn } from "node:child_process";

const API_PORT = process.env.API_PORT ?? "4000";
const WEB_PORT = process.env.PORT ?? "10000";

const procesos = [
  spawn("node", ["--import", "./dist/telemetria.js", "dist/index.js"], {
    cwd: "/app/api",
    stdio: "inherit",
    env: { ...process.env, PORT: API_PORT },
  }),
  spawn("node", [".output/server/index.mjs"], {
    cwd: "/app/web",
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: WEB_PORT,
      HOST: "0.0.0.0",
      API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
    },
  }),
];

let saliendo = false;
const terminar = (codigo) => {
  if (saliendo) return;
  saliendo = true;
  for (const p of procesos) if (p.exitCode === null) p.kill("SIGTERM");
  setTimeout(() => process.exit(codigo), 8000).unref();
};
for (const p of procesos) p.on("exit", (code) => terminar(code ?? 1));
for (const s of ["SIGTERM", "SIGINT"]) process.on(s, () => terminar(0));
