import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { LoadingState } from "@/components/app/common";
import { useCurrentUser } from "@/lib/session";

// Área privada: se renderiza solo en el navegador porque los datos viven en localStorage.
export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({ meta: [{ title: "Panel · NexusFisi" }, { name: "description", content: "Panel de trámites académicos NexusFisi." }] }),
  pendingComponent: () => <LoadingState text="Cargando NexusFisi…" />,
  component: AppLayout,
});

function AppLayout() {
  const user = useCurrentUser();
  if (!user) return <Navigate to="/" replace />;
  return <AppShell user={user}><Outlet /></AppShell>;
}
