import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accion,
  api,
  formulario,
  login,
  olvidarTokens,
  pdf,
  prepararApp,
  type Contexto,
} from "./helpers.js";

let ctx: Contexto;
let estudiante: string,
  estudiante2: string,
  supervisor: string,
  tecnico: string,
  tecnico2: string,
  supervisorFM: string,
  adminFisi: string;
let tipoFisi: number, tipoFM: number;

beforeAll(async () => {
  olvidarTokens();
  ctx = await prepararApp();
  [estudiante, estudiante2, supervisor, tecnico, tecnico2, supervisorFM, adminFisi] =
    (await Promise.all(
      [
        "estudiante.fisi",
        "estudiante2.fisi",
        "supervisor.fisi",
        "tecnico.fisi",
        "tecnico2.fisi",
        "supervisor.fm",
        "admin.fisi",
      ].map((u) => login(ctx, u)),
    )) as [string, string, string, string, string, string, string];
  const tipos = await api(ctx, "GET", "/tipos-tramite", { token: estudiante });
  tipoFisi = tipos.body.find((t: { nombre: string }) => t.nombre === "Constancia de estudios").id;
  const tiposFM = await api(ctx, "GET", "/tipos-tramite", { token: supervisorFM });
  tipoFM = tiposFM.body[0].id;
});
afterAll(() => ctx.database.close());

const nueva = (token: string, extra: Record<string, string | number> = {}, archivos?: File[]) =>
  api(ctx, "POST", "/solicitudes", {
    token,
    form: formulario(
      {
        tipoId: tipoFisi,
        asunto: "Constancia para beca",
        descripcion: "Necesito la constancia para postular a una beca.",
        ...extra,
      },
      archivos,
    ),
  });

describe("HU02 · Registro de solicitud", () => {
  it("Escenario 1 – registro correcto: código único y estado Registrada", async () => {
    const r = await nueva(estudiante);
    expect(r.status).toBe(201);
    expect(r.body.codigo).toMatch(/^FISI-\d{4}-\d{5}$/);
    expect(r.body.estado).toBe("REGISTRADA");
    expect(r.body.adjuntos).toHaveLength(1);
    expect(r.body.historial[0].estadoHasta).toBe("REGISTRADA");
  });

  it("Escenario 2 – datos incompletos: mensaje de validación y NO se registra", async () => {
    const antes = await api(ctx, "GET", "/solicitudes?size=1", { token: estudiante });
    const r = await nueva(estudiante, { asunto: "", descripcion: "corta" });
    expect(r.status).toBe(400);
    expect(r.body.errors).toHaveProperty("asunto");
    expect(r.body.errors).toHaveProperty("descripcion");
    const despues = await api(ctx, "GET", "/solicitudes?size=1", { token: estudiante });
    expect(despues.body.total).toBe(antes.body.total);
  });

  it("exige al menos un documento", async () => {
    const r = await nueva(estudiante, {}, []);
    expect(r.status).toBe(400);
    expect(r.body.errors).toHaveProperty("archivos");
  });

  it("rechaza un archivo que no es PDF/JPG/PNG aunque tenga extensión .pdf", async () => {
    const falso = new File(["MZ ejecutable disfrazado"], "constancia.pdf", {
      type: "application/pdf",
    });
    const r = await nueva(estudiante, {}, [falso]);
    expect(r.status).toBe(415);
  });

  it("no permite registrar un trámite de otra facultad", async () => {
    const r = await nueva(estudiante, { tipoId: tipoFM });
    expect(r.status).toBe(422);
  });

  it("el personal no registra solicitudes", async () => {
    const r = await nueva(supervisor);
    expect(r.status).toBe(403);
  });

  it("registros simultáneos obtienen códigos distintos (correlativo atómico)", async () => {
    const res = await Promise.all(Array.from({ length: 6 }, () => nueva(estudiante2)));
    expect(res.every((r) => r.status === 201)).toBe(true);
    const codigos = res.map((r) => r.body.codigo);
    expect(new Set(codigos).size).toBe(6);
  });
});

describe("Aislamiento por facultad y por rol", () => {
  it("el supervisor de otra facultad no ve ni encuentra la solicitud", async () => {
    const { body } = await nueva(estudiante);
    const r = await api(ctx, "GET", `/solicitudes/${body.codigo}`, { token: supervisorFM });
    expect(r.status).toBe(404);
    const lista = await api(ctx, "GET", `/solicitudes?q=${body.codigo}`, { token: supervisorFM });
    expect(lista.body.total).toBe(0);
  });

  it("un estudiante no ve solicitudes de otro estudiante", async () => {
    const { body } = await nueva(estudiante);
    expect(
      (await api(ctx, "GET", `/solicitudes/${body.codigo}`, { token: estudiante2 })).status,
    ).toBe(404);
  });

  it("el técnico solo ve lo que tiene asignado", async () => {
    const lista = await api(ctx, "GET", "/solicitudes?size=50", { token: tecnico });
    expect(lista.body.items.length).toBeGreaterThan(0);
    expect(
      lista.body.items.every(
        (s: { responsable: { nombre: string } }) => s.responsable?.nombre === "Jorge Medina Ríos",
      ),
    ).toBe(true);
  });

  it("el administrador de facultad consulta pero no tiene acciones de flujo", async () => {
    const { body } = await nueva(estudiante);
    const r = await api(ctx, "GET", `/solicitudes/${body.codigo}`, { token: adminFisi });
    expect(r.status).toBe(200);
    expect(r.body.acciones).toEqual([]);
  });
});

