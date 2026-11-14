import { describe, expect, it } from "vitest";
import { validarPassword } from "../../src/auth/password.js";
import { firmarToken, verificarToken } from "../../src/auth/jwt.js";
import { detectarTipo, limpiarNombre } from "../../src/lib/storage.js";

describe("política de contraseñas", () => {
  it.each([
    ["corta1", false],
    ["solamenteletras", false],
    ["1234567890", false],
    ["Segura2026", true],
  ])("%s → válida: %s", (pass, valida) => {
    expect(validarPassword(pass) === null).toBe(valida);
  });
});

describe("JWT", () => {
  const secreto = "x".repeat(40);
  it("firma y verifica los claims", async () => {
    const t = await firmarToken({ sub: "7", rol: "TECNICO", fac: 3, tv: 2 }, secreto, "1h");
    expect(await verificarToken(t, secreto)).toEqual({ sub: "7", rol: "TECNICO", fac: 3, tv: 2 });
  });
  it("rechaza un token firmado con otro secreto o alterado", async () => {
    const t = await firmarToken({ sub: "7", rol: "TECNICO", fac: 3, tv: 0 }, secreto, "1h");
    expect(await verificarToken(t, "y".repeat(40))).toBeNull();
    const [h, p, s] = t.split(".");
    const pAlterado = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p!, "base64url").toString()), rol: "ADMIN" })).toString("base64url");
    expect(await verificarToken(`${h}.${pAlterado}.${s}`, secreto)).toBeNull();
  });
});

describe("adjuntos: tipo por contenido, no por extensión", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);
  it("reconoce PDF, PNG y JPG", () => {
    expect(detectarTipo(new TextEncoder().encode("%PDF-1.7 ..."))?.mime).toBe("application/pdf");
    expect(detectarTipo(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe("image/png");
    expect(detectarTipo(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
  });
  it("rechaza un ejecutable o texto aunque se llame .pdf", () => {
    expect(detectarTipo(new TextEncoder().encode("MZ\x90\x00 ejecutable"))).toBeNull();
    expect(detectarTipo(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });
  it("limpia nombres con rutas o caracteres peligrosos", () => {
    expect(limpiarNombre("../../etc/passwd")).toBe("passwd");
    expect(limpiarNombre("a<b>c.pdf")).toBe("a_b_c.pdf");
  });
});

import { mailerHttp, remitente } from "../../src/lib/mailer.js";

describe("correo por API HTTPS (Render bloquea SMTP)", () => {
  const correo = { para: "a@unmsm.edu.pe", asunto: "Hola", texto: "Línea 1", boton: { texto: "Ver", url: "https://x.test/y" } };
  const capturar = () => {
    const llamadas: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      llamadas.push({ url, init });
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    return { llamadas, f };
  };

  it("separa nombre y correo del remitente", () => {
    expect(remitente("NexusFisi <nexus@gmail.com>")).toEqual({ nombre: "NexusFisi", email: "nexus@gmail.com" });
    expect(remitente("nexus@gmail.com")).toEqual({ email: "nexus@gmail.com" });
  });

  it("Brevo: usa la cabecera api-key y el formato de su API", async () => {
    const { llamadas, f } = capturar();
    await mailerHttp("brevo", "clave", "NexusFisi <nexus@gmail.com>", f)(correo);
    const body = JSON.parse(String(llamadas[0]!.init.body));
    expect(llamadas[0]!.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((llamadas[0]!.init.headers as Record<string, string>)["api-key"]).toBe("clave");
    expect(body.sender).toEqual({ email: "nexus@gmail.com", name: "NexusFisi" });
    expect(body.to).toEqual([{ email: "a@unmsm.edu.pe" }]);
    expect(body.htmlContent).toContain("https://x.test/y");
  });

  it("Resend: usa Bearer y el formato de su API", async () => {
    const { llamadas, f } = capturar();
    await mailerHttp("resend", "clave", "NexusFisi <nexus@gmail.com>", f)(correo);
    expect(llamadas[0]!.url).toBe("https://api.resend.com/emails");
    expect((llamadas[0]!.init.headers as Record<string, string>)["authorization"]).toBe("Bearer clave");
  });

  it("un rechazo del proveedor se informa como error (para el log)", async () => {
    const f = (async () => new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;
    await expect(mailerHttp("brevo", "mala", "x@y.com", f)(correo)).rejects.toThrow(/401/);
  });
});
