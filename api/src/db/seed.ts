import path from "node:path";
import { fileURLToPath } from "node:url";
import { count, eq } from "drizzle-orm";
import { hashPassword } from "../auth/password.js";
import type { Env } from "../config/env.js";
import type { Sesion, Deps } from "../lib/context.js";
import { createLogger } from "../lib/logger.js";
import { MailerMemoria } from "../lib/mailer.js";
import { almacenDb, almacenDisco } from "../lib/storage.js";
import { crear, transicion, enviarMensaje } from "../modules/solicitudes/service.js";
import type { Accion } from "../domain/workflow.js";
import type { Db } from "./client.js";
import {
  areas,
  escuelas,
  facultades,
  tiposTramite,
  usuarios,
  solicitudes,
  type Prioridad,
  type Rol,
} from "./schema.js";

// Datos de DEMOSTRACIÓN. Contraseña de todas las cuentas: Demo1234.
// No se ejecuta en producción salvo que se pida explícitamente (npm run db:seed).
export const PASSWORD_DEMO = "Demo1234";

const FACULTADES: [string, string][] = [
  ["FM", "Facultad de Medicina"],
  ["FDCP", "Facultad de Derecho y Ciencia Política"],
  ["FLCH", "Facultad de Letras y Ciencias Humanas"],
  ["FFB", "Facultad de Farmacia y Bioquímica"],
  ["FO", "Facultad de Odontología"],
  ["FE", "Facultad de Educación"],
  ["FQIQ", "Facultad de Química e Ingeniería Química"],
  ["FMV", "Facultad de Medicina Veterinaria"],
  ["FCA", "Facultad de Ciencias Administrativas"],
  ["FCB", "Facultad de Ciencias Biológicas"],
  ["FCC", "Facultad de Ciencias Contables"],
  ["FCE", "Facultad de Ciencias Económicas"],
  ["FCF", "Facultad de Ciencias Físicas"],
  ["FCM", "Facultad de Ciencias Matemáticas"],
  ["FCCSS", "Facultad de Ciencias Sociales"],
  ["FIGMMG", "Facultad de Ingeniería Geológica, Minera, Metalúrgica y Geográfica"],
  ["FII", "Facultad de Ingeniería Industrial"],
  ["FPSI", "Facultad de Psicología"],
  ["FIEE", "Facultad de Ingeniería Electrónica y Eléctrica"],
  ["FISI", "Facultad de Ingeniería de Sistemas e Informática"],
];

const ESCUELAS: Record<string, string[]> = {
  FISI: ["Ingeniería de Sistemas", "Ingeniería de Software", "Ciencia de la Computación"],
  FM: ["Medicina Humana", "Enfermería", "Obstetricia", "Nutrición", "Tecnología Médica"],
  FDCP: ["Derecho", "Ciencia Política"],
  FIEE: [
    "Ingeniería Electrónica",
    "Ingeniería Eléctrica",
    "Ingeniería de Telecomunicaciones",
    "Ingeniería Biomédica",
  ],
  FII: ["Ingeniería Industrial", "Ingeniería Textil y Confecciones", "Ingeniería Agroindustrial"],
};

const AREAS = [
  { clave: "SA", nombre: "Secretaría Académica", oficina: "oficina de Secretaría Académica" },
  {
    clave: "MAT",
    nombre: "Unidad de Matrícula y Registros Académicos",
    oficina: "ventanilla de Matrícula",
  },
  { clave: "GT", nombre: "Unidad de Grados y Títulos", oficina: "oficina de Grados y Títulos" },
  { clave: "PR", nombre: "Oficina de Prácticas Preprofesionales", oficina: "oficina de Prácticas" },
] as const;
type ClaveArea = (typeof AREAS)[number]["clave"];

