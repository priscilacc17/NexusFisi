import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/app/common";
import { RequestTable } from "@/components/app/RequestTable";
import { useData } from "@/lib/data/store";
import { useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/app/solicitudes/")({
  head: () => ({ meta: [{ title: "Mis solicitudes · NexusFisi" }, { name: "description", content: "Consulta el estado de tus solicitudes." }] }),
  component: MyRequests,
});

function MyRequests() {
  const user = useCurrentUser()!;
  const requests = useData((s) => s.requests);
  const mine = useMemo(() => requests.filter((r) => r.studentId === user.id), [requests, user.id]);
  return (
    <>
      <PageHeader title="Mis solicitudes" subtitle={`${mine.length} solicitud(es)`} action={<Button asChild><Link to="/app/nueva"><FilePlus2 className="h-4 w-4" />Nueva solicitud</Link></Button>} />
      {mine.length ? <RequestTable requests={mine} /> : <EmptyState title="No tienes solicitudes" text="Registra tu primera solicitud desde el catálogo de trámites." />}
    </>
  );
}
