import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lt,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import {
  adjuntos,
  areas,
  escuelas,
  facultades,
  mensajes,
  movimientos,
  observaciones,
  secuencias,
  solicitudes,
  tiposTramite,
  usuarios,
  type EtapaAdjunto,
  type Estado,
  type Prioridad,
} from "../../db/schema.js";
import { anioEnLima, estaVencida, sumarDiasHabiles } from "../../domain/plazos.js";
import {
  accionesPermitidas,
  estadoDestino,
  ESTADOS_FINALES,
  ETIQUETA_ACCION,
  ETIQUETA_ESTADO,
  ETIQUETA_PRIORIDAD,
  puede,
  validarDatos,
  type Accion,
  type EstadoSolicitud,
} from "../../domain/workflow.js";
import { esAdminCentral } from "../../lib/alcance.js";
import type { Deps, Sesion } from "../../lib/context.js";
import { badRequest, conflict, forbidden, notFound, unprocessable } from "../../lib/errors.js";
import { borrarArchivos, guardarArchivos, validarArchivos } from "../../lib/storage.js";
import { enviarSinEsperar, type Correo } from "../../lib/mailer.js";
import { notificar, supervisoresDe, type Conn } from "../notificaciones/service.js";

type Solicitud = typeof solicitudes.$inferSelect;

const NO_ENCONTRADA = "No existe la solicitud o no tienes acceso a ella.";

// ---------------------------------------------------------------------------
// Visibilidad y participación
// ---------------------------------------------------------------------------

export function puedeVer(
  u: Sesion,
  s: Pick<Solicitud, "facultadId" | "estudianteId" | "responsableId">,
): boolean {
  if (esAdminCentral(u)) return true;
  switch (u.rol) {
    case "ESTUDIANTE":
      return s.estudianteId === u.id;
    case "TECNICO":
      return s.facultadId === u.facultadId && s.responsableId === u.id;
    case "SUPERVISOR":
    case "ADMIN":
      return s.facultadId === u.facultadId;
  }
}

// Quién conversa en el expediente. El administrador consulta pero no interviene.
function esParticipante(u: Sesion, s: Solicitud) {
  return (
    (u.rol === "ESTUDIANTE" && u.id === s.estudianteId) ||
    (u.id === s.responsableId && u.facultadId === s.facultadId) ||
    (u.rol === "SUPERVISOR" && u.facultadId === s.facultadId)
  );
}

const aEstado = (s: Solicitud): EstadoSolicitud => ({
  estado: s.estado,
  estadoPrevio: s.estadoPrevio,
  estudianteId: s.estudianteId,
  responsableId: s.responsableId,
  facultadId: s.facultadId,
  reaperturas: s.reaperturas,
});

// Etapa en la que el usuario puede adjuntar archivos ahora mismo, o null si no puede.
export function etapaAdjunto(u: Sesion, s: Solicitud): EtapaAdjunto | null {
  if (u.rol === "ESTUDIANTE" && u.id === s.estudianteId && s.estado === "OBSERVADA")
    return "CORRECCION";
  const atiende =
    (u.id === s.responsableId || u.rol === "SUPERVISOR") && u.facultadId === s.facultadId;
  if (atiende && s.estado === "EN_ATENCION") return "ATENCION";
  return null;
}

async function cargar(conn: Conn, codigo: string): Promise<Solicitud | undefined> {
  const [s] = await conn.select().from(solicitudes).where(eq(solicitudes.codigo, codigo)).limit(1);
  return s;
}

