import type { Accion, EtapaAdjunto, Estado, Prioridad, Rol, TipoCierre } from "./api/types";

export const ESTADOS: Estado[] = ["REGISTRADA", "EN_EVALUACION", "OBSERVADA", "ASIGNADA", "EN_ATENCION", "RESUELTA", "CERRADA"];
export const PRIORIDADES: Prioridad[] = ["URGENTE", "ALTA", "MEDIA", "BAJA"];
export const ROLES: Rol[] = ["ESTUDIANTE", "TECNICO", "SUPERVISOR", "ADMIN"];

export const estadoLabel: Record<Estado, string> = {
  REGISTRADA: "Registrada",
  EN_EVALUACION: "En evaluación",
  OBSERVADA: "Observada",
  ASIGNADA: "Asignada",
  EN_ATENCION: "En atención",
  RESUELTA: "Resuelta",
  CERRADA: "Cerrada",
};

export const prioridadLabel: Record<Prioridad, string> = { URGENTE: "Urgente", ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" };

export const rolLabel: Record<Rol, string> = {
  ESTUDIANTE: "Estudiante",
  TECNICO: "Técnico",
  SUPERVISOR: "Supervisor",
  ADMIN: "Administrador",
};

export const cierreLabel: Record<TipoCierre, string> = {
  CONFORME: "Cerrada con conformidad del estudiante",
  DESISTIDA: "Desistida por el estudiante",
  SUPERVISOR: "Cerrada por el supervisor",
};

export const etapaLabel: Record<EtapaAdjunto, string> = { REGISTRO: "Registro", CORRECCION: "Corrección", ATENCION: "Resultado" };

// Texto del botón y del diálogo de cada acción del flujo.
export const accionUI: Record<Accion, { boton: string; titulo: string; descripcion: string }> = {
  EVALUAR: { boton: "Iniciar evaluación", titulo: "¿Iniciar la evaluación?", descripcion: "Revisarás los datos y documentos. El estudiante será notificado." },
  OBSERVAR: { boton: "Observar / pedir corrección", titulo: "Observar la solicitud", descripcion: "El estudiante verá la observación y podrá corregir. La solicitud volverá a este punto." },
  ASIGNAR: { boton: "Asignar responsable", titulo: "Asignar responsable", descripcion: "La persona elegida recibirá la solicitud en su bandeja." },
  REASIGNAR: { boton: "Reasignar", titulo: "Reasignar responsable", descripcion: "El responsable actual dejará de tener acceso a esta solicitud." },
  INICIAR_ATENCION: { boton: "Iniciar atención", titulo: "¿Iniciar la atención?", descripcion: "Indica que empezaste a trabajar en la solicitud." },
  RESOLVER: { boton: "Resolver", titulo: "Resolver la solicitud", descripcion: "Escribe la respuesta que verá el estudiante. Si emitiste un documento, adjúntalo antes." },
  CERRAR: { boton: "Cerrar expediente", titulo: "¿Cerrar el expediente?", descripcion: "Ya no se podrá actuar ni enviar mensajes en esta solicitud." },
  CORREGIR: { boton: "Enviar corrección", titulo: "¿Enviar la corrección?", descripcion: "La solicitud volverá al personal que la observó." },
  DESISTIR: { boton: "Desistir de la solicitud", titulo: "¿Desistir de la solicitud?", descripcion: "El expediente se cerrará y no se podrá reabrir." },
  REABRIR: { boton: "No estoy conforme", titulo: "Reabrir la solicitud", descripcion: "Vuelve a atención con el mismo responsable. Solo puedes hacerlo una vez." },
  PRIORIZAR: { boton: "Cambiar prioridad", titulo: "Cambiar prioridad", descripcion: "Ordena el trabajo de la bandeja." },
};

export const fmtHoras = (h: number | null) => {
  if (h === null) return "—";
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} días`;
};
