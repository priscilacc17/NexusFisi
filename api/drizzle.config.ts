import { defineConfig } from "drizzle-kit";

// Solo se usa para GENERAR migraciones a partir de src/db/schema.ts.
// Aplicarlas lo hace la propia API al arrancar (src/db/migrate.ts).
export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
