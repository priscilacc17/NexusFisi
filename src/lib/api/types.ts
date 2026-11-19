// Tipos de la API REST de NexusFisi (ver /api/docs). Reflejan los esquemas OpenAPI.

export type Rol = "ESTUDIANTE" | "TECNICO" | "SUPERVISOR" | "ADMIN";
export type Estado =
  | "REGISTRADA"
  | "EN_EVALUACION"
  | "OBSERVADA"
  | "ASIGNADA"
  | "EN_ATENCION"
  | "RESUELTA"
  | "CERRADA";
export type Prioridad = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
export type TipoCierre = "CONFORME" | "DESISTIDA" | "SUPERVISOR";
export type EtapaAdjunto = "REGISTRO" | "CORRECCION" | "ATENCION";
export type Accion =
  | "EVALUAR"
  | "OBSERVAR"
  | "ASIGNAR"
  | "REASIGNAR"
  | "INICIAR_ATENCION"
  | "RESOLVER"
  | "CERRAR"
  | "CORREGIR"
  | "DESISTIR"
  | "REABRIR"
  | "PRIORIZAR";

export interface Ref {
  id: number;
  nombre: string;
}
export interface FacultadRef {
  id: number;
  codigo: string;
  nombre: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  facultad: FacultadRef | null;
  escuela: Ref | null;
  area: Ref | null;
  codigoEstudiante: string | null;
  activo: boolean;
}

// La sesión real vive en una cookie HttpOnly que el navegador envía solo; aquí
// solo se recuerdan los datos del usuario para pintar la interfaz.
export interface Sesion {
  usuario: Usuario;
}
export interface RespuestaLogin {
  token: string;
  usuario: Usuario;
}

export interface Facultad {
  id: number;
  codigo: string;
  nombre: string;
  activa: boolean;
  escuelas: Ref[];
}

export interface Area {
  id: number;
  facultadId: number;
  nombre: string;
  ubicacion: string;
  activa: boolean;
}

export interface TipoTramite {
  id: number;
  facultadId: number;
  nombre: string;
  descripcion: string;
  requisitos: string[];
  plazoDias: number;
  activo: boolean;
  area: { id: number; nombre: string; ubicacion: string };
}

export interface SolicitudResumen {
  codigo: string;
  asunto: string;
  estado: Estado;
  prioridad: Prioridad;
  createdAt: string;
  updatedAt: string;
  fechaLimite: string;
  vencida: boolean;
  tipo: Ref;
  facultad: { id: number; codigo: string };
  estudiante: { id: number; nombre: string; codigoEstudiante: string | null };
  responsable: Ref | null;
}

export interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface SolicitudDetalle {
  codigo: string;
  version: number;
  asunto: string;
  descripcion: string;
  estado: Estado;
  estadoPrevio: Estado | null;
  prioridad: Prioridad;
  respuesta: string | null;
  tipoCierre: TipoCierre | null;
  reaperturas: number;
  createdAt: string;
  updatedAt: string;
  fechaLimite: string;
  resueltaAt: string | null;
  cerradaAt: string | null;
  vencida: boolean;
  facultad: FacultadRef;
  tipo: {
    id: number;
    nombre: string;
    requisitos: string[];
    plazoDias: number;
    area: { id: number; nombre: string; ubicacion: string };
  };
  estudiante: {
    id: number;
    nombre: string;
    email: string;
    codigoEstudiante: string | null;
    escuela: string | null;
  };
  responsable: { id: number; nombre: string; rol: Rol; area: string | null } | null;
  adjuntos: {
    id: number;
    nombre: string;
    mime: string;
    tamano: number;
    etapa: EtapaAdjunto;
    subidoPor: string;
    createdAt: string;
  }[];
  observaciones: {
    id: number;
    texto: string;
    resuelta: boolean;
    autor: string;
    createdAt: string;
    resueltaAt: string | null;
  }[];
  historial: {
    id: number;
    accion: string;
    estadoDesde: Estado | null;
    estadoHasta: Estado | null;
    nota: string | null;
    autor: string;
    rol: Rol;
    createdAt: string;
  }[];
  mensajes: {
    id: number;
    texto: string;
    autorId: number;
    autor: string;
    rol: Rol;
    createdAt: string;
  }[];
  acciones: Accion[];
  puedeAdjuntar: EtapaAdjunto | null;
  puedeEnviarMensaje: boolean;
  responsablesDisponibles: {
    id: number;
    nombre: string;
    rol: Rol;
    area: string | null;
    delArea: boolean;
  }[];
}

export interface Notificacion {
  id: number;
  texto: string;
  leida: boolean;
  createdAt: string;
  solicitudCodigo: string | null;
}

export interface Conteo {
  clave: string;
  total: number;
}
export interface Dashboard {
  total: number;
  pendientes: number;
  atendidas: number;
  vencidas: number;
  desistidas: number;
  porcentajeResueltas: number | null;
  tiempoPromedioHoras: number | null;
  porEstado: Conteo[];
  porPrioridad: Conteo[];
  porTipo: Conteo[];
  porResponsable: {
    id: number;
    nombre: string;
    total: number;
    pendientes: number;
    resueltas: number;
  }[];
  porFacultad: Conteo[];
}

export interface FacultadAdmin {
  id: number;
  codigo: string;
  nombre: string;
  activa: boolean;
  escuelas: { id: number; nombre: string; activa: boolean }[];
  usuarios: Partial<Record<Rol, number>>;
}

export interface FiltrosSolicitudes {
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
  page?: number | undefined;
  size?: number | undefined;
}
