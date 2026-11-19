// PRUEBA DE ESTRÉS: se sube la concurrencia por escalones hasta muy por encima
// de lo esperado, sin pausas entre peticiones, para encontrar el punto en que
// el servicio se degrada y comprobar que se recupera al bajar la carga.
import { iniciarSesiones, navegar, resumen } from "./comun.js";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "45s", target: 100 },
    { duration: "45s", target: 200 },
    { duration: "45s", target: 300 },
    { duration: "30s", target: 0 },
  ],
  // Umbrales informativos: aquí se busca el límite, no aprobar.
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.05"],
  },
};
export const setup = iniciarSesiones;
export default function (data) {
  navegar(data);
}
export const handleSummary = resumen("estres");
