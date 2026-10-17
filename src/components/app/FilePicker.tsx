import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { fmtSize } from "./common";

export type PickedFile = { name: string; size: number };
const MAX = 5 * 1024 * 1024;

// Solo registra nombre y tamaño (demo local): el archivo no se sube a ningún servidor.
export function FilePicker({ files, onChange }: { files: PickedFile[]; onChange: (f: PickedFile[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => {
    if (!list) return;
    const ok = Array.from(list).filter((f) => f.size <= MAX).map((f) => ({ name: f.name, size: f.size }));
    if (ok.length < list.length) alert("Algunos archivos superan 5 MB y no se agregaron.");
    onChange([...files, ...ok]);
    if (ref.current) ref.current.value = "";
  };
  return (
    <div>
      <button type="button" onClick={() => ref.current?.click()} className="flex w-full flex-col items-center rounded-lg border-2 border-dashed px-4 py-6 text-sm text-muted-foreground hover:border-accent hover:bg-accent/5">
        <Paperclip className="mb-1 h-5 w-5" />Haz clic para adjuntar archivos (PDF, JPG, PNG · máx. 5 MB)
      </button>
      <input ref={ref} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => add(e.target.files)} />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span className="truncate">{f.name} <span className="text-xs text-muted-foreground">({fmtSize(f.size)})</span></span>
              <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Demostración: se guarda solo el nombre del archivo, no su contenido.</p>
    </div>
  );
}