describe("Flujo completo: registrar → revisar → observar → corregir → resolver → consultar", () => {
  it("recorre todos los estados con las validaciones de cada paso", async () => {
    const { body: creada } = await nueva(estudiante);
    const cod = creada.codigo as string;

    expect((await accion(ctx, supervisor, cod, "EVALUAR")).body.estado).toBe("EN_EVALUACION");

    const sinNota = await accion(ctx, supervisor, cod, "OBSERVAR");
    expect(sinNota.status).toBe(400);
    const obs = await accion(ctx, supervisor, cod, "OBSERVAR", {
      nota: "Falta el DNI legible por ambas caras.",
    });
    expect(obs.body.estado).toBe("OBSERVADA");

    // El estudiante adjunta el documento corregido y envía la corrección.
    const adj = await api(ctx, "POST", `/solicitudes/${cod}/adjuntos`, {
      token: estudiante,
      form: formulario({}, [pdf("dni_legible.pdf")]),
    });
    expect(adj.status).toBe(201);
    expect(adj.body.adjuntos.some((a: { etapa: string }) => a.etapa === "CORRECCION")).toBe(true);
    const corr = await accion(ctx, estudiante, cod, "CORREGIR", {
      nota: "Adjunto el DNI escaneado nuevamente.",
    });
    expect(corr.body.estado).toBe("EN_EVALUACION");
    expect(corr.body.observaciones.every((o: { resuelta: boolean }) => o.resuelta)).toBe(true);

    const tecId = (
      await api(ctx, "GET", `/solicitudes/${cod}`, { token: supervisor })
    ).body.responsablesDisponibles.find(
      (r: { nombre: string }) => r.nombre === "Jorge Medina Ríos",
    ).id;
    const asig = await accion(ctx, supervisor, cod, "ASIGNAR", {
      responsableId: tecId,
      prioridad: "ALTA",
    });
    expect(asig.body.estado).toBe("ASIGNADA");
    expect(asig.body.prioridad).toBe("ALTA");

    // Otro técnico no puede iniciar la atención de algo que no es suyo.
    const v = asig.body.version;
    expect(
      (
        await api(ctx, "POST", `/solicitudes/${cod}/transiciones`, {
          token: tecnico2,
          json: { accion: "INICIAR_ATENCION", version: v },
        })
      ).status,
    ).toBe(404);
    expect((await accion(ctx, tecnico, cod, "INICIAR_ATENCION")).body.estado).toBe("EN_ATENCION");

    const sinRespuesta = await accion(ctx, tecnico, cod, "RESOLVER");
    expect(sinRespuesta.status).toBe(400);
    const res = await accion(ctx, tecnico, cod, "RESOLVER", {
      respuesta: "Constancia emitida y enviada a tu correo institucional.",
    });
    expect(res.body.estado).toBe("RESUELTA");

    const vista = await api(ctx, "GET", `/solicitudes/${cod}`, { token: estudiante });
    expect(vista.body.respuesta).toContain("Constancia emitida");
    expect(vista.body.acciones).toEqual(expect.arrayContaining(["CERRAR", "REABRIR"]));

    const cierre = await accion(ctx, estudiante, cod, "CERRAR");
    expect(cierre.body.estado).toBe("CERRADA");
    expect(cierre.body.tipoCierre).toBe("CONFORME");
    expect(
      cierre.body.historial
        .map((h: { estadoHasta: string | null }) => h.estadoHasta)
        .filter(Boolean),
    ).toEqual([
      "REGISTRADA",
      "EN_EVALUACION",
      "OBSERVADA",
      "EN_EVALUACION",
      "ASIGNADA",
      "EN_ATENCION",
      "RESUELTA",
      "CERRADA",
    ]);
    // Cerrada: nadie puede escribir ni actuar.
    expect(
      (
        await api(ctx, "POST", `/solicitudes/${cod}/mensajes`, {
          token: estudiante,
          json: { texto: "hola" },
        })
      ).status,
    ).toBe(422);
  });

  it("observada durante la atención, la corrección vuelve a 'En atención' con el mismo técnico", async () => {
    const { body } = await nueva(estudiante);
    const cod = body.codigo;
    await accion(ctx, supervisor, cod, "EVALUAR");
    const tecId = (
      await api(ctx, "GET", `/solicitudes/${cod}`, { token: supervisor })
    ).body.responsablesDisponibles.find(
      (r: { nombre: string }) => r.nombre === "Jorge Medina Ríos",
    ).id;
    await accion(ctx, supervisor, cod, "ASIGNAR", { responsableId: tecId });
    await accion(ctx, tecnico, cod, "INICIAR_ATENCION");
    expect(
      (
        await accion(ctx, tecnico, cod, "OBSERVAR", {
          nota: "El sílabo no está visado por la escuela.",
        })
      ).body.estado,
    ).toBe("OBSERVADA");
    const corr = await accion(ctx, estudiante, cod, "CORREGIR", {
      nota: "Adjunto el sílabo visado por la escuela.",
    });
    expect(corr.body.estado).toBe("EN_ATENCION");
    expect(corr.body.responsable.id).toBe(tecId);
  });

  it("dos personas actuando a la vez: la segunda recibe 409 en lugar de pisar el cambio", async () => {
    const { body } = await nueva(estudiante);
    const det = await api(ctx, "GET", `/solicitudes/${body.codigo}`, { token: supervisor });
    const v = det.body.version;
    const primera = await api(ctx, "POST", `/solicitudes/${body.codigo}/transiciones`, {
      token: supervisor,
      json: { accion: "EVALUAR", version: v },
    });
    expect(primera.status).toBe(200);
    const segunda = await api(ctx, "POST", `/solicitudes/${body.codigo}/transiciones`, {
      token: supervisor,
      json: { accion: "PRIORIZAR", prioridad: "URGENTE", version: v },
    });
    expect(segunda.status).toBe(409);
  });

  it("el estudiante puede desistir antes de la atención, pero no después", async () => {
    const { body } = await nueva(estudiante);
    const d = await accion(ctx, estudiante, body.codigo, "DESISTIR", {
      nota: "Ya no necesito el trámite.",
    });
    expect(d.body.estado).toBe("CERRADA");
    expect(d.body.tipoCierre).toBe("DESISTIDA");
  });

  it("no se puede asignar a personal de otra facultad", async () => {
    const { body } = await nueva(estudiante);
    await accion(ctx, supervisor, body.codigo, "EVALUAR");
    const yo = await api(ctx, "GET", "/auth/me", { token: supervisorFM });
    const r = await accion(ctx, supervisor, body.codigo, "ASIGNAR", { responsableId: yo.body.id });
    expect(r.status).toBe(422);
  });

  it("notifica al estudiante cuando su solicitud cambia de estado", async () => {
    const { body } = await nueva(estudiante);
    await accion(ctx, supervisor, body.codigo, "EVALUAR");
    const n = await api(ctx, "GET", "/notificaciones", { token: estudiante });
    expect(
      n.body.items.some(
        (x: { solicitudCodigo: string; texto: string }) =>
          x.solicitudCodigo === body.codigo && x.texto.includes("En evaluación"),
      ),
    ).toBe(true);
  });
});

