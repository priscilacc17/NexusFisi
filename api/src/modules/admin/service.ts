import { and, asc, count, eq, inArray, like, notInArray, or, sql, type SQL } from "drizzle-orm";
import { areas, escuelas, facultades, solicitudes, tiposTramite, usuarios, type Rol } from "../../db/schema.js";
import { hashPassword, validarPassword } from "../../auth/password.js";
import { ESTADOS_FINALES } from "../../domain/workflow.js";
import { esAdminCentral, exigirFacultad } from "../../lib/alcance.js";
import type { Deps, Sesion } from "../../lib/context.js";
import { badRequest, conflict, forbidden, notFound, unprocessable } from "../../lib/errors.js";
import { DOMINIO_INSTITUCIONAL, normalizarEmail } from "../auth/service.js";
import { aUsuarioPublico, selectUsuarioPublico, usuarioPublico } from "../usuarios/consultas.js";

// MySQL rechaza duplicados con ER_DUP_ENTRY; Drizzle lo envuelve en `cause`.
function esDuplicado(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "ER_DUP_ENTRY" || err?.cause?.code === "ER_DUP_ENTRY";
}
async function conDuplicado<T>(fn: () => Promise<T>, mensaje: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (esDuplicado(e)) throw conflict(mensaje);
    throw e;
  }
}

// El administrador de facultad trabaja siempre sobre la suya; el central elige.
function facultadObjetivo(u: Sesion, pedida: number | null | undefined): number {
  if (esAdminCentral(u)) {
    if (!pedida) throw badRequest("Indica la facultad.", { facultadId: "Obligatoria" });
    return pedida;
  }
  if (pedida && pedida !== u.facultadId) throw forbidden("Solo puedes gestionar tu propia facultad.");
  return u.facultadId!;
}

async function areaDeFacultad(deps: Deps, areaId: number, facultadId: number) {
  const [a] = await deps.db.select().from(areas).where(eq(areas.id, areaId)).limit(1);
  if (!a || a.facultadId !== facultadId) throw unprocessable("El área no pertenece a esa facultad.");
  return a;
}

