import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// Modelo de datos de NEXUS.
//
// Jerarquía organizativa: Universidad (UNMSM, única) → Facultad → Escuela / Área.
// Todo lo operativo cuelga de una facultad: los tipos de trámite, el personal que
// los atiende y las solicitudes. Así el personal de una facultad nunca ve ni toca
// las solicitudes de otra, y cada facultad numera sus expedientes por separado.

export const ROLES = ["ESTUDIANTE", "TECNICO", "SUPERVISOR", "ADMIN"] as const;
export const ESTADOS = [
  "REGISTRADA",
  "EN_EVALUACION",
  "OBSERVADA",
  "ASIGNADA",
  "EN_ATENCION",
  "RESUELTA",
  "CERRADA",
] as const;
export const PRIORIDADES = ["BAJA", "MEDIA", "ALTA", "URGENTE"] as const;
export const TIPOS_CIERRE = ["CONFORME", "DESISTIDA", "SUPERVISOR"] as const;
export const ETAPAS_ADJUNTO = ["REGISTRO", "CORRECCION", "ATENCION"] as const;

export type Rol = (typeof ROLES)[number];
export type Estado = (typeof ESTADOS)[number];
export type Prioridad = (typeof PRIORIDADES)[number];
export type TipoCierre = (typeof TIPOS_CIERRE)[number];
export type EtapaAdjunto = (typeof ETAPAS_ADJUNTO)[number];

