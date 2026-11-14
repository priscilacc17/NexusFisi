import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { Db } from "./client.js";

// La carpeta drizzle/ está junto a package.json, tanto en desarrollo (src/) como compilado (dist/).
const MIGRATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS });
}

// Uso directo: npm run db:migrate
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { loadEnv } = await import("../config/env.js");
  const { createDatabase } = await import("./client.js");
  const env = loadEnv();
  const database = createDatabase(env.DATABASE_URL);
  await runMigrations(database.db);
  await database.close();
  console.log("Migraciones aplicadas");
}
