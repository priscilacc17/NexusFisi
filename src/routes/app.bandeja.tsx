import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FilterX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  selectClass,
} from "@/components/app/common";
import { EstadoChips } from "@/components/app/EstadoChips";
import { Pagination } from "@/components/app/Pagination";
import { RequestTable } from "@/components/app/RequestTable";
import { useDebounced } from "@/hooks/use-debounced";
import { useFacultadesAdmin, useSolicitudes, useTipos } from "@/lib/api/queries";
import type { FiltrosSolicitudes } from "@/lib/api/types";
import { prioridadLabel, PRIORIDADES } from "@/lib/labels";
import { useUsuario } from "@/lib/session";

export const Route = createFileRoute("/app/bandeja")({
  head: () => ({
    meta: [
      { title: "Bandeja de solicitudes · NexusFisi" },
      { name: "description", content: "Bandeja de trabajo del personal." },
    ],
  }),
  component: Bandeja,
});

const SIZE = 15;
const VACIO: FiltrosSolicitudes = { orden: "prioridad" };

function Bandeja() {
  const user = useUsuario();
  const central = user.rol === "ADMIN" && !user.facultad;
  const [f, setF] = useState<FiltrosSolicitudes>(VACIO);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const busqueda = useDebounced(q.trim(), 300);
  const lista = useSolicitudes({ ...f, q: busqueda || undefined, page, size: SIZE });
  const tipos = useTipos({
    facultadId: f.facultadId,
    incluirInactivos: true,
    enabled: !central || !!f.facultadId,
  });
  const facultades = useFacultadesAdmin(central);

  if (user.rol === "ESTUDIANTE")
    return (
      <EmptyState
        title="Sección para el personal administrativo"
        action={
          <Button asChild size="sm">
            <Link to="/app">Ir al panel</Link>
          </Button>
        }
      />
    );

  const cambiar = (p: Partial<FiltrosSolicitudes>) => {
    setF((prev) => ({ ...prev, ...p }));
    setPage(1);
  };
  const activos = JSON.stringify(f) !== JSON.stringify(VACIO) || q !== "";
  const limpiar = () => {
    setF(VACIO);
    setQ("");
    setPage(1);
  };
  const titulo =
    user.rol === "TECNICO"
      ? "Mis asignaciones"
      : user.rol === "ADMIN"
        ? "Solicitudes"
        : "Bandeja de solicitudes";

  return (
    <>
      <PageHeader
        title={titulo}
        subtitle={
          lista.data
            ? `${lista.data.total} solicitud(es)${user.rol === "ADMIN" ? " · consulta" : ""}`
            : undefined
        }
      />
      <EstadoChips value={f.estado} onChange={(estado) => cambiar({ estado })} />

      <Panel className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="q">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="q"
                className="pl-8"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Código, asunto, estudiante o código de alumno"
              />
            </div>
          </div>
          {central && (
            <div className="space-y-1.5">
              <Label htmlFor="ffac">Facultad</Label>
              <select
                id="ffac"
                className={selectClass}
                value={f.facultadId ?? ""}
                onChange={(e) =>
                  cambiar({
                    facultadId: e.target.value ? Number(e.target.value) : undefined,
                    tipoId: undefined,
                  })
                }
              >
                <option value="">Todas</option>
                {facultades.data?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.codigo}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ftype">Tipo de trámite</Label>
            <select
              id="ftype"
              className={selectClass}
              value={f.tipoId ?? ""}
              disabled={central && !f.facultadId}
              onChange={(e) =>
                cambiar({ tipoId: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">{central && !f.facultadId ? "Elige una facultad" : "Todos"}</option>
              {tipos.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fprio">Prioridad</Label>
            <select
              id="fprio"
              className={selectClass}
              value={f.prioridad ?? ""}
              onChange={(e) =>
                cambiar({
                  prioridad: (e.target.value || undefined) as FiltrosSolicitudes["prioridad"],
                })
              }
            >
              <option value="">Todas</option>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {prioridadLabel[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ffrom">Desde</Label>
            <Input
              id="ffrom"
              type="date"
              value={f.desde ?? ""}
              max={f.hasta || undefined}
              onChange={(e) => cambiar({ desde: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fto">Hasta</Label>
            <Input
              id="fto"
              type="date"
              value={f.hasta ?? ""}
              min={f.desde || undefined}
              onChange={(e) => cambiar({ hasta: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forden">Ordenar por</Label>
            <select
              id="forden"
              className={selectClass}
              value={f.orden ?? "recientes"}
              onChange={(e) => cambiar({ orden: e.target.value as FiltrosSolicitudes["orden"] })}
            >
              <option value="prioridad">Prioridad (pendientes primero)</option>
              <option value="vencimiento">Plazo más próximo</option>
              <option value="recientes">Más recientes</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--primary)]"
                checked={!!f.vencidas}
                onChange={(e) => cambiar({ vencidas: e.target.checked || undefined })}
              />
              Solo vencidas
            </label>
            {user.rol === "SUPERVISOR" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--primary)]"
                  checked={!!f.asignadasAMi}
                  onChange={(e) => cambiar({ asignadasAMi: e.target.checked || undefined })}
                />
                Solo asignadas a mí
              </label>
            )}
          </div>
          <Button variant="ghost" size="sm" disabled={!activos} onClick={limpiar}>
            <FilterX className="h-4 w-4" />
            Limpiar filtros
          </Button>
        </div>
      </Panel>

      {lista.isPending ? (
        <LoadingState />
      ) : lista.isError ? (
        <ErrorState error={lista.error} onRetry={() => void lista.refetch()} />
      ) : lista.data.items.length ? (
        <>
          <RequestTable requests={lista.data.items} showStudent showFaculty={central} />
          <Pagination page={page} size={SIZE} total={lista.data.total} onPage={setPage} />
        </>
      ) : (
        <EmptyState
          title={
            activos
              ? "No hay solicitudes que coincidan"
              : user.rol === "TECNICO"
                ? "No tienes solicitudes asignadas"
                : "La bandeja está vacía"
          }
          text={activos ? "Prueba con otros filtros o límpialos." : undefined}
          action={
            activos ? (
              <Button size="sm" variant="outline" onClick={limpiar}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}
