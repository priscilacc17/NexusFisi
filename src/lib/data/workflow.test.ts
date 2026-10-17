import { describe, expect, it } from "vitest";
import { canTransition, studentCanCorrect } from "./workflow";

describe("flujo de estados", () => {
  it("Registrada solo pasa a En evaluación", () => {
    expect(canTransition("Registrada", "En evaluación")).toBe(true);
    expect(canTransition("Registrada", "Resuelta")).toBe(false);
  });
  it("Solo se puede cerrar una solicitud resuelta", () => {
    expect(canTransition("Resuelta", "Cerrada")).toBe(true);
    expect(canTransition("En atención", "Cerrada")).toBe(false);
  });
  it("El estudiante solo corrige solicitudes observadas", () => {
    expect(studentCanCorrect("Observada")).toBe(true);
    expect(studentCanCorrect("Asignada")).toBe(false);
  });
});
