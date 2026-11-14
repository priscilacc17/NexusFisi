import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccionesPanel } from "@/components/app/request/AccionesPanel";
import type { SolicitudDetalle, Usuario } from "@/lib/api/types";

const base = {
  codigo: "FISI-2026-00001", version: 3, asunto: "x", descripcion: "x", estado: "EN_EVALUACION", estadoPrevio: null, prioridad: "MEDIA",
  respuesta: null, tipoCierre: null, reaperturas: 0, createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", fechaLimite: "2026-11-05T10:00:00Z",
  resueltaAt: null, cerradaAt: null, vencida: false, facultad: { id: 1, codigo: "FISI", nombre: "FISI" },
  tipo: { id: 1, nombre: "Constancia", requisitos: [], plazoDias: 3, area: { id: 1, nombre: "Matrícula", ubicacion: "P1" } },
  estudiante: { id: 9, nombre: "Lucía", email: "l@unmsm.edu.pe", codigoEstudiante: "1", escuela: null },
  responsable: null, adjuntos: [], observaciones: [], historial: [], mensajes: [], puedeAdjuntar: null, puedeEnviarMensaje: true, responsablesDisponibles: [],
} satisfies Omit<SolicitudDetalle, "acciones">;

const supervisor: Usuario = { id: 2, nombre: "Carmen", email: "c@unmsm.edu.pe", rol: "SUPERVISOR", facultad: { id: 1, codigo: "FISI", nombre: "FISI" }, escuela: null, area: null, codigoEstudiante: null, activo: true };
const admin: Usuario = { ...supervisor, id: 3, rol: "ADMIN" };

const pintar = (s: SolicitudDetalle, u: Usuario) =>
  render(<QueryClientProvider client={new QueryClient()}><AccionesPanel s={s} user={u} /></QueryClientProvider>);

describe("panel de acciones", () => {
  it("muestra solo las acciones que la API autoriza", () => {
    pintar({ ...base, acciones: ["OBSERVAR", "ASIGNAR", "PRIORIZAR"] } as SolicitudDetalle, supervisor);
    expect(screen.getByRole("button", { name: "Asignar responsable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Observar / pedir corrección" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolver" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar evaluación" })).not.toBeInTheDocument();
  });

  it("al administrador le explica que solo consulta", () => {
    pintar({ ...base, acciones: [] } as SolicitudDetalle, admin);
    expect(screen.getByText(/Los administradores consultan el expediente/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
