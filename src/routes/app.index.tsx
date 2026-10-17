import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Clock, FilePlus2, FileText, Inbox, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/app/common";
import { RequestTable } from "@/components/app/RequestTable";
import { useData } from "@/lib/data/store";
import { useCurrentUser } from "@/lib/session";
import { STATUSES } from "@/lib/data/types";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Panel principal · NexusFisi" }, { name: "description", content: "Resumen de tus trámites académicos." }] }),
  component: Dashboard,
});

function Dashboard() {
  const user = useCurrentUser()!;
  const { requests, users, types } = useData((s) => s);
  const mine = useMemo(() => (user.role === "estudiante" ? requests.filter((r) => r.studentId === user.id) : requests), [requests, user]);
  const count = (fn: (s: string) => boolean) => mine.filter((r) => fn(r.status)).length;
  const active = count((s) => s !== "Resuelta" && s !== "Cerrada");

  if (user.role === "estudiante") {
    const observed = mine.filter((r) => r.status === "Observada");
    return (
      <>
        <PageHeader title="Panel principal" subtitle={`${user.code} · ${user.cycle}`} action={<Button asChild><Link to="/app/nueva"><FilePlus2 className="h-4 w-4" />Nueva solicitud</Link></Button>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Solicitudes totales" value={mine.length} icon={FileText} />
          <StatCard label="En curso" value={active} icon={Clock} tone="accent" />
          <StatCard label="Observadas" value={observed.length} icon={AlertTriangle} tone="warning" />
          <StatCard label="Resueltas" value={count((s) => s === "Resuelta" || s === "Cerrada")} icon={CheckCircle2} tone="success" />
        </div>
        {observed.length > 0 && (
          <div className="mt-6 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
            <p className="font-semibold">Tienes {observed.length} solicitud(es) observada(s) que requieren corrección.</p>
            <div className="mt-2 flex flex-wrap gap-2">{observed.map((r) => <Link key={r.id} to="/app/solicitudes/$id" params={{ id: r.id }} className="font-mono text-xs font-semibold text-primary underline">{r.code}</Link>)}</div>
          </div>
        )}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-lg font-semibold">Solicitudes recientes</h2>
            {mine.length ? <RequestTable requests={mine.slice(0, 5)} /> : <EmptyState title="Aún no tienes solicitudes" action={<Button asChild size="sm"><Link to="/app/nueva">Registrar solicitud</Link></Button>} />}
          </div>
          <Panel className="h-fit border-dashed">
            <Sparkles className="h-6 w-6 text-accent" />
            <p className="mt-2 font-semibold">Asistente de orientación</p>
            <p className="mt-1 text-sm text-muted-foreground">Próximamente un asistente te ayudará a elegir el trámite adecuado. Mientras tanto, revisa el catálogo.</p>
            <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/app/tramites">Ver catálogo de trámites</Link></Button>
          </Panel>
        </div>
      </>
    );
  }

  const byStatus = STATUSES.map((s) => ({ s, n: requests.filter((r) => r.status === s).length }));
  const max = Math.max(1, ...byStatus.map((b) => b.n));
  return (
    <>
      <PageHeader title="Panel principal" subtitle={user.area} action={<Button asChild><Link to="/app/bandeja"><Inbox className="h-4 w-4" />Ir a la bandeja</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Por evaluar" value={requests.filter((r) => r.status === "Registrada" || r.status === "En evaluación").length} icon={Inbox} />
        <StatCard label="Asignadas a mí" value={requests.filter((r) => r.assigneeId === user.id && r.status !== "Cerrada").length} icon={Clock} tone="accent" />
        <StatCard label="Observadas" value={requests.filter((r) => r.status === "Observada").length} icon={AlertTriangle} tone="warning" />
        {user.role === "admin"
          ? <StatCard label="Usuarios / trámites" value={`${users.length} / ${types.length}`} icon={Users} tone="success" />
          : <StatCard label="Resueltas" value={requests.filter((r) => r.status === "Resuelta" || r.status === "Cerrada").length} icon={CheckCircle2} tone="success" />}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Últimas solicitudes</h2>
          <RequestTable requests={requests.slice(0, 6)} showStudent />
        </div>
        <Panel className="h-fit">
          <p className="font-semibold">Solicitudes por estado</p>
          <div className="mt-4 space-y-3">
            {byStatus.map((b) => (
              <div key={b.s}>
                <div className="flex justify-between text-xs"><span>{b.s}</span><span className="font-semibold">{b.n}</span></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-accent" style={{ width: `${(b.n / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