async function cargarVisible(deps: Deps, u: Sesion, codigo: string) {
  const s = await cargar(deps.db, codigo);
  if (!s || !puedeVer(u, s)) throw notFound(NO_ENCONTRADA);
  return s;
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

async function siguienteCorrelativo(tx: Conn, facultadId: number, anio: number): Promise<number> {
  // Atómico: LAST_INSERT_ID(expr) deja el valor en la sesión de ESTA conexión,
  // que es la de la transacción, así que dos registros simultáneos nunca chocan.
  await tx.execute(
    sql`INSERT INTO ${secuencias} (facultad_id, anio, ultimo) VALUES (${facultadId}, ${anio}, LAST_INSERT_ID(1))
        ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`,
  );
  const [filas] = (await tx.execute(sql`SELECT LAST_INSERT_ID() AS n`)) as unknown as [
    { n: number | string }[],
  ];
  return Number(filas[0]!.n);
}

export interface NuevaSolicitud {
  tipoId: number;
  asunto: string;
  descripcion: string;
}

export function validarNueva(input: {
  tipoId?: unknown;
  asunto?: unknown;
  descripcion?: unknown;
}): NuevaSolicitud {
  const errores: Record<string, string> = {};
  const tipoId = Number(input.tipoId);
  const asunto = typeof input.asunto === "string" ? input.asunto.trim() : "";
  const descripcion = typeof input.descripcion === "string" ? input.descripcion.trim() : "";
  if (!Number.isInteger(tipoId) || tipoId <= 0)
    errores["tipoId"] = "Selecciona un tipo de trámite.";
  if (asunto.length < 5 || asunto.length > 120)
    errores["asunto"] = "El asunto debe tener entre 5 y 120 caracteres.";
  if (descripcion.length < 15 || descripcion.length > 1500)
    errores["descripcion"] = "La descripción debe tener entre 15 y 1500 caracteres.";
  if (Object.keys(errores).length) throw badRequest("Revisa los campos marcados.", errores);
  return { tipoId, asunto, descripcion };
}

export async function crear(deps: Deps, u: Sesion, input: NuevaSolicitud, archivos: File[]) {
  if (u.rol !== "ESTUDIANTE" || u.facultadId === null)
    throw forbidden("Solo los estudiantes registran solicitudes.");
  if (archivos.length === 0)
    throw badRequest("Adjunta al menos un documento.", {
      archivos: "Adjunta al menos un documento.",
    });

  const [tipo] = await deps.db
    .select()
    .from(tiposTramite)
    .where(eq(tiposTramite.id, input.tipoId))
    .limit(1);
  if (!tipo || !tipo.activo)
    throw unprocessable("El tipo de trámite no existe o no está disponible.");
  if (tipo.facultadId !== u.facultadId)
    throw unprocessable("Ese trámite pertenece a otra facultad.");
  const [fac] = await deps.db
    .select()
    .from(facultades)
    .where(eq(facultades.id, tipo.facultadId))
    .limit(1);
  if (!fac?.activa)
    throw unprocessable("Tu facultad no está recibiendo solicitudes en este momento.");

  const leidos = await validarArchivos(archivos, deps.env.MAX_UPLOAD_MB);
  const guardados = await guardarArchivos(deps.almacen, leidos);
  const now = deps.now();
  try {
    return await deps.db.transaction(async (tx) => {
      const n = await siguienteCorrelativo(tx, fac.id, anioEnLima(now));
      const codigo = `${fac.codigo}-${anioEnLima(now)}-${String(n).padStart(5, "0")}`;
      const [res] = await tx
        .insert(solicitudes)
        .values({
          codigo,
          facultadId: fac.id,
          tipoId: tipo.id,
          estudianteId: u.id,
          asunto: input.asunto,
          descripcion: input.descripcion,
          fechaLimite: sumarDiasHabiles(now, tipo.plazoDias),
          createdAt: now,
          updatedAt: now,
        })
        .$returningId();
      const id = res!.id;
      await tx.insert(adjuntos).values(
        guardados.map((g) => ({
          ...g,
          solicitudId: id,
          etapa: "REGISTRO" as const,
          subidoPor: u.id,
          createdAt: now,
        })),
      );
      await tx.insert(movimientos).values({
        solicitudId: id,
        usuarioId: u.id,
        accion: "Solicitud registrada",
        estadoHasta: "REGISTRADA",
        createdAt: now,
      });
      await notificar(
        tx,
        await supervisoresDe(tx, fac.id),
        `Nueva solicitud ${codigo}: ${tipo.nombre}.`,
        { solicitudId: id, autorId: u.id, now },
      );
      return codigo;
    });
  } catch (e) {
    await borrarArchivos(deps.almacen, guardados);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Listado con filtros
// ---------------------------------------------------------------------------

export interface FiltrosListado {
  q?: string | undefined;
  estado?: Estado | undefined;
  tipoId?: number | undefined;
  prioridad?: Prioridad | undefined;
  facultadId?: number | undefined;
  desde?: string | undefined;
  hasta?: string | undefined;
  vencidas?: boolean | undefined;
  asignadasAMi?: boolean | undefined;
  orden?: "recientes" | "prioridad" | "vencimiento" | undefined;
  page: number;
  size: number;
}

const escaparLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);
// Lima no tiene horario de verano: UTC-5 todo el año.
const inicioDiaLima = (d: string) => new Date(`${d}T00:00:00-05:00`);

export function condicionAlcance(u: Sesion, facultadPedida?: number): SQL | undefined {
  if (esAdminCentral(u))
    return facultadPedida ? eq(solicitudes.facultadId, facultadPedida) : undefined;
  switch (u.rol) {
    case "ESTUDIANTE":
      return eq(solicitudes.estudianteId, u.id);
    case "TECNICO":
      return and(eq(solicitudes.facultadId, u.facultadId!), eq(solicitudes.responsableId, u.id));
    default:
      return eq(solicitudes.facultadId, u.facultadId!);
  }
}

export async function listar(deps: Deps, u: Sesion, f: FiltrosListado) {
  const est = alias(usuarios, "est");
  const resp = alias(usuarios, "resp");
  const now = deps.now();
  const conds: (SQL | undefined)[] = [condicionAlcance(u, f.facultadId)];
  if (f.estado) conds.push(eq(solicitudes.estado, f.estado));
  if (f.tipoId) conds.push(eq(solicitudes.tipoId, f.tipoId));
  if (f.prioridad) conds.push(eq(solicitudes.prioridad, f.prioridad));
  if (f.asignadasAMi) conds.push(eq(solicitudes.responsableId, u.id));
  if (f.vencidas)
    conds.push(
      and(lt(solicitudes.fechaLimite, now), notInArray(solicitudes.estado, [...ESTADOS_FINALES])),
    );
  if (f.desde) conds.push(gte(solicitudes.createdAt, inicioDiaLima(f.desde)));
  if (f.hasta)
    conds.push(lt(solicitudes.createdAt, new Date(inicioDiaLima(f.hasta).getTime() + 86_400_000)));
  if (f.q?.trim()) {
    const p = `%${escaparLike(f.q.trim())}%`;
    conds.push(
      or(
        like(solicitudes.codigo, p),
        like(solicitudes.asunto, p),
        like(est.nombre, p),
        like(est.codigoEstudiante, p),
      ),
    );
  }
  const where = and(...conds);

  // En los órdenes de trabajo (prioridad, vencimiento) lo terminado va al final:
  // una solicitud resuelta con prioridad alta ya no es trabajo pendiente.
  const terminadasAlFinal = sql`(${solicitudes.estado} IN ('RESUELTA', 'CERRADA'))`;
  const orden =
    f.orden === "prioridad"
      ? [
          terminadasAlFinal,
          sql`FIELD(${solicitudes.prioridad}, 'URGENTE', 'ALTA', 'MEDIA', 'BAJA')`,
          asc(solicitudes.fechaLimite),
        ]
      : f.orden === "vencimiento"
        ? [terminadasAlFinal, asc(solicitudes.fechaLimite)]
        : [desc(solicitudes.createdAt)];

  const base = deps.db
    .select({
      s: solicitudes,
      tipoNombre: tiposTramite.nombre,
      facCodigo: facultades.codigo,
      estNombre: est.nombre,
      estCodigo: est.codigoEstudiante,
      respNombre: resp.nombre,
    })
    .from(solicitudes)
    .innerJoin(tiposTramite, eq(tiposTramite.id, solicitudes.tipoId))
    .innerJoin(facultades, eq(facultades.id, solicitudes.facultadId))
    .innerJoin(est, eq(est.id, solicitudes.estudianteId))
    .leftJoin(resp, eq(resp.id, solicitudes.responsableId))
    .where(where);

  const [filas, [total]] = await Promise.all([
    base
      .orderBy(...orden)
      .limit(f.size)
      .offset((f.page - 1) * f.size),
    deps.db
      .select({ n: count() })
      .from(solicitudes)
      .innerJoin(est, eq(est.id, solicitudes.estudianteId))
      .where(where),
  ]);

  return {
    items: filas.map((r) => ({
      codigo: r.s.codigo,
      asunto: r.s.asunto,
      estado: r.s.estado,
      prioridad: r.s.prioridad,
      createdAt: r.s.createdAt.toISOString(),
      updatedAt: r.s.updatedAt.toISOString(),
      fechaLimite: r.s.fechaLimite.toISOString(),
      vencida: estaVencida(r.s.fechaLimite, r.s.estado, now),
      tipo: { id: r.s.tipoId, nombre: r.tipoNombre },
      facultad: { id: r.s.facultadId, codigo: r.facCodigo },
      estudiante: { id: r.s.estudianteId, nombre: r.estNombre, codigoEstudiante: r.estCodigo },
      responsable: r.s.responsableId ? { id: r.s.responsableId, nombre: r.respNombre ?? "" } : null,
    })),
    total: total?.n ?? 0,
    page: f.page,
    size: f.size,
  };
}

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

export async function detalle(deps: Deps, u: Sesion, codigo: string) {
  const s = await cargarVisible(deps, u, codigo);
  const now = deps.now();
  const est = alias(usuarios, "est");

  const [[tipo], [fac], [estudiante], [responsable], adj, obs, movs, msgs] = await Promise.all([
    deps.db
      .select({
        t: tiposTramite,
        area: { id: areas.id, nombre: areas.nombre, ubicacion: areas.ubicacion },
      })
      .from(tiposTramite)
      .innerJoin(areas, eq(areas.id, tiposTramite.areaId))
      .where(eq(tiposTramite.id, s.tipoId)),
    deps.db.select().from(facultades).where(eq(facultades.id, s.facultadId)),
    deps.db
      .select({
        id: est.id,
        nombre: est.nombre,
        email: est.email,
        codigoEstudiante: est.codigoEstudiante,
        escuela: escuelas.nombre,
      })
      .from(est)
      .leftJoin(escuelas, eq(escuelas.id, est.escuelaId))
      .where(eq(est.id, s.estudianteId)),
    s.responsableId
      ? deps.db
          .select({
            id: usuarios.id,
            nombre: usuarios.nombre,
            rol: usuarios.rol,
            area: areas.nombre,
          })
          .from(usuarios)
          .leftJoin(areas, eq(areas.id, usuarios.areaId))
          .where(eq(usuarios.id, s.responsableId))
      : Promise.resolve([]),
    deps.db
      .select({ a: adjuntos, autor: usuarios.nombre })
      .from(adjuntos)
      .innerJoin(usuarios, eq(usuarios.id, adjuntos.subidoPor))
      .where(eq(adjuntos.solicitudId, s.id))
      .orderBy(asc(adjuntos.createdAt), asc(adjuntos.id)),
    deps.db
      .select({ o: observaciones, autor: usuarios.nombre })
      .from(observaciones)
      .innerJoin(usuarios, eq(usuarios.id, observaciones.autorId))
      .where(eq(observaciones.solicitudId, s.id))
      .orderBy(asc(observaciones.createdAt), asc(observaciones.id)),
    deps.db
      .select({ m: movimientos, autor: usuarios.nombre, rol: usuarios.rol })
      .from(movimientos)
      .innerJoin(usuarios, eq(usuarios.id, movimientos.usuarioId))
      .where(eq(movimientos.solicitudId, s.id))
      .orderBy(asc(movimientos.createdAt), asc(movimientos.id)),
    deps.db
      .select({ m: mensajes, autor: usuarios.nombre, rol: usuarios.rol })
      .from(mensajes)
      .innerJoin(usuarios, eq(usuarios.id, mensajes.autorId))
      .where(eq(mensajes.solicitudId, s.id))
      .orderBy(asc(mensajes.createdAt), asc(mensajes.id)),
  ]);

  const acciones = accionesPermitidas(u, aEstado(s));
  const asigna = acciones.includes("ASIGNAR") || acciones.includes("REASIGNAR");
  const disponibles = asigna
    ? await deps.db
        .select({
          id: usuarios.id,
          nombre: usuarios.nombre,
          rol: usuarios.rol,
          areaId: usuarios.areaId,
          area: areas.nombre,
        })
        .from(usuarios)
        .leftJoin(areas, eq(areas.id, usuarios.areaId))
        .where(
          and(
            eq(usuarios.facultadId, s.facultadId),
            inArray(usuarios.rol, ["TECNICO", "SUPERVISOR"]),
            eq(usuarios.activo, true),
          ),
        )
        .orderBy(asc(usuarios.nombre))
    : [];

  return {
    codigo: s.codigo,
    version: s.version,
    asunto: s.asunto,
    descripcion: s.descripcion,
    estado: s.estado,
    estadoPrevio: s.estadoPrevio,
    prioridad: s.prioridad,
    respuesta: s.respuesta,
    tipoCierre: s.tipoCierre,
    reaperturas: s.reaperturas,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    fechaLimite: s.fechaLimite.toISOString(),
    resueltaAt: s.resueltaAt?.toISOString() ?? null,
    cerradaAt: s.cerradaAt?.toISOString() ?? null,
    vencida: estaVencida(s.fechaLimite, s.estado, now),
    facultad: { id: fac!.id, codigo: fac!.codigo, nombre: fac!.nombre },
    tipo: {
      id: tipo!.t.id,
      nombre: tipo!.t.nombre,
      requisitos: tipo!.t.requisitos,
      plazoDias: tipo!.t.plazoDias,
      area: tipo!.area,
    },
    estudiante: estudiante!,
    responsable: responsable
      ? {
          id: responsable.id,
          nombre: responsable.nombre,
          rol: responsable.rol,
          area: responsable.area,
        }
      : null,
    adjuntos: adj.map(({ a, autor }) => ({
      id: a.id,
      nombre: a.nombreOriginal,
      mime: a.mime,
      tamano: a.tamano,
      etapa: a.etapa,
      subidoPor: autor,
      createdAt: a.createdAt.toISOString(),
    })),
    observaciones: obs.map(({ o, autor }) => ({
      id: o.id,
      texto: o.texto,
      resuelta: o.resuelta,
      autor,
      createdAt: o.createdAt.toISOString(),
      resueltaAt: o.resueltaAt?.toISOString() ?? null,
    })),
    historial: movs.map(({ m, autor, rol }) => ({
      id: m.id,
      accion: m.accion,
      estadoDesde: m.estadoDesde,
      estadoHasta: m.estadoHasta,
      nota: m.nota,
      autor,
      rol,
      createdAt: m.createdAt.toISOString(),
    })),
    mensajes: msgs.map(({ m, autor, rol }) => ({
      id: m.id,
      texto: m.texto,
      autorId: m.autorId,
      autor,
      rol,
      createdAt: m.createdAt.toISOString(),
    })),
    acciones,
    puedeAdjuntar: etapaAdjunto(u, s),
    puedeEnviarMensaje: esParticipante(u, s) && s.estado !== "CERRADA",
    responsablesDisponibles: disponibles.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      rol: d.rol,
      area: d.area,
      delArea: d.areaId === tipo!.t.areaId,
    })),
  };
}

