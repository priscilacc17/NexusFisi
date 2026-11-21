import { z } from "zod";

// Toda la configuración entra por variables de entorno y se valida al arrancar.
// Si falta algo o es inseguro, la API no levanta: es preferible a fallar a medias.
const bool = (porDefecto: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(porDefecto)
    .transform((v) => v === "true");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().startsWith("mysql://", "DATABASE_URL debe ser una URL mysql://"),
    // Servicios administrados (Aiven, TiDB, PlanetScale…) exigen TLS.
    DATABASE_SSL: bool("false"),
    // CA del proveedor (PEM) si su certificado no es de una autoridad pública (p. ej. Aiven).
    DATABASE_SSL_CA: z.string().optional(),
    JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
    JWT_EXPIRES_IN: z.string().default("8h"),
    // URL pública del sistema: se usa en los enlaces de los correos.
    PUBLIC_URL: z.string().url("PUBLIC_URL debe ser una URL").default("http://localhost:8080"),
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:8080,http://localhost:5173")
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    // La sesión viaja en una cookie HttpOnly; en producción solo por HTTPS.
    COOKIE_SECURE: z.enum(["true", "false", "auto"]).default("auto"),
    // "disk" (volumen, VM con Docker) o "db" (dentro de MySQL; plataformas sin disco persistente, p. ej. Render).
    STORAGE_DRIVER: z.enum(["disk", "db"]).default("disk"),
    UPLOAD_DIR: z.string().default("./uploads"),
    MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
    // Intentos de login por minuto para cada combinación IP + correo (registro: el triple por IP).
    AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
    // Correo saliente (recuperación de contraseña y avisos).
    //  smtp   → servidor SMTP (Gmail, etc.). Render GRATIS bloquea los puertos SMTP (25/465/587).
    //  brevo / resend → API HTTPS (puerto 443): funciona en Render gratis. Requiere MAIL_API_KEY.
    // Sin proveedor configurado, los correos solo se registran en el log.
    MAIL_PROVIDER: z.enum(["smtp", "brevo", "resend"]).optional(),
    MAIL_API_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    // Demostraciones: todo correo se desvía a esta casilla (las cuentas demo no son buzones reales).
    MAIL_REDIRECT_TO: z.string().email().optional(),
    // Enviar por correo los avisos importantes (observada, resuelta, asignada).
    MAIL_NOTIFICACIONES: bool("true"),
    // Token que debe enviar Prometheus para leer /api/v1/metrics. Sin token, en
    // producción el endpoint queda deshabilitado (en desarrollo es abierto).
    METRICS_TOKEN: z.string().min(16, "METRICS_TOKEN debe tener al menos 16 caracteres").optional(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    // Detrás de un proxy (nginx, Render) la IP real del cliente llega en X-Forwarded-For.
    TRUST_PROXY: bool("false"),
    MIGRATE_ON_START: bool("true"),
    // Solo para demostraciones: siembra los datos de ejemplo si la base está vacía.
    SEED_DEMO_ON_START: bool("false"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.JWT_SECRET.startsWith("reemplaza")) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET es el valor de ejemplo; genera uno aleatorio para producción",
      });
    }
    if (
      (env.MAIL_PROVIDER === "brevo" || env.MAIL_PROVIDER === "resend") &&
      (!env.MAIL_API_KEY || !env.MAIL_FROM)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["MAIL_API_KEY"],
        message: `Con MAIL_PROVIDER=${env.MAIL_PROVIDER} hay que definir MAIL_API_KEY y MAIL_FROM`,
      });
    }
    if (env.SMTP_HOST && (!env.SMTP_USER || !env.SMTP_PASS)) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_USER"],
        message: "Con SMTP_HOST hay que definir SMTP_USER y SMTP_PASS",
      });
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Una variable definida pero vacía (habitual en docker compose y en los paneles
  // de Render) cuenta como no definida: toma su valor por defecto.
  const limpio: Record<string, string> = Object.fromEntries(
    Object.entries(source).filter(
      (e): e is [string, string] => e[1] !== undefined && e[1].trim() !== "",
    ),
  );
  // En Render, si no se definió PUBLIC_URL, se usa la URL pública que Render
  // inyecta sola (RENDER_EXTERNAL_URL). Lo mismo para el origen permitido por CORS.
  const render = limpio["RENDER_EXTERNAL_URL"];
  if (render) {
    limpio["PUBLIC_URL"] ??= render;
    limpio["CORS_ORIGINS"] ??= render;
  }
  const parsed = schema.safeParse(limpio);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración inválida:\n${detalle}`);
  }
  return parsed.data;
}

export const cookieSegura = (env: Pick<Env, "COOKIE_SECURE" | "NODE_ENV">) =>
  env.COOKIE_SECURE === "auto" ? env.NODE_ENV === "production" : env.COOKIE_SECURE === "true";
