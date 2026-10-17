import { useData } from "@/lib/data/store";
import type { Request, Status } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { Panel, StatusBadge, fmtDate } from "../common";

// Línea de tiempo con cada movimiento del expediente.
export function RequestHistory({ request }: { request: Request }) {
  const users = useData((s) => s.users);
  const items = [...request.history].reverse();
  return (
    <Panel>
      <p className="font-semibold">Historial de movimientos</p>
      <ol className="mt-4 space-y-4 border-l-2 border-muted pl-5">
        {items.map((h, i) => (
          <li key={h.id} className="relative">
            <span className={cn("absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-card", i === 0 ? "bg-accent" : "bg-muted-foreground/40")} />
            <p className="text-sm font-medium">{h.action}</p>
            {h.from && h.to && h.from !== h.to && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs"><StatusBadge status={h.from} /><span>→</span><StatusBadge status={h.to} /></div>
            )}
            {h.note && <p className="mt-1 rounded-md bg-muted px-2.5 py-1.5 text-xs">{h.note}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{users.find((u) => u.id === h.userId)?.name ?? "Sistema"} · {fmtDate(h.date, true)}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const STEPS: Status[] = ["Registrada", "En evaluación", "Asignada", "En atención", "Resuelta", "Cerrada"];

// Barra de progreso del trámite para el estudiante.
export function StatusProgress({ status }: { status: Status }) {
  const current = status === "Observada" ? 1 : STEPS.indexOf(status);
  return (
    <Panel>
      <p className="font-semibold">Avance del trámite</p>
      <ol className="mt-4 space-y-2.5">
        {STEPS.map((s, i) => {
          const done = i < current || status === "Cerrada";
          const active = i === current && status !== "Cerrada";
          return (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                done ? "bg-success text-white" : active ? (status === "Observada" ? "bg-warning text-foreground" : "bg-accent text-accent-foreground") : "bg-muted text-muted-foreground")}>{i + 1}</span>
              <span className={cn(!done && !active && "text-muted-foreground", active && "font-semibold")}>
                {s}{active && status === "Observada" && " · Observada, requiere tu corrección"}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
