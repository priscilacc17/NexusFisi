import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FilePlus2, FileText, Gauge, Hourglass, Inbox, Sparkles, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarList } from "@/components/app/BarList";
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard, selectClass } from "@/components/app/common";
import { RequestTable } from "@/components/app/RequestTable";
import { useDashboard, useFacultadesAdmin, useSolicitudes } from "@/lib/api/queries";
import type { Dashboard as DashboardData, Usuario } from "@/lib/api/types";
import { estadoLabel, ESTADOS, fmtHoras, prioridadLabel, PRIORIDADES } from "@/lib/labels";
import { useUsuario } from "@/lib/session";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Panel principal · NexusFisi" }, { name: "description", content: "Indicadores y resumen de trámites." }] }),
  component: Dashboard,
});

const contar = (d: DashboardData, estado: string) => d.porEstado.find((e) => e.clave === estado)?.total ?? 0;

function Dashboard() {
  const user = useUsuario();
  if (user.rol === "ESTUDIANTE") return <PanelEstudiante user={user} />;
  if (user.rol === "TECNICO") return <PanelTecnico user={user} />;
  return <PanelGestion user={user} />;
}

function PanelEstudiante({ user }: { user: Usuario }) {
  const dash = useDashboard();
  const recientes = useSolicitudes({ size: 5 });
  const observadas = useSolicitudes({ estado: "OBSERVADA", size: 10 });
  if (dash.isPending) return <LoadingState />;
  if (dash.isError) return <ErrorState error={dash.error} onRetry={() => void dash.refetch()} />;
  const d = dash.data;
  return (
    <>
      <PageHeader
        title="Panel principal"
        subtitle={[user.codigoEstudiante, user.escuela?.nombre, user.facultad?.codigo].filter(Boolean).join(" · ")}
        action={<Button asChild><Link to="/app/nueva"><FilePlus2 className="h-4 w-4" />Nueva solicitud</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Solicitudes totales" value={d.total} icon={FileText} />
        <StatCard label="En curso" value={d.pendientes} icon={Clock} tone="accent" />
        <StatCard label="Observadas" value={contar(d, "OBSERVADA")} icon={AlertTriangle} tone="warning" />
        <StatCard label="Resueltas" value={d.atendidas} icon={CheckCircle2} tone="success" />
      </div>
      {(observadas.data?.items.length ?? 0) > 0 && (
        <div className="mt-6 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm" role="status">
          <p className="font-semibold">Tienes {observadas.data!.items.length} solicitud(es) observada(s) que requieren tu corrección.</p>
          <div className="mt-2 flex flex-wrap gap-2">{observadas.data!.items.map((r) => <Link key={r.codigo} to="/app/solicitudes/$codigo" params={{ codigo: r.codigo }} className="font-mono text-xs font-semibold text-primary underline">{r.codigo}</Link>)}</div>
        </div>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Solicitudes recientes</h2>
          {recientes.isPending ? <LoadingState /> : recientes.data?.items.length ? <RequestTable requests={recientes.data.items} /> :
            <EmptyState title="Aún no tienes solicitudes" action={<Button asChild size="sm"><Link to="/app/nueva">Registrar solicitud</Link></Button>} />}
        </div>
        <Panel className="h-fit border-dashed">
          <Sparkles className="h-6 w-6 text-accent" />
          <p className="mt-2 font-semibold">Asistente de orientación</p>
          <p className="mt-1 text-sm text-muted-foreground">Próximamente un asistente te ayudará a elegir el trámite adecuado. Mientras tanto, revisa el catálogo de tu facultad.</p>
          <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/app/tramites">Ver catálogo de trámites</Link></Button>
        </Panel>
      </div>
    </>
  );
}

function PanelTecnico({ user }: { user: Usuario }) {
  const dash = useDashboard();
  const cola = useSolicitudes({ orden: "prioridad", size: 6 });
  if (dash.isPending) return <LoadingState />;
  if (dash.isError) return <ErrorState error={dash.error} onRetry={() => void dash.refetch()} />;
  const d = dash.data;
  return (
    <>
      <PageHeader title="Panel principal" subtitle={[user.area?.nombre, user.facultad?.nombre].filter(Boolean).join(" · ")} action={<Button asChild><Link to="/app/bandeja"><Inbox className="h-4 w-4" />Mis asignaciones</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Por atender" value={contar(d, "ASIGNADA")} icon={Inbox} />
        <StatCard label="En atención" value={contar(d, "EN_ATENCION")} icon={Clock} tone="accent" />
        <StatCard label="Vencidas" value={d.vencidas} icon={TimerOff} tone={d.vencidas ? "danger" : "success"} />
        <StatCard label="Resueltas por mí" value={d.atendidas} icon={CheckCircle2} tone="success" hint={`Promedio: ${fmtHoras(d.tiempoPromedioHoras)}`} />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Siguiente en tu cola</h2>
      {cola.isPending ? <LoadingState /> : cola.data?.items.length ? <RequestTable requests={cola.data.items} showStudent /> : <EmptyState title="No tienes solicitudes asignadas" text="Cuando un supervisor te asigne una solicitud aparecerá aquí." />}
    </>
  );
}

function PanelGestion({ user }: { user: Usuario }) {
  const central = user.rol === "ADMIN" && !user.facultad;
  const [facultadId, setFacultadId] = useState<number | undefined>();
  const facultades = useFacultadesAdmin(central);
  const dash = useDashboard(facultadId);
  const ultimas = useSolicitudes({ size: 6, facultadId, ...(user.rol === "SUPERVISOR" ? { orden: "prioridad" as const } : {}) });

  const selector = central ? (
    <select aria-label="Facultad" className={`${selectClass} sm:w-72`} value={facultadId ?? ""} onChange={(e) => setFacultadId(e.target.value ? Number(e.target.value) : undefined)}>
      <option value="">Todas las facultades</option>
      {facultades.data?.map((f) => <option key={f.id} value={f.id}>{f.codigo} · {f.nombre}</option>)}
    </select>
  ) : (
    <Button asChild><Link to="/app/bandeja"><Inbox className="h-4 w-4" />Ir a la bandeja</Link></Button>
  );

  return (
    <>
      <PageHeader title="Panel principal" subtitle={central ? "Universidad Nacional Mayor de San Marcos" : user.facultad?.nombre} action={selector} />
      {dash.isPending ? <LoadingState /> : dash.isError ? <ErrorState error={dash.error} onRetry={() => void dash.refetch()} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Solicitudes registradas" value={dash.data.total} icon={FileText} />
            <StatCard label="Pendientes" value={dash.data.pendientes} icon={Hourglass} tone="accent" hint={`${contar(dash.data, "REGISTRADA")} sin evaluar`} />
            <StatCard label="Atendidas" value={dash.data.atendidas} icon={CheckCircle2} tone="success" />
            <StatCard label="Vencidas" value={dash.data.vencidas} icon={TimerOff} tone={dash.data.vencidas ? "danger" : "success"} hint="Superaron el plazo del trámite" />
            <StatCard label="Resueltas" value={dash.data.porcentajeResueltas === null ? "—" : `${dash.data.porcentajeResueltas}%`} icon={Gauge} tone="primary" hint="Sin contar las desistidas" />
            <StatCard label="Tiempo promedio de atención" value={fmtHoras(dash.data.tiempoPromedioHoras)} icon={Clock} tone="warning" hint="Del registro a la resolución" />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <BarList title="Solicitudes por estado" data={ESTADOS.map((e) => ({ label: estadoLabel[e], value: contar(dash.data, e) }))} />
            <BarList title="Por categoría (tipo de trámite)" data={dash.data.porTipo.map((t) => ({ label: t.clave, value: t.total }))} />
            <BarList
              title="Pendientes por prioridad"
              data={PRIORIDADES.map((p) => ({ label: prioridadLabel[p], value: dash.data.porPrioridad.find((x) => x.clave === p)?.total ?? 0 }))}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Panel className="overflow-x-auto p-0 lg:col-span-2">
              <p className="px-5 pt-5 font-semibold">Solicitudes por responsable</p>
              {dash.data.porResponsable.length === 0 ? <p className="px-5 pb-5 pt-3 text-sm text-muted-foreground">Aún no hay solicitudes asignadas.</p> : (
                <table className="mt-3 w-full min-w-[420px] text-sm">
                  <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-2.5">Responsable</th><th className="px-5 py-2.5 text-right">Asignadas</th><th className="px-5 py-2.5 text-right">Pendientes</th><th className="px-5 py-2.5 text-right">Resueltas</th></tr>
                  </thead>
                  <tbody>
                    {dash.data.porResponsable.map((r) => (
                      <tr key={r.id} className="border-t"><td className="px-5 py-2.5">{r.nombre}</td><td className="px-5 py-2.5 text-right tabular-nums">{r.total}</td><td className="px-5 py-2.5 text-right tabular-nums">{r.pendientes}</td><td className="px-5 py-2.5 text-right tabular-nums">{r.resueltas}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
            {central && !facultadId ? (
              <BarList title="Solicitudes por facultad" data={dash.data.porFacultad.map((f) => ({ label: f.clave, value: f.total }))} />
            ) : (
              <Panel className="h-fit">
                <p className="font-semibold">Desistidas</p>
                <p className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{dash.data.desistidas}</p>
                <p className="mt-1 text-sm text-muted-foreground">Solicitudes que el estudiante retiró antes de su atención.</p>
              </Panel>
            )}
          </div>
        </>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">{user.rol === "SUPERVISOR" ? "Pendientes por prioridad" : "Últimas solicitudes"}</h2>
      {ultimas.isPending ? <LoadingState /> : ultimas.data?.items.length ? <RequestTable requests={ultimas.data.items} showStudent showFaculty={central} /> : <EmptyState title="No hay solicitudes" />}
    </>
  );
}
