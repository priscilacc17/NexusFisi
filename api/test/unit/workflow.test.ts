import { describe, expect, it } from "vitest";
import { accionesPermitidas, estadoDestino, puede, validarDatos, type Actor, type EstadoSolicitud } from "../../src/domain/workflow.js";

const FAC = 1;
const estudiante: Actor = { id: 10, rol: "ESTUDIANTE", facultadId: FAC };
const otroEstudiante: Actor = { id: 11, rol: "ESTUDIANTE", facultadId: FAC };
const supervisor: Actor = { id: 20, rol: "SUPERVISOR", facultadId: FAC };
const supervisorOtraFac: Actor = { id: 21, rol: "SUPERVISOR", facultadId: 2 };
const tecnico: Actor = { id: 30, rol: "TECNICO", facultadId: FAC };
const otroTecnico: Actor = { id: 31, rol: "TECNICO", facultadId: FAC };
const adminFac: Actor = { id: 40, rol: "ADMIN", facultadId: FAC };
const adminCentral: Actor = { id: 41, rol: "ADMIN", facultadId: null };

const sol = (over: Partial<EstadoSolicitud> = {}): EstadoSolicitud => ({
  estado: "REGISTRADA", estadoPrevio: null, estudianteId: 10, responsableId: null, facultadId: FAC, reaperturas: 0, ...over,
});

describe("flujo de estados: quién puede hacer qué", () => {
  it("solo el supervisor de la MISMA facultad inicia la evaluación", () => {
    expect(puede(supervisor, "EVALUAR", sol())).toBe(true);
    expect(puede(supervisorOtraFac, "EVALUAR", sol())).toBe(false);
    expect(puede(tecnico, "EVALUAR", sol())).toBe(false);
    expect(puede(estudiante, "EVALUAR", sol())).toBe(false);
  });

  it("los administradores consultan pero no intervienen en el flujo", () => {
    for (const estado of ["REGISTRADA", "EN_EVALUACION", "EN_ATENCION", "RESUELTA"] as const) {
      expect(accionesPermitidas(adminFac, sol({ estado, responsableId: 30 }))).toEqual([]);
      expect(accionesPermitidas(adminCentral, sol({ estado, responsableId: 30 }))).toEqual([]);
    }
  });

  it("solo el técnico asignado inicia la atención", () => {
    const s = sol({ estado: "ASIGNADA", responsableId: 30 });
    expect(puede(tecnico, "INICIAR_ATENCION", s)).toBe(true);
    expect(puede(otroTecnico, "INICIAR_ATENCION", s)).toBe(false);
    expect(puede(supervisor, "INICIAR_ATENCION", s)).toBe(false);
  });

  it("el supervisor puede asignarse a sí mismo y atender", () => {
    const s = sol({ estado: "ASIGNADA", responsableId: 20 });
    expect(puede(supervisor, "INICIAR_ATENCION", s)).toBe(true);
  });

  it("observar se permite en evaluación (supervisor) y en atención (responsable o supervisor)", () => {
    expect(puede(supervisor, "OBSERVAR", sol({ estado: "EN_EVALUACION" }))).toBe(true);
    expect(puede(tecnico, "OBSERVAR", sol({ estado: "EN_EVALUACION", responsableId: 30 }))).toBe(false);
    expect(puede(tecnico, "OBSERVAR", sol({ estado: "EN_ATENCION", responsableId: 30 }))).toBe(true);
    expect(puede(otroTecnico, "OBSERVAR", sol({ estado: "EN_ATENCION", responsableId: 30 }))).toBe(false);
  });

  it("la corrección devuelve la solicitud al estado desde el que se observó", () => {
    expect(estadoDestino("CORREGIR", sol({ estado: "OBSERVADA", estadoPrevio: "EN_ATENCION" }))).toBe("EN_ATENCION");
    expect(estadoDestino("CORREGIR", sol({ estado: "OBSERVADA", estadoPrevio: "EN_EVALUACION" }))).toBe("EN_EVALUACION");
    expect(estadoDestino("CORREGIR", sol({ estado: "OBSERVADA", estadoPrevio: null }))).toBe("EN_EVALUACION");
  });

  it("solo el dueño corrige, desiste, cierra conforme o reabre", () => {
    expect(puede(estudiante, "CORREGIR", sol({ estado: "OBSERVADA" }))).toBe(true);
    expect(puede(otroEstudiante, "CORREGIR", sol({ estado: "OBSERVADA" }))).toBe(false);
    expect(puede(estudiante, "DESISTIR", sol({ estado: "EN_EVALUACION" }))).toBe(true);
    expect(puede(estudiante, "DESISTIR", sol({ estado: "EN_ATENCION" }))).toBe(false);
    expect(puede(estudiante, "CERRAR", sol({ estado: "RESUELTA" }))).toBe(true);
    expect(puede(otroEstudiante, "CERRAR", sol({ estado: "RESUELTA" }))).toBe(false);
  });

  it("solo se puede reabrir una vez", () => {
    expect(puede(estudiante, "REABRIR", sol({ estado: "RESUELTA", reaperturas: 0 }))).toBe(true);
    expect(puede(estudiante, "REABRIR", sol({ estado: "RESUELTA", reaperturas: 1 }))).toBe(false);
  });

  it("no se puede priorizar una solicitud terminada", () => {
    expect(puede(supervisor, "PRIORIZAR", sol({ estado: "EN_ATENCION" }))).toBe(true);
    expect(puede(supervisor, "PRIORIZAR", sol({ estado: "RESUELTA" }))).toBe(false);
    expect(puede(supervisor, "PRIORIZAR", sol({ estado: "CERRADA" }))).toBe(false);
  });

  it("una solicitud cerrada no admite ninguna acción", () => {
    for (const a of [estudiante, supervisor, tecnico, adminFac]) {
      expect(accionesPermitidas(a, sol({ estado: "CERRADA", responsableId: 30 }))).toEqual([]);
    }
  });
});

describe("datos obligatorios por acción", () => {
  it("observar exige una nota de al menos 10 caracteres", () => {
    expect(validarDatos("OBSERVAR", {})).not.toBeNull();
    expect(validarDatos("OBSERVAR", { nota: "corto" })).not.toBeNull();
    expect(validarDatos("OBSERVAR", { nota: "Falta la firma del representante" })).toBeNull();
  });
  it("resolver exige la respuesta para el estudiante", () => {
    expect(validarDatos("RESOLVER", { respuesta: "   " })).not.toBeNull();
    expect(validarDatos("RESOLVER", { respuesta: "Constancia emitida y enviada" })).toBeNull();
  });
  it("asignar exige un responsable", () => {
    expect(validarDatos("ASIGNAR", {})).not.toBeNull();
    expect(validarDatos("ASIGNAR", { responsableId: 3 })).toBeNull();
  });
});
