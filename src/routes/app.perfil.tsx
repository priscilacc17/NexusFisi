import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, PageHeader, Panel } from "@/components/app/common";
import { ApiError, mensajeDeError } from "@/lib/api/client";
import { useCambiarPassword } from "@/lib/api/queries";
import { rolLabel } from "@/lib/labels";
import { useUsuario } from "@/lib/session";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({ meta: [{ title: "Mi perfil · NexusFisi" }, { name: "description", content: "Datos de la cuenta y cambio de contraseña." }] }),
  component: Perfil,
});

function Perfil() {
  const u = useUsuario();
  const cambiar = useCambiarPassword();
  const [f, setF] = useState({ actual: "", nueva: "", confirmar: "" });
  const [err, setErr] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!f.actual) x["actual"] = "Ingresa tu contraseña actual.";
    if (f.nueva.length < 8 || !/[A-Za-z]/.test(f.nueva) || !/\d/.test(f.nueva)) x["nueva"] = "Mínimo 8 caracteres, con letras y números.";
    if (f.nueva !== f.confirmar) x["confirmar"] = "Las contraseñas no coinciden.";
    setErr(x);
    if (Object.keys(x).length) return;
    cambiar.mutate({ actual: f.actual, nueva: f.nueva }, {
      onSuccess: () => { toast.success("Contraseña actualizada. Se cerraron tus otras sesiones."); setF({ actual: "", nueva: "", confirmar: "" }); },
      onError: (e2) => { if (e2 instanceof ApiError) setErr(e2.errors); toast.error(mensajeDeError(e2)); },
    });
  };

  const datos: [string, string | null | undefined][] = [
    ["Nombre", u.nombre],
    ["Correo", u.email],
    ["Rol", rolLabel[u.rol]],
    ["Facultad", u.facultad?.nombre ?? "Administración central (todas las facultades)"],
    ["Escuela", u.escuela?.nombre],
    ["Área", u.area?.nombre],
    ["Código de estudiante", u.codigoEstudiante],
  ];

  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Para cambiar tus datos personales comunícate con la administración de tu facultad." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <p className="font-semibold">Datos de la cuenta</p>
          <dl className="mt-4 space-y-3 text-sm">
            {datos.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
        </Panel>
        <Panel>
          <p className="font-semibold">Cambiar contraseña</p>
          <form onSubmit={submit} noValidate className="mt-4 space-y-3">
            <div className="space-y-1.5"><Label htmlFor="p-act">Contraseña actual</Label><Input id="p-act" type="password" autoComplete="current-password" value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} /><FieldError>{err["actual"]}</FieldError></div>
            <div className="space-y-1.5"><Label htmlFor="p-new">Nueva contraseña</Label><Input id="p-new" type="password" autoComplete="new-password" value={f.nueva} onChange={(e) => setF({ ...f, nueva: e.target.value })} /><FieldError>{err["nueva"]}</FieldError></div>
            <div className="space-y-1.5"><Label htmlFor="p-con">Confirmar nueva contraseña</Label><Input id="p-con" type="password" autoComplete="new-password" value={f.confirmar} onChange={(e) => setF({ ...f, confirmar: e.target.value })} /><FieldError>{err["confirmar"]}</FieldError></div>
            <Button type="submit" disabled={cambiar.isPending}>{cambiar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Actualizar contraseña</Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