// ---------------------------------------------------------------------------
// Transiciones
// ---------------------------------------------------------------------------

export interface TransicionInput {
  accion: Accion;
  version: number;
  nota?: string | undefined;
  responsableId?: number | undefined;
  prioridad?: Prioridad | undefined;
  respuesta?: string | undefined;
}

export async function transicion(deps: Deps, u: Sesion, codigo: string, input: TransicionInput) {
  const s = await cargarVisible(deps, u, codigo);
  if (s.version !== input.version)
    throw conflict("La solicitud cambió mientras la revisabas. Recarga para ver su estado actual.");
  if (!puede(u, input.accion, aEstado(s))) {
    throw unprocessable(
      `No puedes realizar esta acción sobre una solicitud en estado "${ETIQUETA_ESTADO[s.estado]}".`,
    );
  }
  const falta = validarDatos(input.accion, input);
  if (falta)
    throw badRequest(falta, {
      [input.accion === "RESOLVER"
        ? "respuesta"
        : input.accion === "PRIORIZAR"
          ? "prioridad"
          : input.accion.includes("ASIGNAR")
            ? "responsableId"
            : "nota"]: falta,
    });

  const now = deps.now();
  const nota = input.nota?.trim() || null;
  const destino = estadoDestino(input.accion, aEstado(s));
  const cambios: Partial<typeof solicitudes.$inferInsert> = { estado: destino, updatedAt: now };

  let nuevoResponsable: { id: number; nombre: string } | null = null;
  if (input.accion === "ASIGNAR" || input.accion === "REASIGNAR") {
    const [r] = await deps.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, input.responsableId!))
      .limit(1);
    if (
      !r ||
      !r.activo ||
      r.facultadId !== s.facultadId ||
      (r.rol !== "TECNICO" && r.rol !== "SUPERVISOR")
    ) {
      throw unprocessable("El responsable debe ser personal activo de la misma facultad.");
    }
    if (r.id === s.responsableId)
      throw unprocessable("Esa persona ya es la responsable de la solicitud.");
    nuevoResponsable = { id: r.id, nombre: r.nombre };
    cambios.responsableId = r.id;
    if (input.prioridad) cambios.prioridad = input.prioridad;
  }
  switch (input.accion) {
    case "OBSERVAR":
      cambios.estadoPrevio = s.estado;
      break;
    case "CORREGIR":
      cambios.estadoPrevio = null;
      break;
    case "RESOLVER":
      cambios.respuesta = input.respuesta!.trim();
      cambios.resueltaAt = now;
      break;
    case "CERRAR":
      cambios.cerradaAt = now;
      cambios.tipoCierre = u.rol === "ESTUDIANTE" ? "CONFORME" : "SUPERVISOR";
      break;
    case "DESISTIR":
      cambios.cerradaAt = now;
      cambios.tipoCierre = "DESISTIDA";
      break;
    case "REABRIR":
      cambios.reaperturas = s.reaperturas + 1;
      cambios.resueltaAt = null;
      break;
    case "PRIORIZAR":
      if (input.prioridad === s.prioridad)
        throw unprocessable("La solicitud ya tiene esa prioridad.");
      cambios.prioridad = input.prioridad!;
      break;
  }

  await deps.db.transaction(async (tx) => {
    const [res] = await tx
      .update(solicitudes)
      .set({ ...cambios, version: sql`${solicitudes.version} + 1` })
      .where(and(eq(solicitudes.id, s.id), eq(solicitudes.version, input.version)));
    if (res.affectedRows !== 1)
      throw conflict(
        "La solicitud cambió mientras la revisabas. Recarga para ver su estado actual.",
      );

    let detalleMov = ETIQUETA_ACCION[input.accion];
    if (nuevoResponsable) detalleMov += `: ${nuevoResponsable.nombre}`;
    if (input.accion === "PRIORIZAR" || (nuevoResponsable && input.prioridad))
      detalleMov += ` (prioridad ${ETIQUETA_PRIORIDAD[cambios.prioridad!].toLowerCase()})`;
    await tx.insert(movimientos).values({
      solicitudId: s.id,
      usuarioId: u.id,
      accion: detalleMov.slice(0, 120),
      estadoDesde: s.estado,
      estadoHasta: destino,
      nota: input.accion === "RESOLVER" ? cambios.respuesta! : nota,
      createdAt: now,
    });

    if (input.accion === "OBSERVAR") {
      await tx
        .insert(observaciones)
        .values({ solicitudId: s.id, autorId: u.id, texto: nota!, createdAt: now });
    }
    if (input.accion === "CORREGIR") {
      await tx
        .update(observaciones)
        .set({ resuelta: true, resueltaAt: now })
        .where(and(eq(observaciones.solicitudId, s.id), eq(observaciones.resuelta, false)));
    }

    const op = { solicitudId: s.id, autorId: u.id, now };
    const equipo = s.responsableId ? [s.responsableId] : await supervisoresDe(tx, s.facultadId);
    switch (input.accion) {
      case "EVALUAR":
      case "INICIAR_ATENCION":
        await notificar(
          tx,
          [s.estudianteId],
          `Tu solicitud ${s.codigo} pasó a "${ETIQUETA_ESTADO[destino]}".`,
          op,
        );
        break;
      case "OBSERVAR":
        await notificar(
          tx,
          [s.estudianteId],
          `Tu solicitud ${s.codigo} fue observada. Revisa qué corregir.`,
          op,
        );
        break;
      case "ASIGNAR":
      case "REASIGNAR":
        await notificar(tx, [nuevoResponsable!.id], `Se te asignó la solicitud ${s.codigo}.`, op);
        await notificar(
          tx,
          [s.estudianteId],
          `Tu solicitud ${s.codigo} tiene un responsable asignado.`,
          op,
        );
        if (s.responsableId)
          await notificar(
            tx,
            [s.responsableId],
            `La solicitud ${s.codigo} fue reasignada a otra persona.`,
            op,
          );
        break;
      case "RESOLVER":
        await notificar(
          tx,
          [s.estudianteId],
          `Tu solicitud ${s.codigo} fue resuelta. Revisa la respuesta.`,
          op,
        );
        break;
      case "CERRAR":
        await notificar(
          tx,
          u.rol === "ESTUDIANTE" ? equipo : [s.estudianteId],
          `El expediente ${s.codigo} fue cerrado.`,
          op,
        );
        break;
      case "CORREGIR":
        await notificar(tx, equipo, `${s.codigo}: el estudiante envió la corrección.`, op);
        break;
      case "DESISTIR":
        await notificar(tx, equipo, `${s.codigo}: el estudiante desistió de la solicitud.`, op);
        break;
      case "REABRIR":
        await notificar(
          tx,
          [...equipo, ...(await supervisoresDe(tx, s.facultadId))],
          `${s.codigo} fue reabierta: el estudiante no está conforme.`,
          op,
        );
        break;
      case "PRIORIZAR":
        await notificar(
          tx,
          [s.responsableId],
          `La prioridad de ${s.codigo} cambió a ${ETIQUETA_PRIORIDAD[cambios.prioridad!].toLowerCase()}.`,
          op,
        );
        break;
    }
  });
  await avisarPorCorreo(deps, s, input.accion, {
    nota,
    respuesta: cambios.respuesta ?? null,
    responsableId: nuevoResponsable?.id ?? null,
  });
  return detalle(deps, u, codigo);
}

