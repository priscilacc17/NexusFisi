import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, prepararApp, type Contexto } from "./helpers.js";

let ctx: Contexto;
beforeAll(async () => {
  ctx = await prepararApp({ AUTH_RATE_LIMIT: "3" });
});
afterAll(() => ctx.database.close());

const intento = (email: string) =>
  api(ctx, "POST", "/auth/login", { json: { email, password: "Incorrecta9" } });

describe("límite de intentos de login (IP compartida del campus)", () => {
  it("frena a una cuenta que insiste, sin bloquear a las demás desde la misma IP", async () => {
    for (let i = 0; i < 3; i++)
      expect((await intento("estudiante.fm@unmsm.edu.pe")).status).toBe(401);
    const cuartaVez = await intento("estudiante.fm@unmsm.edu.pe");
    expect(cuartaVez.status).toBe(429);
    // Otra persona en la misma red sigue pudiendo ingresar.
    const otra = await api(ctx, "POST", "/auth/login", {
      json: { email: "estudiante.fisi@unmsm.edu.pe", password: "Demo1234" },
    });
    expect(otra.status).toBe(200);
  });
});
