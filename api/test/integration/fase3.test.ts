import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { archivos } from "../../src/db/schema.js";
import {
  accion,
  api,
  formulario,
  login,
  olvidarTokens,
  prepararApp,
  type Contexto,
} from "./helpers.js";

const esperarCorreos = () => new Promise((r) => setTimeout(r, 30));

describe("sesión con cookie HttpOnly y protección CSRF", () => {
  let ctx: Contexto;
  beforeAll(async () => {
    olvidarTokens();
    ctx = await prepararApp();
  });
  afterAll(() => ctx.database.close());

  const pedir = (ruta: string, init: RequestInit = {}) => ctx.app.request(`/api/v1${ruta}`, init);

  it("el login fija una cookie HttpOnly, SameSite=Lax y limitada a /api", async () => {
    const r = await pedir("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "estudiante.fisi@unmsm.edu.pe", password: "Demo1234" }),
    });
    const cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^nf_sesion=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api/);
  });

  it("con la cookie se puede leer; para modificar exige la cabecera anti-CSRF", async () => {
    const r = await pedir("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "estudiante.fisi@unmsm.edu.pe", password: "Demo1234" }),
    });
    const cookie = r.headers.get("set-cookie")!.split(";")[0]!;
    expect((await pedir("/auth/me", { headers: { cookie } })).status).toBe(200);

    const sinCabecera = await pedir("/notificaciones/leer-todas", {
      method: "POST",
      headers: { cookie },
    });
    expect(sinCabecera.status).toBe(403);
    const conCabecera = await pedir("/notificaciones/leer-todas", {
      method: "POST",
      headers: { cookie, "x-nexusfisi": "1" },
    });
    expect(conCabecera.status).toBe(200);
  });

  it("cerrar sesión borra la cookie", async () => {
    const r = await pedir("/auth/logout", { method: "POST" });
    expect(r.status).toBe(204);
    expect(r.headers.get("set-cookie")).toMatch(/nf_sesion=;.*Max-Age=0/i);
    expect(r.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(r.headers.get("set-cookie")).toMatch(/SameSite=Lax/);
  });
});

