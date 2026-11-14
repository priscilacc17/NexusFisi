import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import type { Db } from "../../db/client.js";
import { areas, escuelas, facultades, usuarios } from "../../db/schema.js";

// Vista pública de un usuario: nunca incluye el hash ni los contadores de seguridad.
export function selectUsuarioPublico(db: Db) {
  const f = alias(facultades, "f");
  const e = alias(escuelas, "e");
  const a = alias(areas, "a");
  return db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      codigoEstudiante: usuarios.codigoEstudiante,
      activo: usuarios.activo,
      fId: f.id,
      fCodigo: f.codigo,
      fNombre: f.nombre,
      eId: e.id,
      eNombre: e.nombre,
      aId: a.id,
      aNombre: a.nombre,
    })
    .from(usuarios)
    .leftJoin(f, eq(f.id, usuarios.facultadId))
    .leftJoin(e, eq(e.id, usuarios.escuelaId))
    .leftJoin(a, eq(a.id, usuarios.areaId));
}

type Fila = Awaited<ReturnType<ReturnType<typeof selectUsuarioPublico>["execute"]>>[number];

export function aUsuarioPublico(r: Fila) {
  return {
    id: r.id,
    nombre: r.nombre,
    email: r.email,
    rol: r.rol,
    codigoEstudiante: r.codigoEstudiante,
    activo: r.activo,
    facultad: r.fId ? { id: r.fId, codigo: r.fCodigo!, nombre: r.fNombre! } : null,
    escuela: r.eId ? { id: r.eId, nombre: r.eNombre! } : null,
    area: r.aId ? { id: r.aId, nombre: r.aNombre! } : null,
  };
}

export async function usuarioPublico(db: Db, id: number) {
  const [r] = await selectUsuarioPublico(db).where(eq(usuarios.id, id)).limit(1);
  return r ? aUsuarioPublico(r) : null;
}
