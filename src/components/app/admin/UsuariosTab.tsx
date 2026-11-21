import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Pencil, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api/client";
import {
  useAdmin,
  useAreas,
  useFacultades,
  useFacultadesAdmin,
  useUsuariosAdmin,
} from "@/lib/api/queries";
import type { Rol, Usuario } from "@/lib/api/types";
import { rolLabel, ROLES } from "@/lib/labels";
import { EmptyState, ErrorState, FieldError, LoadingState, selectClass } from "../common";
import { Pagination } from "../Pagination";
import { FormDialog, guardar, type Errores } from "./FormDialog";

const SIZE = 15;

export function UsuariosTab({ yo, facultadId }: { yo: Usuario; facultadId: number | undefined }) {
  const [rol, setRol] = useState<Rol | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const busqueda = useDebounced(q.trim(), 300);
  const lista = useUsuariosAdmin({
    facultadId,
    rol: rol || undefined,
    q: busqueda || undefined,
    page,
    size: SIZE,
  });
  const [editando, setEditando] = useState<Usuario | "nuevo" | null>(null);
  const [clave, setClave] = useState<Usuario | null>(null);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            aria-label="Buscar usuarios"
            placeholder="Nombre, correo o código"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Filtrar por rol"
          className={`${selectClass} sm:w-48`}
          value={rol}
          onChange={(e) => {
            setRol(e.target.value as Rol | "");
            setPage(1);
          }}
        >
          <option value="">Todos los roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {rolLabel[r]}
            </option>
          ))}
        </select>
        <Button onClick={() => setEditando("nuevo")}>
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {lista.isPending ? (
        <LoadingState />
      ) : lista.isError ? (
        <ErrorState error={lista.error} onRetry={() => void lista.refetch()} />
      ) : lista.data.items.length === 0 ? (
        <EmptyState title="No hay usuarios con ese filtro" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Facultad</th>
                  <th className="px-4 py-3">Área / escuela</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.data.items.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.nombre}</p>
                      <p className="font-mono text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {rolLabel[u.rol]}
                      {u.rol === "ADMIN" && !u.facultad && (
                        <span className="block text-xs text-muted-foreground">Central</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{u.facultad?.codigo ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.area?.nombre ?? u.escuela?.nombre ?? "—"}
                      {u.codigoEstudiante && (
                        <span className="block font-mono text-xs">{u.codigoEstudiante}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.activo ? (
                        <span className="text-xs font-semibold text-success">Activo</span>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Editar ${u.nombre}`}
                          onClick={() => setEditando(u)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Contraseña temporal para ${u.nombre}`}
                          onClick={() => setClave(u)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} size={SIZE} total={lista.data.total} onPage={setPage} />
        </>
      )}

      {editando && (
        <UsuarioDialog
          yo={yo}
          usuario={editando === "nuevo" ? null : editando}
          facultadInicial={facultadId}
          onClose={() => setEditando(null)}
        />
      )}
      {clave && <ClaveDialog usuario={clave} onClose={() => setClave(null)} />}
    </>
  );
}

function UsuarioDialog({
  yo,
  usuario,
  facultadInicial,
  onClose,
}: {
  yo: Usuario;
  usuario: Usuario | null;
  facultadInicial: number | undefined;
  onClose: () => void;
}) {
  const central = !yo.facultad;
  const [f, setF] = useState({
    nombre: usuario?.nombre ?? "",
    email: usuario?.email ?? "",
    rol: (usuario?.rol ?? "ESTUDIANTE") as Rol,
    facultadId: String(usuario?.facultad?.id ?? yo.facultad?.id ?? facultadInicial ?? ""),
    areaId: String(usuario?.area?.id ?? ""),
    escuelaId: String(usuario?.escuela?.id ?? ""),
    codigoEstudiante: usuario?.codigoEstudiante ?? "",
    password: "",
    activo: usuario?.activo ?? true,
  });
  const [errores, setErrores] = useState<Errores>({});
  const facAdmin = useFacultadesAdmin(central);
  const publicas = useFacultades();
  const facId = f.facultadId ? Number(f.facultadId) : undefined;
  const areas = useAreas({ facultadId: facId, enabled: !!facId });
  const escuelas = publicas.data?.find((x) => x.id === facId)?.escuelas ?? [];
  const esCentral = f.rol === "ADMIN" && !f.facultadId;
  const mutar = useAdmin((body: object) =>
    usuario
      ? api("PUT", `/admin/usuarios/${usuario.id}`, { json: body })
      : api("POST", "/admin/usuarios", { json: body }),
  );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const enviar = async () => {
    const e: Errores = {};
    if (f.nombre.trim().length < 5) e["nombre"] = "Nombre completo (mínimo 5 caracteres).";
    if (!usuario && !f.email.trim().toLowerCase().endsWith("@unmsm.edu.pe"))
      e["email"] = "Debe ser un correo @unmsm.edu.pe.";
    if (!usuario && f.password.length < 8)
      e["password"] = "Contraseña temporal de al menos 8 caracteres, con letras y números.";
    if (!esCentral && !f.facultadId) e["facultadId"] = "Selecciona la facultad.";
    if (f.rol === "TECNICO" && !f.areaId) e["areaId"] = "El técnico debe pertenecer a un área.";
    if (f.rol === "ESTUDIANTE" && !/^\d{8}$/.test(f.codigoEstudiante))
      e["codigoEstudiante"] = "8 dígitos.";
    setErrores(e);
    if (Object.keys(e).length) return;
    const perfil = {
      areaId:
        f.rol === "TECNICO" || f.rol === "SUPERVISOR" ? (f.areaId ? Number(f.areaId) : null) : null,
      escuelaId: f.rol === "ESTUDIANTE" && f.escuelaId ? Number(f.escuelaId) : null,
      codigoEstudiante: f.rol === "ESTUDIANTE" ? f.codigoEstudiante : null,
    };
    const body = usuario
      ? { nombre: f.nombre.trim(), rol: f.rol, activo: f.activo, ...perfil }
      : {
          nombre: f.nombre.trim(),
          email: f.email.trim(),
          rol: f.rol,
          facultadId: esCentral ? null : Number(f.facultadId),
          password: f.password,
          ...perfil,
        };
    if (
      await guardar(
        () => mutar.mutateAsync(body),
        usuario ? "Usuario actualizado" : "Usuario creado",
        setErrores,
      )
    )
      onClose();
  };

  const propio = usuario?.id === yo.id;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={usuario ? "Editar usuario" : "Nuevo usuario"}
      description={
        usuario ? usuario.email : "El usuario podrá cambiar su contraseña desde «Mi perfil»."
      }
      onSubmit={enviar}
      error={errores["_"]}
    >
      <div className="space-y-1.5">
        <Label htmlFor="u-nombre">Nombre completo</Label>
        <Input id="u-nombre" value={f.nombre} onChange={set("nombre")} />
        <FieldError>{errores["nombre"]}</FieldError>
      </div>
      {!usuario && (
        <div className="space-y-1.5">
          <Label htmlFor="u-email">Correo institucional</Label>
          <Input id="u-email" type="email" value={f.email} onChange={set("email")} />
          <FieldError>{errores["email"]}</FieldError>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="u-rol">Rol</Label>
          <select
            id="u-rol"
            className={selectClass}
            value={f.rol}
            disabled={propio}
            onChange={(e) =>
              setF((p) => ({ ...p, rol: e.target.value as Rol, areaId: "", escuelaId: "" }))
            }
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {rolLabel[r]}
              </option>
            ))}
          </select>
          {propio && (
            <p className="text-xs text-muted-foreground">No puedes cambiar tu propio rol.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-fac">Facultad</Label>
          <select
            id="u-fac"
            className={selectClass}
            value={f.facultadId}
            disabled={!central || !!usuario}
            onChange={(e) =>
              setF((p) => ({ ...p, facultadId: e.target.value, areaId: "", escuelaId: "" }))
            }
          >
            {central && f.rol === "ADMIN" && (
              <option value="">Administración central (todas)</option>
            )}
            {central && f.rol !== "ADMIN" && <option value="">Selecciona…</option>}
            {(central ? (facAdmin.data ?? []) : yo.facultad ? [yo.facultad] : []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.codigo} · {x.nombre}
              </option>
            ))}
          </select>
          <FieldError>{errores["facultadId"]}</FieldError>
        </div>
      </div>
      {(f.rol === "TECNICO" || f.rol === "SUPERVISOR") && f.facultadId && (
        <div className="space-y-1.5">
          <Label htmlFor="u-area">Área{f.rol === "TECNICO" ? " *" : " (opcional)"}</Label>
          <select id="u-area" className={selectClass} value={f.areaId} onChange={set("areaId")}>
            <option value="">{f.rol === "TECNICO" ? "Selecciona…" : "Sin área específica"}</option>
            {areas.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
          <FieldError>{errores["areaId"]}</FieldError>
        </div>
      )}
      {f.rol === "ESTUDIANTE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="u-cod">Código de estudiante</Label>
            <Input
              id="u-cod"
              maxLength={8}
              inputMode="numeric"
              value={f.codigoEstudiante}
              onChange={set("codigoEstudiante")}
            />
            <FieldError>{errores["codigoEstudiante"]}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-esc">Escuela</Label>
            <select
              id="u-esc"
              className={selectClass}
              value={f.escuelaId}
              onChange={set("escuelaId")}
              disabled={escuelas.length === 0}
            >
              <option value="">
                {escuelas.length ? "Selecciona…" : "La facultad no tiene escuelas"}
              </option>
              {escuelas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {!usuario && (
        <div className="space-y-1.5">
          <Label htmlFor="u-pass">Contraseña temporal</Label>
          <Input
            id="u-pass"
            type="text"
            autoComplete="off"
            value={f.password}
            onChange={set("password")}
          />
          <FieldError>{errores["password"]}</FieldError>
        </div>
      )}
      {usuario && !propio && (
        <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
          <span>
            <span className="font-medium">Cuenta activa</span>
            <span className="block text-xs text-muted-foreground">
              Al desactivarla se cierra su sesión. Si atiende solicitudes, primero hay que
              reasignarlas.
            </span>
          </span>
          <Switch checked={f.activo} onCheckedChange={(v) => setF((p) => ({ ...p, activo: v }))} />
        </label>
      )}
    </FormDialog>
  );
}

function ClaveDialog({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const mutar = useAdmin((p: string) =>
    api("POST", `/admin/usuarios/${usuario.id}/restablecer-password`, { json: { password: p } }),
  );
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Asignar contraseña temporal"
      description={`${usuario.nombre} deberá usarla para ingresar. Sus sesiones abiertas se cerrarán y se desbloqueará la cuenta.`}
      submitLabel="Asignar"
      error={errores["_"] ?? errores["password"]}
      onSubmit={async () => {
        if (password.length < 8)
          return setErrores({ password: "Mínimo 8 caracteres, con letras y números." });
        if (await guardar(() => mutar.mutateAsync(password), "Contraseña asignada", setErrores)) {
          toast.info("Comunica la contraseña temporal por un canal seguro.");
          onClose();
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="tmp-pass">Nueva contraseña</Label>
        <Input
          id="tmp-pass"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </FormDialog>
  );
}
