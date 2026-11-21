import pino from "pino";
import type { Env } from "../config/env.js";

export function createLogger(env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">) {
  return pino({
    level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
    // Nunca escribir credenciales en los logs.
    redact: {
      paths: ["req.headers.authorization", "*.password", "*.passwordHash", "*.token"],
      censor: "[oculto]",
    },
    base: { service: "nexus-api" },
  });
}
