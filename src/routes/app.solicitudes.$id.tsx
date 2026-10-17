import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, FileText, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatusBadge, fmtDate, fmtSize } from "@/components/app/common";
import { CorrectionForm } from "@/components/app/request/CorrectionForm";
import { RequestHistory, StatusProgress } from "@/components/app/request/RequestHistory";
import { RequestMessages } from "@/components/app/request/RequestMessages";
import { StaffActions } from "@/components/app/request/StaffActions";
import { useData } from "@/lib/data/store";
import { isFinished } from "@/lib/data/workflow";
import { useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/app/solicitudes/$id")({
  head: ({ params }) => ({ meta: [{ title: `${params.id} · NexusFisi` }, { name: "description", content: "Detalle y seguimiento de la solicitud." }] }),
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const user = useCurrentUser()!;
  const request = useData((s) => s.requests.find((r) => r.id === id));
  const users = useData((s) => s.users);
  const type = useData((s) => s.types.find((t) => t.id === request?.typeId));
  const isStudent = user.role === "estudiante";
  const back = isStudent ? { to: "/app/solicitudes" as const, label: "Mis solicitudes" } : { to: "/app/bandeja" as const, label: "Bandeja" };

  // El estudiante solo puede ver sus propias solicitudes.
  if (!request || (isStudent && request.studentId !== user.id)) {
    return <EmptyState title="Solicitud no encontrada" text="No existe o no tienes permiso para verla." action={<Button asChild size="sm"><Link to={back.to}>Volver a {back.label}</Link></Button>} />;
  }

  const name = (uid?: string) => users.find((u) => u.id === uid)?.name ?? "Sin asignar";
  const student = users.find((u) => u.id === request.studentId);

  return (
    <>
      <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{back.label}</Link>
      <PageHeader title={request.subject} subtitle={`${request.code} · ${type?.name ?? "Trámite"}`} action={<div><StatusBadge status={request.status} /></div>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isStudent && request.status === "Observada" && <CorrectionForm request={request} user={user} />}

          {request.response && (
            <div className={isFinished(request.status) ? "rounded-xl border border-success/50 bg-success/10 p-5" : "rounded-xl border bg-card p-5"}>
              <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-success" />{isFinished(request.status) ? "Resultado del trámite" : "Respuesta registrada"}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{request.response}</p>
            </div>
          )}

          <Panel>
            <p className="font-semibold">Datos de la solicitud</p>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Info label="Código" value={<span className="font-mono font-semibold">{request.code}</span>} />
              <Info label="Tipo de trámite" value={type?.name ?? "—"} />
              <Info label="Estudiante" value={`${student?.name ?? "—"}${student?.code ? ` · ${student.code}` : ""}`} />
              <Info label="Ciclo" value={student?.cycle ?? "—"} />
              <Info label="Fecha de registro" value={fmtDate(request.createdAt, true)} />
              <Info label="Última actualización" value={fmtDate(request.updatedAt, true)} />
              <Info label="Responsable" value={name(request.assigneeId)} />
              <Info label="Plazo estimado" value={type ? `${type.days} días hábiles` : "—"} />
            </dl>
            <div className="mt-5 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{request.description}</p>
            </div>
          </Panel>

          <Panel>
            <p className="font-semibold">Documentos adjuntos ({request.attachments.length})</p>
            {request.attachments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Sin documentos.</p> : (
              <ul className="mt-3 divide-y rounded-lg border">
                {request.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{fmtSize(a.size)} · {fmtDate(a.uploadedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Demostración: solo se registra el nombre del archivo; no hay descarga disponible.</p>
          </Panel>

          <Panel>
            <p className="flex items-center gap-2 font-semibold"><MessageSquareWarning className="h-4 w-4 text-warning" />Observaciones</p>
            {request.observations.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">La solicitud no tiene observaciones.</p> : (
              <ul className="mt-3 space-y-2">
                {request.observations.map((o) => (
                  <li key={o.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{name(o.userId)} · {fmtDate(o.date, true)}</span>
                      <span className={o.resolved ? "text-xs font-semibold text-success" : "text-xs font-semibold text-warning"}>{o.resolved ? "Atendida" : "Pendiente"}</span>
                    </div>
                    <p className="mt-1">{o.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <RequestMessages request={request} user={user} />
        </div>

        <div className="space-y-6">
          {isStudent ? <StatusProgress status={request.status} /> : <StaffActions key={request.id} request={request} user={user} />}
          <RequestHistory request={request} />
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
