import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Panel, selectClass } from "@/components/app/common";
import { FilePicker, type PickedFile } from "@/components/app/FilePicker";
import { dataService, useData } from "@/lib/data/store";
import { useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/app/nueva")({
  validateSearch: (s: Record<string, unknown>): { tipo?: string } => (typeof s["tipo"] === "string" ? { tipo: s["tipo"] } : {}),
  head: () => ({ meta: [{ title: "Nueva solicitud · NexusFisi" }, { name: "description", content: "Registra una nueva solicitud académica." }] }),
  component: NewRequest,
});

const schema = z.object({
  typeId: z.string().min(1, "Selecciona un tipo de trámite."),
  subject: z.string().trim().min(5, "El asunto debe tener al menos 5 caracteres.").max(120, "Máximo 120 caracteres."),
  description: z.string().trim().min(15, "Describe tu solicitud (mínimo 15 caracteres).").max(1500, "Máximo 1500 caracteres."),
});

type FormErrors = Partial<Record<"typeId" | "subject" | "description" | "files", string>>;

function NewRequest() {
  const user = useCurrentUser()!;
  const { tipo } = Route.useSearch();
  const navigate = useNavigate();
  const types = useData((s) => s.types).filter((t) => t.active);
  const [form, setForm] = useState({ typeId: tipo ?? "", subject: "", description: "" });
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const type = types.find((t) => t.id === form.typeId);

  if (user.role !== "estudiante") return <p className="text-muted-foreground">Solo los estudiantes pueden registrar solicitudes.</p>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = schema.safeParse(form);
    const errs: FormErrors = {};
    if (!res.success) res.error.issues.forEach((i) => (errs[i.path[0] as keyof FormErrors] ??= i.message));
    if (files.length === 0) errs.files = "Adjunta al menos un documento.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setTimeout(() => {
      const r = dataService.createRequest({ ...form, studentId: user.id, files });
      toast.success(`Solicitud ${r.code} registrada correctamente`);
      navigate({ to: "/app/solicitudes/$id", params: { id: r.id } });
    }, 500);
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Nueva solicitud" subtitle="Los campos marcados con * son obligatorios." />
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-3">
        <Panel className="space-y-5 lg:col-span-2">
          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo de trámite *</Label>
            <select id="type" className={selectClass} value={form.typeId} onChange={set("typeId")}>
              <option value="">Selecciona…</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {errors.typeId && <p className="text-sm text-destructive">{errors.typeId}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Asunto *</Label>
            <Input id="subject" value={form.subject} onChange={set("subject")} placeholder="Ej. Constancia para beca" />
            {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descripción *</Label>
            <Textarea id="desc" rows={5} value={form.description} onChange={set("description")} placeholder="Explica el motivo de tu solicitud" />
            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Documentos *</Label>
            <FilePicker files={files} onChange={setFiles} />
            {errors.files && <p className="text-sm text-destructive">{errors.files}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/tramites" })}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Registrar solicitud</Button>
          </div>
        </Panel>
        <Panel className="h-fit">
          <p className="font-semibold">Requisitos</p>
          {type ? (
            <><p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{type.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
              <p className="mt-3 text-xs text-muted-foreground">Plazo estimado: {type.days} días hábiles</p></>
          ) : <p className="mt-1 text-sm text-muted-foreground">Selecciona un trámite para ver sus requisitos.</p>}
        </Panel>
      </form>
    </>
  );
}
