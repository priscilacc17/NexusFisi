import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { mensajeDeError } from "@/lib/api/client";
import { useEnviarMensaje } from "@/lib/api/queries";
import type { SolicitudDetalle, Usuario } from "@/lib/api/types";
import { rolLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { FieldError, Panel, fmtDate } from "../common";

// Conversación del expediente entre el estudiante y el personal a cargo.
export function RequestMessages({ s, user }: { s: SolicitudDetalle; user: Usuario }) {
  const enviar = useEnviarMensaje(s.codigo);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const send = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return setError("Escribe un mensaje antes de enviar.");
    if (t.length > 1000) return setError("El mensaje no puede superar 1000 caracteres.");
    setError("");
    enviar.mutate(t, { onSuccess: () => setText(""), onError: (err) => toast.error(mensajeDeError(err)) });
  };

  return (
    <Panel>
      <p className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4 text-accent" />Mensajes del expediente</p>
      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {s.mensajes.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay mensajes en esta solicitud.</p>}
        {s.mensajes.map((m) => {
          const own = m.autorId === user.id;
          return (
            <div key={m.id} className={cn("flex", own && "justify-end")}>
              <div className={cn("max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm", own ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <p className={cn("text-xs font-semibold", own ? "opacity-80" : "text-muted-foreground")}>{own ? "Tú" : `${m.autor} · ${rolLabel[m.rol]}`}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.texto}</p>
                <p className={cn("mt-1 text-[11px]", own ? "opacity-70" : "text-muted-foreground")}>{fmtDate(m.createdAt, true)}</p>
              </div>
            </div>
          );
        })}
      </div>
      {s.puedeEnviarMensaje ? (
        <form onSubmit={send} noValidate className="mt-4 space-y-2">
          <Textarea rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje…" aria-label="Nuevo mensaje" disabled={enviar.isPending} />
          <FieldError>{error}</FieldError>
          <div className="flex justify-end"><Button type="submit" size="sm" disabled={enviar.isPending}>{enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar</Button></div>
        </form>
      ) : (
        <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {s.estado === "CERRADA" ? "El expediente está cerrado; ya no se pueden enviar mensajes." : "Solo el estudiante y el personal a cargo escriben en este expediente."}
        </p>
      )}
    </Panel>
  );
}
