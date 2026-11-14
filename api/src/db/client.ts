import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.js";

export type Db = MySql2Database<typeof schema>;

export interface Database {
  db: Db;
  pool: mysql.Pool;
  close(): Promise<void>;
}

// Los proveedores (Aiven, entre otros) entregan la URI con "?ssl-mode=REQUIRED",
// un parámetro del cliente de consola de MySQL que el driver de Node no entiende.
// Se quita de la URL y, si pide TLS, se activa.
export function normalizarUrl(url: string): { uri: string; pideTls: boolean } {
  const u = new URL(url);
  let pideTls = false;
  for (const clave of ["ssl-mode", "sslmode", "ssl_mode"]) {
    const valor = u.searchParams.get(clave);
    if (valor !== null) {
      if (valor.toUpperCase() !== "DISABLED") pideTls = true;
      u.searchParams.delete(clave);
    }
  }
  return { uri: u.toString(), pideTls };
}

export function createDatabase(url: string, tlsConfig?: { ca?: string | undefined }): Database {
  const { uri, pideTls } = normalizarUrl(url);
  const tls = tlsConfig ?? (pideTls ? {} : undefined);
  const pool = mysql.createPool({
    uri,
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
