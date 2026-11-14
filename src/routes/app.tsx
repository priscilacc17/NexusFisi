import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { LoadingState } from "@/components/app/common";
import { useMe } from "@/lib/api/queries";
import { useSesion } from "@/lib/session";

// Área privada: se renderiza solo en el navegador (la sesión vive en localStorage).
export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({ meta: [{ title: "Panel · NexusFisi" }, { name: "description", content: "Panel de trámites académicos de la UNMSM." }] }),
  pendingComponent: () => <LoadingState text="Cargando NexusFisi…" />,
  component: AppLayout,
});

function AppLayout() {
  const sesion = useSesion();
  // Valida el token contra la API al entrar; si fue revocado, el cliente cierra la sesión.
  useMe(!!sesion);
  if (!sesion) return <Navigate to="/" replace />;
  return <AppShell user={sesion.usuario}><Outlet /></AppShell>;
}
