import { describe, expect, it } from "vitest";
import { anioEnLima, estaVencida, sumarDiasHabiles } from "../../src/domain/plazos.js";

// Fechas en hora de Lima (UTC-5).
const lima = (s: string) => new Date(`${s}-05:00`);

describe("plazos en días hábiles (calendario de Lima)", () => {
  it("de jueves, 3 días hábiles terminan el martes siguiente", () => {
    expect(sumarDiasHabiles(lima("2026-10-15T09:00:00"), 3).toISOString()).toBe(
      lima("2026-10-20T09:00:00").toISOString(),
    );
  });
  it("de viernes, 1 día hábil es el lunes", () => {
    expect(sumarDiasHabiles(lima("2026-10-16T18:00:00"), 1).toISOString()).toBe(
      lima("2026-10-19T18:00:00").toISOString(),
    );
  });
  it("usa el día de Lima aunque en UTC ya sea el día siguiente", () => {
    // Viernes 23:30 en Lima = sábado 04:30 UTC. Sigue siendo viernes para el plazo.
    expect(sumarDiasHabiles(lima("2026-10-16T23:30:00"), 1).toISOString()).toBe(
      lima("2026-10-19T23:30:00").toISOString(),
    );
  });
  it("el año del correlativo es el de Lima, no el de UTC", () => {
    expect(anioEnLima(lima("2026-12-31T22:00:00"))).toBe(2026);
  });
  it("una solicitud resuelta o cerrada nunca está vencida", () => {
    const limite = lima("2026-10-01T09:00:00");
    const despues = lima("2026-10-10T09:00:00");
    expect(estaVencida(limite, "EN_ATENCION", despues)).toBe(true);
    expect(estaVencida(limite, "RESUELTA", despues)).toBe(false);
    expect(estaVencida(limite, "CERRADA", despues)).toBe(false);
  });
});
