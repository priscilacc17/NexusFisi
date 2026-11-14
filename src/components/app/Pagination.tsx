import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Paginación">
      <p className="text-muted-foreground">{(page - 1) * size + 1}–{Math.min(page * size, total)} de {total}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" />Anterior</Button>
        <span className="tabular-nums text-muted-foreground">{page}/{paginas}</span>
        <Button variant="outline" size="sm" disabled={page >= paginas} onClick={() => onPage(page + 1)}>Siguiente<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </nav>
  );
}
