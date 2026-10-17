import { useState, type FormEvent } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { dataService, useData } from "@/lib/data/store";
import type { Request, User } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { FieldError, Panel, fmtDate, runAction } from "../common";
import { roleLabel } from "../AppShell";

// Conversación entre el estudiante y el personal, asociada al expediente.
export function RequestMessages({ request, user }: { request: Request; user: User }) {
  const users = useData((s) => s.users);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const closed = request.status === "Cerrada";

  const send = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return setError("Escribe un mensaje antes de enviar.");
    if (t.length > 1000) return setError("El mensaje no puede superar 1000 caracteres.");
    setError("");
    if (runAction(() => dataService.addMessage(request.id, user.id, t), "Mensaje enviado")) setText("");
  };

  return (
    <Panel>
      <p className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4 text-accent" />Mensajes del expediente</p>
      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
        {request.messages.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay mensajes en esta solicitud.</p>}
        {request.messages.map((m) => {
          const author = users.find((u) => u.id === m.userId);
          const own = m.userId === user.id;
          return (
            <div key={m.id} className={cn("flex", own && "justify-end")}>
              <div className={cn("max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm", own ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <p className={cn("text-xs font-semibold", own ? "opacity-80" : "text-muted-foreground")}>
                  {own ? "Tú" : author?.name ?? "Usuario"}{!own && author && ` · ${roleLabel[author.role]}`}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.text}</p>
                <p className={cn("mt-1 text-[11px]", own ? "opacity-70" : "text-muted-foreground")}>{fmtDate(m.date, true)}</p>
              </div>
            </div>
          );
        })}
      </div>
      {closed ? (
        <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">El expediente está cerrado; ya no se pueden enviar mensajes.</p>
      ) : (
        <form onSubmit={send} noValidate className="mt-4 space-y-2">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje…" aria-label="Nuevo mensaje" />
          <FieldError>{error}</FieldError>
          <div className="flex justify-end"><Button type="submit" size="sm"><Send className="h-4 w-4" />Enviar</Button></div>
        </form>
      )}
    </Panel>
  );
}
