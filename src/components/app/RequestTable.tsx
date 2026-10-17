import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useData } from "@/lib/data/store";
import type { Request } from "@/lib/data/types";
import { StatusBadge, fmtDate } from "./common";

export function RequestTable({ requests, showStudent }: { requests: Request[]; showStudent?: boolean }) {
  const { types, users } = useData((s) => s);
  const tn = (id: string) => types.find((t) => t.id === id)?.name ?? "—";
  const un = (id?: string) => users.find((u) => u.id === id)?.name ?? "Sin asignar";
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <table className="hidden w-full text-sm md:table">
        <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Trámite</th>{showStudent && <th className="px-4 py-3">Estudiante</th>}<th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Estado</th><th /></tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/50">
              <td className="px-4 py-3 font-mono text-xs font-semibold">{r.code}</td>
              <td className="px-4 py-3"><p className="font-medium">{tn(r.typeId)}</p><p className="text-xs text-muted-foreground">{r.subject}</p></td>
              {showStudent && <td className="px-4 py-3">{un(r.studentId)}</td>}
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
              <td className="px-4 py-3 text-muted-foreground">{un(r.assigneeId)}</td>
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3 text-right"><Link to="/app/solicitudes/$id" params={{ id: r.id }} className="font-medium text-primary hover:underline">Ver</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y md:hidden">
        {requests.map((r) => (
          <li key={r.id}>
            <Link to="/app/solicitudes/$id" params={{ id: r.id }} className="flex items-center gap-3 p-4 hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold">{r.code}</span><StatusBadge status={r.status} /></div>
                <p className="mt-1 truncate font-medium">{tn(r.typeId)}</p>
                <p className="truncate text-xs text-muted-foreground">{showStudent ? `${un(r.studentId)} · ` : ""}{fmtDate(r.createdAt)}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
