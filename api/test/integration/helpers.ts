import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { createDatabase, type Database } from "../../src/db/client.js";
import { runMigrations } from "../../src/db/migrate.js";
import { PASSWORD_DEMO, seed } from "../../src/db/seed.js";
import { createLogger } from "../../src/lib/logger.js";
import { MailerMemoria } from "../../src/lib/mailer.js";
import { almacenDb, almacenDisco } from "../../src/lib/storage.js";

// Base de pruebas: TEST_DATABASE_URL (en CI la crea el servicio MySQL del pipeline).
const URL_PRUEBAS =
  process.env["TEST_DATABASE_URL"] ??
  "mysql://nexusfisi:nexusfisi_dev@127.0.0.1:3317/nexusfisi_test";

export interface Contexto {
  app: ReturnType<typeof createApp>;
  database: Database;
  correos: MailerMemoria;
  fijarHora(d: Date): void;
}

// Cada archivo de pruebas parte de una base limpia: tablas borradas, migraciones
// aplicadas y datos demo sembrados con las mismas funciones de producción.
export async function prepararApp(extra: Record<string, string> = {}): Promise<Contexto> {
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: URL_PRUEBAS,
    JWT_SECRET: "clave-de-pruebas-".padEnd(48, "x"),
    UPLOAD_DIR: await mkdtemp(path.join(os.tmpdir(), "nexusfisi-test-")),
    AUTH_RATE_LIMIT: "1000",
    PUBLIC_URL: "https://nexusfisi.test",
    ...extra,
  });
  const database = createDatabase(env.DATABASE_URL);
  const conn = await database.pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    const [tablas] = (await conn.query(
      "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()",
    )) as unknown as [{ t: string }[]];
    for (const { t } of tablas) await conn.query(`DROP TABLE \`${t}\``);
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    conn.release();
  }
  await runMigrations(database.db);
  await seed(database.db, env);
  let reloj: Date | null = null;
  const correos = new MailerMemoria();
  const almacen =
    env.STORAGE_DRIVER === "db" ? almacenDb(database.db) : almacenDisco(env.UPLOAD_DIR);
  const app = createApp({
    db: database.db,
    env,
    logger: createLogger(env),
    now: () => reloj ?? new Date(),
    almacen,
    mailer: correos,
  });
  return { app, database, correos, fijarHora: (d) => (reloj = d) };
}

const tokens = new Map<string, string>();

export async function login(
  ctx: Contexto,
  usuario: string,
  password = PASSWORD_DEMO,
): Promise<string> {
  const email = usuario.includes("@") ? usuario : `${usuario}@unmsm.edu.pe`;
  const clave = `${email}:${password}`;
  const enCache = tokens.get(clave);
  if (enCache) return enCache;
  const r = await ctx.app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${await r.text()}`);
  const { token } = (await r.json()) as { token: string };
  tokens.set(clave, token);
  return token;
}

export function olvidarTokens() {
  tokens.clear();
}

export async function api(
  ctx: Contexto,
  metodo: string,
  ruta: string,
  opts: { token?: string; json?: unknown; form?: FormData } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const r = await ctx.app.request(`/api/v1${ruta}`, {
    method: metodo,
    headers,
    body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
  });
  const texto = await r.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- las pruebas leen campos arbitrarios de la respuesta
  let body: any = texto;
  try {
    body = JSON.parse(texto);
  } catch {
    /* no es JSON */
  }
  return { status: r.status, body };
}

export const pdf = (nombre = "documento.pdf") =>
  new File([`%PDF-1.4\n% ${nombre}\n%%EOF\n`], nombre, { type: "application/pdf" });

export function formulario(campos: Record<string, string | number>, archivos: File[] = [pdf()]) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, String(v));
  for (const a of archivos) fd.append("archivos", a);
  return fd;
}

// Atajo: ejecuta una transición leyendo antes la versión vigente.
export async function accion(
  ctx: Contexto,
  token: string,
  codigo: string,
  accion: string,
  extra: Record<string, unknown> = {},
) {
  const det = await api(ctx, "GET", `/solicitudes/${codigo}`, { token });
  return api(ctx, "POST", `/solicitudes/${codigo}/transiciones`, {
    token,
    json: { accion, version: det.body.version, ...extra },
  });
}
