// Servicio de datos LOCAL (navegador + localStorage). No hay API ni base de datos real.
// Para integrar Spring Boot + MySQL, reemplaza las funciones de `dataService`
// por llamadas REST manteniendo las mismas firmas.
import { useSyncExternalStore } from "react";
import { createSeed } from "./seed";
import type { DataState, ProcedureType, Request, Status } from "./types";
import { transitionBlocker } from "./workflow";

const KEY = "nexusfisi:data:v1";
let state: DataState = load();
const listeners = new Set<() => void>();

function load(): DataState {
  if (typeof window === "undefined") return createSeed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignorar */ }
  return createSeed();
}
function commit(next: DataState) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignorar */ }
  listeners.forEach((l) => l());
}
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

export function useData<T>(sel: (s: DataState) => T): T {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => sel(state),
    () => sel(state),
  );
}
export const getState = () => state;

function updateRequest(id: string, fn: (r: Request) => Request, notify?: { userId: string; text: string }[]) {
  const notes = (notify ?? []).map((n) => ({ id: uid(), date: now(), read: false, requestId: id, ...n }));
  commit({
    ...state,
    requests: state.requests.map((r) => (r.id === id ? { ...fn(r), updatedAt: now() } : r)),
    notifications: [...notes, ...state.notifications],
  });
}
const staff = () => state.users.filter((u) => u.role === "personal" || u.role === "admin");
const findRequest = (id: string) => {
  const r = state.requests.find((x) => x.id === id);
  if (!r) throw new Error("Solicitud no encontrada");
  return r;
};

export const dataService = {
  createRequest(input: { typeId: string; studentId: string; subject: string; description: string; files: { name: string; size: number }[] }) {
    const seq = state.seq + 1;
    const code = `NF-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
    const r: Request = {
      id: code, code, typeId: input.typeId, studentId: input.studentId, subject: input.subject,
      description: input.description, status: "Registrada", createdAt: now(), updatedAt: now(),
      attachments: input.files.map((f) => ({ id: uid(), name: f.name, size: f.size, uploadedAt: now(), uploadedBy: input.studentId })),
      observations: [], messages: [],
      history: [{ id: uid(), date: now(), userId: input.studentId, action: "Solicitud registrada", to: "Registrada" }],
    };
    commit({
      ...state, seq, requests: [r, ...state.requests],
      notifications: [...staff().map((u) => ({ id: uid(), userId: u.id, date: now(), read: false, requestId: code, text: `Nueva solicitud ${code} registrada.` })), ...state.notifications],
    });
    return r;
  },
  changeStatus(id: string, to: Status, userId: string, note?: string) {
    const r = findRequest(id);
    const reason = transitionBlocker(r, to, note);
    if (reason) throw new Error(reason);
    updateRequest(id, (r) => ({
      ...r, status: to,
      observations: to === "Observada" && note ? [...r.observations, { id: uid(), date: now(), userId, text: note, resolved: false }] : r.observations,
      history: [...r.history, { id: uid(), date: now(), userId, action: to === "Observada" ? "Solicitud observada" : "Cambio de estado", from: r.status, to, note }],
    }), [{ userId: r.studentId, text: `Tu solicitud ${r.code} cambió a "${to}".` }]);
  },
  assign(id: string, assigneeId: string, userId: string) {
    const r = findRequest(id);
    if (r.status !== "En evaluación" && r.status !== "Asignada" && r.status !== "En atención") throw new Error("Solo se asignan solicitudes en evaluación o en curso.");
    const name = state.users.find((u) => u.id === assigneeId)?.name;
    updateRequest(id, (r) => ({
      ...r, assigneeId,
      status: r.status === "En evaluación" ? "Asignada" : r.status,
      history: [...r.history, { id: uid(), date: now(), userId, action: `Responsable asignado: ${name}`, from: r.status, to: r.status === "En evaluación" ? "Asignada" : r.status }],
    }), [{ userId: assigneeId, text: `Se te asignó la solicitud ${r.code}.` }]);
  },
  respond(id: string, response: string, userId: string) {
    const r = findRequest(id);
    if (r.status !== "En atención") throw new Error("La respuesta se registra cuando la solicitud está en atención.");
    updateRequest(id, (r) => ({ ...r, response, history: [...r.history, { id: uid(), date: now(), userId, action: "Respuesta registrada", note: response }] }),
      [{ userId: r.studentId, text: `Hay una respuesta en tu solicitud ${r.code}.` }]);
  },
  submitCorrection(id: string, userId: string, note: string, files: { name: string; size: number }[]) {
    const r = findRequest(id);
    if (r.status !== "Observada" || r.studentId !== userId) throw new Error("Solo el estudiante puede corregir una solicitud observada.");
    updateRequest(id, (r) => ({
      ...r, status: "En evaluación",
      observations: r.observations.map((o) => ({ ...o, resolved: true })),
      attachments: [...r.attachments, ...files.map((f) => ({ id: uid(), name: f.name, size: f.size, uploadedAt: now(), uploadedBy: userId }))],
      history: [...r.history, { id: uid(), date: now(), userId, action: "Corrección enviada", from: r.status, to: "En evaluación", note }],
    }), staff().map((u) => ({ userId: u.id, text: `${r.code}: el estudiante envió una corrección.` })));
  },
  addMessage(id: string, userId: string, text: string) {
    const r = findRequest(id);
    const sender = state.users.find((u) => u.id === userId)!;
    const targets = sender.role === "estudiante" ? (r.assigneeId ? [r.assigneeId] : staff().map((u) => u.id)) : [r.studentId];
    updateRequest(id, (r) => ({ ...r, messages: [...r.messages, { id: uid(), date: now(), userId, text }] }),
      targets.map((t) => ({ userId: t, text: `Nuevo mensaje en ${r.code}.` })));
  },
  markRead(notificationId: string) {
    commit({ ...state, notifications: state.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)) });
  },
  markAllRead(userId: string) {
    commit({ ...state, notifications: state.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)) });
  },
  saveType(t: Omit<ProcedureType, "id"> & { id?: string | undefined }) {
    const exists = t.id && state.types.some((x) => x.id === t.id);
    commit({ ...state, types: exists ? state.types.map((x) => (x.id === t.id ? (t as ProcedureType) : x)) : [...state.types, { ...t, id: uid() }] });
  },
  toggleType(id: string) {
    commit({ ...state, types: state.types.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) });
  },
  reset() { commit(createSeed()); },
};