// ---------------------------------------------------------------------------
// Adjuntos y mensajes
// ---------------------------------------------------------------------------

export async function adjuntar(deps: Deps, u: Sesion, codigo: string, archivos: File[]) {
  const s = await cargarVisible(deps, u, codigo);
  const etapa = etapaAdjunto(u, s);
  if (!etapa)
    throw unprocessable("No puedes adjuntar archivos a esta solicitud en su estado actual.");
  if (archivos.length === 0)
    throw badRequest("Selecciona al menos un archivo.", {
      archivos: "Selecciona al menos un archivo.",
    });
  const leidos = await validarArchivos(archivos, deps.env.MAX_UPLOAD_MB);
  const guardados = await guardarArchivos(deps.almacen, leidos);
  const now = deps.now();
  try {
    await deps.db.transaction(async (tx) => {
      await tx.insert(adjuntos).values(
        guardados.map((g) => ({
          ...g,
          solicitudId: s.id,
          etapa,
          subidoPor: u.id,
          createdAt: now,
        })),
      );
      await tx.update(solicitudes).set({ updatedAt: now }).where(eq(solicitudes.id, s.id));
      await tx.insert(movimientos).values({
        solicitudId: s.id,
        usuarioId: u.id,
        accion: `Documentos adjuntados (${guardados.length})`,
        nota: guardados
          .map((g) => g.nombreOriginal)
          .join(", ")
          .slice(0, 1000),
        createdAt: now,
      });
      const destino =
        etapa === "CORRECCION"
          ? s.responsableId
            ? [s.responsableId]
            : await supervisoresDe(tx, s.facultadId)
          : [s.estudianteId];
      await notificar(tx, destino, `Nuevos documentos en ${s.codigo}.`, {
        solicitudId: s.id,
        autorId: u.id,
        now,
      });
    });
  } catch (e) {
    await borrarArchivos(deps.almacen, guardados);
    throw e;
  }
  return detalle(deps, u, codigo);
}

