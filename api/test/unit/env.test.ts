import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";

const base = { DATABASE_URL: "mysql://u:p@h:3306/db", JWT_SECRET: "x".repeat(40) };

describe("configuración por variables de entorno", () => {
  it("una variable vacía cuenta como no definida (docker compose / Render)", () => {
    const env = loadEnv({ ...base, MAIL_REDIRECT_TO: "", SMTP_HOST: "", STORAGE_DRIVER: "" });
    expect(env.MAIL_REDIRECT_TO).toBeUndefined();
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.STORAGE_DRIVER).toBe("disk");
  });
  it("rechaza el JWT_SECRET de ejemplo en producción", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production", JWT_SECRET: "reemplaza-esto-por-un-secreto-aleatorio-de-48-bytes" })).toThrow(/JWT_SECRET/);
  });
  it("exige usuario y contraseña si se configura SMTP", () => {
    expect(() => loadEnv({ ...base, SMTP_HOST: "smtp.gmail.com" })).toThrow(/SMTP_USER/);
  });
});
