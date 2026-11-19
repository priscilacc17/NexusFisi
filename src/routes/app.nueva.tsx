import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  ErrorState,
  FieldError,
  LoadingState,
  PageHeader,
  Panel,
  selectClass,
} from "@/components/app/common";
import { FilePicker } from "@/components/app/FilePicker";
import { ApiError, mensajeDeError } from "@/lib/api/client";
import { useCrearSolicitud, useTipos } from "@/lib/api/queries";
import { useUsuario } from "@/lib/session";

export const Route = createFileRoute("/app/nueva")({
  validateSearch: (s: Record<string, unknown>): { tipo?: number } => {
    const n = Number(s["tipo"]);
    return Number.isInteger(n) && n > 0 ? { tipo: n } : {};
  },
  head: () => ({
    meta: [
      { title: "Nueva solicitud · NexusFisi" },
      { name: "description", content: "Registra una nueva solicitud académica." },
    ],
  }),
  component: NewRequest,
});

const schema = z.object({
  tipoId: z.string().min(1, "Selecciona un tipo de trámite."),
  asunto: z
    .string()
    .trim()
    .min(5, "El asunto debe tener al menos 5 caracteres.")
    .max(120, "Máximo 120 caracteres."),
  description: z
    .string()
    .trim()
    .min(15, "Describe tu solicitud (mínimo 15 caracteres).")
    .max(1500, "Máximo 1500 caracteres."),
});
type Errores = Partial<Record<"tipoId" | "asunto" | "description" | "archivos", string>>;

function NewRequest() {
  const user = useUsuario();
  const { tipo } = Route.useSearch();
  const navigate = useNavigate();
  const tipos = useTipos({ enabled: user.rol === "ESTUDIANTE" });
  const crear = useCrearSolicitud();
  const [form, setForm] = useState({
    tipoId: tipo ? String(tipo) : "",
    asunto: "",
    description: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Errores>({});

  if (user.rol !== "ESTUDIANTE")
    return (
      <EmptyState
        title="Solo los estudiantes registran solicitudes"
        action={
          <Button asChild size="sm">
            <Link to="/app">Ir al panel</Link>
          </Button>
        }
      />
    );
  if (tipos.isPending) return <LoadingState />;
  if (tipos.isError) return <ErrorState error={tipos.error} onRetry={() => void tipos.refetch()} />;
  const type = tipos.data.find((t) => String(t.id) === form.tipoId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = schema.safeParse(form);
    const errs: Errores = {};
    if (!res.success)
      for (const i of res.error.issues) errs[i.path[0] as keyof Errores] ??= i.message;
    if (files.length === 0) errs.archivos = "Adjunta al menos un documento.";
    setErrors(errs);
    if (!res.success || Object.keys(errs).length) return;
    crear.mutate(
      {
        tipoId: Number(res.data.tipoId),
        asunto: res.data.asunto,
        descripcion: res.data.description,
        archivos: files,
      },
      {
        onSuccess: (s) => {
          toast.success(`Solicitud ${s.codigo} registrada correctamente`);
          void navigate({ to: "/app/solicitudes/$codigo", params: { codigo: s.codigo } });
        },
        onError: (err) => {
          // Errores de campo de la API (p. ej. un archivo con contenido inválido).
          if (err instanceof ApiError)
            setErrors({
              ...(err.errors as Errores),
              ...(err.errors["descripcion"] ? { description: err.errors["descripcion"] } : {}),
            });
          toast.error(mensajeDeError(err));
        },
      },
    );
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader
        title="Nueva solicitud"
        subtitle={`${user.facultad?.nombre ?? ""} · Los campos marcados con * son obligatorios.`}
      />
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-3">
        <Panel className="space-y-5 lg:col-span-2">
          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo de trámite *</Label>
            <select
              id="type"
              className={selectClass}
              value={form.tipoId}
              onChange={set("tipoId")}
              disabled={crear.isPending}
            >
              <option value="">Selecciona…</option>
              {tipos.data.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <FieldError>{errors.tipoId}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Asunto *</Label>
            <Input
              id="subject"
              value={form.asunto}
              onChange={set("asunto")}
              placeholder="Ej. Constancia para beca"
              maxLength={120}
              disabled={crear.isPending}
            />
            <FieldError>{errors.asunto}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descripción *</Label>
            <Textarea
              id="desc"
              rows={5}
              value={form.description}
              onChange={set("description")}
              placeholder="Explica el motivo de tu solicitud"
              maxLength={1500}
              disabled={crear.isPending}
            />
            <div className="flex justify-between">
              <FieldError>{errors.description}</FieldError>
              <span className="ml-auto text-xs text-muted-foreground">
                {form.description.length}/1500
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Documentos *</Label>
            <FilePicker files={files} onChange={setFiles} disabled={crear.isPending} />
            <FieldError>{errors.archivos}</FieldError>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={crear.isPending}
              onClick={() => void navigate({ to: "/app/tramites" })}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Registrar solicitud
            </Button>
          </div>
        </Panel>
        <Panel className="h-fit">
          <p className="font-semibold">Requisitos</p>
          {type ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">{type.descripcion}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {type.requisitos.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Plazo estimado: {type.plazoDias} días hábiles
              </p>
              <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Atiende: {type.area.nombre} ({type.area.ubicacion})
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Selecciona un trámite para ver sus requisitos.
            </p>
          )}
        </Panel>
      </form>
    </>
  );
}
