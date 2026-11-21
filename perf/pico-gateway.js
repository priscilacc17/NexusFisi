// PICO CONTRA EL GATEWAY: 150 clientes desde una misma IP sin pausas.
// Se espera que nginx corte el exceso con 429 (límite de 20 peticiones/s por IP)
// y que la API detrás siga respondiendo rápido a lo que sí deja pasar.
import http from "k6/http";
import { check } from "k6";
import { resumen } from "./comun.js";

export const options = {
  stages: [
    { duration: "15s", target: 150 },
    { duration: "30s", target: 150 },
    { duration: "10s", target: 0 },
  ],
};
const BASE = __ENV.BASE_URL || "http://gateway";
export default function () {
  const r = http.get(`${BASE}/api/v1/facultades`, { tags: { name: "GET /facultades" } });
  check(r, {
    "200 o 429": (x) => x.status === 200 || x.status === 429,
    "limitado (429)": (x) => x.status === 429,
  });
}
export const handleSummary = resumen("pico-gateway");
