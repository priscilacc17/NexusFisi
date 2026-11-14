import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.js";

export type Db = MySql2Database<typeof schema>;

export interface Database {
  db: Db;
  pool: mysql.Pool;
  close(): Promise<void>;
}

export function createDatabase(url: string, tls?: { ca?: string | undefined }): Database {
  const pool = mysql.createPool({
    uri: url,
    // Todo se guarda y se lee en UTC; la zona de Lima solo se aplica al calcular plazos.
    timezone: "Z",
    connectionLimit: 10,
    multipleStatements: false,
    // TLS verificado contra las CA públicas o contra la CA del proveedor. En los
    // paneles de variables el PEM suele pegarse con "\n" literales: se restauran.
    ...(tls ? { ssl: { rejectUnauthorized: true, ...(tls.ca ? { ca: tls.ca.replace(/\\n/g, "\n") } : {}) } } : {}),
  });
  const db = drizzle(pool, { schema, mode: "default" });
  return { db, pool, close: () => pool.end() };
}
