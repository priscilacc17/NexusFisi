import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { archivos } from "../db/schema.js";
import { badRequest, AppError } from "./errors.js";

// Los adjuntos se guardan fuera de cualquier carpeta pública, con un nombre
// aleatorio, y se sirven solo a través de la API tras verificar permisos.
// El tipo se decide por los primeros bytes del archivo, no por la extensión ni
// por el Content-Type que manda el navegador (ambos los controla el cliente).
const FIRMAS: { mime: string; ext: string; bytes: number[] }[] = [
  { mime: "application/pdf", ext: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { mime: "image/png", ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
];

export const MAX_ARCHIVOS = 5;

export interface ArchivoGuardado {
  nombreOriginal: string;
  nombreAlmacenado: string;
  mime: string;
  tamano: number;
}

export function detectarTipo(buf: Uint8Array) {
  return FIRMAS.find((f) => f.bytes.every((b, i) => buf[i] === b)) ?? null;
}

export function limpiarNombre(nombre: string): string {
  const base = path
    .basename(nombre)
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim();
  return (base || "archivo").slice(0, 200);
}

export async function validarArchivos(archivos: File[], maxMb: number) {
  if (archivos.length > MAX_ARCHIVOS)
    throw badRequest(`Puedes adjuntar como máximo ${MAX_ARCHIVOS} archivos por envío.`);
  const leidos: {
    file: File;
    buf: Uint8Array;
    tipo: NonNullable<ReturnType<typeof detectarTipo>>;
  }[] = [];
  for (const file of archivos) {
    if (file.size === 0) throw badRequest(`El archivo "${file.name}" está vacío.`);
    if (file.size > maxMb * 1024 * 1024)
      throw new AppError(413, "ARCHIVO_DEMASIADO_GRANDE", `"${file.name}" supera ${maxMb} MB.`);
    const buf = new Uint8Array(await file.arrayBuffer());
    const tipo = detectarTipo(buf);
    if (!tipo)
      throw new AppError(
        415,
        "TIPO_NO_PERMITIDO",
        `"${file.name}" no es un PDF, JPG o PNG válido.`,
      );
    leidos.push({ file, buf, tipo });
  }
  return leidos;
}

// Dónde viven los bytes. "disk" para la VM con volumen Docker; "db" para
// plataformas sin disco persistente (Render): el archivo va a la tabla `archivos`.
export interface Almacen {
  guardar(nombre: string, datos: Uint8Array): Promise<void>;
  leer(nombre: string): Promise<Buffer>;
  borrar(nombre: string): Promise<void>;
}

export function almacenDisco(dir: string): Almacen {
  // El nombre sale de la BD y es un UUID; aun así se impide salir de la carpeta.
  const ruta = (n: string) => path.join(dir, path.basename(n));
  return {
    async guardar(nombre, datos) {
      await mkdir(dir, { recursive: true });
      await writeFile(ruta(nombre), datos, { flag: "wx" });
    },
    leer: (nombre) => readFile(ruta(nombre)),
    borrar: (nombre) => unlink(ruta(nombre)).catch(() => undefined),
  };
}

export function almacenDb(db: Db): Almacen {
  return {
    async guardar(nombre, datos) {
      await db.insert(archivos).values({ nombreAlmacenado: nombre, datos: Buffer.from(datos) });
    },
    async leer(nombre) {
      const [f] = await db
        .select()
        .from(archivos)
        .where(eq(archivos.nombreAlmacenado, nombre))
        .limit(1);
      if (!f) throw new Error("archivo no encontrado");
      return f.datos;
    },
    async borrar(nombre) {
      await db.delete(archivos).where(eq(archivos.nombreAlmacenado, nombre));
    },
  };
}

export async function guardarArchivos(
  almacen: Almacen,
  leidos: Awaited<ReturnType<typeof validarArchivos>>,
): Promise<ArchivoGuardado[]> {
  const guardados: ArchivoGuardado[] = [];
  try {
    for (const { file, buf, tipo } of leidos) {
      const nombreAlmacenado = `${randomUUID()}.${tipo.ext}`;
      await almacen.guardar(nombreAlmacenado, buf);
      guardados.push({
        nombreOriginal: limpiarNombre(file.name),
        nombreAlmacenado,
        mime: tipo.mime,
        tamano: file.size,
      });
    }
  } catch (e) {
    await borrarArchivos(almacen, guardados);
    throw e;
  }
  return guardados;
}

export async function borrarArchivos(
  almacen: Almacen,
  lista: Pick<ArchivoGuardado, "nombreAlmacenado">[],
) {
  await Promise.all(lista.map((a) => almacen.borrar(a.nombreAlmacenado).catch(() => undefined)));
}
