import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, mensajeDeError } from "@/lib/api/client";
import { useAdmin, useAreas, useTipos } from "@/lib/api/queries";
import type { Area, TipoTramite } from "@/lib/api/types";
import { ConfirmAction, EmptyState, ErrorState, FieldError, LoadingState, Panel, selectClass } from "../common";
import { FormDialog, guardar, type Errores } from "./FormDialog";

const Inactivo = () => <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Inactivo</span>;

// ---------------------------------------------------------------------------
// Tipos de trámite (categorías)
// ---------------------------------------------------------------------------

export function TramitesTab({ facultadId }: { facultadId: number | undefined }) {
  const tipos = useTipos({ facultadId, incluirInactivos: true });
  const [editando, setEditando] = useState<TipoTramite | "nuevo" | null>(null);
  const eliminar = useAdmin((id: number) => api("DELETE", `/admin/tipos-tramite/${id}`));

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Cada trámite lo atiende un área de la facultad y tiene su plazo en días hábiles.</p>
        <Button onClick={() => setEditando("nuevo")}><Plus className="h-4 w-4" />Nuevo trámite</Button>
      </div>
      {tipos.isPending ? <LoadingState /> : tipos.isError ? <ErrorState error={tipos.error} onRetry={() => void tipos.refetch()} /> : tipos.data.length === 0 ? <EmptyState title="No hay tipos de trámite" /> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <ul className="divide-y">
            {tipos.data.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.nombre}{!t.activo && <Inactivo />}</p>
                  <p className="truncate text-sm text-muted-foreground">{t.descripcion}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.area.nombre} · {t.requisitos.length} requisito(s) · {t.plazoDias} días hábiles</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditando(t)}><Pencil className="h-4 w-4" />Editar</Button>
                  <ConfirmAction title="¿Eliminar este trámite?" description="Solo se puede eliminar si nunca recibió solicitudes; si las tiene, desactívalo para conservar el historial." confirmLabel="Eliminar" destructive
                    onConfirm={async () => {
                      try { await eliminar.mutateAsync(t.id); toast.success("Trámite eliminado"); } catch (e) { toast.error(mensajeDeError(e)); }
                    }}
                    trigger={<Button size="icon" variant="ghost" aria-label={`Eliminar ${t.nombre}`}><Trash2 className="h-4 w-4" /></Button>} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {editando && <TipoDialog tipo={editando === "nuevo" ? null : editando} facultadId={facultadId} onClose={() => setEditando(null)} />}
    </>
  );
}

