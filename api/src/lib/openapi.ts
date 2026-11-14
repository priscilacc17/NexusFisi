import { z } from "@hono/zod-openapi";
import { ESTADOS, PRIORIDADES, ROLES, TIPOS_CIERRE } from "../db/schema.js";
import { ACCIONES } from "../domain/workflow.js";

// Esquemas compartidos. Cada uno lleva nombre OpenAPI para aparecer como
// componente reutilizable en la documentación (/api/docs).

export const Problem = z
  .object({
    type: z.string().openapi({ example: "about:blank" }),
    title: z.string().openapi({ example: "SOLICITUD_INVALIDA" }),
    status: z.number().int().openapi({ example: 400 }),
    detail: z.string().openapi({ example: "Revisa los campos marcados." }),
    errors: z.record(z.string(), z.string()).optional().openapi({ example: { asunto: "Mínimo 5 caracteres" } }),
  })
  .openapi("Problem");

const problem = (description: string) => ({ description, content: { "application/problem+json": { schema: Problem } } });

export const errores = {
  400: problem("Datos inválidos"),
  401: problem("No autenticado"),
  403: problem("Sin permiso"),
  404: problem("No encontrado"),
  409: problem("Conflicto con el estado actual"),
  422: problem("Regla de negocio incumplida"),
} as const;

export const ok = <T extends z.ZodType>(schema: T, description = "OK") => ({
  description,
  content: { "application/json": { schema } },
});

export const jsonBody = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

export const Rol = z.enum(ROLES).openapi("Rol");
export const Estado = z.enum(ESTADOS).openapi("Estado");
export const Prioridad = z.enum(PRIORIDADES).openapi("Prioridad");
export const TipoCierre = z.enum(TIPOS_CIERRE).openapi("TipoCierre");
export const Accion = z.enum(ACCIONES).openapi("Accion");

export const IdParam = z.object({ id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" }, example: 1 }) });
export const CodigoParam = z.object({
  codigo: z
    .string()
    .regex(/^[A-Z0-9]{2,12}-\d{4}-\d{5}$/, "Código de expediente inválido")
    .openapi({ param: { name: "codigo", in: "path" }, example: "FISI-2026-00001" }),
});

export const Paginacion = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  size: z.coerce.number().int().min(1).max(50).default(20).openapi({ example: 20 }),
});

export const pagina = <T extends z.ZodType>(item: T, nombre: string) =>
  z
    .object({ items: z.array(item), total: z.number().int(), page: z.number().int(), size: z.number().int() })
    .openapi(nombre);

export const Ref = z.object({ id: z.number().int(), nombre: z.string() }).openapi("Ref");
export const FacultadRef = z.object({ id: z.number().int(), codigo: z.string(), nombre: z.string() }).openapi("FacultadRef");

export const UsuarioPublico = z
  .object({
    id: z.number().int(),
    nombre: z.string(),
    email: z.string(),
    rol: Rol,
    facultad: FacultadRef.nullable(),
    escuela: Ref.nullable(),
    area: Ref.nullable(),
    codigoEstudiante: z.string().nullable(),
    activo: z.boolean(),
  })
  .openapi("Usuario");

export const Ok = z.object({ ok: z.literal(true) }).openapi("Ok");
