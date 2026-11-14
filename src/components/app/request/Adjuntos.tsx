import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { descargar, mensajeDeError } from "@/lib/api/client";
import { useAdjuntar } from "@/lib/api/queries";
import type { SolicitudDetalle } from "@/lib/api/types";
import { etapaLabel } from "@/lib/labels";
import { Panel, fmtDate, fmtSize } from "../common";
import { FilePicker } from "../FilePicker";

export function Adjuntos({ s }: { s: SolicitudDetalle }) {
  const [bajando, setBajando] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const adjuntar = useAdjuntar(s.codigo);
  // El estudiante adjunta dentro del formulario de corrección; aquí solo el personal.
  const puedeSubir = s.puedeAdjuntar === "ATENCION";

  const bajar = async (id: number, nombre: string) => {
    setBajando(id);
    try {
      await descargar(`/solicitudes/${s.codigo}/adjuntos/${id}`, nombre);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setBajando(null);
    }
  };

  return (
    <Panel>
      <p className="font-semibold">Documentos ({s.adjuntos.length})</p>
      {s.adjuntos.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Sin documentos.</p> : (
        <ul className="mt-3 divide-y rounded-lg border">
          {s.adjuntos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{a.nombre}</p>
                <p className="text-xs text-muted-foreground">{etapaLabel[a.etapa]} · {a.subidoPor} · {fmtSize(a.tamano)} · {fmtDate(a.createdAt)}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Descargar ${a.nombre}`} disabled={bajando === a.id} onClick={() => void bajar(a.id, a.nombre)}>
                {bajando === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {puedeSubir && (
        <div className="mt-4 space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Adjuntar el resultado (constancia, resolución…)</p>
          <FilePicker files={files} onChange={setFiles} disabled={adjuntar.isPending} />
          <div className="flex justify-end">
            <Button size="sm" disabled={!files.length || adjuntar.isPending} onClick={() => adjuntar.mutate(files, {
              onSuccess: () => { setFiles([]); toast.success("Documentos adjuntados."); },
              onError: (e) => toast.error(mensajeDeError(e)),
            })}>
              {adjuntar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Subir documentos
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
