import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/data/types";

const statusStyle: Record<Status, string> = {
  Registrada: "bg-secondary text-secondary-foreground",
  "En evaluación": "bg-info/15 text-info",
  Observada: "bg-warning/20 text-foreground",
  Asignada: "bg-accent/20 text-accent-foreground",
  "En atención": "bg-primary/10 text-primary",
  Resuelta: "bg-success/15 text-success",
  Cerrada: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", statusStyle[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
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
  return <div className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>{children}</div>;
}

export function StatCard({ label, value, icon: Icon, tone = "primary" }: { label: string; value: number | string; icon: LucideIcon; tone?: "primary" | "accent" | "warning" | "success" }) {
  const tones = { primary: "bg-primary/10 text-primary", accent: "bg-accent/20 text-accent-foreground", warning: "bg-warning/20 text-foreground", success: "bg-success/15 text-success" };
  return (
    <Panel className="flex items-center gap-4">
      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", tones[tone])}><Icon className="h-6 w-6" /></div>
      <div className="min-w-0">
        <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
        <p className="truncate text-sm text-muted-foreground">{label}</p>
      </div>
    </Panel>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground" />
      <p className="mt-3 font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const fmtDate = (iso: string, time = false) =>
  new Date(iso).toLocaleString("es-PE", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
export const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export const selectClass = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
