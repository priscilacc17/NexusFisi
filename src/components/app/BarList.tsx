import { Panel } from "./common";

// Barras horizontales de una sola serie (magnitud): etiqueta y valor en texto,
// la barra solo refuerza la comparación. El valor exacto está siempre visible,
// así que el color nunca es la única forma de leer el dato.
export function BarList({
  title,
  data,
  empty = "Sin datos todavía.",
  note,
}: {
  title: string;
  data: { label: string; value: number }[];
  empty?: string;
  note?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Panel className="h-fit">
      <p className="font-semibold">{title}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.map((d) => (
            <li key={d.label} title={`${d.label}: ${d.value}`} className="group">
              <div className="flex justify-between gap-3 text-xs">
                <span className="truncate">{d.label}</span>
                <span className="font-semibold tabular-nums">{d.value}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary/80 transition-colors group-hover:bg-primary"
                  style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
