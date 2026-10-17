import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FilterX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, PageHeader, Panel, selectClass } from "@/components/app/common";
import { RequestTable } from "@/components/app/RequestTable";
import { useData } from "@/lib/data/store";
import { STATUSES } from "@/lib/data/types";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/bandeja")({
  head: () => ({ meta: [{ title: "Bandeja de solicitudes · NexusFisi" }, { name: "description", content: "Bandeja administrativa de solicitudes." }] }),
  component: Inbox,
});

const EMPTY = { q: "", typeId: "", status: "", from: "", to: "", mine: false };

function Inbox() {
  const user = useCurrentUser()!;
  const { requests, users, types } = useData((s) => s);
  const [f, setF] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return requests.filter((r) => {
      const student = users.find((u) => u.id === r.studentId);
      const day = r.createdAt.slice(0, 10);
      if (q && ![r.code, r.subject, student?.name, student?.code].some((v) => v?.toLowerCase().includes(q))) return false;
      if (f.typeId && r.typeId !== f.typeId) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
      if (f.mine && r.assigneeId !== user.id) return false;
      return true;
    });
  }, [requests, users, f, user.id]);

  if (user.role === "estudiante") {
    return <EmptyState title="Sección para personal administrativo" action={<Button asChild size="sm"><Link to="/app">Ir al panel</Link></Button>} />;
  }

  const active = JSON.stringify(f) !== JSON.stringify(EMPTY);
  const counts = (s: string) => requests.filter((r) => r.status === s).length;

  return (
    <>
      <PageHeader title="Bandeja de solicitudes" subtitle={`${filtered.length} de ${requests.length} solicitudes`} />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {["", ...STATUSES].map((s) => (
          <button key={s || "todas"} type="button" onClick={() => setF({ ...f, status: s })}
            className={cn("whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              f.status === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
            {s || "Todas"} <span className="opacity-70">({s ? counts(s) : requests.length})</span>
          </button>
        ))}
      </div>

      <Panel className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="q">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="q" className="pl-8" value={f.q} onChange={set("q")} placeholder="Código, asunto, estudiante o código de alumno" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ftype">Tipo de trámite</Label>
            <select id="ftype" className={selectClass} value={f.typeId} onChange={set("typeId")}>
              <option value="">Todos</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ffrom">Desde</Label>
            <Input id="ffrom" type="date" value={f.from} max={f.to || undefined} onChange={set("from")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fto">Hasta</Label>
            <Input id="fto" type="date" value={f.to} min={f.from || undefined} onChange={set("to")} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked })} />
            Solo asignadas a mí
          </label>
          <Button variant="ghost" size="sm" disabled={!active} onClick={() => setF(EMPTY)}><FilterX className="h-4 w-4" />Limpiar filtros</Button>
        </div>
      </Panel>

      {filtered.length ? <RequestTable requests={filtered} showStudent /> : (
        <EmptyState title="No hay solicitudes que coincidan" text="Prueba con otros filtros o límpialos para ver toda la bandeja."
          action={active ? <Button size="sm" variant="outline" onClick={() => setF(EMPTY)}>Limpiar filtros</Button> : undefined} />
      )}
    </>
  );
}
