import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { escuelas, facultades, restablecimientos, usuarios } from "../../db/schema.js";
import { enviarSinEsperar } from "../../lib/mailer.js";
import {
  HASH_SEÑUELO,
  hashPassword,
  validarPassword,
  verificarPassword,
} from "../../auth/password.js";
import { firmarToken } from "../../auth/jwt.js";
import type { Deps } from "../../lib/context.js";
import { AppError, badRequest, conflict, unauthorized, unprocessable } from "../../lib/errors.js";
import { usuarioPublico } from "../usuarios/consultas.js";

export const DOMINIO_INSTITUCIONAL = "@unmsm.edu.pe";
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

export interface RegistroInput {
  nombre: string;
  email: string;
  password: string;
  codigoEstudiante: string;
  facultadId: number;
  escuelaId?: number | undefined;
}

// Autoregistro: SOLO crea estudiantes. El rol no viene del cliente, así que no
// hay forma de registrarse como personal o administrador.
export async function registrar(deps: Deps, input: RegistroInput) {
  const email = normalizarEmail(input.email);
  if (!email.endsWith(DOMINIO_INSTITUCIONAL))
    throw badRequest("Usa tu correo institucional.", {
      email: `Debe terminar en ${DOMINIO_INSTITUCIONAL}`,
    });
  const errPass = validarPassword(input.password);
  if (errPass) throw badRequest(errPass, { password: errPass });

  const [fac] = await deps.db
    .select()
    .from(facultades)
    .where(eq(facultades.id, input.facultadId))
    .limit(1);
  if (!fac || !fac.activa) throw unprocessable("La facultad seleccionada no está disponible.");
  const escuelasFac = await deps.db
    .select({ id: escuelas.id })
    .from(escuelas)
    .where(and(eq(escuelas.facultadId, fac.id), eq(escuelas.activa, true)));
  if (escuelasFac.length > 0 && !escuelasFac.some((e) => e.id === input.escuelaId)) {
    throw badRequest("Selecciona tu escuela profesional.", {
      escuelaId: "Escuela inválida para la facultad elegida",
    });
  }

  const [dup] = await deps.db
    .select({ email: usuarios.email, codigo: usuarios.codigoEstudiante })
    .from(usuarios)
    .where(
      sql`${usuarios.email} = ${email} OR ${usuarios.codigoEstudiante} = ${input.codigoEstudiante}`,
    )
    .limit(1);
  if (dup)
    throw conflict(
      dup.email === email
        ? "Ya existe una cuenta con ese correo."
        : "Ese código de estudiante ya está registrado.",
    );

  const [res] = await deps.db
    .insert(usuarios)
    .values({
      nombre: input.nombre.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      rol: "ESTUDIANTE",
      facultadId: fac.id,
      escuelaId: escuelasFac.length > 0 ? input.escuelaId : null,
      codigoEstudiante: input.codigoEstudiante,
    })
    .$returningId();
  return usuarioPublico(deps.db, res!.id);
}

export async function login(deps: Deps, emailIn: string, password: string) {
  const email = normalizarEmail(emailIn);
  const ahora = deps.now();
  const [u] = await deps.db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (!u) {
    await verificarPassword(password, HASH_SEÑUELO);
    throw unauthorized("Correo o contraseña incorrectos.");
  }
  if (u.bloqueadoHasta && u.bloqueadoHasta > ahora) {
    const min = Math.ceil((u.bloqueadoHasta.getTime() - ahora.getTime()) / 60000);
    throw new AppError(
      423,
      "CUENTA_BLOQUEADA",
      `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${min} min.`,
    );
  }
  const valida = await verificarPassword(password, u.passwordHash);
  if (!valida) {
    const intentos = u.intentosFallidos + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await deps.db
      .update(usuarios)
      .set({
        intentosFallidos: bloquear ? 0 : intentos,
        bloqueadoHasta: bloquear ? new Date(ahora.getTime() + BLOQUEO_MIN * 60000) : null,
      })
      .where(eq(usuarios.id, u.id));
    throw unauthorized("Correo o contraseña incorrectos.");
  }
  if (!u.activo)
    throw new AppError(
      403,
      "CUENTA_INACTIVA",
      "Tu cuenta está desactivada. Comunícate con la administración de tu facultad.",
    );
  if (u.intentosFallidos > 0 || u.bloqueadoHasta) {
    await deps.db
      .update(usuarios)
      .set({ intentosFallidos: 0, bloqueadoHasta: null })
      .where(eq(usuarios.id, u.id));
  }
  const token = await firmarToken(
    { sub: String(u.id), rol: u.rol, fac: u.facultadId, tv: u.tokenVersion },
    deps.env.JWT_SECRET,
    deps.env.JWT_EXPIRES_IN,
  );
  return { token, usuario: (await usuarioPublico(deps.db, u.id))! };
}

