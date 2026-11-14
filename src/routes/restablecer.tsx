import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { FieldError } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mensajeDeError } from "@/lib/api/client";
import { useRestablecer } from "@/lib/api/queries";

export const Route = createFileRoute("/restablecer")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => (typeof s["token"] === "string" ? { token: s["token"] } : {}),
  head: () => ({ meta: [{ title: "Nueva contraseña · NexusFisi" }, { name: "description", content: "Crea una nueva contraseña." }, { name: "referrer", content: "no-referrer" }] }),
  component: Restablecer,
});

function Restablecer() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const restablecer = useRestablecer();
  const [f, setF] = useState({ password: "", confirmar: "" });
  const [err, setErr] = useState<Record<string, string>>({});

  if (!token) {
    return (
      <AuthLayout>
        <h2 className="text-xl font-bold">Enlace incompleto</h2>
        <p className="mt-2 text-sm text-muted-foreground">Abre el enlace tal como llegó a tu correo, o solicita uno nuevo.</p>
        <Button asChild className="mt-4 w-full"><Link to="/recuperar">Solicitar un enlace</Link></Button>
      </AuthLayout>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (f.password.length < 8 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(f.password) || !/\d/.test(f.password)) x["password"] = "Mínimo 8 caracteres, con letras y números.";
    if (f.password !== f.confirmar) x["confirmar"] = "Las contraseñas no coinciden.";
    setErr(x);
    if (Object.keys(x).length) return;
    restablecer.mutate({ token, password: f.password }, {
      onSuccess: () => {
        toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
        void navigate({ to: "/", replace: true });
      },
      onError: (e2) => setErr({ _: mensajeDeError(e2) }),
    });
  };

  return (
    <AuthLayout>
      <h2 className="mb-1 text-xl font-bold">Crea una nueva contraseña</h2>
      <p className="mb-5 text-sm text-muted-foreground">Al guardarla se cerrarán las sesiones abiertas en otros dispositivos.</p>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="pw">Nueva contraseña</Label><Input id="pw" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><FieldError>{err["password"]}</FieldError></div>
        <div className="space-y-1.5"><Label htmlFor="pw2">Confirmar contraseña</Label><Input id="pw2" type="password" autoComplete="new-password" value={f.confirmar} onChange={(e) => setF({ ...f, confirmar: e.target.value })} /><FieldError>{err["confirmar"]}</FieldError></div>
        <FieldError>{err["_"]}</FieldError>
        {err["_"] && <p className="text-sm"><Link to="/recuperar" className="font-semibold text-primary hover:underline">Solicitar un enlace nuevo</Link></p>}
        <Button type="submit" className="w-full" disabled={restablecer.isPending}>{restablecer.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Guardar contraseña</Button>
      </form>
    </AuthLayout>
  );
}
