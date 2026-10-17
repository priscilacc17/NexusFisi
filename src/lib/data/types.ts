// Modelos de dominio. Pensados para mapear 1:1 con futuras entidades
// Spring Boot / tablas MySQL y DTOs de una API REST.

export type Role = "estudiante" | "personal" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // SOLO demostración: nunca almacenar contraseñas así en producción
  role: Role;
  code?: string | undefined; // código de estudiante
  cycle?: string | undefined;
  area?: string | undefined;
}

export const STATUSES = [
  "Registrada",
  "En evaluación",
  "Observada",
  "Asignada",
  "En atención",
  "Resuelta",
  "Cerrada",
] as const;
export type Status = (typeof STATUSES)[number];

export interface ProcedureType {
  id: string;
  name: string;
  description: string;
  requirements: string[];
  days: number; // plazo estimado (días hábiles)
  active: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface HistoryEntry {
  id: string;
  date: string;
  userId: string;
  action: string;
  from?: Status | undefined;
  to?: Status | undefined;
  note?: string | undefined;
}

export interface Message {
  id: string;
  date: string;
  userId: string;
  text: string;
}

export interface Observation {
  id: string;
  date: string;
  userId: string;
  text: string;
  resolved: boolean;
}

export interface Request {
  id: string;
  code: string;
  typeId: string;
  studentId: string;
  subject: string;
  description: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  assigneeId?: string | undefined;
  response?: string | undefined;
  attachments: Attachment[];
  observations: Observation[];
  history: HistoryEntry[];
  messages: Message[];
}

export interface Notification {
  id: string;
  userId: string;
  date: string;
  text: string;
  requestId?: string | undefined;
  read: boolean;
}

export interface DataState {
  users: User[];
  types: ProcedureType[];
  requests: Request[];
  notifications: Notification[];
  seq: number;
}
