import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mensajeDeError } from "@/lib/api/client";
import { useAdjuntar, useTransicion } from "@/lib/api/queries";
import type { SolicitudDetalle } from "@/lib/api/types";
import { FieldError } from "../common";
import { FilePicker } from "../FilePicker";

// El estudiante responde a una observación: primero sube los documentos (si hay)
// y luego envía la corrección, que devuelve la solicitud a quien la observó.
export function CorrectionForm({ s }: { s: SolicitudDetalle }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const adjuntar = useAdjuntar(s.codigo);
  const transicion = useTransicion(s);
  const ocupado = adjuntar.isPending || transicion.isPending;
  const pendientes = s.observaciones.filter((o) => !o.resuelta);

  const enviar = async () => {
    if (note.trim().length < 10) return setError("Explica la corrección realizada (mínimo 10 caracteres).");
    setError("");
    try {
      // Adjuntar no cambia la versión de la solicitud (solo las transiciones lo hacen).
      if (files.length) await adjuntar.mutateAsync(files);
      await transicion.mutateAsync({ accion: "CORREGIR", nota: note.trim() });
      setFiles([]);
      setNote("");
      toast.success("Corrección enviada. La solicitud volvió al personal a cargo.");
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  };
  return (
    <div className="rounded-xl border border-warning/60 bg-warning/10 p-5">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 text-warning" />Tu solicitud fue observada</p>
      <ul className="mt-2 space-y-1 text-sm">{pendientes.map((o) => <li key={o.id}>• {o.texto}</li>)}</ul>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="correction">Detalle de la corrección *</Label>
          <Textarea id="correction" rows={3} className="bg-card" maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Adjunto la carta firmada por el representante de la empresa." disabled={ocupado} />
          <FieldError>{error}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label>Documentos corregidos (opcional)</Label>
          <FilePicker files={files} onChange={setFiles} disabled={ocupado} />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void enviar()} disabled={ocupado}>{ocupado && <Loader2 className="h-4 w-4 animate-spin" />}Enviar corrección</Button>
        </div>
      </div>
    </div>
  );
}