function TipoDialog({ tipo, facultadId, onClose }: { tipo: TipoTramite | null; facultadId: number | undefined; onClose: () => void }) {
  const areas = useAreas({ facultadId: tipo?.facultadId ?? facultadId });
  const [f, setF] = useState({
    nombre: tipo?.nombre ?? "",
    descripcion: tipo?.descripcion ?? "",
    areaId: String(tipo?.area.id ?? ""),
    requisitos: tipo?.requisitos.join("\n") ?? "",
    plazoDias: String(tipo?.plazoDias ?? 5),
    activo: tipo?.activo ?? true,
  });
  const [errores, setErrores] = useState<Errores>({});
  const mutar = useAdmin((body: object) => (tipo ? api("PUT", `/admin/tipos-tramite/${tipo.id}`, { json: body }) : api("POST", "/admin/tipos-tramite", { json: body })));
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const enviar = async () => {
    const requisitos = f.requisitos.split("\n").map((r) => r.trim()).filter(Boolean);
    const plazo = Number(f.plazoDias);
    const e: Errores = {};
    if (f.nombre.trim().length < 4) e["nombre"] = "Mínimo 4 caracteres.";
    if (f.descripcion.trim().length < 10) e["descripcion"] = "Describe el trámite (mínimo 10 caracteres).";
    if (!f.areaId) e["areaId"] = "Selecciona el área que lo atiende.";
    if (requisitos.length === 0) e["requisitos"] = "Indica al menos un requisito.";
    if (!Number.isInteger(plazo) || plazo < 1 || plazo > 60) e["plazoDias"] = "Entre 1 y 60 días hábiles.";
    setErrores(e);
    if (Object.keys(e).length) return;
    const body = { nombre: f.nombre.trim(), descripcion: f.descripcion.trim(), areaId: Number(f.areaId), requisitos, plazoDias: plazo, activo: f.activo, ...(tipo ? {} : { facultadId }) };
    if (await guardar(() => mutar.mutateAsync(body), tipo ? "Trámite actualizado" : "Trámite creado", setErrores)) onClose();
  };

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={tipo ? "Editar trámite" : "Nuevo tipo de trámite"} description={tipo ? "Un plazo nuevo aplica a las solicitudes que se registren desde ahora." : undefined} onSubmit={enviar} error={errores["_"]}>
      <div className="space-y-1.5"><Label htmlFor="t-nombre">Nombre *</Label><Input id="t-nombre" maxLength={120} value={f.nombre} onChange={set("nombre")} /><FieldError>{errores["nombre"]}</FieldError></div>
      <div className="space-y-1.5"><Label htmlFor="t-desc">Descripción *</Label><Textarea id="t-desc" rows={3} maxLength={500} value={f.descripcion} onChange={set("descripcion")} /><FieldError>{errores["descripcion"]}</FieldError></div>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <div className="space-y-1.5">
          <Label htmlFor="t-area">Área responsable *</Label>
          <select id="t-area" className={selectClass} value={f.areaId} onChange={set("areaId")}>
            <option value="">Selecciona…</option>
            {areas.data?.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <FieldError>{errores["areaId"]}</FieldError>
        </div>
        <div className="space-y-1.5"><Label htmlFor="t-plazo">Plazo (días hábiles) *</Label><Input id="t-plazo" type="number" min={1} max={60} value={f.plazoDias} onChange={set("plazoDias")} /><FieldError>{errores["plazoDias"]}</FieldError></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="t-req">Requisitos * <span className="font-normal text-muted-foreground">(uno por línea)</span></Label><Textarea id="t-req" rows={4} value={f.requisitos} onChange={set("requisitos")} /><FieldError>{errores["requisitos"]}</FieldError></div>
      <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
        <span><span className="font-medium">Disponible para los estudiantes</span><span className="block text-xs text-muted-foreground">Desactivarlo no afecta a las solicitudes ya registradas.</span></span>
        <Switch checked={f.activo} onCheckedChange={(v) => setF((p) => ({ ...p, activo: v }))} />
      </label>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Áreas responsables
// ---------------------------------------------------------------------------

export function AreasTab({ facultadId }: { facultadId: number | undefined }) {
  const areas = useAreas({ facultadId, incluirInactivas: true });
  const [editando, setEditando] = useState<Area | "nueva" | null>(null);
  const eliminar = useAdmin((id: number) => api("DELETE", `/admin/areas/${id}`));
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Oficinas de la facultad que atienden los trámites. Su ubicación se muestra al estudiante.</p>
        <Button onClick={() => setEditando("nueva")}><Plus className="h-4 w-4" />Nueva área</Button>
      </div>
      {areas.isPending ? <LoadingState /> : areas.isError ? <ErrorState error={areas.error} onRetry={() => void areas.refetch()} /> : areas.data.length === 0 ? <EmptyState title="No hay áreas registradas" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {areas.data.map((a) => (
            <Panel key={a.id} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.nombre}{!a.activa && <Inactivo />}</p>
                <p className="mt-1 flex gap-1.5 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{a.ubicacion}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label={`Editar ${a.nombre}`} onClick={() => setEditando(a)}><Pencil className="h-4 w-4" /></Button>
              <ConfirmAction title="¿Eliminar esta área?" description="Solo se puede eliminar si no tiene trámites ni personal asociados; si los tiene, desactívala." confirmLabel="Eliminar" destructive
                onConfirm={async () => { try { await eliminar.mutateAsync(a.id); toast.success("Área eliminada"); } catch (e) { toast.error(mensajeDeError(e)); } }}
                trigger={<Button size="icon" variant="ghost" aria-label={`Eliminar ${a.nombre}`}><Trash2 className="h-4 w-4" /></Button>} />
            </Panel>
          ))}
        </div>
      )}
      {editando && <AreaDialog area={editando === "nueva" ? null : editando} facultadId={facultadId} onClose={() => setEditando(null)} />}
    </>
  );
}

function AreaDialog({ area, facultadId, onClose }: { area: Area | null; facultadId: number | undefined; onClose: () => void }) {
  const [f, setF] = useState({ nombre: area?.nombre ?? "", ubicacion: area?.ubicacion ?? "", activa: area?.activa ?? true });
  const [errores, setErrores] = useState<Errores>({});
  const mutar = useAdmin((body: object) => (area ? api("PUT", `/admin/areas/${area.id}`, { json: body }) : api("POST", "/admin/areas", { json: body })));
  const enviar = async () => {
    const e: Errores = {};
    if (f.nombre.trim().length < 3) e["nombre"] = "Mínimo 3 caracteres.";
    if (f.ubicacion.trim().length < 3) e["ubicacion"] = "Indica dónde se atiende (pabellón, piso, oficina).";
    setErrores(e);
    if (Object.keys(e).length) return;
    const body = { nombre: f.nombre.trim(), ubicacion: f.ubicacion.trim(), activa: f.activa, ...(area ? {} : { facultadId }) };
    if (await guardar(() => mutar.mutateAsync(body), area ? "Área actualizada" : "Área creada", setErrores)) onClose();
  };
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={area ? "Editar área" : "Nueva área"} onSubmit={enviar} error={errores["_"]}>
      <div className="space-y-1.5"><Label htmlFor="a-nombre">Nombre *</Label><Input id="a-nombre" maxLength={120} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /><FieldError>{errores["nombre"]}</FieldError></div>
      <div className="space-y-1.5"><Label htmlFor="a-ubic">Ubicación *</Label><Input id="a-ubic" maxLength={200} placeholder="Ej. Pabellón FISI, 1.er piso, oficina 102" value={f.ubicacion} onChange={(e) => setF({ ...f, ubicacion: e.target.value })} /><FieldError>{errores["ubicacion"]}</FieldError></div>
      {area && (
        <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
          <span><span className="font-medium">Área activa</span><span className="block text-xs text-muted-foreground">No se puede desactivar mientras atienda trámites activos.</span></span>
          <Switch checked={f.activa} onCheckedChange={(v) => setF({ ...f, activa: v })} />
        </label>
      )}
    </FormDialog>
  );
}
