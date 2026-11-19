import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mensajeDeError } from "@/lib/api/client";
import { useLogin } from "@/lib/api/queries";
import { useSesion } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NexusFisi · Trámites académicos UNMSM" },
      {
        name: "description",
        content:
          "Registra y da seguimiento a tus solicitudes y trámites académicos en las facultades de la Universidad Nacional Mayor de San Marcos.",
      },
      { property: "og:title", content: "NexusFisi · Trámites académicos" },
      {
        property: "og:description",
        content: "Plataforma de solicitudes y trámites académicos de la UNMSM.",
      },
    ],
  }),
  component: LoginPage,
});

// Cuentas de los datos de demostración (api/src/db/seed.ts). Se ocultan con VITE_MOSTRAR_DEMO=false.
const DEMO = [
  { rol: "Estudiante (FISI)", email: "estudiante.fisi@unmsm.edu.pe" },
  { rol: "Técnico (FISI)", email: "tecnico.fisi@unmsm.edu.pe" },
  { rol: "Supervisor (FISI)", email: "supervisor.fisi@unmsm.edu.pe" },
  { rol: "Administrador (FISI)", email: "admin.fisi@unmsm.edu.pe" },
  { rol: "Administrador central", email: "admin.central@unmsm.edu.pe" },
];
const MOSTRAR_DEMO = import.meta.env["VITE_MOSTRAR_DEMO"] !== "false";

function LoginPage() {
  const sesion = useSesion();
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (sesion) return <Navigate to="/app" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Ingresa tu correo y contraseña.");
    setError("");
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => void navigate({ to: "/app" }),
        onError: (err) => setError(mensajeDeError(err)),
      },
    );
  };

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo institucional</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre.apellido@unmsm.edu.pe"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Contraseña</Label>
          <Input
            id="pw"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Ingresar
        </Button>
      </form>
      <p className="mt-3 text-center text-sm">
        <Link to="/recuperar" className="text-muted-foreground hover:text-primary hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿Eres estudiante y no tienes cuenta?{" "}
        <Link to="/registro" className="font-semibold text-primary hover:underline">
          Regístrate
        </Link>
      </p>
      {MOSTRAR_DEMO && (
        <div className="mt-8 rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 text-warning" />
            Cuentas de demostración
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Datos de prueba, no reales. Contraseña para todas:{" "}
            <span className="font-mono font-semibold text-foreground">Demo1234</span>
          </p>
          <div className="mt-3 space-y-1.5">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword("Demo1234");
                  setError("");
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs hover:border-accent hover:bg-accent/10"
              >
                <span className="font-semibold">{d.rol}</span>
                <span className="truncate font-mono text-muted-foreground">
                  {d.email.split("@")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
