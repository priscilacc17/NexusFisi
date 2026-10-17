import type { DataState, Request, Status } from "./types";

const d = (daysAgo: number, h = 10) => {
  const x = new Date();
  x.setDate(x.getDate() - daysAgo);
  x.setHours(h, 15, 0, 0);
  return x.toISOString();
};

export const users: DataState["users"] = [
  { id: "u1", name: "Lucía Ramírez Torres", email: "estudiante@nexusfisi.edu", password: "demo123", role: "estudiante", code: "20211534", cycle: "VII ciclo" },
  { id: "u2", name: "Diego Huamán Quispe", email: "diego@nexusfisi.edu", password: "demo123", role: "estudiante", code: "20220871", cycle: "V ciclo" },
  { id: "u3", name: "Carmen Salazar Vega", email: "personal@nexusfisi.edu", password: "demo123", role: "personal", area: "Secretaría Académica" },
  { id: "u4", name: "Jorge Medina Ríos", email: "jorge@nexusfisi.edu", password: "demo123", role: "personal", area: "Coordinación de Prácticas" },
  { id: "u5", name: "Ana Paredes Lino", email: "admin@nexusfisi.edu", password: "demo123", role: "admin", area: "Dirección de Escuela" },
];

export const types: DataState["types"] = [
  { id: "t1", name: "Constancia de estudios", description: "Documento que acredita tu matrícula vigente en la facultad.", requirements: ["Matrícula vigente", "DNI escaneado"], days: 3, active: true },
  { id: "t2", name: "Rectificación de matrícula", description: "Solicitud para agregar o retirar cursos dentro del plazo establecido.", requirements: ["Ficha de matrícula", "Justificación escrita"], days: 5, active: true },
  { id: "t3", name: "Convalidación de cursos", description: "Reconocimiento de cursos aprobados en otra institución o plan.", requirements: ["Certificado de notas", "Sílabos visados", "Resolución de traslado"], days: 15, active: true },
  { id: "t4", name: "Prácticas preprofesionales", description: "Inscripción y aprobación de la sede de prácticas clínicas.", requirements: ["Carta de aceptación de la sede", "Seguro vigente", "Récord académico"], days: 7, active: true },
  { id: "t5", name: "Justificación de inasistencia", description: "Justificación por motivos de salud u otros debidamente acreditados.", requirements: ["Certificado médico o documento sustentatorio"], days: 3, active: true },
  { id: "t6", name: "Reserva de matrícula", description: "Suspensión temporal de estudios por un periodo académico.", requirements: ["Solicitud firmada", "Constancia de no adeudo"], days: 10, active: true },
];

function req(n: number, typeId: string, studentId: string, subject: string, status: Status, daysAgo: number, extra: Partial<Request> = {}): Request {
  const code = `NF-2026-${String(n).padStart(4, "0")}`;
  const order: Status[] = ["Registrada", "En evaluación", "Asignada", "En atención", "Resuelta", "Cerrada"];
  const history: Request["history"] = [
    { id: `${code}-h0`, date: d(daysAgo, 9), userId: studentId, action: "Solicitud registrada", to: "Registrada" },
  ];
  const target = status === "Observada" ? "En evaluación" : status;
  const idx = order.indexOf(target);
  for (let i = 1; i <= idx; i++) {
    history.push({ id: `${code}-h${i}`, date: d(Math.max(daysAgo - i, 0), 10 + i), userId: "u3", action: "Cambio de estado", from: order[i - 1], to: order[i] });
  }
  if (status === "Observada") {
    history.push({ id: `${code}-hx`, date: d(Math.max(daysAgo - 2, 0), 15), userId: "u3", action: "Solicitud observada", from: "En evaluación", to: "Observada", note: extra.observations?.[0]?.text });
  }
  return {
    id: code, code, typeId, studentId, subject,
    description: "Solicito por favor la atención del presente trámite según los requisitos indicados.",
    status, createdAt: d(daysAgo, 9), updatedAt: history.at(-1)!.date,
    attachments: [{ id: `${code}-a1`, name: "dni_escaneado.pdf", size: 245000, uploadedAt: d(daysAgo, 9), uploadedBy: studentId }],
    observations: [], messages: [], history, ...extra,
  };
}

export const requests: Request[] = [
  req(1, "t1", "u1", "Constancia para beca", "Registrada", 1),
  req(2, "t4", "u1", "Prácticas en Hospital Rebagliati", "Observada", 6, {
    observations: [{ id: "o1", date: d(4, 15), userId: "u3", text: "La carta de aceptación no tiene firma del jefe de servicio. Adjunte una versión firmada.", resolved: false }],
    messages: [
      { id: "m1", date: d(4, 15), userId: "u3", text: "Hola Lucía, revisa la observación registrada por favor." },
      { id: "m2", date: d(3, 9), userId: "u1", text: "Entendido, estoy gestionando la firma en la sede." },
    ],
  }),
  req(3, "t3", "u1", "Convalidación de Anatomía I", "En atención", 12, { assigneeId: "u4" }),
  req(4, "t5", "u1", "Inasistencia por cita médica", "Resuelta", 20, { assigneeId: "u3", response: "Se aprueba la justificación de inasistencia del 02/10. Se comunicó al docente." }),
  req(5, "t2", "u2", "Retiro de curso Biomecánica", "En evaluación", 3),
  req(6, "t6", "u2", "Reserva semestre 2026-II", "Asignada", 8, { assigneeId: "u3" }),
  req(7, "t1", "u2", "Constancia para trabajo", "Cerrada", 30, { assigneeId: "u3", response: "Constancia emitida y enviada al correo institucional." }),
];

export function createSeed(): DataState {
  return structuredClone({ users, types, requests, notifications: [
    { id: "n1", userId: "u1", date: d(4, 15), text: "Tu solicitud NF-2026-0002 fue observada.", requestId: "NF-2026-0002", read: false },
    { id: "n2", userId: "u3", date: d(1, 9), text: "Nueva solicitud NF-2026-0001 registrada.", requestId: "NF-2026-0001", read: false },
  ], seq: 7 });
}