const TIPOS: {
  nombre: string;
  area: ClaveArea;
  dias: number;
  descripcion: string;
  requisitos: string[];
}[] = [
  {
    nombre: "Constancia de estudios",
    area: "MAT",
    dias: 3,
    descripcion: "Acredita que estás matriculado en el semestre vigente.",
    requisitos: ["Matrícula vigente en el semestre", "DNI escaneado (ambas caras)"],
  },
  {
    nombre: "Rectificación de matrícula",
    area: "MAT",
    dias: 5,
    descripcion: "Agregar o retirar asignaturas dentro del plazo del calendario académico.",
    requisitos: ["Ficha de matrícula", "Justificación escrita del cambio"],
  },
  {
    nombre: "Reserva de matrícula",
    area: "MAT",
    dias: 10,
    descripcion: "Suspensión temporal de estudios por uno o dos semestres.",
    requisitos: ["Solicitud firmada", "Constancia de no adeudo"],
  },
  {
    nombre: "Convalidación de asignaturas",
    area: "SA",
    dias: 15,
    descripcion: "Reconocimiento de asignaturas aprobadas en otro plan de estudios o institución.",
    requisitos: [
      "Certificado de notas",
      "Sílabos visados de las asignaturas",
      "Resolución de traslado (si corresponde)",
    ],
  },
  {
    nombre: "Justificación de inasistencia",
    area: "SA",
    dias: 3,
    descripcion: "Justifica inasistencias a evaluaciones por motivos de salud u otros acreditados.",
    requisitos: ["Certificado médico o documento sustentatorio"],
  },
  {
    nombre: "Constancia de egresado",
    area: "GT",
    dias: 7,
    descripcion: "Acredita que culminaste el plan de estudios.",
    requisitos: ["Récord académico con créditos completos", "DNI escaneado"],
  },
  {
    nombre: "Inscripción de prácticas preprofesionales",
    area: "PR",
    dias: 7,
    descripcion:
      "Registro y aprobación de la empresa o institución donde realizarás tus prácticas.",
    requisitos: [
      "Carta de aceptación de la empresa",
      "Plan de prácticas firmado",
      "Récord académico",
    ],
  },
];

interface Persona {
  email: string;
  nombre: string;
  rol: Rol;
  fac: string | null;
  area?: ClaveArea;
  escuela?: string;
  codigo?: string;
}

const PERSONAS: Persona[] = [
  {
    email: "admin.central@unmsm.edu.pe",
    nombre: "Administración Central NexusFisi",
    rol: "ADMIN",
    fac: null,
  },
  { email: "admin.fisi@unmsm.edu.pe", nombre: "Ana Paredes Lino", rol: "ADMIN", fac: "FISI" },
  {
    email: "supervisor.fisi@unmsm.edu.pe",
    nombre: "Carmen Salazar Vega",
    rol: "SUPERVISOR",
    fac: "FISI",
    area: "SA",
  },
  {
    email: "tecnico.fisi@unmsm.edu.pe",
    nombre: "Jorge Medina Ríos",
    rol: "TECNICO",
    fac: "FISI",
    area: "MAT",
  },
  {
    email: "tecnico2.fisi@unmsm.edu.pe",
    nombre: "Rosa Quispe Mamani",
    rol: "TECNICO",
    fac: "FISI",
    area: "PR",
  },
  {
    email: "estudiante.fisi@unmsm.edu.pe",
    nombre: "Lucía Ramírez Torres",
    rol: "ESTUDIANTE",
    fac: "FISI",
    escuela: "Ingeniería de Sistemas",
    codigo: "21200154",
  },
  {
    email: "estudiante2.fisi@unmsm.edu.pe",
    nombre: "Diego Huamán Quispe",
    rol: "ESTUDIANTE",
    fac: "FISI",
    escuela: "Ingeniería de Software",
    codigo: "22200871",
  },
  {
    email: "supervisor.fm@unmsm.edu.pe",
    nombre: "Patricia Llanos Cueva",
    rol: "SUPERVISOR",
    fac: "FM",
    area: "SA",
  },
  {
    email: "tecnico.fm@unmsm.edu.pe",
    nombre: "Miguel Torres Arce",
    rol: "TECNICO",
    fac: "FM",
    area: "MAT",
  },
  {
    email: "estudiante.fm@unmsm.edu.pe",
    nombre: "Valeria Chávez Rojas",
    rol: "ESTUDIANTE",
    fac: "FM",
    escuela: "Enfermería",
    codigo: "23010245",
  },
  {
    email: "supervisor.fdcp@unmsm.edu.pe",
    nombre: "Ricardo Vílchez Soto",
    rol: "SUPERVISOR",
    fac: "FDCP",
    area: "SA",
  },
  {
    email: "tecnico.fdcp@unmsm.edu.pe",
    nombre: "Elena Gutiérrez Paz",
    rol: "TECNICO",
    fac: "FDCP",
    area: "MAT",
  },
  {
    email: "estudiante.fdcp@unmsm.edu.pe",
    nombre: "Andrés Flores Ninaquispe",
    rol: "ESTUDIANTE",
    fac: "FDCP",
    escuela: "Derecho",
    codigo: "22020317",
  },
];

