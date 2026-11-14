import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { FieldError, selectClass } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, mensajeDeError } from "@/lib/api/client";
import { useFacultades, useRegistro } from "@/lib/api/queries";
import { useSesion } from "@/lib/session";

export const Route = createFileRoute("/registro")({
  head: () => ({ meta: [{ title: "Crear cuenta · NexusFisi" }, { name: "description", content: "Registro de estudiantes de la UNMSM en NexusFisi." }] }),
  component: Registro,
});

// Misma política que la API; se valida aquí para avisar antes de enviar.
const schema = z
  .object({
    nombre: z.string().trim().min(5, "Ingresa tu nombre completo."),
    email: z.string().trim().toLowerCase().email("Correo inválido.").refine((v) => v.endsWith("@unmsm.edu.pe"), "Usa tu correo institucional @unmsm.edu.pe."),
    codigoEstudiante: z.string().regex(/^\d{8}$/, "Tu código de estudiante tiene 8 dígitos."),
    facultadId: z.coerce.number().int().positive("Selecciona tu facultad."),
    escuelaId: z.coerce.number().int().optional(),
    password: z.string().min(8, "Mínimo 8 caracteres.").regex(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/, "Incluye al menos una letra.").regex(/\d/, "Incluye al menos un número."),
    confirmar: z.string(),
  })
  .refine((d) => d.password === d.confirmar, { path: ["confirmar"], message: "Las contraseñas no coinciden." });

type Campos = Record<"nombre" | "email" | "codigoEstudiante" | "facultadId" | "escuelaId" | "password" | "confirmar", string>;

function Registro() {
  const sesion = useSesion();
  const navigate = useNavigate();
  const facultades = useFacultades();
  const registro = useRegistro();
  const [f, setF] = useState<Campos>({ nombre: "", email: "", codigoEstudiante: "", facultadId: "", escuelaId: "", password: "", confirmar: "" });
  const [errores, setErrores] = useState<Partial<Campos>>({});
  if (sesion) return <Navigate to="/app" replace />;

  const fac = facultades.data?.find((x) => String(x.id) === f.facultadId);
  const set = (k: keyof Campos) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value, ...(k === "facultadId" ? { escuelaId: "" } : {}) }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(f);
    const errs: Partial<Campos> = {};
    if (!r.success) for (const i of r.error.issues) errs[i.path[0] as keyof Campos] ??= i.message;
    if (fac && fac.escuelas.length > 0 && !f.escuelaId) errs.escuelaId = "Selecciona tu escuela profesional.";
    setErrores(errs);
    if (!r.success || Object.keys(errs).length) return;
    const d = r.data;
    registro.mutate(
      { nombre: d.nombre, email: d.email, password: d.password, codigoEstudiante: d.codigoEstudiante, facultadId: d.facultadId, ...(d.escuelaId ? { escuelaId: d.escuelaId } : {}) },
      {
        onSuccess: () => {
          toast.success("Cuenta creada. Ya puedes iniciar sesión.");
          void navigate({ to: "/" });
        },
        onError: (err) => {
          if (err instanceof ApiError && Object.keys(err.errors).length) setErrores(err.errors as Partial<Campos>);
          toast.error(mensajeDeError(err));
        },
      },
    );
  };

  return (
    <AuthLayout>
      <h2 className="mb-1 text-xl font-bold">Crear cuenta de estudiante</h2>
      <p className="mb-5 text-sm text-muted-foreground">El personal administrativo recibe su cuenta de la administración de su facultad.</p>
      <form onSubmit={submit} noValidate className="space-y-3.5">
        <div className="space-y-1.5"><Label htmlFor="nombre">Nombres y apellidos</Label><Input id="nombre" autoComplete="name" value={f.nombre} onChange={set("nombre")} /><FieldError>{errores.nombre}</FieldError></div>
        <div className="space-y-1.5"><Label htmlFor="email">Correo institucional</Label><Input id="email" type="email" autoComplete="email" placeholder="nombre.apellido@unmsm.edu.pe" value={f.email} onChange={set("email")} /><FieldError>{errores.email}</FieldError></div>
        <div className="space-y-1.5"><Label htmlFor="codigo">Código de estudiante</Label><Input id="codigo" inputMode="numeric" maxLength={8} value={f.codigoEstudiante} onChange={set("codigoEstudiante")} /><FieldError>{errores.codigoEstudiante}</FieldError></div>
        <div className="space-y-1.5">
          <Label htmlFor="facultad">Facultad</Label>
          <select id="facultad" className={selectClass} value={f.facultadId} onChange={set("facultadId")} disabled={facultades.isLoading}>
            <option value="">{facultades.isLoading ? "Cargando facultades…" : facultades.isError ? "No se pudo cargar la lista" : "Selecciona…"}</option>
            {facultades.data?.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
          <FieldError>{errores.facultadId}</FieldError>
        </div>
        {fac && fac.escuelas.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="escuela">Escuela profesional</Label>
            <select id="escuela" className={selectClass} value={f.escuelaId} onChange={set("escuelaId")}>
              <option value="">Selecciona…</option>
              {fac.escuelas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
            <FieldError>{errores.escuelaId}</FieldError>
          </div>
        )}
        <div className="space-y-1.5"><Label htmlFor="pw">Contraseña</Label><Input id="pw" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} /><FieldError>{errores.password}</FieldError><p className="text-xs text-muted-foreground">Al menos 8 caracteres, con letras y números.</p></div>
        <div className="space-y-1.5"><Label htmlFor="pw2">Confirmar contraseña</Label><Input id="pw2" type="password" autoComplete="new-password" value={f.confirmar} onChange={set("confirmar")} /><FieldError>{errores.confirmar}</FieldError></div>
        <Button type="submit" className="w-full" disabled={registro.isPending}>{registro.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Crear cuenta</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">¿Ya tienes cuenta? <Link to="/" className="font-semibold text-primary hover:underline">Inicia sesión</Link></p>
    </AuthLayout>
  );
}
