import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actualizarUsuario, cerrarSesion, iniciarSesion } from "../session";
import { api } from "./client";
import type {
  Accion,
  Area,
  Dashboard,
  Facultad,
  FacultadAdmin,
  FiltrosSolicitudes,
  Notificacion,
  Pagina,
  Prioridad,
  Rol,
  RespuestaLogin,
  SolicitudDetalle,
  SolicitudResumen,
  TipoTramite,
  Usuario,
} from "./types";

// Claves de caché centralizadas: al cambiar una solicitud se invalidan juntas
// la lista, el detalle, el dashboard y las notificaciones.
export const qk = {
  me: ["me"] as const,
  facultades: ["facultades"] as const,
  tipos: (facultadId?: number, inactivos?: boolean) => ["tipos", facultadId ?? null, !!inactivos] as const,
  areas: (facultadId?: number, inactivas?: boolean) => ["areas", facultadId ?? null, !!inactivas] as const,
  solicitudes: (f: FiltrosSolicitudes) => ["solicitudes", f] as const,
  solicitud: (codigo: string) => ["solicitud", codigo] as const,
  dashboard: (facultadId?: number) => ["dashboard", facultadId ?? null] as const,
  notificaciones: ["notificaciones"] as const,
  usuarios: (f: object) => ["admin", "usuarios", f] as const,
  facultadesAdmin: ["admin", "facultades"] as const,
};

// --- Autenticación -----------------------------------------------------------

export function useLogin() {
  return useMutation({
    mutationFn: (d: { email: string; password: string }) => api<RespuestaLogin>("POST", "/auth/login", { json: d, auth: false }),
    // La cookie de sesión la fija el servidor; el token del cuerpo se descarta.
    onSuccess: (s) => iniciarSesion({ usuario: s.usuario }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("POST", "/auth/logout", { auth: false }),
    // Se cierra la sesión local aunque la API no responda.
    onSettled: () => {
      cerrarSesion();
      qc.clear();
    },
  });
}

export const useRecuperar = () => useMutation({ mutationFn: (email: string) => api("POST", "/auth/recuperar", { json: { email }, auth: false }) });
export const useRestablecer = () =>
  useMutation({ mutationFn: (d: { token: string; password: string }) => api("POST", "/auth/restablecer", { json: d, auth: false }) });

export function useRegistro() {
  return useMutation({
    mutationFn: (d: { nombre: string; email: string; password: string; codigoEstudiante: string; facultadId: number; escuelaId?: number }) =>
      api<Usuario>("POST", "/auth/registro", { json: d, auth: false }),
  });
}

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      const u = await api<Usuario>("GET", "/auth/me");
      actualizarUsuario(u);
      return u;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useCambiarPassword() {
  return useMutation({
    // La API renueva la cookie de sesión; las demás sesiones quedan cerradas.
    mutationFn: (d: { actual: string; nueva: string }) => api<{ token: string }>("POST", "/auth/cambiar-password", { json: d }),
  });
}

// --- Catálogo ----------------------------------------------------------------

export const useFacultades = () => useQuery({ queryKey: qk.facultades, queryFn: () => api<Facultad[]>("GET", "/facultades", { auth: false }), staleTime: 300_000 });

export const useTipos = (o: { facultadId?: number | undefined; incluirInactivos?: boolean | undefined; enabled?: boolean | undefined } = {}) =>
  useQuery({
    queryKey: qk.tipos(o.facultadId, o.incluirInactivos),
    queryFn: () => api<TipoTramite[]>("GET", "/tipos-tramite", { query: { facultadId: o.facultadId, incluirInactivos: o.incluirInactivos } }),
    enabled: o.enabled ?? true,
  });

export const useAreas = (o: { facultadId?: number | undefined; incluirInactivas?: boolean | undefined; enabled?: boolean | undefined } = {}) =>
  useQuery({
    queryKey: qk.areas(o.facultadId, o.incluirInactivas),
    queryFn: () => api<Area[]>("GET", "/areas", { query: { facultadId: o.facultadId, incluirInactivos: o.incluirInactivas } }),
    enabled: o.enabled ?? true,
  });

// --- Solicitudes -------------------------------------------------------------

export const useSolicitudes = (f: FiltrosSolicitudes) =>
  useQuery({
    queryKey: qk.solicitudes(f),
    queryFn: () => api<Pagina<SolicitudResumen>>("GET", "/solicitudes", { query: { ...f } }),
    placeholderData: keepPreviousData,
  });

export const useSolicitud = (codigo: string) =>
  useQuery({ queryKey: qk.solicitud(codigo), queryFn: () => api<SolicitudDetalle>("GET", `/solicitudes/${encodeURIComponent(codigo)}`) });

function useRefrescarSolicitud() {
  const qc = useQueryClient();
  return (d: SolicitudDetalle) => {
    qc.setQueryData(qk.solicitud(d.codigo), d);
    void qc.invalidateQueries({ queryKey: ["solicitudes"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: qk.notificaciones });
  };
}

export function useCrearSolicitud() {
  const refrescar = useRefrescarSolicitud();
  return useMutation({
    mutationFn: (d: { tipoId: number; asunto: string; descripcion: string; archivos: File[] }) => {
      const fd = new FormData();
      fd.set("tipoId", String(d.tipoId));
      fd.set("asunto", d.asunto);
      fd.set("descripcion", d.descripcion);
      for (const a of d.archivos) fd.append("archivos", a);
      return api<SolicitudDetalle>("POST", "/solicitudes", { form: fd });
    },
    onSuccess: refrescar,
  });
}

export interface DatosTransicion {
  accion: Accion;
  nota?: string;
  responsableId?: number;
  prioridad?: Prioridad;
  respuesta?: string;
}

export function useTransicion(s: Pick<SolicitudDetalle, "codigo" | "version">) {
  const refrescar = useRefrescarSolicitud();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: DatosTransicion) => api<SolicitudDetalle>("POST", `/solicitudes/${s.codigo}/transiciones`, { json: { ...d, version: s.version } }),
    onSuccess: refrescar,
    // 409: otra persona cambió la solicitud. Se recarga para mostrar su estado real.
    onError: (e: { status?: number }) => {
      if (e.status === 409) void qc.invalidateQueries({ queryKey: qk.solicitud(s.codigo) });
    },
  });
}

