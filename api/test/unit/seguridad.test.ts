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
