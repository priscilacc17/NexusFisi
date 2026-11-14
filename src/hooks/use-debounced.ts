import { useEffect, useState } from "react";

// Retrasa un valor (p. ej. lo que se escribe en un buscador) para no consultar la API en cada tecla.
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
