import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, mensajeDeError } from "@/lib/api/client";
import { useTransicion, type DatosTransicion } from "@/lib/api/queries";
import type { Accion, Prioridad, SolicitudDetalle, Usuario } from "@/lib/api/types";
import { accionUI, prioridadLabel, PRIORIDADES, rolLabel } from "@/lib/labels";
import { ConfirmAction, FieldError, Panel, PriorityBadge, StatusBadge, selectClass } from "../common";

// Orden en que se muestran; CORREGIR tiene su propio formulario (CorrectionForm).
const ORDEN: Accion[] = ["EVALUAR", "ASIGNAR", "INICIAR_ATENCION", "RESOLVER", "CERRAR", "REABRIR", "OBSERVAR", "REASIGNAR", "PRIORIZAR", "DESISTIR"];
const CON_NOTA: Partial<Record<Accion, { min: number; label: string; placeholder: string }>> = {
  OBSERVAR: { min: 10, label: "Observación para el estudiante *", placeholder: "Ej. La carta de aceptación no tiene la firma del representante." },
  DESISTIR: { min: 5, label: "Motivo *", placeholder: "Ej. Ya no necesito el trámite." },
  REABRIR: { min: 10, label: "¿Por qué no estás conforme? *", placeholder: "Ej. La constancia tiene un error en mi nombre." },
};

function AccionBoton({ s, accion, user }: { s: SolicitudDetalle; accion: Accion; user: Usuario }) {
  const transicion = useTransicion(s);
  const [nota, setNota] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>(s.prioridad);
  const [error, setError] = useState("");
  const ui = accionUI[accion];
  const esEstudiante = user.rol === "ESTUDIANTE";
  const boton = accion === "CERRAR" && esEstudiante ? "Estoy conforme · cerrar" : ui.boton;
  const nInfo = CON_NOTA[accion];

  const ejecutar = async () => {
    const d: DatosTransicion = { accion };
    if (nInfo) {
      if (nota.trim().length < nInfo.min) return (setError(`Escribe al menos ${nInfo.min} caracteres.`), false);
      d.nota = nota.trim();
    }
    if (accion === "RESOLVER") {
      if (respuesta.trim().length < 10) return (setError("Escribe la respuesta (mínimo 10 caracteres)."), false);
      d.respuesta = respuesta.trim();
    }
    if (accion === "ASIGNAR" || accion === "REASIGNAR") {
      if (!responsableId) return (setError("Selecciona un responsable."), false);
      d.responsableId = Number(responsableId);
      if (prioridad !== s.prioridad) d.prioridad = prioridad;
    }
    if (accion === "PRIORIZAR") {
      if (prioridad === s.prioridad) return (setError("Elige una prioridad distinta a la actual."), false);
      d.prioridad = prioridad;
    }
    setError("");
    try {
      await transicion.mutateAsync(d);
      toast.success("Listo: la solicitud se actualizó.");
      setNota(""); setRespuesta(""); setResponsableId("");
      return true;
    } catch (e) {
      // 400: dato inválido → se queda abierto para corregir. Otro error → se informa y se cierra.
      if (e instanceof ApiError && e.status === 400) return (setError(mensajeDeError(e)), false);
      toast.error(mensajeDeError(e));
      return true;
    }
  };

  const disponibles = s.responsablesDisponibles.filter((r) => r.id !== s.responsable?.id);
  return (
    <ConfirmAction
      title={ui.titulo}
      description={ui.descripcion}
      confirmLabel={boton}
      destructive={accion === "DESISTIR"}
      onConfirm={ejecutar}
      trigger={<Button className="w-full" variant={accion === "OBSERVAR" || accion === "DESISTIR" || accion === "REABRIR" || accion === "PRIORIZAR" || accion === "REASIGNAR" ? "outline" : "default"}>{boton}</Button>}
    >
      <div className="space-y-3">
        {nInfo && (
          <div className="space-y-1.5">
            <Label htmlFor={`nota-${accion}`}>{nInfo.label}</Label>
            <Textarea id={`nota-${accion}`} rows={3} maxLength={1500} value={nota} onChange={(e) => setNota(e.target.value)} placeholder={nInfo.placeholder} />
          </div>
        )}
        {accion === "RESOLVER" && (
          <div className="space-y-1.5">
            <Label htmlFor="respuesta">Respuesta para el estudiante *</Label>
            <Textarea id="respuesta" rows={4} maxLength={3000} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Ej. Se emitió la constancia; la encontrarás adjunta en el expediente." />
          </div>
        )}
        {(accion === "ASIGNAR" || accion === "REASIGNAR") && (
          <div className="space-y-1.5">
            <Label htmlFor="responsable">Responsable *</Label>
            <select id="responsable" className={selectClass} value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
              <option value="">Selecciona…</option>
              {disponibles.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre} · {rolLabel[r.rol]}{r.area ? ` · ${r.area}` : ""}{r.delArea ? " (área del trámite)" : ""}</option>
              ))}
            </select>
            {disponibles.length === 0 && <p className="text-xs text-muted-foreground">No hay otro personal activo en la facultad.</p>}
          </div>
        )}
        {(accion === "ASIGNAR" || accion === "REASIGNAR" || accion === "PRIORIZAR") && (
          <div className="space-y-1.5">
            <Label htmlFor="prioridad">Prioridad</Label>
            <select id="prioridad" className={selectClass} value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
              {PRIORIDADES.map((p) => <option key={p} value={p}>{prioridadLabel[p]}</option>)}
            </select>
          </div>
        )}
        <FieldError>{error}</FieldError>
      </div>
    </ConfirmAction>
  );
}

export function AccionesPanel({ s, user }: { s: SolicitudDetalle; user: Usuario }) {
  const acciones = ORDEN.filter((a) => s.acciones.includes(a));
  const esEstudiante = user.rol === "ESTUDIANTE";
  if (esEstudiante && acciones.length === 0) return null;
  return (
    <Panel className="space-y-4">
      <div>
        <p className="font-semibold">{esEstudiante ? "Tus opciones" : "Acciones"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Estado: <StatusBadge status={s.estado} /> <PriorityBadge prioridad={s.prioridad} /></div>
      </div>
      {acciones.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {user.rol === "ADMIN" ? "Los administradores consultan el expediente; las acciones las realiza el personal de la facultad." :
            s.estado === "OBSERVADA" ? "En espera de la corrección del estudiante." :
            s.estado === "CERRADA" ? "El expediente está cerrado." :
            s.estado === "RESUELTA" ? "En espera de la conformidad del estudiante." :
            "No tienes acciones disponibles en este momento."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {acciones.map((a) => <AccionBoton key={a} s={s} accion={a} user={user} />)}
        </div>
      )}
      {s.acciones.includes("RESOLVER") && <p className="text-xs text-muted-foreground">Si emites un documento (constancia, resolución), adjúntalo antes de resolver.</p>}
    </Panel>
  );
}
