// Errores de negocio con su código HTTP. El manejador global los convierte en
// respuestas application/problem+json (RFC 9457) sin exponer trazas internas.
export class AppError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 423 | 429,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: Record<string, string>) =>
  new AppError(400, "SOLICITUD_INVALIDA", message, details);
export const unauthorized = (message = "Debes iniciar sesión.") =>
  new AppError(401, "NO_AUTENTICADO", message);
export const forbidden = (message = "No tienes permiso para realizar esta acción.") =>
  new AppError(403, "PROHIBIDO", message);
export const notFound = (message = "Recurso no encontrado.") =>
  new AppError(404, "NO_ENCONTRADO", message);
export const conflict = (message: string) => new AppError(409, "CONFLICTO", message);
export const unprocessable = (message: string) => new AppError(422, "REGLA_DE_NEGOCIO", message);
