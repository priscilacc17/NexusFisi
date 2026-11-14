import type { Estado } from "@/lib/api/types";
import { estadoLabel, ESTADOS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function EstadoChips({ value, onChange }: { value: Estado | undefined; onChange: (e: Estado | undefined) => void }) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por estado">
      {([undefined, ...ESTADOS] as (Estado | undefined)[]).map((s) => (
        <button key={s ?? "todas"} type="button" aria-pressed={value === s} onClick={() => onChange(s)}
          className={cn("whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
          {s ? estadoLabel[s] : "Todas"}
        </button>
      ))}
    </div>
  );
}