export async function descargar(deps: Deps, u: Sesion, codigo: string, adjuntoId: number) {
  const [fila] = await deps.db
    .select({ a: adjuntos, s: solicitudes })
    .from(adjuntos)
    .innerJoin(solicitudes, eq(solicitudes.id, adjuntos.solicitudId))
    .where(eq(adjuntos.id, adjuntoId))
    .limit(1);
  if (!fila || fila.s.codigo !== codigo || !puedeVer(u, fila.s))
    throw notFound("No existe el archivo o no tienes acceso a él.");
  const contenido = await deps.almacen.leer(fila.a.nombreAlmacenado).catch(() => {
    throw notFound("El archivo ya no está disponible en el servidor.");
  });
  return { contenido, mime: fila.a.mime, nombre: fila.a.nombreOriginal };
}

export async function enviarMensaje(deps: Deps, u: Sesion, codigo: string, textoIn: string) {
  const s = await cargarVisible(deps, u, codigo);
  if (!esParticipante(u, s))
    throw forbidden("Solo el estudiante y el personal a cargo pueden escribir en este expediente.");
  if (s.estado === "CERRADA")
    throw unprocessable("El expediente está cerrado; ya no admite mensajes.");
  const texto = textoIn.trim();
  if (texto.length < 1 || texto.length > 1000)
    throw badRequest("El mensaje debe tener entre 1 y 1000 caracteres.", {
      texto: "Entre 1 y 1000 caracteres.",
    });
  const now = deps.now();
  await deps.db.transaction(async (tx) => {
    await tx.insert(mensajes).values({ solicitudId: s.id, autorId: u.id, texto, createdAt: now });
    await tx.update(solicitudes).set({ updatedAt: now }).where(eq(solicitudes.id, s.id));
    const destino =
      u.rol === "ESTUDIANTE"
        ? s.responsableId
          ? [s.responsableId]
          : await supervisoresDe(tx, s.facultadId)
        : [s.estudianteId, s.responsableId];
    await notificar(tx, destino, `Nuevo mensaje en ${s.codigo}.`, {
      solicitudId: s.id,
      autorId: u.id,
      now,
    });
  });
  return detalle(deps, u, codigo);
}

