// Sesión del usuario en el navegador. El token NO se guarda aquí: viaja en una
// cookie HttpOnly que JavaScript no puede leer (un XSS no podría robarlo). En
// localStorage solo queda el perfil, para pintar la interfaz tras una recarga;
// la API valida la cookie en cada petición y, si ya no sirve, se borra.
import { useSyncExternalStore } from "react";
import type { Sesion, Usuario } from "./api/types";

const KEY = "nexusfisi:sesion";
const listeners = new Set<() => void>();
let cache: Sesion | null | undefined;

function leer(): Sesion | null {
  if (typeof window === "undefined") return null;
  if (cache !== undefined) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function escribir(s: Sesion | null) {
  cache = s;
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible: la sesión vive solo en memoria */
  }
  listeners.forEach((l) => l());
}

export const getSesion = leer;
export const iniciarSesion = (s: Sesion) => escribir(s);
export const cerrarSesion = () => escribir(null);
export const actualizarUsuario = (usuario: Usuario) => {
  const s = leer();
  if (s) escribir({ ...s, usuario });
};

export function useSesion(): Sesion | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    leer,
    () => null,
  );
}

export function useUsuario(): Usuario {
  const s = useSesion();
  if (!s) throw new Error("useUsuario requiere una sesión activa");
  return s.usuario;
}
