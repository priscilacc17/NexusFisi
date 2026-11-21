import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Clock, Inbox, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Estado, Prioridad } from "@/lib/api/types";
import { estadoLabel, prioridadLabel } from "@/lib/labels";

const statusStyle: Record<Estado, string> = {
  REGISTRADA: "bg-secondary text-secondary-foreground",
  EN_EVALUACION: "bg-info/15 text-info",
  OBSERVADA: "bg-warning/20 text-foreground",
  ASIGNADA: "bg-accent/20 text-accent-foreground",
  EN_ATENCION: "bg-primary/10 text-primary",
  RESUELTA: "bg-success/15 text-success",
  CERRADA: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: Estado }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        statusStyle[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {estadoLabel[status]}
    </span>
  );
}

const prioridadStyle: Record<Prioridad, string> = {
  URGENTE: "border-destructive/40 bg-destructive/10 text-destructive",
  ALTA: "border-warning/50 bg-warning/15 text-foreground",
  MEDIA: "border-border bg-card text-muted-foreground",
  BAJA: "border-border bg-card text-muted-foreground",
};

export function PriorityBadge({ prioridad }: { prioridad: Prioridad }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        prioridadStyle[prioridad],
      )}
    >
      {prioridadLabel[prioridad]}
    </span>
  );
}

export function VencidaBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
      <Clock className="h-3 w-3" />
      Vencida
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "warning" | "success" | "danger";
  hint?: string;
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    warning: "bg-warning/20 text-foreground",
    success: "bg-success/15 text-success",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <Panel className="flex items-center gap-4">
      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", tones[tone])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {value}
        </p>
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        {hint && <p className="truncate text-xs text-muted-foreground/80">{hint}</p>}
      </div>
    </Panel>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground" />
      <p className="mt-3 font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Error de carga con opción de reintentar (p. ej. la API no responde).
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <AlertCircle className="h-9 w-9 text-destructive" />
      <p className="mt-3 font-semibold">No se pudo cargar la información</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Error inesperado."}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export const fmtDate = (iso: string, time = false) =>
  new Date(iso).toLocaleString(
    "es-PE",
    time
      ? { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }
      : { dateStyle: "medium", timeZone: "America/Lima" },
  );
export const fmtSize = (b: number) =>
  b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function FieldError({ children }: { children?: string | undefined }) {
  return children ? (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  ) : null;
}

export function LoadingState({ text = "Cargando…" }: { text?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

// Botón que pide confirmación antes de una acción importante. `onConfirm` puede
// ser asíncrono: el diálogo muestra "procesando" y solo se cierra si termina bien
// (devolver false lo mantiene abierto, p. ej. para mostrar un error de validación).
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  children,
  disabled,
  destructive,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<boolean | void> | boolean | void;
  children?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmar = async () => {
    setBusy(true);
    try {
      if ((await onConfirm()) !== false) setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <AlertDialogTrigger asChild disabled={disabled}>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={confirmar}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