describe("recuperación de contraseña por correo", () => {
  let ctx: Contexto;
  beforeAll(async () => {
    olvidarTokens();
    ctx = await prepararApp();
  });
  afterAll(() => ctx.database.close());

  const tokenDelCorreo = () =>
    new URL(ctx.correos.enviados.at(-1)!.boton!.url).searchParams.get("token")!;

  it("responde lo mismo exista o no la cuenta, y solo envía correo si existe", async () => {
    const antes = ctx.correos.enviados.length;
    const noExiste = await api(ctx, "POST", "/auth/recuperar", {
      json: { email: "nadie@unmsm.edu.pe" },
    });
    await esperarCorreos();
    expect(noExiste.status).toBe(200);
    expect(ctx.correos.enviados.length).toBe(antes);

    const existe = await api(ctx, "POST", "/auth/recuperar", {
      json: { email: "estudiante2.fisi@unmsm.edu.pe" },
    });
    await esperarCorreos();
    expect(existe.body).toEqual(noExiste.body);
    const correo = ctx.correos.enviados.at(-1)!;
    expect(correo.para).toBe("estudiante2.fisi@unmsm.edu.pe");
    expect(correo.boton!.url).toMatch(/^https:\/\/nexusfisi\.test\/restablecer\?token=/);
  });

  it("el enlace cambia la contraseña, cierra las sesiones y no se puede reutilizar", async () => {
    const viejo = await login(ctx, "estudiante2.fisi");
    await api(ctx, "POST", "/auth/recuperar", { json: { email: "estudiante2.fisi@unmsm.edu.pe" } });
    await esperarCorreos();
    const token = tokenDelCorreo();

    expect(
      (await api(ctx, "POST", "/auth/restablecer", { json: { token, password: "debil" } })).status,
    ).toBe(400);
    expect(
      (await api(ctx, "POST", "/auth/restablecer", { json: { token, password: "Recuperada2026" } }))
        .status,
    ).toBe(200);
    expect((await api(ctx, "GET", "/auth/me", { token: viejo })).status).toBe(401);
    expect(
      (
        await api(ctx, "POST", "/auth/login", {
          json: { email: "estudiante2.fisi@unmsm.edu.pe", password: "Demo1234" },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await api(ctx, "POST", "/auth/login", {
          json: { email: "estudiante2.fisi@unmsm.edu.pe", password: "Recuperada2026" },
        })
      ).status,
    ).toBe(200);
    expect(
      (await api(ctx, "POST", "/auth/restablecer", { json: { token, password: "OtraClave2026" } }))
        .status,
    ).toBe(400);
  });

  it("un enlace nuevo anula el anterior, y los enlaces vencen a los 30 minutos", async () => {
    await api(ctx, "POST", "/auth/recuperar", { json: { email: "tecnico2.fisi@unmsm.edu.pe" } });
    await esperarCorreos();
    const primero = tokenDelCorreo();
    await api(ctx, "POST", "/auth/recuperar", { json: { email: "tecnico2.fisi@unmsm.edu.pe" } });
    await esperarCorreos();
    const segundo = tokenDelCorreo();
    expect(
      (
        await api(ctx, "POST", "/auth/restablecer", {
          json: { token: primero, password: "Clave2026x" },
        })
      ).status,
    ).toBe(400);

    ctx.fijarHora(new Date(Date.now() + 31 * 60_000));
    expect(
      (
        await api(ctx, "POST", "/auth/restablecer", {
          json: { token: segundo, password: "Clave2026x" },
        })
      ).status,
    ).toBe(400);
    ctx.fijarHora(new Date());
  });
});

describe("avisos por correo del flujo", () => {
  let ctx: Contexto;
  beforeAll(async () => {
    olvidarTokens();
    ctx = await prepararApp();
  });
  afterAll(() => ctx.database.close());

  it("al observar, el estudiante recibe un correo con la observación y el enlace al expediente", async () => {
    const est = await login(ctx, "estudiante.fisi");
    const sup = await login(ctx, "supervisor.fisi");
    const tipos = await api(ctx, "GET", "/tipos-tramite", { token: est });
    const { body } = await api(ctx, "POST", "/solicitudes", {
      token: est,
      form: formulario({
        tipoId: tipos.body[0].id,
        asunto: "Constancia para beca",
        descripcion: "Necesito la constancia para postular a una beca.",
      }),
    });
    await accion(ctx, sup, body.codigo, "EVALUAR");
    await accion(ctx, sup, body.codigo, "OBSERVAR", { nota: "Falta el DNI por ambas caras." });
    await esperarCorreos();
    const correo = ctx.correos.enviados.find(
      (c) => c.asunto.includes(body.codigo) && c.asunto.includes("observada"),
    );
    expect(correo?.para).toBe("estudiante.fisi@unmsm.edu.pe");
    expect(correo?.texto).toContain("Falta el DNI por ambas caras.");
    expect(correo?.boton?.url).toBe(`https://nexusfisi.test/app/solicitudes/${body.codigo}`);
  });
});

describe("adjuntos guardados en la base de datos (STORAGE_DRIVER=db, para Render)", () => {
  let ctx: Contexto;
  beforeAll(async () => {
    olvidarTokens();
    ctx = await prepararApp({ STORAGE_DRIVER: "db" });
  });
  afterAll(() => ctx.database.close());

  it("se guardan en MySQL y se descargan byte por byte", async () => {
    const est = await login(ctx, "estudiante.fisi");
    const tipos = await api(ctx, "GET", "/tipos-tramite", { token: est });
    const contenido = "%PDF-1.4\n% contenido unico 12345\n%%EOF\n";
    const { status, body } = await api(ctx, "POST", "/solicitudes", {
      token: est,
      form: formulario(
        {
          tipoId: tipos.body[0].id,
          asunto: "Constancia para beca",
          descripcion: "Necesito la constancia para postular a una beca.",
        },
        [new File([contenido], "dni.pdf")],
      ),
    });
    expect(status).toBe(201);
    const filas = await ctx.database.db.select().from(archivos);
    expect(filas.some((f) => f.datos.toString() === contenido)).toBe(true);
    const r = await ctx.app.request(
      `/api/v1/solicitudes/${body.codigo}/adjuntos/${body.adjuntos[0].id}`,
      { headers: { authorization: `Bearer ${est}` } },
    );
    expect(await r.text()).toBe(contenido);
  });
});
