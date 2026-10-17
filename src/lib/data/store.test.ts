import { beforeEach, describe, expect, it } from "vitest";
import { dataService, getState } from "./store";

const get = (id: string) => getState().requests.find((r) => r.id === id)!;

describe("flujo completo de una solicitud", () => {
  beforeEach(() => dataService.reset());

  it("registrar → evaluar → observar → corregir → asignar → atender → responder → resolver → cerrar", () => {
    const r = dataService.createRequest({ typeId: "t1", studentId: "u1", subject: "Constancia para beca", description: "Necesito la constancia para postular.", files: [{ name: "dni.pdf", size: 1000 }] });
    expect(get(r.id).status).toBe("Registrada");
    expect(getState().notifications.some((n) => n.userId === "u3" && n.requestId === r.id)).toBe(true);

    dataService.changeStatus(r.id, "En evaluación", "u3");
    expect(() => dataService.changeStatus(r.id, "Observada", "u3")).toThrow(); // exige nota
    dataService.changeStatus(r.id, "Observada", "u3", "Falta DNI legible");
    expect(get(r.id).observations[0]?.resolved).toBe(false);

    expect(() => dataService.submitCorrection(r.id, "u2", "No soy el dueño", [])).toThrow();
    dataService.submitCorrection(r.id, "u1", "Adjunto DNI legible", [{ name: "dni2.pdf", size: 2000 }]);
    expect(get(r.id).status).toBe("En evaluación");
    expect(get(r.id).observations.every((o) => o.resolved)).toBe(true);
    expect(get(r.id).attachments).toHaveLength(2);

    dataService.assign(r.id, "u4", "u3");
    expect(get(r.id).status).toBe("Asignada");
    dataService.changeStatus(r.id, "En atención", "u4");
    expect(() => dataService.changeStatus(r.id, "Resuelta", "u4")).toThrow(); // exige respuesta
    dataService.respond(r.id, "Constancia emitida y enviada al correo.", "u4");
    dataService.changeStatus(r.id, "Resuelta", "u4");
    dataService.changeStatus(r.id, "Cerrada", "u4");

    const final = get(r.id);
    expect(final.status).toBe("Cerrada");
    expect(final.response).toContain("Constancia emitida");
    expect(final.history.map((h) => h.to)).toEqual(
      ["Registrada", "En evaluación", "Observada", "En evaluación", "Asignada", "En atención", undefined, "Resuelta", "Cerrada"],
    );
  });

  it("los mensajes notifican a la otra parte", () => {
    dataService.addMessage("NF-2026-0002", "u1", "Ya tengo la carta firmada");
    expect(get("NF-2026-0002").messages.at(-1)?.text).toBe("Ya tengo la carta firmada");
    dataService.addMessage("NF-2026-0002", "u3", "Perfecto, adjúntala");
    expect(getState().notifications.some((n) => n.userId === "u1" && n.text.includes("Nuevo mensaje"))).toBe(true);
  });
});
