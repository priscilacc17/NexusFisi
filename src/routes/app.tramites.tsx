import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/app/common";
import { useData } from "@/lib/data/store";
import { useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/app/tramites")({
  head: () => ({ meta: [{ title: "Catálogo de trámites · NexusFisi" }, { name: "description", content: "Trámites académicos disponibles y sus requisitos." }] }),
  component: Catalog,
});

function Catalog() {
  const user = useCurrentUser()!;
  const all = useData((s) => s.types);
  const types = all.filter((t) => t.active);
  return (
    <>
      <PageHeader title="Catálogo de trámites" subtitle="Revisa la descripción y los requisitos antes de registrar tu solicitud." />
      {types.length === 0 ? <EmptyState title="No hay trámites disponibles" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => (
            <Panel key={t.id} className="flex flex-col">
              <h3 className="font-semibold">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requisitos</p>
              <ul className="mt-2 space-y-1.5 text-sm">{t.requirements.map((r) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{r}</li>)}</ul>
              <div className="mt-auto flex items-center justify-between pt-5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{t.days} días hábiles</span>
                {user.role === "estudiante" && <Button asChild size="sm"><Link to="/app/nueva" search={{ tipo: t.id }}>Solicitar</Link></Button>}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