export async function cambiarPassword(deps: Deps, userId: number, actual: string, nueva: string) {
  const [u] = await deps.db.select().from(usuarios).where(eq(usuarios.id, userId)).limit(1);
  if (!u || !(await verificarPassword(actual, u.passwordHash)))
    throw badRequest("La contraseña actual no es correcta.", { actual: "Incorrecta" });
  const err = validarPassword(nueva);
  if (err) throw badRequest(err, { nueva: err });
  if (actual === nueva)
    throw badRequest("La nueva contraseña debe ser distinta de la actual.", {
      nueva: "Igual a la actual",
    });
  await deps.db
    .update(usuarios)
    .set({
      passwordHash: await hashPassword(nueva),
      tokenVersion: sql`${usuarios.tokenVersion} + 1`,
    })
    .where(eq(usuarios.id, userId));
  // Devuelve un token nuevo: el anterior quedó invalidado por token_version.
  const [n] = await deps.db.select().from(usuarios).where(eq(usuarios.id, userId)).limit(1);
  return firmarToken(
    { sub: String(n!.id), rol: n!.rol, fac: n!.facultadId, tv: n!.tokenVersion },
    deps.env.JWT_SECRET,
    deps.env.JWT_EXPIRES_IN,
  );
}

// ---------------------------------------------------------------------------
// Recuperación de contraseña por correo
// ---------------------------------------------------------------------------

const VIGENCIA_ENLACE_MIN = 30;
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

// Responde siempre igual (exista o no la cuenta) y no espera al correo, para no
// revelar qué correos están registrados ni por el mensaje ni por el tiempo.
export async function solicitarRecuperacion(deps: Deps, emailIn: string) {
  const email = normalizarEmail(emailIn);
  const [u] = await deps.db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (!u || !u.activo) return;
  const ahora = deps.now();
  const token = randomBytes(32).toString("base64url");
  // Un enlace nuevo anula los anteriores que no se usaron.
  await deps.db
    .update(restablecimientos)
    .set({ usadoAt: ahora })
    .where(and(eq(restablecimientos.usuarioId, u.id), isNull(restablecimientos.usadoAt)));
  await deps.db.insert(restablecimientos).values({
    usuarioId: u.id,
    tokenHash: hashToken(token),
    expiraAt: new Date(ahora.getTime() + VIGENCIA_ENLACE_MIN * 60_000),
    createdAt: ahora,
  });
  const url = new URL("/restablecer", deps.env.PUBLIC_URL);
  url.searchParams.set("token", token);
  enviarSinEsperar(deps.mailer, deps.logger, [
    {
      para: u.email,
      asunto: "Restablece tu contraseña de NEXUS",
      texto: `Hola ${u.nombre}.\nRecibimos una solicitud para restablecer tu contraseña. El enlace vence en ${VIGENCIA_ENLACE_MIN} minutos y solo se puede usar una vez.\nSi no fuiste tú, ignora este correo: tu contraseña no cambiará.`,
      boton: { texto: "Crear una nueva contraseña", url: url.toString() },
    },
  ]);
}

export async function restablecerConToken(deps: Deps, token: string, password: string) {
  const ahora = deps.now();
  const [r] = await deps.db
    .select()
    .from(restablecimientos)
    .where(
      and(
        eq(restablecimientos.tokenHash, hashToken(token)),
        isNull(restablecimientos.usadoAt),
        gt(restablecimientos.expiraAt, ahora),
      ),
    )
    .limit(1);
  if (!r)
    throw badRequest("El enlace no es válido o ya venció. Solicita uno nuevo.", {
      token: "Enlace inválido o vencido",
    });
  const err = validarPassword(password);
  if (err) throw badRequest(err, { password: err });
  await deps.db.transaction(async (tx) => {
    await tx
      .update(usuarios)
      .set({
        passwordHash: await hashPassword(password),
        intentosFallidos: 0,
        bloqueadoHasta: null,
        tokenVersion: sql`${usuarios.tokenVersion} + 1`,
      })
      .where(eq(usuarios.id, r.usuarioId));
    await tx
      .update(restablecimientos)
      .set({ usadoAt: ahora })
      .where(and(eq(restablecimientos.usuarioId, r.usuarioId), isNull(restablecimientos.usadoAt)));
  });
}
