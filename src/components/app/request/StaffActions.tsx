import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { dataService, useData } from "@/lib/data/store";
import type { Request, Status, User } from "@/lib/data/types";
import { ACTION_LABEL, TRANSITIONS, transitionBlocker } from "@/lib/data/workflow";
import { ConfirmAction, FieldError, Panel, StatusBadge, runAction, selectClass } from "../common";

const ASSIGNABLE: Status[] = ["En evaluación", "Asignada", "En atención"];

// Acciones del personal administrativo sobre un expediente.
export function StaffActions({ request, user }: { request: Request; user: User }) {
  const users = useData((s) => s.users);
  const staff = users.filter((u) => u.role === "personal" || u.role === "admin");
  const [assignee, setAssignee] = useState(request.assigneeId ?? "");
  const [response, setResponse] = useState(request.response ?? "");
  const [responseError, setResponseError] = useState("");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");

  // "Asignada" se obtiene desde el bloque de asignación.
  const next = TRANSITIONS[request.status].filter((s) => s !== "Asignada");
  const canAssign = ASSIGNABLE.includes(request.status);
  const canRespond = request.status === "En atención";

  const change = (to: Status) => {
    const blocker = transitionBlocker(request, to, note);
    if (blocker) { setNoteError(blocker); return false; }
    const ok = runAction(() => dataService.changeStatus(request.id, to, user.id, note.trim() || undefined), `Estado actualizado a "${to}"`);
    if (ok) { setNote(""); setNoteError(""); }
    return ok;
  };

  const saveResponse = () => {
    const t = response.trim();
    if (t.length < 10) return setResponseError("La respuesta debe tener al menos 10 caracteres.");
    setResponseError("");
    runAction(() => dataService.respond(request.id, t, user.id), "Respuesta registrada");
  };

  return (
    <Panel className="space-y-5">
      <div>
        <p className="font-semibold">Acciones</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">Estado actual: <StatusBadge status={request.status} /></p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cambiar estado</p>
        {next.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {request.status === "Observada" ? "En espera de la corrección del estudiante." :
              "No hay acciones de estado disponibles."}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {next.map((to) => {
            const needsResponse = to === "Resuelta" && !request.response;
            return (
              <ConfirmAction key={to} title={`${ACTION_LABEL[to]}`}
                description={to === "Observada" ? "El estudiante recibirá la observación y podrá enviar una corrección." : `La solicitud pasará de "${request.status}" a "${to}" y se notificará al estudiante.`}
                confirmLabel="Confirmar" onConfirm={() => change(to)} disabled={needsResponse}
                trigger={<Button variant={to === "Observada" ? "outline" : "default"} className="w-full" disabled={needsResponse}>{ACTION_LABEL[to]}</Button>}>
                <div className="space-y-1.5">
                  <Label htmlFor={`note-${to}`}>{to === "Observada" ? "Observación para el estudiante *" : "Nota (opcional)"}</Label>
                  <Textarea id={`note-${to}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder={to === "Observada" ? "Ej. Falta la firma del jefe de servicio en la carta." : "Comentario interno visible en el historial"} />
                  <FieldError>{noteError}</FieldError>
                </div>
              </ConfirmAction>
            );
          })}
        </div>
        {next.includes("Resuelta") && !request.response && <p className="text-xs text-muted-foreground">Registra una respuesta para poder resolver.</p>}
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="assignee" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsable</Label>
        <select id="assignee" className={selectClass} value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canAssign}>
          <option value="">Sin asignar</option>
          {staff.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.area}</option>)}
        </select>
        <Button variant="secondary" className="w-full" disabled={!canAssign || !assignee || assignee === request.assigneeId}
          onClick={() => runAction(() => dataService.assign(request.id, assignee, user.id), "Responsable asignado")}>
          {request.status === "En evaluación" ? "Asignar y pasar a Asignada" : "Guardar responsable"}
        </Button>
        {!canAssign && <p className="text-xs text-muted-foreground">Disponible cuando la solicitud está en evaluación o en curso.</p>}
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="response" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Respuesta al estudiante</Label>
        <Textarea id="response" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} disabled={!canRespond}
          placeholder="Ej. Se aprueba la solicitud. La constancia fue enviada a su correo institucional." />
        <FieldError>{responseError}</FieldError>
        <Button variant="secondary" className="w-full" disabled={!canRespond} onClick={saveResponse}>Guardar respuesta</Button>
        {!canRespond && <p className="text-xs text-muted-foreground">Disponible cuando la solicitud está "En atención".</p>}
      </div>
    </Panel>
  );
}
