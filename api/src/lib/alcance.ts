import type { Sesion } from "./context.js";
import { forbidden } from "./errors.js";

export const esAdminCentral = (u: Pick<Sesion, "rol" | "facultadId">) => u.rol === "ADMIN" && u.facultadId === null;

// Facultad sobre la que opera una consulta. El administrador central puede elegir
// cualquiera (o todas, con null); el resto queda SIEMPRE atado a la suya, aunque
// mande otra en la query.
export function facultadDeAlcance(u: Sesion, pedida?: number): number | null {
  if (esAdminCentral(u)) return pedida ?? null;
  if (u.facultadId === null) throw forbidden();
  return u.facultadId;
}

export function exigirFacultad(u: Sesion, facultadId: number): void {
  if (!esAdminCentral(u) && u.facultadId !== facultadId) throw forbidden("Ese recurso pertenece a otra facultad.");
}
