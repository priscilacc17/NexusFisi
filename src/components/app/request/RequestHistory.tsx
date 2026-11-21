import type { Estado, SolicitudDetalle } from "@/lib/api/types";
import { estadoLabel, rolLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Panel, StatusBadge, fmtDate } from "../common";

// Línea de tiempo con cada movimiento del expediente (lo más reciente arriba).
export function RequestHistory({ s }: { s: SolicitudDetalle }) {
  const items = [...s.historial].reverse();
  return (
    <Panel>
      <p className="font-semibold">Historial de movimientos</p>
      <ol className="mt-4 space-y-4 border-l-2 border-muted pl-5">
        {items.map((h, i) => (
          <li key={h.id} className="relative">
            <span
              className={cn(
                "absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-card",
                i === 0 ? "bg-accent" : "bg-muted-foreground/40",
              )}
            />
            <p className="text-sm font-medium">{h.accion}</p>
            {h.estadoDesde && h.estadoHasta && h.estadoDesde !== h.estadoHasta && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <StatusBadge status={h.estadoDesde} />
                <span aria-hidden>→</span>
                <StatusBadge status={h.estadoHasta} />
              </div>
            )}
            {h.nota && (
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted px-2.5 py-1.5 text-xs">
                {h.nota}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {h.autor} · {rolLabel[h.rol]} · {fmtDate(h.createdAt, true)}
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const PASOS: Estado[] = [
  "REGISTRADA",
  "EN_EVALUACION",
  "ASIGNADA",
  "EN_ATENCION",
  "RESUELTA",
  "CERRADA",
];

// Avance del trámite para el estudiante. Una observación se muestra sobre el
// paso desde el que se observó (evaluación o atención).
export function StatusProgress({ s }: { s: SolicitudDetalle }) {
  const actual =
    s.estado === "OBSERVADA"
      ? PASOS.indexOf(s.estadoPrevio ?? "EN_EVALUACION")
      : PASOS.indexOf(s.estado);
  const desistida = s.tipoCierre === "DESISTIDA";
  return (
    <Panel>
      <p className="font-semibold">Avance del trámite</p>
      {desistida ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Desististe de esta solicitud el {fmtDate(s.cerradaAt ?? s.updatedAt)}.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {PASOS.map((paso, i) => {
            const hecho = i < actual || s.estado === "CERRADA";
            const activo = i === actual && s.estado !== "CERRADA";
            const observada = activo && s.estado === "OBSERVADA";
            return (
              <li
                key={paso}
                className="flex items-center gap-3 text-sm"
                aria-current={activo ? "step" : undefined}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                    hecho
                      ? "bg-success text-white"
                      : activo
                        ? observada
                          ? "bg-warning text-foreground"
                          : "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    !hecho && !activo && "text-muted-foreground",
                    activo && "font-semibold",
                  )}
                >
                  {estadoLabel[paso]}
                  {observada && " · observada, requiere tu corrección"}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
