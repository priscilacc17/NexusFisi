import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  FilePlus2,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLogout, useMarcarLeidas, useNotificaciones } from "@/lib/api/queries";
import type { Rol, Usuario } from "@/lib/api/types";
import { rolLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { fmtDate } from "./common";

type Item = { to: string; label: string; icon: typeof Inbox };

const NAV: Record<Rol, Item[]> = {
  ESTUDIANTE: [
    { to: "/app", label: "Panel principal", icon: LayoutDashboard },
    { to: "/app/tramites", label: "Trámites", icon: BookOpen },
    { to: "/app/nueva", label: "Nueva solicitud", icon: FilePlus2 },
    { to: "/app/solicitudes", label: "Mis solicitudes", icon: FileText },
  ],
  TECNICO: [
    { to: "/app", label: "Panel principal", icon: LayoutDashboard },
    { to: "/app/bandeja", label: "Mis asignaciones", icon: Inbox },
    { to: "/app/tramites", label: "Trámites", icon: BookOpen },
  ],
  SUPERVISOR: [
    { to: "/app", label: "Panel principal", icon: LayoutDashboard },
    { to: "/app/bandeja", label: "Bandeja", icon: Inbox },
    { to: "/app/tramites", label: "Trámites", icon: BookOpen },
  ],
  ADMIN: [
    { to: "/app", label: "Panel principal", icon: LayoutDashboard },
    { to: "/app/bandeja", label: "Solicitudes", icon: Inbox },
    { to: "/app/admin", label: "Administración", icon: Settings },
  ],
};

export const alcanceLabel = (u: Usuario) =>
  u.facultad ? u.facultad.codigo : "Todas las facultades";

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid h-9 w-9 place-items-center rounded-lg bg-brand font-bold text-primary-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        NX
      </div>
      <div>
        <p className="font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>
          NEXUS
        </p>
        <p className="text-[11px] opacity-70">Expediente Único · UNMSM</p>
      </div>
    </div>
  );
}

function NavList({ user, onNav }: { user: Usuario; onNav?: () => void }) {
  const items = [...NAV[user.rol], { to: "/app/perfil", label: "Mi perfil", icon: UserRound }];
  return (
    <nav className="flex flex-col gap-1" aria-label="Navegación principal">
      {items.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onNav}
          activeOptions={{ exact: n.to === "/app" }}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground"
        >
          <n.icon className="h-4 w-4" />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

function Notifications() {
  const { data } = useNotificaciones();
  const marcar = useMarcarLeidas();
  const items = data?.items ?? [];
  const unread = data?.noLeidas ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 && (
            <button
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => marcar.mutate(undefined)}
            >
              Marcar como leídas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sin notificaciones</p>
          ) : (
            items.map((n) => {
              const cls = cn(
                "block w-full border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-muted",
                !n.leida && "bg-accent/10",
              );
              const body = (
                <>
                  <p className="flex items-start gap-2">
                    {!n.leida && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    )}
                    {n.texto}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDate(n.createdAt, true)}
                  </p>
                </>
              );
              const leer = () => {
                if (!n.leida) marcar.mutate(n.id);
              };
              return n.solicitudCodigo ? (
                <Link
                  key={n.id}
                  to="/app/solicitudes/$codigo"
                  params={{ codigo: n.solicitudCodigo }}
                  onClick={leer}
                  className={cls}
                >
                  {body}
                </Link>
              ) : (
                <button key={n.id} type="button" onClick={leer} className={cls}>
                  {body}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ user, children }: { user: Usuario; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const logout = useLogout();
  const doLogout = () =>
    logout.mutate(undefined, { onSettled: () => void navigate({ to: "/", replace: true }) });
  const footer = (
    <div className="border-t border-sidebar-border pt-4">
      <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">{user.nombre}</p>
      <p className="text-xs text-sidebar-foreground/70">
        {rolLabel[user.rol]} · {alcanceLabel(user)}
      </p>
      <button
        onClick={doLogout}
        className="mt-3 flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </button>
    </div>
  );
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col justify-between bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <div className="space-y-8">
          <Brand />
          <NavList user={user} />
        </div>
        {footer}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col justify-between bg-sidebar p-5 text-sidebar-foreground">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <Brand />
                <button aria-label="Cerrar menú" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavList user={user} onNav={() => setOpen(false)} />
            </div>
            {footer}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menú"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <p className="truncate text-sm text-muted-foreground">
            Hola, <span className="font-semibold text-foreground">{user.nombre.split(" ")[0]}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="hidden max-w-56 truncate rounded-full border px-3 py-1 text-xs font-semibold text-foreground md:inline"
            title={user.facultad?.nombre ?? "Universidad Nacional Mayor de San Marcos"}
          >
            {alcanceLabel(user)}
          </span>
          <span className="hidden rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent-foreground sm:inline">
            {rolLabel[user.rol]}
          </span>
          <Notifications />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