// Un PDF mínimo válido: pasa la verificación por contenido de la API.
const pdf = (nombre: string) =>
  new File([`%PDF-1.4\n% ${nombre}\n%%EOF\n`], nombre, { type: "application/pdf" });

export async function seed(
  db: Db,
  env: Env,
  opciones: { log?: (m: string) => void; deps?: Deps } = {},
) {
  const log = opciones.log ?? (() => undefined);
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(facultades);
  if (n > 0) {
    log("La base ya tiene datos: no se vuelve a sembrar.");
    return false;
  }

  const facId: Record<string, number> = {};
  for (const [codigo, nombre] of FACULTADES) {
    const [r] = await db.insert(facultades).values({ codigo, nombre }).$returningId();
    facId[codigo] = r!.id;
  }
  const escId: Record<string, number> = {};
  for (const [fac, lista] of Object.entries(ESCUELAS)) {
    for (const nombre of lista) {
      const [r] = await db
        .insert(escuelas)
        .values({ facultadId: facId[fac]!, nombre })
        .$returningId();
      escId[`${fac}:${nombre}`] = r!.id;
    }
  }
  // Toda facultad recibe sus áreas y el catálogo base de trámites, así cualquier
  // estudiante que se registre encuentra trámites disponibles.
  const areaId: Record<string, number> = {};
  const tipoId: Record<string, number> = {};
  for (const [codigo, nombre] of FACULTADES) {
    const pabellon = codigo === "FISI" ? "Pabellón FISI, 1.er piso" : `Local de la ${nombre}`;
    for (const a of AREAS) {
      const [r] = await db
        .insert(areas)
        .values({
          facultadId: facId[codigo]!,
          nombre: a.nombre,
          ubicacion: `${pabellon}, ${a.oficina}`,
        })
        .$returningId();
      areaId[`${codigo}:${a.clave}`] = r!.id;
    }
    for (const t of TIPOS) {
      const [r] = await db
        .insert(tiposTramite)
        .values({
          facultadId: facId[codigo]!,
          areaId: areaId[`${codigo}:${t.area}`]!,
          nombre: t.nombre,
          descripcion: t.descripcion,
          requisitos: t.requisitos,
          plazoDias: t.dias,
        })
        .$returningId();
      tipoId[`${codigo}:${t.nombre}`] = r!.id;
    }
  }

  const hash = await hashPassword(PASSWORD_DEMO);
  const ses: Record<string, Sesion> = {};
  for (const p of PERSONAS) {
    const facultadId = p.fac ? facId[p.fac]! : null;
    const [r] = await db
      .insert(usuarios)
      .values({
        nombre: p.nombre,
        email: p.email,
        passwordHash: hash,
        rol: p.rol,
        facultadId,
        areaId: p.area && p.fac ? areaId[`${p.fac}:${p.area}`]! : null,
        escuelaId: p.escuela && p.fac ? escId[`${p.fac}:${p.escuela}`]! : null,
        codigoEstudiante: p.codigo ?? null,
      })
      .$returningId();
    ses[p.email.split("@")[0]!] = {
      id: r!.id,
      nombre: p.nombre,
      email: p.email,
      rol: p.rol,
      facultadId,
    };
  }

  // Solicitudes recorriendo el flujo real con un reloj controlado.
  let reloj = new Date();
  // Los avisos por correo se apagan al sembrar: son datos de ejemplo.
  const base = opciones.deps ?? {
    almacen: env.STORAGE_DRIVER === "db" ? almacenDb(db) : almacenDisco(env.UPLOAD_DIR),
    mailer: new MailerMemoria(),
  };
  const deps: Deps = {
    db,
    env: { ...env, MAIL_NOTIFICACIONES: false },
    logger: createLogger({ LOG_LEVEL: "silent", NODE_ENV: env.NODE_ENV }),
    now: () => reloj,
    almacen: base.almacen,
    mailer: new MailerMemoria(),
  };
  const HOY = Date.now();
  const enDias = (d: number, hora = 10) => {
    const f = new Date(HOY - d * 86_400_000);
    f.setUTCHours(hora + 5, 15, 0, 0); // hora de Lima
    return f;
  };
  const version = async (codigo: string) =>
    (
      await db
        .select({ v: solicitudes.version })
        .from(solicitudes)
        .where(eq(solicitudes.codigo, codigo))
    )[0]!.v;
  const paso = async (
    dia: number,
    hora: number,
    quien: Sesion,
    codigo: string,
    accion: Accion,
    extra: {
      nota?: string;
      responsableId?: number;
      prioridad?: Prioridad;
      respuesta?: string;
    } = {},
  ) => {
    reloj = enDias(dia, hora);
    await transicion(deps, quien, codigo, { accion, version: await version(codigo), ...extra });
  };
  const nueva = async (
    dia: number,
    quien: Sesion,
    fac: string,
    tipo: string,
    asunto: string,
    descripcion: string,
    archivos: string[],
  ) => {
    reloj = enDias(dia, 9);
    return crear(
      deps,
      quien,
      { tipoId: tipoId[`${fac}:${tipo}`]!, asunto, descripcion },
      archivos.map(pdf),
    );
  };
  const msg = async (dia: number, hora: number, quien: Sesion, codigo: string, texto: string) => {
    reloj = enDias(dia, hora);
    await enviarMensaje(deps, quien, codigo, texto);
  };

  const lucia = ses["estudiante.fisi"]!,
    diego = ses["estudiante2.fisi"]!,
    carmen = ses["supervisor.fisi"]!,
    jorge = ses["tecnico.fisi"]!,
    rosa = ses["tecnico2.fisi"]!;

  // FISI ---------------------------------------------------------------------
  const c1 = await nueva(
    30,
    diego,
    "FISI",
    "Constancia de estudios",
    "Constancia para trabajo",
    "Solicito una constancia de estudios para presentarla en mi centro de prácticas.",
    ["dni_escaneado.pdf"],
  );
  await paso(30, 11, carmen, c1, "EVALUAR");
  await paso(29, 9, carmen, c1, "ASIGNAR", { responsableId: jorge.id });
  await paso(29, 10, jorge, c1, "INICIAR_ATENCION");
  await paso(28, 16, jorge, c1, "RESOLVER", {
    respuesta: "Se emitió la constancia de estudios y se envió a tu correo institucional.",
  });
  await paso(27, 8, diego, c1, "CERRAR");

  const c2 = await nueva(
    20,
    lucia,
    "FISI",
    "Justificación de inasistencia",
    "Inasistencia por cita médica",
    "Solicito justificar mi inasistencia al examen parcial de Estructura de Datos por una cita médica.",
    ["certificado_medico.pdf"],
  );
  await paso(20, 12, carmen, c2, "EVALUAR");
  await paso(19, 9, carmen, c2, "ASIGNAR", { responsableId: carmen.id, prioridad: "ALTA" });
  await paso(19, 10, carmen, c2, "INICIAR_ATENCION");
  await paso(18, 15, carmen, c2, "RESOLVER", {
    respuesta:
      "Se aprueba la justificación. Se comunicó al docente para la reprogramación del examen.",
  });

  const c3 = await nueva(
    12,
    lucia,
    "FISI",
    "Convalidación de asignaturas",
    "Convalidación de Algorítmica I",
    "Solicito la convalidación de Algorítmica I aprobada en mi plan de estudios anterior.",
    ["certificado_notas.pdf", "silabo_algoritmica.pdf"],
  );
  await paso(11, 10, carmen, c3, "EVALUAR");
  await paso(10, 9, carmen, c3, "ASIGNAR", { responsableId: jorge.id });
  await paso(10, 11, jorge, c3, "INICIAR_ATENCION");

  const c4 = await nueva(
    8,
    diego,
    "FISI",
    "Reserva de matrícula",
    "Reserva de matrícula 2027-I",
    "Solicito la reserva de matrícula del semestre 2027-I por motivos laborales.",
    ["solicitud_firmada.pdf", "constancia_no_adeudo.pdf"],
  );
  await paso(7, 10, carmen, c4, "EVALUAR");
  await paso(6, 9, carmen, c4, "ASIGNAR", { responsableId: jorge.id, prioridad: "ALTA" });

  const c5 = await nueva(
    9,
    diego,
    "FISI",
    "Constancia de estudios",
    "Constancia para beca de transporte",
    "Necesito la constancia de estudios para postular a la beca de transporte universitario.",
    ["dni_escaneado.pdf"],
  );
  await paso(8, 11, carmen, c5, "EVALUAR");

  const c6 = await nueva(
    6,
    lucia,
    "FISI",
    "Inscripción de prácticas preprofesionales",
    "Prácticas en desarrollo de software",
    "Solicito inscribir mis prácticas preprofesionales en el área de desarrollo de una empresa de tecnología.",
    ["carta_aceptacion.pdf", "plan_practicas.pdf"],
  );
  await paso(5, 10, carmen, c6, "EVALUAR");
  await paso(4, 15, carmen, c6, "OBSERVAR", {
    nota: "La carta de aceptación no tiene la firma del representante de la empresa. Adjunta una versión firmada.",
  });
  await msg(4, 15, carmen, c6, "Hola Lucía, revisa la observación registrada, por favor.");
  await msg(3, 9, lucia, c6, "Entendido, estoy gestionando la firma con la empresa.");

  const c7 = await nueva(
    3,
    diego,
    "FISI",
    "Rectificación de matrícula",
    "Retiro de Base de Datos II",
    "Solicito el retiro de la asignatura Base de Datos II por cruce de horario con mis prácticas.",
    ["ficha_matricula.pdf"],
  );
  await paso(2, 10, carmen, c7, "EVALUAR");

  await nueva(
    1,
    lucia,
    "FISI",
    "Constancia de estudios",
    "Constancia para beca de investigación",
    "Necesito la constancia de estudios para postular a la beca de investigación del vicerrectorado.",
    ["dni_escaneado.pdf"],
  );

  const c9 = await nueva(
    15,
    diego,
    "FISI",
    "Inscripción de prácticas preprofesionales",
    "Prácticas en soporte de TI",
    "Solicito inscribir mis prácticas en el área de soporte técnico de una entidad pública.",
    ["carta_aceptacion.pdf"],
  );
  await paso(14, 10, carmen, c9, "EVALUAR");
  await paso(14, 11, carmen, c9, "ASIGNAR", { responsableId: rosa.id });
  await paso(13, 9, rosa, c9, "INICIAR_ATENCION");
  await paso(12, 16, rosa, c9, "RESOLVER", {
    respuesta: "Prácticas inscritas. Presenta tu informe mensual en la Oficina de Prácticas.",
  });
  await paso(11, 9, carmen, c9, "CERRAR");

  // Medicina y Derecho --------------------------------------------------------
  const valeria = ses["estudiante.fm"]!,
    patricia = ses["supervisor.fm"]!,
    miguel = ses["tecnico.fm"]!;
  const m1 = await nueva(
    10,
    valeria,
    "FM",
    "Constancia de estudios",
    "Constancia para internado",
    "Solicito constancia de estudios para el proceso de internado hospitalario.",
    ["dni_escaneado.pdf"],
  );
  await paso(9, 10, patricia, m1, "EVALUAR");
  await paso(9, 11, patricia, m1, "ASIGNAR", { responsableId: miguel.id, prioridad: "URGENTE" });
  await paso(8, 9, miguel, m1, "INICIAR_ATENCION");
  await paso(7, 12, miguel, m1, "RESOLVER", {
    respuesta:
      "Constancia emitida. Recógela en la ventanilla de Matrícula o descárgala desde el expediente.",
  });
  await nueva(
    2,
    valeria,
    "FM",
    "Justificación de inasistencia",
    "Inasistencia a práctica clínica",
    "Solicito justificar mi inasistencia a la práctica del lunes por motivos de salud.",
    ["certificado_medico.pdf"],
  );

  const andres = ses["estudiante.fdcp"]!,
    ricardo = ses["supervisor.fdcp"]!;
  const d1 = await nueva(
    5,
    andres,
    "FDCP",
    "Rectificación de matrícula",
    "Agregar Derecho Procesal Civil",
    "Solicito agregar la asignatura Derecho Procesal Civil en el horario de la mañana.",
    ["ficha_matricula.pdf"],
  );
  await paso(4, 10, ricardo, d1, "EVALUAR");

  log(
    `Sembradas ${FACULTADES.length} facultades, ${PERSONAS.length} usuarios demo y solicitudes de ejemplo. Contraseña: ${PASSWORD_DEMO}`,
  );
  return true;
}

// Uso directo: npm run db:seed
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { loadEnv } = await import("../config/env.js");
  const { createDatabase } = await import("./client.js");
  const { runMigrations } = await import("./migrate.js");
  const env = loadEnv();
  const database = createDatabase(
    env.DATABASE_URL,
    env.DATABASE_SSL ? { ca: env.DATABASE_SSL_CA } : undefined,
  );
  await runMigrations(database.db);
  await seed(database.db, env, { log: console.log });
  await database.close();
}
