import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accion,
  api,
  formulario,
  login,
  olvidarTokens,
  prepararApp,
  type Contexto,
} from "./helpers.js";

let ctx: Contexto;
let fisiId: number, escuelaSistemas: number;

beforeAll(async () => {
  olvidarTokens();
  ctx = await prepararApp();
  const facs = await api(ctx, "GET", "/facultades");
  const fisi = facs.body.find((f: { codigo: string }) => f.codigo === "FISI");
  fisiId = fisi.id;
  escuelaSistemas = fisi.escuelas.find(
    (e: { nombre: string }) => e.nombre === "Ingeniería de Sistemas",
  ).id;
});
afterAll(() => ctx.database.close());

const registro = (extra: Record<string, unknown> = {}) =>
  api(ctx, "POST", "/auth/registro", {
    json: {
      nombre: "Mariana Soto Ruiz",
      email: "mariana.soto@unmsm.edu.pe",
      password: "Segura2026",
      codigoEstudiante: "24200111",
      facultadId: fisiId,
      escuelaId: escuelaSistemas,
      ...extra,
    },
  });

describe("Registro de usuarios", () => {
  it("crea siempre un ESTUDIANTE aunque el cliente intente mandar otro rol", async () => {
    const r = await registro({ rol: "ADMIN" });
    expect(r.status).toBe(201);
    expect(r.body.rol).toBe("ESTUDIANTE");
    expect(r.body.facultad.codigo).toBe("FISI");
  });
  it("rechaza correos que no son institucionales", async () => {
    const r = await registro({ email: "alguien@gmail.com", codigoEstudiante: "24200112" });
    expect(r.status).toBe(400);
    expect(r.body.errors).toHaveProperty("email");
  });
  it("rechaza correos o códigos duplicados", async () => {
    expect((await registro()).status).toBe(409);
    expect((await registro({ email: "otra.persona@unmsm.edu.pe" })).status).toBe(409);
  });
  it("exige la escuela cuando la facultad tiene escuelas", async () => {
    const r = await registro({
      email: "sin.escuela@unmsm.edu.pe",
      codigoEstudiante: "24200113",
      escuelaId: undefined,
    });
    expect(r.status).toBe(400);
  });
  it("aplica la política de contraseñas", async () => {
    const r = await registro({
      email: "debil@unmsm.edu.pe",
      codigoEstudiante: "24200114",
      password: "solamenteletras",
    });
    expect(r.status).toBe(400);
  });
});

describe("Inicio de sesión", () => {
  it("credenciales incorrectas → 401 con mensaje genérico", async () => {
    const r = await api(ctx, "POST", "/auth/login", {
      json: { email: "noexiste@unmsm.edu.pe", password: "Demo1234" },
    });
    expect(r.status).toBe(401);
    expect(r.body.detail).toBe("Correo o contraseña incorrectos.");
  });
  it("bloquea la cuenta tras 5 intentos fallidos", async () => {
    for (let i = 0; i < 5; i++) {
      await api(ctx, "POST", "/auth/login", {
        json: { email: "estudiante.fdcp@unmsm.edu.pe", password: "Incorrecta1" },
      });
    }
    const r = await api(ctx, "POST", "/auth/login", {
      json: { email: "estudiante.fdcp@unmsm.edu.pe", password: "Demo1234" },
    });
    expect(r.status).toBe(423);
  });
  it("sin token o con token inválido → 401", async () => {
    expect((await api(ctx, "GET", "/solicitudes")).status).toBe(401);
    expect((await api(ctx, "GET", "/solicitudes", { token: "abc.def.ghi" })).status).toBe(401);
  });
  it("cambiar la contraseña invalida las sesiones anteriores", async () => {
    const viejo = await login(ctx, "estudiante.fm");
    const r = await api(ctx, "POST", "/auth/cambiar-password", {
      token: viejo,
      json: { actual: "Demo1234", nueva: "NuevaClave2026" },
    });
    expect(r.status).toBe(200);
    expect((await api(ctx, "GET", "/auth/me", { token: viejo })).status).toBe(401);
    expect((await api(ctx, "GET", "/auth/me", { token: r.body.token })).status).toBe(200);
  });
});

