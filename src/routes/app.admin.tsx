import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Pencil, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction, EmptyState, FieldError, PageHeader, Panel, runAction } from "@/components/app/common";
import { roleLabel } from "@/components/app/AppShell";
import { dataService, useData } from "@/lib/data/store";
import type { ProcedureType } from "@/lib/data/types";
import { useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Administración · NexusFisi" }, { name: "description", content: "Gestión de tipos de trámite y usuarios de demostración." }] }),
  component: Admin,
});

const schema = z.object({
  name: z.string().trim().min(4, "El nombre debe tener al menos 4 caracteres.").max(80, "Máximo 80 caracteres."),
  description: z.string().trim().min(10, "Describe el trámite (mínimo 10 caracteres).").max(300, "Máximo 300 caracteres."),
  requirements: z.array(z.string()).min(1, "Indica al menos un requisito."),
  days: z.number({ invalid_type_error: "Indica el plazo en días." }).int("Usa un número entero.").min(1, "Mínimo 1 día.").max(60, "Máximo 60 días."),
});

function Admin() {
  const user = useCurrentUser()!;
  const { types, users, requests } = useData((s) => s);
  const [editing, setEditing] = useState<ProcedureType | "new" | null>(null);

  if (user.role !== "admin") {
    return <EmptyState title="Sección exclusiva para administradores" action={<Button asChild size="sm"><Link to="/app">Ir al panel</Link></Button>} />;
  }

  return (
    <>
      <PageHeader title="Administración" subtitle="Configuración básica de la plataforma (datos de demostración)."
        action={
          <ConfirmAction title="¿Restablecer datos de demostración?" description="Se borrarán las solicitudes, mensajes y cambios realizados en este navegador y se cargarán los datos iniciales."
            confirmLabel="Restablecer" onConfirm={() => runAction(() => dataService.reset(), "Datos de demostración restablecidos")}
            trigger={<Button variant="outline"><RotateCcw className="h-4 w-4" />Restablecer datos demo</Button>} />
        } />

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tipos de trámite</h2>
          <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Nuevo trámite</Button>
        </div>
        {types.length === 0 ? <EmptyState title="No hay tipos de trámite" /> : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <ul className="divide-y">
              {types.map((t) => {
                const used = requests.filter((r) => r.typeId === t.id).length;
                return (
                  <li key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name} {!t.active && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactivo</span>}</p>
                      <p className="truncate text-sm text-muted-foreground">{t.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t.requirements.length} requisito(s) · {t.days} días hábiles · {used} solicitud(es)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ConfirmAction title={t.active ? "¿Desactivar trámite?" : "¿Activar trámite?"}
                        description={t.active ? "Dejará de mostrarse a los estudiantes. Las solicitudes existentes no se modifican." : "Volverá a estar disponible en el catálogo."}
                        onConfirm={() => runAction(() => dataService.toggleType(t.id), t.active ? "Trámite desactivado" : "Trámite activado")}
                        trigger={<Button size="sm" variant="ghost">{t.active ? "Desactivar" : "Activar"}</Button>} />
                      <Button size="sm" variant="outline" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" />Editar</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Usuarios de demostración</h2>
        <p className="mb-3 text-sm text-muted-foreground">Cuentas de prueba locales (contraseña <span className="font-mono">demo123</span>). No representan autenticación real.</p>
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Código / Área</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">{roleLabel[u.role]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.code ? `${u.code} · ${u.cycle}` : u.area}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </section>

      <TypeDialog value={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function TypeDialog({ value, onClose }: { value: ProcedureType | "new" | null; onClose: () => void }) {
  const open = value !== null;
  const current = value && value !== "new" ? value : null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current ? "Editar trámite" : "Nuevo tipo de trámite"}</DialogTitle>
          <DialogDescription>Los campos marcados con * son obligatorios.</DialogDescription>
        </DialogHeader>
        {open && <TypeForm key={current?.id ?? "new"} current={current} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

type TypeErrors = Partial<Record<keyof z.infer<typeof schema>, string>>;

function TypeForm({ current, onDone }: { current: ProcedureType | null; onDone: () => void }) {
  const [form, setForm] = useState({
    name: current?.name ?? "", description: current?.description ?? "",
    requirements: current?.requirements.join("\n") ?? "", days: String(current?.days ?? 5),
  });
  const [errors, setErrors] = useState<TypeErrors>({});
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name, description: form.description,
      requirements: form.requirements.split("\n").map((s) => s.trim()).filter(Boolean),
      days: form.days === "" ? NaN : Number(form.days),
    };
    const res = schema.safeParse(data);
    if (!res.success) {
      const errs: TypeErrors = {};
      res.error.issues.forEach((i) => (errs[i.path[0] as keyof TypeErrors] ??= i.message));
      return setErrors(errs);
    }
    if (runAction(() => dataService.saveType({ ...res.data, id: current?.id, active: current?.active ?? true }), current ? "Trámite actualizado" : "Trámite creado")) onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="tname">Nombre *</Label><Input id="tname" value={form.name} onChange={set("name")} /><FieldError>{errors.name}</FieldError></div>
      <div className="space-y-1.5"><Label htmlFor="tdesc">Descripción *</Label><Textarea id="tdesc" rows={3} value={form.description} onChange={set("description")} /><FieldError>{errors.description}</FieldError></div>
      <div className="space-y-1.5"><Label htmlFor="treq">Requisitos * <span className="font-normal text-muted-foreground">(uno por línea)</span></Label><Textarea id="treq" rows={4} value={form.requirements} onChange={set("requirements")} /><FieldError>{errors.requirements}</FieldError></div>
      <div className="space-y-1.5"><Label htmlFor="tdays">Plazo estimado (días hábiles) *</Label><Input id="tdays" type="number" min={1} max={60} value={form.days} onChange={set("days")} className="w-32" /><FieldError>{errors.days}</FieldError></div>
      <DialogFooter><Button type="button" variant="outline" onClick={onDone}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter>
    </form>
  );
}
