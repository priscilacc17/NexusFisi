import { mkdir } from "node:fs/promises";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { createLogger } from "./lib/logger.js";
import { crearMailer } from "./lib/mailer.js";
import { almacenDb, almacenDisco } from "./lib/storage.js";
import { seed } from "./db/seed.js";

const env = loadEnv();
const logger = createLogger(env);
const database = createDatabase(
  env.DATABASE_URL,
  env.DATABASE_SSL ? { ca: env.DATABASE_SSL_CA } : undefined,
);

if (env.MIGRATE_ON_START) {
  await runMigrations(database.db);
  logger.info("migraciones aplicadas");
}
if (env.STORAGE_DRIVER === "disk") await mkdir(env.UPLOAD_DIR, { recursive: true });
const almacen = env.STORAGE_DRIVER === "db" ? almacenDb(database.db) : almacenDisco(env.UPLOAD_DIR);
const mailer = crearMailer(env, logger);
const deps = { db: database.db, env, logger, now: () => new Date(), almacen, mailer };

if (env.SEED_DEMO_ON_START) {
  // Solo siembra si la base está vacía; en reinicios posteriores no hace nada.
  const sembro = await seed(database.db, env, { deps });
  if (sembro) logger.warn("datos de DEMOSTRACIÓN sembrados (SEED_DEMO_ON_START=true)");
}

const app = createApp(deps);
const server = serve({ fetch: app.fetch, port: env.PORT }, (info) =>
  logger.info({ port: info.port }, "NexusFisi API escuchando"),
);

const apagar = (senal: string) => {
  logger.info({ senal }, "apagando");
  server.close(() => void database.close().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => apagar("SIGTERM"));
process.on("SIGINT", () => apagar("SIGINT"));
