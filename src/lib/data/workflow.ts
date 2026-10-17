import type { Request, Status } from "./types";

// Transiciones permitidas para el personal administrativo.
// "Asignada" se alcanza al asignar un responsable (no con un cambio de estado directo).
export const TRANSITIONS: Record<Status, Status[]> = {
  Registrada: ["En evaluación"],
  "En evaluación": ["Observada", "Asignada"],
  Observada: [], // vuelve a "En evaluación" cuando el estudiante corrige
  Asignada: ["En atención"],
  "En atención": ["Observada", "Resuelta"],
  Resuelta: ["Cerrada"],
  Cerrada: [],
};

// Texto de los botones de acción para cada estado destino.
export const ACTION_LABEL: Record<Status, string> = {
  Registrada: "Registrar",
  "En evaluación": "Iniciar evaluación",
  Observada: "Observar / solicitar corrección",
  Asignada: "Asignar",
  "En atención": "Iniciar atención",
  Resuelta: "Marcar como resuelta",
  Cerrada: "Cerrar expediente",
};

export function canTransition(from: Status, to: Status) {
  return TRANSITIONS[from].includes(to);
}

// Devuelve el motivo por el que no se puede pasar al estado indicado, o null si es válido.
export function transitionBlocker(r: Pick<Request, "status" | "assigneeId" | "response">, to: Status, note?: string): string | null {
  if (!canTransition(r.status, to)) return `No se puede pasar de "${r.status}" a "${to}".`;
  if (to === "Asignada" && !r.assigneeId) return "Asigna un responsable primero.";
  if (to === "Observada" && !note?.trim()) return "Describe la observación para el estudiante.";
  if (to === "Resuelta" && !r.response?.trim()) return "Registra una respuesta antes de resolver.";
  return null;
}

export function studentCanCorrect(status: Status) {
  return status === "Observada";
}

export const isFinished = (s: Status) => s === "Resuelta" || s === "Cerrada";
