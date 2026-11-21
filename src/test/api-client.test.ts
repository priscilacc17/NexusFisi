import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api/client";
import { cerrarSesion, getSesion, iniciarSesion } from "@/lib/session";
import type { Usuario } from "@/lib/api/types";

const usuario: Usuario = {
  id: 1,
  nombre: "Lucía",
  email: "l@unmsm.edu.pe",
  rol: "ESTUDIANTE",
  facultad: null,
  escuela: null,
  area: null,
  codigoEstudiante: "21200154",
  activo: true,
};
const respuesta = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  cerrarSesion();
});

describe("cliente de la API", () => {
  it("usa la cookie (no expone el token), envía la cabecera anti-CSRF y arma la query omitiendo vacíos", async () => {
    iniciarSesion({ usuario });
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await api("GET", "/solicitudes", {
      query: { estado: "OBSERVADA", q: "", vencidas: false, page: 2 },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/solicitudes?estado=OBSERVADA&page=2");
    expect(init.headers.authorization).toBeUndefined();
    expect(init.headers["x-nexus"]).toBe("1");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.stringify(localStorage)).not.toMatch(/token/i);
  });

  it("convierte problem+json en ApiError con los errores por campo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuesta(400, {
          title: "SOLICITUD_INVALIDA",
          detail: "Revisa los campos.",
          errors: { asunto: "Mínimo 5" },
        }),
      ),
    );
    const e = (await api("POST", "/solicitudes", { json: {} }).catch(
      (x: unknown) => x,
    )) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(400);
    expect(e.errors).toEqual({ asunto: "Mínimo 5" });
    expect(e.message).toBe("Revisa los campos.");
  });

  it("un 401 con sesión abierta cierra la sesión local", async () => {
    iniciarSesion({ usuario });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          respuesta(401, { title: "NO_AUTENTICADO", detail: "Tu sesión expiró." }),
        ),
    );
    await expect(api("GET", "/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(getSesion()).toBeNull();
  });

  it("sin conexión con el servidor da un mensaje claro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const e = (await api("GET", "/facultades").catch((x: unknown) => x)) as ApiError;
    expect(e.code).toBe("SIN_CONEXION");
    expect(e.message).toMatch(/No se pudo conectar/);
  });
});
