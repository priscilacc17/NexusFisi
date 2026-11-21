import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { notificaciones, usuarios } from "../../db/schema.js";

export type Conn = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

// Crea una notificación por destinatario, sin duplicados y sin avisarle a quien
// hizo la acción (nadie necesita enterarse de lo que acaba de hacer).
export async function notificar(
  conn: Conn,
  destinatarios: (number | null | undefined)[],
  texto: string,
  opts: { solicitudId?: number; autorId?: number; now: Date },
) {
  const ids = [
    ...new Set(
      destinatarios.filter((d): d is number => typeof d === "number" && d !== opts.autorId),
    ),
  ];
  if (ids.length === 0) return;
  await conn.insert(notificaciones).values(
    ids.map((usuarioId) => ({
      usuarioId,
      solicitudId: opts.solicitudId ?? null,
      texto: texto.slice(0, 255),
      createdAt: opts.now,
    })),
  );
}

export async function supervisoresDe(conn: Conn, facultadId: number): Promise<number[]> {
  const filas = await conn
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.facultadId, facultadId),
        eq(usuarios.rol, "SUPERVISOR"),
        eq(usuarios.activo, true),
      ),
    );
  return filas.map((f) => f.id);
}

export async function marcarLeidas(db: Db, usuarioId: number, ids?: number[]) {
  await db
    .update(notificaciones)
    .set({ leida: true })
    .where(
      and(
        eq(notificaciones.usuarioId, usuarioId),
        ids ? inArray(notificaciones.id, ids) : undefined,
      ),
    );
}
