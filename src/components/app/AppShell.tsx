import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, BookOpen, FilePlus2, FileText, Inbox, LayoutDashboard, LogOut, Menu, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dataService, useData } from "@/lib/data/store";
import type { Role, User } from "@/lib/data/types";
import { logout } from "@/lib/session";
import { fmtDate } from "./common";
import { cn } from "@/lib/utils";

const NAV: Record<Role, { to: string; label: string; icon: typeof Inbox }[]> = {
  estudiante: [
    { to: "/app", label: "Panel principal", icon: LayoutDashboard },
    { to: "/app/tramites", label: "Trámites", icon: BookOpen },
    { to: "/app/nueva", label: "Nueva solicitud", icon: FilePlus2 },
    { to: "/app/solicitudes", label: "Mis solicitudes", icon: FileText },
  ],
  personal: [
    { to: "/app", label: "Panel principal", icon: LayoutDashboard },
    { to: "/app/bandeja", label: "Bandeja", icon: Inbox },
    { to: "/app/tramites", label: "Trámites", icon: BookOpen },
  ],
  admin: [
    { to: "/app", label: "Panel principal", icon: LayoutDashboard },
    { to: "/app/bandeja", label: "Bandeja", icon: Inbox },
    { to: "/app/admin", label: "Administración", icon: Settings },
  ],
};
export const roleLabel: Record<Role, string> = { estudiante: "Estudiante", personal: "Personal administrativo", admin: "Administrador" };

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand font-bold text-primary-foreground" style={{ fontFamily: "var(--font-display)" }}>NF</div>
      <div>
        <p className="font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>NexusFisi</p>
        <p className="text-[11px] opacity-70">Facultad de Fisioterapia</p>
      </div>
    </div>
  );
}

function NavList({ user, onNav }: { user: User; onNav?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV[user.role].map((n) => (
        <Link key={n.to} to={n.to} onClick={onNav} activeOptions={{ exact: n.to === "/app" }}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground">
          <n.icon className="h-4 w-4" />{n.label}
        </Link>
      ))}
    </nav>
  );
}

function Notifications({ user }: { user: User }) {
  const all = useData((s) => s.notifications);
  const mine = useMemo(() => all.filter((n) => n.userId === user.id).slice(0, 12), [all, user.id]);
  const unread = mine.filter((n) => !n.read).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 && <button className="text-xs font-medium text-primary hover:underline" onClick={() => dataService.markAllRead(user.id)}>Marcar como leídas</button>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {mine.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Sin notificaciones</p> :
            mine.map((n) => {
              const cls = cn("block w-full border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-muted", !n.read && "bg-accent/10");
              const body = <><p className="flex items-start gap-2">{!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}{n.text}</p><p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(n.date, true)}</p></>;
              return n.requestId
                ? <Link key={n.id} to="/app/solicitudes/$id" params={{ id: n.requestId }} onClick={() => dataService.markRead(n.id)} className={cls}>{body}</Link>
                : <button key={n.id} type="button" onClick={() => dataService.markRead(n.id)} className={cls}>{body}</button>;
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const doLogout = () => { logout(); navigate({ to: "/", replace: true }); };
  const footer = (
    <div className="border-t border-sidebar-border pt-4">
      <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">{user.name}</p>
      <p className="text-xs text-sidebar-foreground/70">{roleLabel[user.role]}</p>
      <button onClick={doLogout} className="mt-3 flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"><LogOut className="h-4 w-4" />Cerrar sesión</button>
    </div>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col justify-between bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <div className="space-y-8"><Brand /><NavList user={user} /></div>{footer}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col justify-between bg-sidebar p-5 text-sidebar-foreground">
            <div className="space-y-8">
              <div className="flex items-center justify-between"><Brand /><button aria-label="Cerrar menú" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
              <NavList user={user} onNav={() => setOpen(false)} />
            </div>{footer}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
          <p className="truncate text-sm text-muted-foreground">Hola, <span className="font-semibold text-foreground">{user.name.split(" ")[0]}</span></p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent-foreground sm:inline">{roleLabel[user.role]}</span>
          <Notifications user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
