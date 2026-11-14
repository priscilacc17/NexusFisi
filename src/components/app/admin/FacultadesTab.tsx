import { useState } from "react";
import { Building2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { useAdmin, useFacultadesAdmin } from "@/lib/api/queries";
import type { FacultadAdmin, Rol } from "@/lib/api/types";
import { estadoLabel, ESTADOS, prioridadLabel, PRIORIDADES, rolLabel, ROLES } from "@/lib/labels";
import { EmptyState, ErrorState, FieldError, LoadingState, Panel, PriorityBadge, StatusBadge } from "../common";
import { FormDialog, guardar, type Errores } from "./FormDialog";

export function FacultadesTab({ central }: { central: boolean }) {
  const facs = useFacultadesAdmin();
  const [editando, setEditando] = useState<FacultadAdmin | "nueva" | null>(null);
  const [escuela, setEscuela] = useState<{ fac: FacultadAdmin; esc: FacultadAdmin["escuelas"][number] | null } | null>(null);

  return (
    <>
      {central && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Universidad Nacional Mayor de San Marcos · {facs.data?.length ?? 0} facultades. Cada una gestiona su catálogo y su personal.</p>
          <Button onClick={() => setEditando("nueva")}><Plus className="h-4 w-4" />Nueva facultad</Button>
        </div>
      )}
      {facs.isPending ? <LoadingState /> : facs.isError ? <ErrorState error={facs.error} onRetry={() => void facs.refetch()} /> : facs.data.length === 0 ? <EmptyState title="No hay facultades" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {facs.data.map((f) => (
            <Panel key={f.id}>
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{f.codigo}{!f.activa && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Inactiva</span>}</p>
                  <p className="text-sm text-muted-foreground">{f.nombre}</p>
                </div>
                {central && <Button size="icon" variant="ghost" aria-label={`Editar ${f.codigo}`} onClick={() => setEditando(f)}><Pencil className="h-4 w-4" /></Button>}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {ROLES.filter((r) => f.usuarios[r]).map((r) => `${f.usuarios[r]} ${rolLabel[r as Rol].toLowerCase()}${(f.usuarios[r] ?? 0) > 1 ? "s" : ""}`).join(" · ") || "Sin usuarios todavía"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.escuelas.map((e) => (
                  <button key={e.id} type="button" disabled={!central} onClick={() => setEscuela({ fac: f, esc: e })}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${e.activa ? "" : "text-muted-foreground line-through"} ${central ? "hover:bg-muted" : "cursor-default"}`}>{e.nombre}</button>
                ))}
                {central && <button type="button" onClick={() => setEscuela({ fac: f, esc: null })} className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted">+ Escuela</button>}
              </div>
            </Panel>
          ))}
        </div>
      )}
      {editando && <FacultadDialog fac={editando === "nueva" ? null : editando} onClose={() => setEditando(null)} />}
      {escuela && <EscuelaDialog fac={escuela.fac} esc={escuela.esc} onClose={() => setEscuela(null)} />}
    </>
  );
}

function FacultadDialog({ fac, onClose }: { fac: FacultadAdmin | null; onClose: () => void }) {
  const [f, setF] = useState({ codigo: fac?.codigo ?? "", nombre: fac?.nombre ?? "", activa: fac?.activa ?? true });
  const [errores, setErrores] = useState<Errores>({});
  const mutar = useAdmin((body: object) => (fac ? api("PUT", `/admin/facultades/${fac.id}`, { json: body }) : api("POST", "/admin/facultades", { json: body })));
  const enviar = async () => {
    const e: Errores = {};
    if (!/^[A-Za-z]{2,12}$/.test(f.codigo.trim())) e["codigo"] = "Entre 2 y 12 letras (forma parte de los códigos de expediente).";
    if (f.nombre.trim().length < 5) e["nombre"] = "Nombre completo de la facultad.";
    setErrores(e);
    if (Object.keys(e).length) return;
    if (await guardar(() => mutar.mutateAsync({ codigo: f.codigo.trim().toUpperCase(), nombre: f.nombre.trim(), activa: f.activa }), fac ? "Facultad actualizada" : "Facultad creada", setErrores)) onClose();
  };
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={fac ? "Editar facultad" : "Nueva facultad"} description={fac ? "El código no se puede cambiar si ya tiene expedientes." : "Luego agrega sus áreas, trámites y personal."} onSubmit={enviar} error={errores["_"]}>
      <div className="space-y-1.5"><Label htmlFor="f-cod">Código *</Label><Input id="f-cod" maxLength={12} value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} placeholder="FISI" /><FieldError>{errores["codigo"]}</FieldError></div>
      <div className="space-y-1.5"><Label htmlFor="f-nom">Nombre *</Label><Input id="f-nom" maxLength={160} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /><FieldError>{errores["nombre"]}</FieldError></div>
      {fac && (
        <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
          <span><span className="font-medium">Facultad activa</span><span className="block text-xs text-muted-foreground">Inactiva: no admite registros ni solicitudes nuevas; las existentes continúan.</span></span>
          <Switch checked={f.activa} onCheckedChange={(v) => setF({ ...f, activa: v })} />
        </label>
      )}
    </FormDialog>
  );
}

function EscuelaDialog({ fac, esc, onClose }: { fac: FacultadAdmin; esc: FacultadAdmin["escuelas"][number] | null; onClose: () => void }) {
  const [nombre, setNombre] = useState(esc?.nombre ?? "");
  const [activa, setActiva] = useState(esc?.activa ?? true);
  const [errores, setErrores] = useState<Errores>({});
  const mutar = useAdmin((body: object) => (esc ? api("PUT", `/admin/facultades/${fac.id}/escuelas/${esc.id}`, { json: body }) : api("POST", `/admin/facultades/${fac.id}/escuelas`, { json: body })));
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={esc ? "Editar escuela" : `Nueva escuela en ${fac.codigo}`} error={errores["_"] ?? errores["nombre"]}
      onSubmit={async () => {
        if (nombre.trim().length < 3) return setErrores({ nombre: "Mínimo 3 caracteres." });
        if (await guardar(() => mutar.mutateAsync({ nombre: nombre.trim(), activa }), "Escuela guardada", setErrores)) onClose();
      }}>
      <div className="space-y-1.5"><Label htmlFor="e-nom">Escuela profesional</Label><Input id="e-nom" maxLength={160} value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
      {esc && <label className="flex items-center justify-between text-sm"><span>Escuela activa</span><Switch checked={activa} onCheckedChange={setActiva} /></label>}
    </FormDialog>
  );
}

const DESC_ESTADO: Record<(typeof ESTADOS)[number], string> = {
  REGISTRADA: "El estudiante registró la solicitud con sus documentos.",
  EN_EVALUACION: "El supervisor revisa datos y requisitos.",
  OBSERVADA: "Falta algo: el estudiante debe corregir. Vuelve al paso desde el que se observó.",
  ASIGNADA: "Tiene un responsable (técnico o supervisor) designado.",
  EN_ATENCION: "El responsable está trabajando en la solicitud.",
  RESUELTA: "Tiene respuesta. El estudiante puede dar conformidad o reabrirla una vez.",
  CERRADA: "Expediente terminado: por conformidad, por el supervisor o por desistimiento.",
};

// Estados y prioridades son parte del flujo (reglas del sistema), no datos
// editables: cambiarlos rompería las transiciones y los indicadores.
export function FlujoReferencia() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel className="lg:col-span-2">
        <p className="font-semibold">Estados del flujo</p>
        <p className="mt-1 text-xs text-muted-foreground">Definidos por las reglas del sistema; no se editan para no romper las transiciones ni los indicadores.</p>
        <ul className="mt-4 space-y-3">
          {ESTADOS.map((e) => <li key={e} className="flex items-start gap-3 text-sm"><span className="w-28 shrink-0"><StatusBadge status={e} /></span><span className="text-muted-foreground">{DESC_ESTADO[e]}</span></li>)}
        </ul>
      </Panel>
      <Panel className="h-fit">
        <p className="font-semibold">Prioridades</p>
        <p className="mt-1 text-xs text-muted-foreground">Las asigna el supervisor. Ordenan la bandeja de trabajo.</p>
        <ul className="mt-4 space-y-2">{PRIORIDADES.map((p) => <li key={p} className="flex items-center gap-2 text-sm"><PriorityBadge prioridad={p} /><span className="text-muted-foreground">{prioridadLabel[p]}</span></li>)}</ul>
        <p className="mt-4 text-xs text-muted-foreground">{estadoLabel.RESUELTA} y {estadoLabel.CERRADA} no se pueden repriorizar.</p>
      </Panel>
    </div>
  );
}
