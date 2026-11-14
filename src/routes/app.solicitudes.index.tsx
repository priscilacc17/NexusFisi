import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FilePlus2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/app/common";
import { EstadoChips } from "@/components/app/EstadoChips";
import { Pagination } from "@/components/app/Pagination";
import { RequestTable } from "@/components/app/RequestTable";
import { useDebounced } from "@/hooks/use-debounced";
import { useSolicitudes } from "@/lib/api/queries";
import type { Estado } from "@/lib/api/types";

export const Route = createFileRoute("/app/solicitudes/")({
  head: () => ({ meta: [{ title: "Mis solicitudes · NexusFisi" }, { name: "description", content: "Consulta el estado de tus solicitudes." }] }),
  component: MyRequests,
});

const SIZE = 10;

function MyRequests() {
  const [estado, setEstado] = useState<Estado | undefined>();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const busqueda = useDebounced(q.trim(), 300);
  const lista = useSolicitudes({ estado, q: busqueda || undefined, page, size: SIZE });
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <>
      <PageHeader title="Mis solicitudes" subtitle={lista.data ? `${lista.data.total} solicitud(es)` : undefined} action={<Button asChild><Link to="/app/nueva"><FilePlus2 className="h-4 w-4" />Nueva solicitud</Link></Button>} />
      <EstadoChips value={estado} onChange={(e) => reset(() => setEstado(e))} />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" aria-label="Buscar" placeholder="Buscar por código o asunto" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
      </div>
      {lista.isPending ? <LoadingState /> : lista.isError ? <ErrorState error={lista.error} onRetry={() => void lista.refetch()} /> : lista.data.items.length ? (
        <>
          <RequestTable requests={lista.data.items} />
          <Pagination page={page} size={SIZE} total={lista.data.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState title={estado || busqueda ? "No hay solicitudes con ese filtro" : "No tienes solicitudes"} text="Registra tu primera solicitud desde el catálogo de trámites." />
      )}
    </>
  );
}
