import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { fmtSize } from "./common";

const MAX_MB = 5;
const MAX_ARCHIVOS = 5;
const EXT = /\.(pdf|jpe?g|png)$/i;

// Primera validación en el navegador para avisar rápido. La definitiva la hace
// la API, que además revisa el CONTENIDO del archivo (no solo la extensión).
export function FilePicker({ files, onChange, disabled }: { files: File[]; onChange: (f: File[]) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => {
    if (!list) return;
    const ok = Array.from(list).filter((f) => f.size > 0 && f.size <= MAX_MB * 1024 * 1024 && EXT.test(f.name));
    if (ok.length < list.length) toast.error(`Algunos archivos no se agregaron: solo PDF, JPG o PNG de hasta ${MAX_MB} MB.`);
    const todos = [...files, ...ok];
    if (todos.length > MAX_ARCHIVOS) toast.error(`Puedes adjuntar como máximo ${MAX_ARCHIVOS} archivos.`);
    onChange(todos.slice(0, MAX_ARCHIVOS));
    if (ref.current) ref.current.value = "";
  };
  return (
    <div>
      <button type="button" disabled={disabled || files.length >= MAX_ARCHIVOS} onClick={() => ref.current?.click()} className="flex w-full flex-col items-center rounded-lg border-2 border-dashed px-4 py-6 text-sm text-muted-foreground hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-50">
        <Paperclip className="mb-1 h-5 w-5" />Haz clic para adjuntar archivos (PDF, JPG o PNG · máx. {MAX_MB} MB c/u · hasta {MAX_ARCHIVOS})
      </button>
      <input ref={ref} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => add(e.target.files)} />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span className="truncate">{f.name} <span className="text-xs text-muted-foreground">({fmtSize(f.size)})</span></span>
              <button type="button" aria-label={`Quitar ${f.name}`} disabled={disabled} onClick={() => onChange(files.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