async function solicitudesEnCurso(deps: Deps, responsableId: number) {
  const [r] = await deps.db
    .select({ n: count() })
    .from(solicitudes)
    .where(and(eq(solicitudes.responsableId, responsableId), notInArray(solicitudes.estado, [...ESTADOS_FINALES])));
  return r?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

export interface FiltroUsuarios {
  facultadId?: number | undefined;
  rol?: Rol | undefined;
  q?: string | undefined;
  page: number;
  size: number;
}

export async function listarUsuarios(deps: Deps, u: Sesion, f: FiltroUsuarios) {
  const conds: (SQL | undefined)[] = [];
  if (!esAdminCentral(u)) conds.push(eq(usuarios.facultadId, u.facultadId!));
  else if (f.facultadId) conds.push(eq(usuarios.facultadId, f.facultadId));
  if (f.rol) conds.push(eq(usuarios.rol, f.rol));
  if (f.q?.trim()) {
    const p = `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    conds.push(or(like(usuarios.nombre, p), like(usuarios.email, p), like(usuarios.codigoEstudiante, p)));
  }
  const where = and(...conds);
  const [filas, [tot]] = await Promise.all([
    selectUsuarioPublico(deps.db).where(where).orderBy(asc(usuarios.rol), asc(usuarios.nombre)).limit(f.size).offset((f.page - 1) * f.size),
    deps.db.select({ n: count() }).from(usuarios).where(where),
  ]);
  return { items: filas.map(aUsuarioPublico), total: tot?.n ?? 0, page: f.page, size: f.size };
}

export interface UsuarioInput {
  nombre: string;
  email: string;
  rol: Rol;
  facultadId?: number | null | undefined;
  areaId?: number | null | undefined;
  escuelaId?: number | null | undefined;
  codigoEstudiante?: string | null | undefined;
  password: string;
}

async function validarPerfil(deps: Deps, rol: Rol, facultadId: number | null, d: Pick<UsuarioInput, "areaId" | "escuelaId" | "codigoEstudiante">) {
  const perfil = { areaId: null as number | null, escuelaId: null as number | null, codigoEstudiante: null as string | null };
  if (facultadId === null) return perfil;
  if (rol === "TECNICO" && !d.areaId) throw badRequest("El técnico debe pertenecer a un área.", { areaId: "Obligatoria para técnicos" });
  if ((rol === "TECNICO" || rol === "SUPERVISOR") && d.areaId) perfil.areaId = (await areaDeFacultad(deps, d.areaId, facultadId)).id;
  if (rol === "ESTUDIANTE") {
    if (!d.codigoEstudiante || !/^\d{8}$/.test(d.codigoEstudiante)) throw badRequest("El código de estudiante tiene 8 dígitos.", { codigoEstudiante: "8 dígitos" });
    perfil.codigoEstudiante = d.codigoEstudiante;
    if (d.escuelaId) {
      const [e] = await deps.db.select().from(escuelas).where(eq(escuelas.id, d.escuelaId)).limit(1);
      if (!e || e.facultadId !== facultadId) throw unprocessable("La escuela no pertenece a esa facultad.");
      perfil.escuelaId = e.id;
    }
  }
  return perfil;
}

export async function crearUsuario(deps: Deps, u: Sesion, d: UsuarioInput) {
  const email = normalizarEmail(d.email);
  if (!email.endsWith(DOMINIO_INSTITUCIONAL)) throw badRequest("Usa un correo institucional.", { email: `Debe terminar en ${DOMINIO_INSTITUCIONAL}` });
  const errPass = validarPassword(d.password);
  if (errPass) throw badRequest(errPass, { password: errPass });
  // Administrador central = ADMIN sin facultad. Solo otro central puede crearlo.
  const central = d.rol === "ADMIN" && !d.facultadId && esAdminCentral(u);
  const facultadId = central ? null : facultadObjetivo(u, d.facultadId);
  if (facultadId !== null) {
    const [f] = await deps.db.select().from(facultades).where(eq(facultades.id, facultadId)).limit(1);
    if (!f) throw unprocessable("La facultad no existe.");
  }
  const perfil = await validarPerfil(deps, d.rol, facultadId, d);
  const passwordHash = await hashPassword(d.password);
  const [res] = await conDuplicado(
    () => deps.db.insert(usuarios).values({ nombre: d.nombre.trim(), email, rol: d.rol, facultadId, passwordHash, ...perfil }).$returningId(),
    "Ya existe un usuario con ese correo o código de estudiante.",
  );
  return usuarioPublico(deps.db, res!.id);
}

export interface UsuarioCambios {
  nombre?: string | undefined;
  rol?: Rol | undefined;
  areaId?: number | null | undefined;
  escuelaId?: number | null | undefined;
  codigoEstudiante?: string | null | undefined;
  activo?: boolean | undefined;
}

export async function actualizarUsuario(deps: Deps, u: Sesion, id: number, d: UsuarioCambios) {
  const [actual] = await deps.db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
  if (!actual) throw notFound("Usuario no encontrado.");
  if (actual.facultadId === null && !esAdminCentral(u)) throw forbidden();
  if (actual.facultadId !== null) exigirFacultad(u, actual.facultadId);
  if (id === u.id && (d.rol !== undefined && d.rol !== actual.rol || d.activo === false)) {
    throw unprocessable("No puedes cambiar tu propio rol ni desactivar tu propia cuenta.");
  }
  const rol = d.rol ?? actual.rol;
  if (actual.facultadId === null && rol !== "ADMIN") throw unprocessable("El administrador central no pertenece a una facultad; no puede tener otro rol.");

  const dejaDeAtender = (actual.rol === "TECNICO" || actual.rol === "SUPERVISOR") && (rol === "ESTUDIANTE" || rol === "ADMIN" || d.activo === false);
  if (dejaDeAtender) {
    const n = await solicitudesEnCurso(deps, id);
    if (n > 0) throw unprocessable(`Tiene ${n} solicitud(es) en curso a su cargo. Reasígnalas antes de cambiar su rol o desactivarlo.`);
  }
  if (actual.rol === "ESTUDIANTE" && rol !== "ESTUDIANTE") {
    const [r] = await deps.db.select({ n: count() }).from(solicitudes).where(eq(solicitudes.estudianteId, id));
    if ((r?.n ?? 0) > 0) throw unprocessable("Un estudiante con solicitudes registradas no puede cambiar de rol.");
  }

  const perfil = await validarPerfil(deps, rol, actual.facultadId, {
    areaId: d.areaId === undefined ? actual.areaId : d.areaId,
    escuelaId: d.escuelaId === undefined ? actual.escuelaId : d.escuelaId,
    codigoEstudiante: d.codigoEstudiante === undefined ? actual.codigoEstudiante : d.codigoEstudiante,
  });
  // Cambiar rol o desactivar invalida las sesiones abiertas de esa persona.
  const invalidar = rol !== actual.rol || (d.activo !== undefined && d.activo !== actual.activo);
  await conDuplicado(
    () =>
      deps.db
        .update(usuarios)
        .set({
          nombre: d.nombre?.trim() ?? actual.nombre,
          rol,
          activo: d.activo ?? actual.activo,
          ...perfil,
          ...(invalidar ? { tokenVersion: sql`${usuarios.tokenVersion} + 1` } : {}),
        })
        .where(eq(usuarios.id, id)),
    "Ese código de estudiante ya está en uso.",
  );
  return usuarioPublico(deps.db, id);
}

export async function restablecerPassword(deps: Deps, u: Sesion, id: number, password: string) {
  const [actual] = await deps.db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
  if (!actual) throw notFound("Usuario no encontrado.");
  if (actual.facultadId === null) {
    if (!esAdminCentral(u)) throw forbidden();
  } else exigirFacultad(u, actual.facultadId);
  const err = validarPassword(password);
  if (err) throw badRequest(err, { password: err });
  await deps.db
    .update(usuarios)
    .set({ passwordHash: await hashPassword(password), intentosFallidos: 0, bloqueadoHasta: null, tokenVersion: sql`${usuarios.tokenVersion} + 1` })
    .where(eq(usuarios.id, id));
}

// ---------------------------------------------------------------------------
// Áreas responsables
// ---------------------------------------------------------------------------

export interface AreaInput {
  facultadId?: number | undefined;
  nombre: string;
  ubicacion: string;
  activa?: boolean | undefined;
}

export async function crearArea(deps: Deps, u: Sesion, d: AreaInput) {
  const facultadId = facultadObjetivo(u, d.facultadId);
  const [res] = await conDuplicado(
    () => deps.db.insert(areas).values({ facultadId, nombre: d.nombre.trim(), ubicacion: d.ubicacion.trim(), activa: d.activa ?? true }).$returningId(),
    "Ya existe un área con ese nombre en la facultad.",
  );
  const [a] = await deps.db.select().from(areas).where(eq(areas.id, res!.id));
  return a!;
}

export async function actualizarArea(deps: Deps, u: Sesion, id: number, d: Omit<AreaInput, "facultadId">) {
  const [a] = await deps.db.select().from(areas).where(eq(areas.id, id)).limit(1);
  if (!a) throw notFound("Área no encontrada.");
  exigirFacultad(u, a.facultadId);
  if (d.activa === false && a.activa) {
    const [t] = await deps.db.select({ n: count() }).from(tiposTramite).where(and(eq(tiposTramite.areaId, id), eq(tiposTramite.activo, true)));
    if ((t?.n ?? 0) > 0) throw unprocessable("El área atiende trámites activos. Desactívalos o muévelos a otra área primero.");
  }
  await conDuplicado(
    () => deps.db.update(areas).set({ nombre: d.nombre.trim(), ubicacion: d.ubicacion.trim(), activa: d.activa ?? a.activa }).where(eq(areas.id, id)),
    "Ya existe un área con ese nombre en la facultad.",
  );
  const [n] = await deps.db.select().from(areas).where(eq(areas.id, id));
  return n!;
}

export async function eliminarArea(deps: Deps, u: Sesion, id: number) {
  const [a] = await deps.db.select().from(areas).where(eq(areas.id, id)).limit(1);
  if (!a) throw notFound("Área no encontrada.");
  exigirFacultad(u, a.facultadId);
  const [[t], [p]] = await Promise.all([
    deps.db.select({ n: count() }).from(tiposTramite).where(eq(tiposTramite.areaId, id)),
    deps.db.select({ n: count() }).from(usuarios).where(eq(usuarios.areaId, id)),
  ]);
  if ((t?.n ?? 0) + (p?.n ?? 0) > 0) throw conflict("El área tiene trámites o personal asociados. Desactívala en lugar de eliminarla.");
  await deps.db.delete(areas).where(eq(areas.id, id));
}

// ---------------------------------------------------------------------------
// Tipos de trámite (categorías)
// ---------------------------------------------------------------------------

export interface TipoInput {
  facultadId?: number | undefined;
  areaId: number;
  nombre: string;
  descripcion: string;
  requisitos: string[];
  plazoDias: number;
  activo?: boolean | undefined;
}

const limpiarRequisitos = (r: string[]) => [...new Set(r.map((x) => x.trim()).filter(Boolean))];

export async function crearTipo(deps: Deps, u: Sesion, d: TipoInput) {
  const facultadId = facultadObjetivo(u, d.facultadId);
  const area = await areaDeFacultad(deps, d.areaId, facultadId);
  if (!area.activa) throw unprocessable("El área seleccionada está inactiva.");
  const requisitos = limpiarRequisitos(d.requisitos);
  if (requisitos.length === 0) throw badRequest("Indica al menos un requisito.", { requisitos: "Obligatorio" });
  const [res] = await conDuplicado(
    () =>
      deps.db
        .insert(tiposTramite)
        .values({ facultadId, areaId: area.id, nombre: d.nombre.trim(), descripcion: d.descripcion.trim(), requisitos, plazoDias: d.plazoDias, activo: d.activo ?? true })
        .$returningId(),
    "Ya existe un trámite con ese nombre en la facultad.",
  );
  return res!.id;
}

export async function actualizarTipo(deps: Deps, u: Sesion, id: number, d: Omit<TipoInput, "facultadId">) {
  const [t] = await deps.db.select().from(tiposTramite).where(eq(tiposTramite.id, id)).limit(1);
  if (!t) throw notFound("Tipo de trámite no encontrado.");
  exigirFacultad(u, t.facultadId);
  const area = await areaDeFacultad(deps, d.areaId, t.facultadId);
  if (!area.activa && (d.activo ?? t.activo)) throw unprocessable("Un trámite activo no puede quedar en un área inactiva.");
  const requisitos = limpiarRequisitos(d.requisitos);
  if (requisitos.length === 0) throw badRequest("Indica al menos un requisito.", { requisitos: "Obligatorio" });
  // El nuevo plazo aplica a las solicitudes que se registren desde ahora; las
  // existentes conservan la fecha límite que se les comunicó al registrarlas.
  await conDuplicado(
    () =>
      deps.db
        .update(tiposTramite)
        .set({ areaId: area.id, nombre: d.nombre.trim(), descripcion: d.descripcion.trim(), requisitos, plazoDias: d.plazoDias, activo: d.activo ?? t.activo })
        .where(eq(tiposTramite.id, id)),
    "Ya existe un trámite con ese nombre en la facultad.",
  );
  return id;
}

export async function eliminarTipo(deps: Deps, u: Sesion, id: number) {
  const [t] = await deps.db.select().from(tiposTramite).where(eq(tiposTramite.id, id)).limit(1);
  if (!t) throw notFound("Tipo de trámite no encontrado.");
  exigirFacultad(u, t.facultadId);
  const [r] = await deps.db.select({ n: count() }).from(solicitudes).where(eq(solicitudes.tipoId, id));
  if ((r?.n ?? 0) > 0) throw conflict(`Tiene ${r!.n} solicitud(es) registradas. Desactívalo en lugar de eliminarlo para conservar el historial.`);
  await deps.db.delete(tiposTramite).where(eq(tiposTramite.id, id));
}

// ---------------------------------------------------------------------------
// Facultades y escuelas (solo administrador central)
// ---------------------------------------------------------------------------

function soloCentral(u: Sesion) {
  if (!esAdminCentral(u)) throw forbidden("Solo el administrador central gestiona las facultades.");
}

export async function listarFacultadesAdmin(deps: Deps, u: Sesion) {
  const facs = await deps.db
    .select()
    .from(facultades)
    .where(esAdminCentral(u) ? undefined : eq(facultades.id, u.facultadId!))
    .orderBy(asc(facultades.nombre));
  const ids = facs.map((f) => f.id);
  if (ids.length === 0) return [];
  const [escs, conteos] = await Promise.all([
    deps.db.select().from(escuelas).where(inArray(escuelas.facultadId, ids)).orderBy(asc(escuelas.nombre)),
    deps.db
      .select({ facultadId: usuarios.facultadId, rol: usuarios.rol, n: count() })
      .from(usuarios)
      .where(inArray(usuarios.facultadId, ids))
      .groupBy(usuarios.facultadId, usuarios.rol),
  ]);
  return facs.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    nombre: f.nombre,
    activa: f.activa,
    escuelas: escs.filter((e) => e.facultadId === f.id).map((e) => ({ id: e.id, nombre: e.nombre, activa: e.activa })),
    usuarios: Object.fromEntries(conteos.filter((c) => c.facultadId === f.id).map((c) => [c.rol, Number(c.n)])),
  }));
}

export async function guardarFacultad(deps: Deps, u: Sesion, id: number | null, d: { codigo: string; nombre: string; activa?: boolean | undefined }) {
  soloCentral(u);
  const datos = { codigo: d.codigo.trim().toUpperCase(), nombre: d.nombre.trim(), activa: d.activa ?? true };
  if (id === null) {
    const [res] = await conDuplicado(() => deps.db.insert(facultades).values(datos).$returningId(), "Ya existe una facultad con ese código o nombre.");
    return res!.id;
  }
  const [f] = await deps.db.select().from(facultades).where(eq(facultades.id, id)).limit(1);
  if (!f) throw notFound("Facultad no encontrada.");
  // El código forma parte de los expedientes ya emitidos (FISI-2026-00001): no se cambia.
  if (datos.codigo !== f.codigo) {
    const [s] = await deps.db.select({ n: count() }).from(solicitudes).where(eq(solicitudes.facultadId, id));
    if ((s?.n ?? 0) > 0) throw unprocessable("La facultad ya tiene expedientes con su código; no se puede cambiar.");
  }
  await conDuplicado(() => deps.db.update(facultades).set(datos).where(eq(facultades.id, id)), "Ya existe una facultad con ese código o nombre.");
  return id;
}

export async function guardarEscuela(deps: Deps, u: Sesion, facultadId: number, id: number | null, d: { nombre: string; activa?: boolean | undefined }) {
  soloCentral(u);
  const [f] = await deps.db.select().from(facultades).where(eq(facultades.id, facultadId)).limit(1);
  if (!f) throw notFound("Facultad no encontrada.");
  if (id === null) {
    const [res] = await conDuplicado(
      () => deps.db.insert(escuelas).values({ facultadId, nombre: d.nombre.trim(), activa: d.activa ?? true }).$returningId(),
      "Ya existe esa escuela en la facultad.",
    );
    return res!.id;
  }
  const [e] = await deps.db.select().from(escuelas).where(eq(escuelas.id, id)).limit(1);
  if (!e || e.facultadId !== facultadId) throw notFound("Escuela no encontrada.");
  await conDuplicado(
    () => deps.db.update(escuelas).set({ nombre: d.nombre.trim(), activa: d.activa ?? e.activa }).where(eq(escuelas.id, id)),
    "Ya existe esa escuela en la facultad.",
  );
  return id;
}
