import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { FieldError } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mensajeDeError } from "@/lib/api/client";
import { useRecuperar } from "@/lib/api/queries";

export const Route = createFileRoute("/recuperar")({
  head: () => ({
    meta: [
      { title: "Recuperar contraseña · NexusFisi" },
      { name: "description", content: "Recibe un enlace para crear una nueva contraseña." },
    ],
  }),
  component: Recuperar,
});

function Recuperar() {
  const recuperar = useRecuperar();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Ingresa tu correo institucional.");
    setError("");
    recuperar.mutate(email.trim(), {
      onSuccess: () => setEnviado(true),
      onError: (err) => setError(mensajeDeError(err)),
    });
  };

  return (
    <AuthLayout>
      <h2 className="mb-1 text-xl font-bold">Recuperar contraseña</h2>
      {enviado ? (
        <div className="mt-4 rounded-xl border bg-card p-5 text-sm" role="status">
          <MailCheck className="h-6 w-6 text-success" />
          <p className="mt-2 font-semibold">Revisa tu correo</p>
          <p className="mt-1 text-muted-foreground">
            Si <span className="font-medium text-foreground">{email.trim()}</span> tiene una cuenta,
            te enviamos un enlace para crear una nueva contraseña. Vence en 30 minutos y solo
            funciona una vez. Revisa también la carpeta de spam.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-5 text-sm text-muted-foreground">
            Te enviaremos un enlace a tu correo institucional para crear una nueva contraseña.
          </p>
          <form onSubmit={submit} noValidate className="space-y-4">
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
              <FieldError>{error}</FieldError>
            </div>
            <Button type="submit" className="w-full" disabled={recuperar.isPending}>
              {recuperar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Enviar enlace
            </Button>
          </form>
        </>
      )}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/" className="font-semibold text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
