import nodemailer from "nodemailer";
import type { Logger } from "pino";
import type { Env } from "../config/env.js";

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  // Botón principal del correo (enlace al expediente o al restablecimiento).
  boton?: { texto: string; url: string } | undefined;
}

export interface Mailer {
  enviar(c: Correo): Promise<void>;
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function html(c: Correo): string {
  const parrafos = c.texto.split("\n").filter(Boolean).map((p) => `<p style="margin:0 0 12px">${escapar(p)}</p>`).join("");
  const boton = c.boton
    ? `<p style="margin:20px 0"><a href="${escapar(c.boton.url)}" style="background:#16294a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapar(c.boton.texto)}</a></p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1e293b;max-width:560px;margin:auto">
<p style="font-size:20px;font-weight:700;color:#16294a;margin:0 0 16px">NexusFisi · Trámites académicos UNMSM</p>
${parrafos}${boton}
<p style="font-size:12px;color:#64748b;margin-top:24px">Mensaje automático de NexusFisi. No respondas a este correo.</p></div>`;
}

// "Nombre <correo@dominio>" → partes.
export function remitente(from: string): { nombre?: string; email: string } {
  const m = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(from);
  return m ? { ...(m[1] ? { nombre: m[1].replace(/^"|"$/g, "") } : {}), email: m[2]! } : { email: from.trim() };
}

// Envío por API HTTPS. Necesario en plataformas que bloquean SMTP (Render gratis).
export function mailerHttp(proveedor: "brevo" | "resend", apiKey: string, from: string, fetchImpl: typeof fetch = fetch) {
  const r = remitente(from);
  return async (c: Correo) => {
    const texto = c.texto + (c.boton ? `

${c.boton.texto}: ${c.boton.url}` : "");
    const res =
      proveedor === "brevo"
        ? await fetchImpl("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({ sender: { email: r.email, ...(r.nombre ? { name: r.nombre } : {}) }, to: [{ email: c.para }], subject: c.asunto, htmlContent: html(c), textContent: texto }),
          })
        : await fetchImpl("https://api.resend.com/emails", {
            method: "POST",
            headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({ from, to: [c.para], subject: c.asunto, html: html(c), text: texto }),
          });
    if (!res.ok) throw new Error(`${proveedor} respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  };
}

// Proveedor según la configuración. Sin ninguno, los correos solo se registran en
// el log, para que el desarrollo no dependa de un buzón.
export function crearMailer(env: Env, logger: Logger): Mailer {
  const redirigir = (c: Correo): Correo =>
    env.MAIL_REDIRECT_TO ? { ...c, para: env.MAIL_REDIRECT_TO, asunto: `[Demo → ${c.para}] ${c.asunto}` } : c;
  const proveedor = env.MAIL_PROVIDER ?? (env.SMTP_HOST ? "smtp" : undefined);

  if (proveedor === "brevo" || proveedor === "resend") {
    const enviar = mailerHttp(proveedor, env.MAIL_API_KEY!, env.MAIL_FROM!);
    logger.info({ proveedor }, "correo saliente por API HTTPS");
    return {
      async enviar(c) {
        const r = redirigir(c);
        await enviar(r);
        logger.info({ para: r.para, asunto: r.asunto, proveedor }, "correo enviado");
      },
    };
  }

  if (proveedor === "smtp" && process.env["RENDER"] && [25, 465, 587].includes(env.SMTP_PORT)) {
    logger.warn({ puerto: env.SMTP_PORT }, "Render gratis bloquea los puertos SMTP 25/465/587: usa el puerto 2525 (Brevo) o MAIL_PROVIDER=brevo/resend");
  }

  if (!env.SMTP_HOST) {
    return {
      async enviar(c) {
        const r = redirigir(c);
        logger.warn({ para: r.para, asunto: r.asunto, enlace: r.boton?.url }, "SMTP no configurado: correo no enviado");
      },
    };
  }
  const transporte = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! },
  });
  return {
    async enviar(c) {
      const r = redirigir(c);
      await transporte.sendMail({ from: env.MAIL_FROM ?? env.SMTP_USER, to: r.para, subject: r.asunto, text: r.texto + (r.boton ? `\n\n${r.boton.texto}: ${r.boton.url}` : ""), html: html(r) });
      logger.info({ para: r.para, asunto: r.asunto }, "correo enviado");
    },
  };
}

// Para pruebas: guarda los correos en memoria.
export class MailerMemoria implements Mailer {
  readonly enviados: Correo[] = [];
  async enviar(c: Correo) {
    this.enviados.push(c);
  }
}

// Avisos que no deben frenar ni romper la operación si el correo falla.
export function enviarSinEsperar(mailer: Mailer, logger: Logger, correos: Correo[]) {
  for (const c of correos) void mailer.enviar(c).catch((err) => logger.error({ err, para: c.para }, "no se pudo enviar el correo"));
}
