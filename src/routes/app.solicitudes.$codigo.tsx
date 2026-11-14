import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock, MapPin, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, PriorityBadge, StatusBadge, VencidaBadge, fmtDate } from "@/components/app/common";
import { AccionesPanel } from "@/components/app/request/AccionesPanel";
import { Adjuntos } from "@/components/app/request/Adjuntos";
import { CorrectionForm } from "@/components/app/request/CorrectionForm";
import { RequestHistory, StatusProgress } from "@/components/app/request/RequestHistory";
import { RequestMessages } from "@/components/app/request/RequestMessages";
import { ApiError } from "@/lib/api/client";
import { useSolicitud } from "@/lib/api/queries";
import { cierreLabel, rolLabel } from "@/lib/labels";
import { useUsuario } from "@/lib/session";

export const Route = createFileRoute("/app/solicitudes/$codigo")({
  head: ({ params }) => ({ meta: [{ title: `${params.codigo} · NexusFisi` }, { name: "description", content: "Detalle y seguimiento de la solicitud." }] }),
  component: RequestDetail,
});

function RequestDetail() {
  const { codigo } = Route.useParams();
  const user = useUsuario();
  const q = useSolicitud(codigo);
  const isStudent = user.rol === "ESTUDIANTE";
  const back = isStudent ? { to: "/app/solicitudes" as const, label: "Mis solicitudes" } : { to: "/app/bandeja" as const, label: user.rol === "TECNICO" ? "Mis asignaciones" : "Bandeja" };

  if (q.isPending) return <LoadingState text="Cargando expediente…" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) {
      return <EmptyState title="Solicitud no encontrada" text="No existe o no tienes permiso para verla." action={<Button asChild size="sm"><Link to={back.to}>Volver a {back.label}</Link></Button>} />;
    }
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  }
  const s = q.data;
  const terminada = s.estado === "RESUELTA" || s.estado === "CERRADA";

  return (
    <>
      <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{back.label}</Link>
      <PageHeader
        title={s.asunto}
        subtitle={`${s.codigo} · ${s.tipo.nombre} · ${s.facultad.codigo}`}
        action={<div className="flex flex-wrap items-center gap-2"><StatusBadge status={s.estado} /><PriorityBadge prioridad={s.prioridad} />{s.vencida && <VencidaBadge />}</div>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {s.acciones.includes("CORREGIR") && <CorrectionForm s={s} />}

          {s.respuesta && (
            <div className={terminada ? "rounded-xl border border-success/50 bg-success/10 p-5" : "rounded-xl border bg-card p-5"}>
              <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-success" />{s.estado === "RESUELTA" || s.estado === "CERRADA" ? "Resultado del trámite" : "Respuesta anterior (reabierta)"}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{s.respuesta}</p>
              {s.resueltaAt && <p className="mt-2 text-xs text-muted-foreground">Resuelta el {fmtDate(s.resueltaAt, true)}</p>}
            </div>
          )}
          {s.tipoCierre && <p className="rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">{cierreLabel[s.tipoCierre]}{s.cerradaAt ? ` · ${fmtDate(s.cerradaAt, true)}` : ""}</p>}

          <Panel>
            <p className="font-semibold">Datos de la solicitud</p>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Info label="Código" value={<span className="font-mono font-semibold">{s.codigo}</span>} />
              <Info label="Tipo de trámite" value={s.tipo.nombre} />
              <Info label="Estudiante" value={`${s.estudiante.nombre}${s.estudiante.codigoEstudiante ? ` · ${s.estudiante.codigoEstudiante}` : ""}`} />
              <Info label="Escuela / facultad" value={[s.estudiante.escuela, s.facultad.nombre].filter(Boolean).join(" · ")} />
              <Info label="Fecha de registro" value={fmtDate(s.createdAt, true)} />
              <Info label="Plazo de atención" value={<span className={s.vencida ? "font-semibold text-destructive" : undefined}>{fmtDate(s.fechaLimite)} ({s.tipo.plazoDias} días hábiles){s.vencida ? " · vencido" : ""}</span>} />
              <Info label="Responsable" value={s.responsable ? `${s.responsable.nombre} · ${rolLabel[s.responsable.rol]}` : "Sin asignar"} />
              <Info label="Última actualización" value={fmtDate(s.updatedAt, true)} />
            </dl>
            <p className="mt-4 flex gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Atiende <span className="font-medium text-foreground">{s.tipo.area.nombre}</span> · {s.tipo.area.ubicacion}</span></p>
            <div className="mt-5 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{s.descripcion}</p>
            </div>
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requisitos del trámite</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{s.tipo.requisitos.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          </Panel>

          <Adjuntos s={s} />

          <Panel>
            <p className="flex items-center gap-2 font-semibold"><MessageSquareWarning className="h-4 w-4 text-warning" />Observaciones</p>
            {s.observaciones.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">La solicitud no tiene observaciones.</p> : (
              <ul className="mt-3 space-y-2">
                {s.observaciones.map((o) => (
                  <li key={o.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{o.autor} · {fmtDate(o.createdAt, true)}</span>
                      <span className={o.resuelta ? "text-xs font-semibold text-success" : "text-xs font-semibold text-warning"}>{o.resuelta ? "Atendida" : "Pendiente"}</span>
                    </div>
                    <p className="mt-1">{o.texto}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <RequestMessages s={s} user={user} />
        </div>

        <div className="space-y-6">
          <AccionesPanel s={s} user={user} />
          {isStudent && <StatusProgress s={s} />}
          {!isStudent && s.vencida && (
            <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><Clock className="h-4 w-4" />Superó el plazo de {s.tipo.plazoDias} días hábiles.</p>
          )}
          <RequestHistory s={s} />
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