// Fechas en UTC con milisegundos; la conexión fija timezone "Z".
const ts = (name: string) => datetime(name, { mode: "date", fsp: 3 });
const creado = () =>
  ts("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`);

export const facultades = mysqlTable(
  "facultades",
  {
    id: int("id").autoincrement().primaryKey(),
    codigo: varchar("codigo", { length: 12 }).notNull(),
    nombre: varchar("nombre", { length: 160 }).notNull(),
    activa: boolean("activa").notNull().default(true),
    createdAt: creado(),
  },
  (t) => [
    uniqueIndex("uq_facultades_codigo").on(t.codigo),
    uniqueIndex("uq_facultades_nombre").on(t.nombre),
  ],
);

export const escuelas = mysqlTable(
  "escuelas",
  {
    id: int("id").autoincrement().primaryKey(),
    facultadId: int("facultad_id")
      .notNull()
      .references(() => facultades.id),
    nombre: varchar("nombre", { length: 160 }).notNull(),
    activa: boolean("activa").notNull().default(true),
  },
  (t) => [uniqueIndex("uq_escuelas_facultad_nombre").on(t.facultadId, t.nombre)],
);

// Área responsable: la oficina de la facultad que atiende un tipo de trámite.
export const areas = mysqlTable(
  "areas",
  {
    id: int("id").autoincrement().primaryKey(),
    facultadId: int("facultad_id")
      .notNull()
      .references(() => facultades.id),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    ubicacion: varchar("ubicacion", { length: 200 }).notNull(),
    activa: boolean("activa").notNull().default(true),
  },
  (t) => [uniqueIndex("uq_areas_facultad_nombre").on(t.facultadId, t.nombre)],
);

export const usuarios = mysqlTable(
  "usuarios",
  {
    id: int("id").autoincrement().primaryKey(),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    passwordHash: varchar("password_hash", { length: 100 }).notNull(),
    rol: mysqlEnum("rol", ROLES).notNull(),
    // NULL solo para el administrador central (ve y gestiona todas las facultades).
    facultadId: int("facultad_id").references(() => facultades.id),
    escuelaId: int("escuela_id").references(() => escuelas.id),
    areaId: int("area_id").references(() => areas.id),
    codigoEstudiante: varchar("codigo_estudiante", { length: 10 }),
    activo: boolean("activo").notNull().default(true),
    intentosFallidos: int("intentos_fallidos").notNull().default(0),
    bloqueadoHasta: ts("bloqueado_hasta"),
    // Se incrementa al cambiar la contraseña o desactivar la cuenta: invalida los JWT emitidos antes.
    tokenVersion: int("token_version").notNull().default(0),
    createdAt: creado(),
  },
  (t) => [
    uniqueIndex("uq_usuarios_email").on(t.email),
    uniqueIndex("uq_usuarios_codigo_estudiante").on(t.codigoEstudiante),
    index("ix_usuarios_facultad_rol").on(t.facultadId, t.rol),
  ],
);

export const tiposTramite = mysqlTable(
  "tipos_tramite",
  {
    id: int("id").autoincrement().primaryKey(),
    facultadId: int("facultad_id")
      .notNull()
      .references(() => facultades.id),
    areaId: int("area_id")
      .notNull()
      .references(() => areas.id),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    descripcion: varchar("descripcion", { length: 500 }).notNull(),
    requisitos: json("requisitos").$type<string[]>().notNull(),
    plazoDias: int("plazo_dias").notNull(),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [uniqueIndex("uq_tipos_facultad_nombre").on(t.facultadId, t.nombre)],
);

// Correlativo de expedientes por facultad y año. Se incrementa de forma atómica
// (INSERT ... ON DUPLICATE KEY UPDATE con LAST_INSERT_ID) para que dos registros
// simultáneos nunca obtengan el mismo código.
export const secuencias = mysqlTable(
  "secuencias",
  {
    facultadId: int("facultad_id")
      .notNull()
      .references(() => facultades.id),
    anio: int("anio").notNull(),
    ultimo: int("ultimo").notNull(),
  },
  (t) => [primaryKey({ columns: [t.facultadId, t.anio] })],
);

export const solicitudes = mysqlTable(
  "solicitudes",
  {
    id: int("id").autoincrement().primaryKey(),
    codigo: varchar("codigo", { length: 24 }).notNull(),
    facultadId: int("facultad_id")
      .notNull()
      .references(() => facultades.id),
    tipoId: int("tipo_id")
      .notNull()
      .references(() => tiposTramite.id),
    estudianteId: int("estudiante_id")
      .notNull()
      .references(() => usuarios.id),
    responsableId: int("responsable_id").references(() => usuarios.id),
    asunto: varchar("asunto", { length: 120 }).notNull(),
    descripcion: text("descripcion").notNull(),
    estado: mysqlEnum("estado", ESTADOS).notNull().default("REGISTRADA"),
    // Estado desde el que se observó: la corrección devuelve la solicitud ahí
    // (a evaluación o a atención) en lugar de reiniciar todo el flujo.
    estadoPrevio: mysqlEnum("estado_previo", ESTADOS),
    prioridad: mysqlEnum("prioridad", PRIORIDADES).notNull().default("MEDIA"),
    respuesta: text("respuesta"),
    tipoCierre: mysqlEnum("tipo_cierre", TIPOS_CIERRE),
    reaperturas: int("reaperturas").notNull().default(0),
    fechaLimite: ts("fecha_limite").notNull(),
    resueltaAt: ts("resuelta_at"),
    cerradaAt: ts("cerrada_at"),
    // Bloqueo optimista: cada cambio exige la versión que vio el usuario.
    version: int("version").notNull().default(0),
    createdAt: creado(),
    updatedAt: ts("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [
    uniqueIndex("uq_solicitudes_codigo").on(t.codigo),
    index("ix_solicitudes_facultad_estado").on(t.facultadId, t.estado),
    index("ix_solicitudes_estudiante").on(t.estudianteId),
    index("ix_solicitudes_responsable").on(t.responsableId),
  ],
);

export const adjuntos = mysqlTable(
  "adjuntos",
  {
    id: int("id").autoincrement().primaryKey(),
    solicitudId: int("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    nombreOriginal: varchar("nombre_original", { length: 200 }).notNull(),
    nombreAlmacenado: varchar("nombre_almacenado", { length: 80 }).notNull(),
    mime: varchar("mime", { length: 60 }).notNull(),
    tamano: int("tamano").notNull(),
    etapa: mysqlEnum("etapa", ETAPAS_ADJUNTO).notNull(),
    subidoPor: int("subido_por")
      .notNull()
      .references(() => usuarios.id),
    createdAt: creado(),
  },
  (t) => [
    index("ix_adjuntos_solicitud").on(t.solicitudId),
    uniqueIndex("uq_adjuntos_almacenado").on(t.nombreAlmacenado),
  ],
);

export const observaciones = mysqlTable(
  "observaciones",
  {
    id: int("id").autoincrement().primaryKey(),
    solicitudId: int("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    autorId: int("autor_id")
      .notNull()
      .references(() => usuarios.id),
    texto: text("texto").notNull(),
    resuelta: boolean("resuelta").notNull().default(false),
    createdAt: creado(),
    resueltaAt: ts("resuelta_at"),
  },
  (t) => [index("ix_observaciones_solicitud").on(t.solicitudId)],
);

// Historial: una fila por cada movimiento del expediente.
export const movimientos = mysqlTable(
  "movimientos",
  {
    id: int("id").autoincrement().primaryKey(),
    solicitudId: int("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    usuarioId: int("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    accion: varchar("accion", { length: 120 }).notNull(),
    estadoDesde: mysqlEnum("estado_desde", ESTADOS),
    estadoHasta: mysqlEnum("estado_hasta", ESTADOS),
    nota: text("nota"),
    createdAt: creado(),
  },
  (t) => [index("ix_movimientos_solicitud").on(t.solicitudId)],
);

export const mensajes = mysqlTable(
  "mensajes",
  {
    id: int("id").autoincrement().primaryKey(),
    solicitudId: int("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    autorId: int("autor_id")
      .notNull()
      .references(() => usuarios.id),
    texto: text("texto").notNull(),
    createdAt: creado(),
  },
  (t) => [index("ix_mensajes_solicitud").on(t.solicitudId)],
);

export const notificaciones = mysqlTable(
  "notificaciones",
  {
    id: int("id").autoincrement().primaryKey(),
    usuarioId: int("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    solicitudId: int("solicitud_id").references(() => solicitudes.id),
    texto: varchar("texto", { length: 255 }).notNull(),
    leida: boolean("leida").notNull().default(false),
    createdAt: creado(),
  },
  (t) => [index("ix_notificaciones_usuario").on(t.usuarioId, t.leida)],
);

// Enlaces de recuperación de contraseña. Se guarda el HASH del token (no el
// token): quien lea la base no puede usar los enlaces vigentes.
export const restablecimientos = mysqlTable(
  "restablecimientos",
  {
    id: int("id").autoincrement().primaryKey(),
    usuarioId: int("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiraAt: ts("expira_at").notNull(),
    usadoAt: ts("usado_at"),
    createdAt: creado(),
  },
  (t) => [
    uniqueIndex("uq_restablecimientos_hash").on(t.tokenHash),
    index("ix_restablecimientos_usuario").on(t.usuarioId),
  ],
);

const longblob = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "longblob" });

// Contenido de los adjuntos cuando STORAGE_DRIVER=db (plataformas sin disco persistente).
export const archivos = mysqlTable("archivos", {
  nombreAlmacenado: varchar("nombre_almacenado", { length: 80 }).primaryKey(),
  datos: longblob("datos").notNull(),
});
