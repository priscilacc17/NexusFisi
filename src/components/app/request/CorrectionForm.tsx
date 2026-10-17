import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dataService } from "@/lib/data/store";
import type { Request, User } from "@/lib/data/types";
import { ConfirmAction, FieldError, runAction } from "../common";
import { FilePicker, type PickedFile } from "../FilePicker";

// Formulario para que el estudiante responda a una observación.
export function CorrectionForm({ request, user }: { request: Request; user: User }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState("");
  const pending = request.observations.filter((o) => !o.resolved);

  const validate = () => {
    if (note.trim().length < 10) { setError("Explica la corrección realizada (mínimo 10 caracteres)."); return false; }
    setError("");
    return true;
  };

  return (
    <div className="rounded-xl border border-warning/60 bg-warning/10 p-5">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 text-warning" />Tu solicitud fue observada</p>
      <ul className="mt-2 space-y-1 text-sm">{pending.map((o) => <li key={o.id}>• {o.text}</li>)}</ul>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="correction">Detalle de la corrección *</Label>
          <Textarea id="correction" rows={3} className="bg-card" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Adjunto la carta firmada por el representante de la empresa." />
          <FieldError>{error}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label>Documentos corregidos (opcional)</Label>
          <FilePicker files={files} onChange={setFiles} />
        </div>
        <div className="flex justify-end">
          <ConfirmAction title="¿Enviar corrección?" description="La solicitud volverá a evaluación y el personal será notificado."
            confirmLabel="Enviar corrección"
            onConfirm={() => validate() && runAction(() => dataService.submitCorrection(request.id, user.id, note.trim(), files), "Corrección enviada")}
            trigger={<Button onClick={(e) => { if (!validate()) e.preventDefault(); }}>Enviar corrección</Button>} />
        </div>
      </div>
    </div>
  );
}
