import type { Status } from "./types";

// Transiciones permitidas para el personal administrativo.
export const TRANSITIONS: Record<Status, Status[]> = {
  Registrada: ["En evaluación"],
  "En evaluación": ["Observada", "Asignada"],
  Observada: [], // vuelve a "En evaluación" cuando el estudiante corrige
  Asignada: ["En atención"],
  "En atención": ["Observada", "Resuelta"],
  Resuelta: ["Cerrada"],
  Cerrada: [],
};

export function canTransition(from: Status, to: Status) {
  return TRANSITIONS[from].includes(to);
}

export function studentCanCorrect(status: Status) {
  return status === "Observada";
}
