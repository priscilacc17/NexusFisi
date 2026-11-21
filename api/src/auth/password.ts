import bcrypt from "bcryptjs";

const COSTO = 11;

// Política: 8 a 72 caracteres (72 es el límite real de bcrypt), con al menos una letra y un número.
export function validarPassword(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (Buffer.byteLength(password, "utf8") > 72) return "La contraseña no puede superar 72 bytes.";
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password) || !/\d/.test(password))
    return "La contraseña debe combinar letras y números.";
  return null;
}

export const hashPassword = (password: string) => bcrypt.hash(password, COSTO);
export const verificarPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// Hash con el que se compara cuando el correo no existe, para que la respuesta
// tarde lo mismo y no delate qué correos están registrados.
export const HASH_SEÑUELO = bcrypt.hashSync("no-es-una-cuenta-real-0", COSTO);