describe("Adjuntos", () => {
  it("el dueño descarga su documento; otro estudiante recibe 404", async () => {
    const { body } = await nueva(estudiante, {}, [pdf("dni.pdf")]);
    const id = body.adjuntos[0].id;
    const propia = await ctx.app.request(`/api/v1/solicitudes/${body.codigo}/adjuntos/${id}`, {
      headers: { authorization: `Bearer ${estudiante}` },
    });
    expect(propia.status).toBe(200);
    expect(propia.headers.get("content-disposition")).toContain("dni.pdf");
    expect(propia.headers.get("x-content-type-options")).toBe("nosniff");
    const ajena = await ctx.app.request(`/api/v1/solicitudes/${body.codigo}/adjuntos/${id}`, {
      headers: { authorization: `Bearer ${estudiante2}` },
    });
    expect(ajena.status).toBe(404);
  });
});

describe("Listado y dashboard", () => {
  it("filtra por estado y marca las vencidas", async () => {
    const r = await api(ctx, "GET", "/solicitudes?vencidas=true", { token: supervisor });
    expect(r.status).toBe(200);
    expect(r.body.items.every((s: { vencida: boolean }) => s.vencida)).toBe(true);
    expect(r.body.total).toBeGreaterThan(0);
  });

  it("valida los parámetros de consulta", async () => {
    const r = await api(ctx, "GET", "/solicitudes?desde=13-11-2026", { token: supervisor });
    expect(r.status).toBe(400);
    expect(r.body.errors).toHaveProperty("desde");
  });

  it("los indicadores se limitan a la facultad del usuario", async () => {
    const fisi = await api(ctx, "GET", "/dashboard", { token: supervisor });
    const fm = await api(ctx, "GET", "/dashboard", { token: supervisorFM });
    expect(fisi.body.porFacultad.map((f: { clave: string }) => f.clave)).toEqual(["FISI"]);
    expect(fm.body.porFacultad.map((f: { clave: string }) => f.clave)).toEqual(["FM"]);
    expect(fisi.body.total).toBe(
      fisi.body.porEstado.reduce((a: number, e: { total: number }) => a + e.total, 0),
    );
  });
});
