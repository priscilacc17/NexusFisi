import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel } from "@/components/app/common";
import { useTipos } from "@/lib/api/queries";
import { useUsuario } from "@/lib/session";

export const Route = createFileRoute("/app/tramites")({
  head: () => ({ meta: [{ title: "Catálogo de trámites · NexusFisi" }, { name: "description", content: "Trámites académicos disponibles y sus requisitos." }] }),
  component: Catalog,
});

function Catalog() {
  const user = useUsuario();
  const tipos = useTipos();
  return (
    <>
      <PageHeader title="Catálogo de trámites" subtitle={`${user.facultad?.nombre ?? "UNMSM"} · Revisa la descripción y los requisitos antes de registrar tu solicitud.`} />
      {tipos.isPending ? <LoadingState /> : tipos.isError ? <ErrorState error={tipos.error} onRetry={() => void tipos.refetch()} /> : tipos.data.length === 0 ? (
        <EmptyState title="No hay trámites disponibles" text="Tu facultad todavía no publicó trámites en NexusFisi." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tipos.data.map((t) => (
            <Panel key={t.id} className="flex flex-col">
              <h3 className="font-semibold">{t.nombre}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.descripcion}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requisitos</p>
              <ul className="mt-2 space-y-1.5 text-sm">{t.requisitos.map((r) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{r}</li>)}</ul>
              <p className="mt-4 flex gap-1.5 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><span className="font-medium text-foreground">{t.area.nombre}</span> · {t.area.ubicacion}</span></p>
              <div className="mt-auto flex items-center justify-between pt-5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{t.plazoDias} días hábiles</span>
                {user.rol === "ESTUDIANTE" && <Button asChild size="sm"><Link to="/app/nueva" search={{ tipo: t.id }}>Solicitar</Link></Button>}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