export function useAdjuntar(codigo: string) {
  const refrescar = useRefrescarSolicitud();
  return useMutation({
    mutationFn: (archivos: File[]) => {
      const fd = new FormData();
      for (const a of archivos) fd.append("archivos", a);
      return api<SolicitudDetalle>("POST", `/solicitudes/${codigo}/adjuntos`, { form: fd });
    },
    onSuccess: refrescar,
  });
}

export function useEnviarMensaje(codigo: string) {
  const refrescar = useRefrescarSolicitud();
  return useMutation({
    mutationFn: (texto: string) => api<SolicitudDetalle>("POST", `/solicitudes/${codigo}/mensajes`, { json: { texto } }),
    onSuccess: refrescar,
  });
}

// --- Dashboard y notificaciones ----------------------------------------------

export const useDashboard = (facultadId?: number) =>
  useQuery({ queryKey: qk.dashboard(facultadId), queryFn: () => api<Dashboard>("GET", "/dashboard", { query: { facultadId } }) });

export const useNotificaciones = () =>
  useQuery({
    queryKey: qk.notificaciones,
    queryFn: () => api<{ items: Notificacion[]; noLeidas: number }>("GET", "/notificaciones"),
    refetchInterval: 30_000,
  });

export function useMarcarLeidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: number) => (id ? api("POST", `/notificaciones/${id}/leida`) : api("POST", "/notificaciones/leer-todas")),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notificaciones }),
  });
}

// --- Administración ----------------------------------------------------------

export interface FiltroUsuarios { facultadId?: number | undefined; rol?: Rol | undefined; q?: string | undefined; page?: number | undefined; size?: number | undefined }

export const useUsuariosAdmin = (f: FiltroUsuarios) =>
  useQuery({ queryKey: qk.usuarios(f), queryFn: () => api<Pagina<Usuario>>("GET", "/admin/usuarios", { query: { ...f } }), placeholderData: keepPreviousData });

export const useFacultadesAdmin = (enabled = true) =>
  useQuery({ queryKey: qk.facultadesAdmin, queryFn: () => api<FacultadAdmin[]>("GET", "/admin/facultades"), enabled });

// Mutación genérica de administración: al terminar invalida todo lo administrable.
export function useAdmin<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of [["admin"], ["tipos"], ["areas"], ["facultades"]]) void qc.invalidateQueries({ queryKey: k });
    },
  });
}
