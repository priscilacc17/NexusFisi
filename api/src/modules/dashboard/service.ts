import { and, count, desc, eq, isNotNull, lt, notInArray, sql } from "drizzle-orm";
import { facultades, solicitudes, tiposTramite, usuarios } from "../../db/schema.js";
import { ESTADOS_FINALES } from "../../domain/workflow.js";
import type { Deps, Sesion } from "../../lib/context.js";
import { condicionAlcance } from "../solicitudes/service.js";

// Indicadores del Módulo 4, siempre dentro del alcance del usuario (su facultad,
// sus solicitudes o las que tiene asignadas, según el rol).
export async function resumen(deps: Deps, u: Sesion, facultadId?: number) {
  const alcance = condicionAlcance(u, facultadId);
  const now = deps.now();
  const finales = [...ESTADOS_FINALES];
  const n = (r: { n: number | string | null }[]) => Number(r[0]?.n ?? 0);

  const [
    total,
    pendientes,
    atendidas,
    vencidas,
    desistidas,
    tiempo,
    porEstado,
    porPrioridad,
    porTipo,
    porResponsable,
    porFacultad,
  ] = await Promise.all([
    deps.db.select({ n: count() }).from(solicitudes).where(alcance),
    deps.db
      .select({ n: count() })
      .from(solicitudes)
      .where(and(alcance, notInArray(solicitudes.estado, finales))),
    deps.db
      .select({ n: count() })
      .from(solicitudes)
      .where(and(alcance, isNotNull(solicitudes.resueltaAt))),
    deps.db
      .select({ n: count() })
      .from(solicitudes)
      .where(
        and(alcance, notInArray(solicitudes.estado, finales), lt(solicitudes.fechaLimite, now)),
      ),
    deps.db
      .select({ n: count() })
      .from(solicitudes)
      .where(and(alcance, eq(solicitudes.tipoCierre, "DESISTIDA"))),
    deps.db
      .select({
        n: sql<
          string | null
        >`AVG(TIMESTAMPDIFF(MINUTE, ${solicitudes.createdAt}, ${solicitudes.resueltaAt}))`,
      })
      .from(solicitudes)
      .where(and(alcance, isNotNull(solicitudes.resueltaAt))),
    deps.db
      .select({ clave: solicitudes.estado, n: count() })
      .from(solicitudes)
      .where(alcance)
      .groupBy(solicitudes.estado),
    deps.db
      .select({ clave: solicitudes.prioridad, n: count() })
      .from(solicitudes)
      .where(and(alcance, notInArray(solicitudes.estado, finales)))
      .groupBy(solicitudes.prioridad),
    deps.db
      .select({ clave: tiposTramite.nombre, n: count() })
      .from(solicitudes)
      .innerJoin(tiposTramite, eq(tiposTramite.id, solicitudes.tipoId))
      .where(alcance)
      .groupBy(tiposTramite.nombre)
      .orderBy(desc(count()))
      .limit(10),
    deps.db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        total: count(),
        pendientes: sql<string>`SUM(CASE WHEN ${solicitudes.estado} NOT IN ('RESUELTA','CERRADA') THEN 1 ELSE 0 END)`,
        resueltas: sql<string>`SUM(CASE WHEN ${solicitudes.resueltaAt} IS NOT NULL THEN 1 ELSE 0 END)`,
      })
      .from(solicitudes)
      .innerJoin(usuarios, eq(usuarios.id, solicitudes.responsableId))
      .where(alcance)
      .groupBy(usuarios.id, usuarios.nombre)
      .orderBy(desc(count())),
    deps.db
      .select({ clave: facultades.codigo, n: count() })
      .from(solicitudes)
      .innerJoin(facultades, eq(facultades.id, solicitudes.facultadId))
      .where(alcance)
      .groupBy(facultades.codigo)
      .orderBy(desc(count())),
  ]);

  const tot = n(total);
  const atend = n(atendidas);
  // Las desistidas no cuentan para el porcentaje: el estudiante retiró el pedido,
  // la oficina no tuvo oportunidad de resolverlo.
  const base = tot - n(desistidas);
  const minutos = tiempo[0]?.n === null || tiempo[0]?.n === undefined ? null : Number(tiempo[0].n);
  const lista = (r: { clave: string; n: number }[]) =>
    r.map((x) => ({ clave: x.clave, total: Number(x.n) }));

  return {
    total: tot,
    pendientes: n(pendientes),
    atendidas: atend,
    vencidas: n(vencidas),
    desistidas: n(desistidas),
    porcentajeResueltas: base > 0 ? Math.round((atend / base) * 1000) / 10 : null,
    tiempoPromedioHoras: minutos === null ? null : Math.round((minutos / 60) * 10) / 10,
    porEstado: lista(porEstado),
    porPrioridad: lista(porPrioridad),
    porTipo: lista(porTipo),
    porResponsable: porResponsable.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      total: Number(r.total),
      pendientes: Number(r.pendientes),
      resueltas: Number(r.resueltas),
    })),
    porFacultad: lista(porFacultad),
  };
}
