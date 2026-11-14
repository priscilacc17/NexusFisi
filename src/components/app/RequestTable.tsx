import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { SolicitudResumen } from "@/lib/api/types";
import { PriorityBadge, StatusBadge, VencidaBadge, fmtDate } from "./common";

export function RequestTable({ requests, showStudent, showFaculty }: { requests: SolicitudResumen[]; showStudent?: boolean; showFaculty?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <table className="hidden w-full text-sm md:table">
        <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Código</th>
            <th className="px-4 py-3">Trámite</th>
            {showStudent && <th className="px-4 py-3">Estudiante</th>}
            <th className="px-4 py-3">Registro</th>
            <th className="px-4 py-3">Plazo</th>
            <th className="px-4 py-3">Responsable</th>
            <th className="px-4 py-3">Estado</th>
            <th><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.codigo} className="border-t hover:bg-muted/50">
              <td className="px-4 py-3">
                <p className="font-mono text-xs font-semibold">{r.codigo}</p>
                {showFaculty && <p className="text-[11px] text-muted-foreground">{r.facultad.codigo}</p>}
              </td>
              <td className="px-4 py-3"><p className="font-medium">{r.tipo.nombre}</p><p className="text-xs text-muted-foreground">{r.asunto}</p></td>
              {showStudent && <td className="px-4 py-3"><p>{r.estudiante.nombre}</p><p className="text-xs text-muted-foreground">{r.estudiante.codigoEstudiante}</p></td>}
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.vencida ? <VencidaBadge /> : fmtDate(r.fechaLimite)}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.responsable?.nombre ?? "Sin asignar"}</td>
              <td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><StatusBadge status={r.estado} /><PriorityBadge prioridad={r.prioridad} /></div></td>
              <td className="px-4 py-3 text-right"><Link to="/app/solicitudes/$codigo" params={{ codigo: r.codigo }} className="font-medium text-primary hover:underline">Ver</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y md:hidden">
        {requests.map((r) => (
          <li key={r.codigo}>
            <Link to="/app/solicitudes/$codigo" params={{ codigo: r.codigo }} className="flex items-center gap-3 p-4 hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold">{r.codigo}</span><StatusBadge status={r.estado} /></div>
                <p className="mt-1 truncate font-medium">{r.tipo.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{showStudent ? `${r.estudiante.nombre} · ` : ""}{fmtDate(r.createdAt)}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5"><PriorityBadge prioridad={r.prioridad} />{r.vencida && <VencidaBadge />}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
