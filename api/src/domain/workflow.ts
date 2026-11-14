import type { Estado, Prioridad, Rol } from "../db/schema.js";

// Flujo de una solicitud. Es la ÚNICA fuente de verdad sobre qué se puede hacer:
// la API valida con estas funciones y además le devuelve al frontend la lista de
// acciones permitidas, para que la interfaz nunca muestre un botón que el
// servidor después rechazaría.
//
//   REGISTRADA ──evaluar──▶ EN_EVALUACION ──asignar──▶ ASIGNADA ──iniciar──▶ EN_ATENCION ──resolver──▶ RESUELTA ──cerrar──▶ CERRADA
//                               │  ▲                     ▲  │ reasignar        │  ▲                     │
//                       observar│  │corregir              └──┘                  │  │corregir             └─reabrir (1 vez)─▶ EN_ATENCION
//                               ▼  │                                  observar ▼  │
//                             OBSERVADA ◀───────────────────────────────────────── OBSERVADA
//
// La corrección devuelve la solicitud al estado desde el que se observó.
// El estudiante puede desistir mientras nadie la está atendiendo todavía.

export const ACCIONES = [
  "EVALUAR",
  "OBSERVAR",
  "ASIGNAR",
  "REASIGNAR",
  "INICIAR_ATENCION",
  "RESOLVER",
  "CERRAR",
  "CORREGIR",
  "DESISTIR",
  "REABRIR",
  "PRIORIZAR",
] as const;
export type Accion = (typeof ACCIONES)[number];

export const ESTADOS_FINALES: readonly Estado[] = ["RESUELTA", "CERRADA"];
export const MAX_REAPERTURAS = 1;

export interface Actor {
  id: number;
  rol: Rol;
  facultadId: number | null;
}

export interface EstadoSolicitud {
  estado: Estado;
  estadoPrevio: Estado | null;
  estudianteId: number;
  responsableId: number | null;
  facultadId: number;
  reaperturas: number;
}

const esSupervisor = (a: Actor, s: EstadoSolicitud) => a.rol === "SUPERVISOR" && a.facultadId === s.facultadId;
const esResponsable = (a: Actor, s: EstadoSolicitud) =>
  (a.rol === "TECNICO" || a.rol === "SUPERVISOR") && a.facultadId === s.facultadId && a.id === s.responsableId;
const esDueno = (a: Actor, s: EstadoSolicitud) => a.rol === "ESTUDIANTE" && a.id === s.estudianteId;

const REGLAS: Record<Accion, (a: Actor, s: EstadoSolicitud) => boolean> = {
  EVALUAR: (a, s) => s.estado === "REGISTRADA" && esSupervisor(a, s),
  OBSERVAR: (a, s) =>
    (s.estado === "EN_EVALUACION" && esSupervisor(a, s)) ||
    (s.estado === "EN_ATENCION" && (esSupervisor(a, s) || esResponsable(a, s))),
  ASIGNAR: (a, s) => s.estado === "EN_EVALUACION" && esSupervisor(a, s),
  REASIGNAR: (a, s) => (s.estado === "ASIGNADA" || s.estado === "EN_ATENCION") && esSupervisor(a, s),
  INICIAR_ATENCION: (a, s) => s.estado === "ASIGNADA" && esResponsable(a, s),
  RESOLVER: (a, s) => s.estado === "EN_ATENCION" && (esResponsable(a, s) || esSupervisor(a, s)),
  CERRAR: (a, s) => s.estado === "RESUELTA" && (esDueno(a, s) || esSupervisor(a, s)),
  CORREGIR: (a, s) => s.estado === "OBSERVADA" && esDueno(a, s),
  DESISTIR: (a, s) => (s.estado === "REGISTRADA" || s.estado === "EN_EVALUACION" || s.estado === "OBSERVADA") && esDueno(a, s),
  REABRIR: (a, s) => s.estado === "RESUELTA" && esDueno(a, s) && s.reaperturas < MAX_REAPERTURAS,
  PRIORIZAR: (a, s) => !ESTADOS_FINALES.includes(s.estado) && esSupervisor(a, s),
};

export function accionesPermitidas(actor: Actor, s: EstadoSolicitud): Accion[] {
  return ACCIONES.filter((acc) => REGLAS[acc](actor, s));
}

export function puede(actor: Actor, accion: Accion, s: EstadoSolicitud): boolean {
  return REGLAS[accion](actor, s);
}

export function estadoDestino(accion: Accion, s: EstadoSolicitud): Estado {
  switch (accion) {
    case "EVALUAR":
      return "EN_EVALUACION";
    case "OBSERVAR":
      return "OBSERVADA";
    case "ASIGNAR":
    case "REASIGNAR":
      return "ASIGNADA";
    case "INICIAR_ATENCION":
    case "REABRIR":
      return "EN_ATENCION";
    case "RESOLVER":
      return "RESUELTA";
    case "CERRAR":
    case "DESISTIR":
      return "CERRADA";
    case "CORREGIR":
      return s.estadoPrevio ?? "EN_EVALUACION";
    case "PRIORIZAR":
      return s.estado;
  }
}

// Datos que exige cada acción. Se validan en el servicio con mensajes claros.
export interface DatosAccion {
  nota?: string | undefined;
  responsableId?: number | undefined;
  prioridad?: Prioridad | undefined;
  respuesta?: string | undefined;
}

export function validarDatos(accion: Accion, d: DatosAccion): string | null {
  const largo = (v: string | undefined, min: number) => (v?.trim().length ?? 0) >= min;
  switch (accion) {
    case "OBSERVAR":
      return largo(d.nota, 10) ? null : "Describe la observación para el estudiante (mínimo 10 caracteres).";
    case "CORREGIR":
      return largo(d.nota, 10) ? null : "Explica la corrección realizada (mínimo 10 caracteres).";
    case "REABRIR":
      return largo(d.nota, 10) ? null : "Indica por qué no estás conforme (mínimo 10 caracteres).";
    case "DESISTIR":
      return largo(d.nota, 5) ? null : "Indica el motivo del desistimiento (mínimo 5 caracteres).";
    case "RESOLVER":
      return largo(d.respuesta, 10) ? null : "Escribe la respuesta para el estudiante (mínimo 10 caracteres).";
    case "ASIGNAR":
    case "REASIGNAR":
      return d.responsableId ? null : "Selecciona un responsable.";
    case "PRIORIZAR":
      return d.prioridad ? null : "Selecciona una prioridad.";
    default:
      return null;
  }
}

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  REGISTRADA: "Registrada",
  EN_EVALUACION: "En evaluación",
  OBSERVADA: "Observada",
  ASIGNADA: "Asignada",
  EN_ATENCION: "En atención",
  RESUELTA: "Resuelta",
  CERRADA: "Cerrada",
};

export const ETIQUETA_PRIORIDAD: Record<Prioridad, string> = { BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", URGENTE: "Urgente" };

export const ETIQUETA_ACCION: Record<Accion, string> = {
  EVALUAR: "Evaluación iniciada",
  OBSERVAR: "Solicitud observada",
  ASIGNAR: "Responsable asignado",
  REASIGNAR: "Responsable reasignado",
  INICIAR_ATENCION: "Atención iniciada",
  RESOLVER: "Solicitud resuelta",
  CERRAR: "Expediente cerrado",
  CORREGIR: "Corrección enviada",
  DESISTIR: "Solicitud desistida por el estudiante",
  REABRIR: "Reabierta por el estudiante",
  PRIORIZAR: "Prioridad actualizada",
};