// Los eventos que cambian lo que alguien tiene que HACER también llegan por
// correo (las demás notificaciones quedan solo en la campana del sistema).
// Se envía después de confirmar la transacción y sin esperar: un fallo del
// correo nunca deshace ni demora la operación.
async function avisarPorCorreo(
  deps: Deps,
  s: Solicitud,
  accion: Accion,
  d: { nota: string | null; respuesta: string | null; responsableId: number | null },
) {
  if (!deps.env.MAIL_NOTIFICACIONES) return;
  const plan: { usuarioId: number; asunto: string; texto: string }[] = [];
  if (accion === "OBSERVAR") {
    plan.push({
      usuarioId: s.estudianteId,
      asunto: `Tu solicitud ${s.codigo} fue observada`,
      texto: `Tu solicitud "${s.asunto}" necesita una corrección:
${d.nota ?? ""}
Ingresa al expediente para enviar la corrección.`,
    });
  } else if (accion === "RESOLVER") {
    plan.push({
      usuarioId: s.estudianteId,
      asunto: `Tu solicitud ${s.codigo} fue resuelta`,
      texto: `Respuesta a "${s.asunto}":
${d.respuesta ?? ""}
Revisa el expediente y confirma tu conformidad.`,
    });
  } else if ((accion === "ASIGNAR" || accion === "REASIGNAR") && d.responsableId) {
    plan.push({
      usuarioId: d.responsableId,
      asunto: `Se te asignó la solicitud ${s.codigo}`,
      texto: `Tienes una nueva solicitud a cargo: "${s.asunto}".`,
    });
  }
  if (plan.length === 0) return;
  const destinos = await deps.db
    .select({ id: usuarios.id, email: usuarios.email, nombre: usuarios.nombre })
    .from(usuarios)
    .where(
      inArray(
        usuarios.id,
        plan.map((p) => p.usuarioId),
      ),
    );
  const url = new URL(`/app/solicitudes/${s.codigo}`, deps.env.PUBLIC_URL).toString();
  const correos: Correo[] = plan.flatMap((p) => {
    const dest = destinos.find((x) => x.id === p.usuarioId);
    return dest
      ? [
          {
            para: dest.email,
            asunto: p.asunto,
            texto: `Hola ${dest.nombre}.
${p.texto}`,
            boton: { texto: "Ver el expediente", url },
          },
        ]
      : [];
  });
  enviarSinEsperar(deps.mailer, deps.logger, correos);
}
