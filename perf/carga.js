// PRUEBA DE CARGA: uso esperado en hora punta de una facultad grande.
// 50 usuarios simultáneos navegando durante 3 minutos.
// Criterio: p95 < 500 ms y menos de 1 % de errores.
import { sleep } from "k6";
import { iniciarSesiones, navegar, resumen } from "./comun.js";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "3m", target: 50 },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};
export const setup = iniciarSesiones;
export default function (data) {
  navegar(data);
  sleep(1 + Math.random() * 2); // tiempo de lectura de un usuario real
}
export const handleSummary = resumen("carga");