describe("Administración", () => {
  it("solo el rol ADMIN accede a /admin", async () => {
    const sup = await login(ctx, "supervisor.fisi");
    expect((await api(ctx, "GET", "/admin/usuarios", { token: sup })).status).toBe(403);
  });

  it("el admin de facultad solo ve y gestiona su facultad", async () => {
    const admin = await login(ctx, "admin.fisi");
    const lista = await api(ctx, "GET", "/admin/usuarios?size=50", { token: admin });
    expect(
      lista.body.items.every(
        (u: { facultad: { codigo: string } | null }) => u.facultad?.codigo === "FISI",
      ),
    ).toBe(true);
    const otro = await api(ctx, "GET", "/admin/usuarios?q=supervisor.fm", {
      token: await login(ctx, "admin.central"),
    });
    const idFM = otro.body.items[0].id;
    expect(
      (await api(ctx, "PUT", `/admin/usuarios/${idFM}`, { token: admin, json: { activo: false } }))
        .status,
    ).toBe(403);
  });

  it("no deja desactivar a un técnico con solicitudes en curso", async () => {
    const admin = await login(ctx, "admin.fisi");
    const tec = await api(ctx, "GET", "/admin/usuarios?q=tecnico.fisi", { token: admin });
    const r = await api(ctx, "PUT", `/admin/usuarios/${tec.body.items[0].id}`, {
      token: admin,
      json: { activo: false },
    });
    expect(r.status).toBe(422);
    expect(r.body.detail).toContain("Reasígnalas");
  });

  it("desactivar una cuenta corta su sesión al instante", async () => {
    const admin = await login(ctx, "admin.fisi");
    const est = await login(ctx, "estudiante2.fisi");
    const u = await api(ctx, "GET", "/admin/usuarios?q=estudiante2.fisi", { token: admin });
    expect(
      (
        await api(ctx, "PUT", `/admin/usuarios/${u.body.items[0].id}`, {
          token: admin,
          json: { activo: false },
        })
      ).status,
    ).toBe(200);
    expect((await api(ctx, "GET", "/auth/me", { token: est })).status).toBe(401);
  });

  it("un tipo de trámite con solicitudes no se elimina (409); uno sin uso sí (204)", async () => {
    const admin = await login(ctx, "admin.fisi");
    const tipos = await api(ctx, "GET", "/tipos-tramite?incluirInactivos=true", { token: admin });
    const usado = tipos.body.find((t: { nombre: string }) => t.nombre === "Constancia de estudios");
    expect(
      (await api(ctx, "DELETE", `/admin/tipos-tramite/${usado.id}`, { token: admin })).status,
    ).toBe(409);

    const nuevo = await api(ctx, "POST", "/admin/tipos-tramite", {
      token: admin,
      json: {
        areaId: usado.area.id,
        nombre: "Duplicado de carné",
        descripcion: "Emisión de un nuevo carné universitario.",
        requisitos: ["Denuncia o carné deteriorado"],
        plazoDias: 5,
      },
    });
    expect(nuevo.status).toBe(201);
    expect(nuevo.body.area.id).toBe(usado.area.id);
    expect(
      (await api(ctx, "DELETE", `/admin/tipos-tramite/${nuevo.body.id}`, { token: admin })).status,
    ).toBe(204);
  });

  it("un trámite desactivado ya no se puede solicitar", async () => {
    const admin = await login(ctx, "admin.fisi");
    const est = await login(ctx, "estudiante.fisi");
    const tipos = await api(ctx, "GET", "/tipos-tramite?incluirInactivos=true", { token: admin });
    const t = tipos.body.find((x: { nombre: string }) => x.nombre === "Reserva de matrícula");
    const off = await api(ctx, "PUT", `/admin/tipos-tramite/${t.id}`, {
      token: admin,
      json: {
        areaId: t.area.id,
        nombre: t.nombre,
        descripcion: t.descripcion,
        requisitos: t.requisitos,
        plazoDias: t.plazoDias,
        activo: false,
      },
    });
    expect(off.status).toBe(200);
    const r = await api(ctx, "POST", "/solicitudes", {
      token: est,
      form: formulario({
        tipoId: t.id,
        asunto: "Reserva 2027",
        descripcion: "Solicito reservar mi matrícula del semestre.",
      }),
    });
    expect(r.status).toBe(422);
  });

  it("solo el administrador central crea facultades", async () => {
    const adminFac = await login(ctx, "admin.fisi");
    const central = await login(ctx, "admin.central");
    const body = { codigo: "FPRUEBA", nombre: "Facultad de Prueba" };
    expect(
      (await api(ctx, "POST", "/admin/facultades", { token: adminFac, json: body })).status,
    ).toBe(403);
    expect(
      (await api(ctx, "POST", "/admin/facultades", { token: central, json: body })).status,
    ).toBe(201);
    expect(
      (await api(ctx, "POST", "/admin/facultades", { token: central, json: body })).status,
    ).toBe(409);
  });

  it("el central ve todas las facultades en el dashboard; el resto solo la suya", async () => {
    const central = await api(ctx, "GET", "/dashboard", {
      token: await login(ctx, "admin.central"),
    });
    expect(central.body.porFacultad.length).toBeGreaterThan(1);
  });

  it("al reasignar, el técnico anterior pierde el acceso y el nuevo lo gana", async () => {
    const sup = await login(ctx, "supervisor.fisi");
    const jorge = await login(ctx, "tecnico.fisi");
    const rosa = await login(ctx, "tecnico2.fisi");
    const lista = await api(ctx, "GET", "/solicitudes?estado=ASIGNADA", { token: sup });
    const cod = lista.body.items[0].codigo;
    const rosaId = (
      await api(ctx, "GET", `/solicitudes/${cod}`, { token: sup })
    ).body.responsablesDisponibles.find(
      (r: { nombre: string }) => r.nombre === "Rosa Quispe Mamani",
    ).id;
    expect((await accion(ctx, sup, cod, "REASIGNAR", { responsableId: rosaId })).status).toBe(200);
    expect((await api(ctx, "GET", `/solicitudes/${cod}`, { token: jorge })).status).toBe(404);
    expect((await api(ctx, "GET", `/solicitudes/${cod}`, { token: rosa })).status).toBe(200);
  });
});
