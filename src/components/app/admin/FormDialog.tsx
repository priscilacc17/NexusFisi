import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, mensajeDeError } from "@/lib/api/client";
import { FieldError } from "../common";

export type Errores = Record<string, string>;

// Diálogo con formulario: valida, envía y muestra los errores de campo que
// devuelve la API (problem+json → errors) junto a cada campo.
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Guardar",
  onSubmit,
  children,
  error,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string | undefined;
  submitLabel?: string;
  onSubmit: () => Promise<void>;
  children: ReactNode;
  error?: string | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          {children}
          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Ejecuta la mutación: si la API devuelve errores de campo los entrega para
// pintarlos; cualquier otro error se informa con un toast. Devuelve true si salió bien.
export async function guardar(
  fn: () => Promise<unknown>,
  ok: string,
  setErrores: (e: Errores) => void,
): Promise<boolean> {
  try {
    await fn();
    toast.success(ok);
    setErrores({});
    return true;
  } catch (e) {
    if (e instanceof ApiError && Object.keys(e.errors).length) setErrores(e.errors);
    else setErrores({ _: mensajeDeError(e) });
    return false;
  }
}
