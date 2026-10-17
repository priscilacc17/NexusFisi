// Sesión de DEMOSTRACIÓN guardada en localStorage. No es autenticación segura.
import { useSyncExternalStore } from "react";
import { getState, useData } from "./data/store";

const KEY = "nexusfisi:session";
const listeners = new Set<() => void>();
const read = () => (typeof window === "undefined" ? null : localStorage.getItem(KEY));

export function login(email: string, password: string) {
  const u = getState().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
  if (!u) return null;
  localStorage.setItem(KEY, u.id);
  listeners.forEach((l) => l());
  return u;
}
export function logout() {
  localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}
export function useCurrentUser() {
  const id = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, read, () => null);
  return useData((s) => s.users.find((u) => u.id === id) ?? null);
}
