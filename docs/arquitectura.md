# Arquitectura de NexusFisi

## Vista general

```
                 ┌──────────────────────────── VM (docker compose) ────────────────────────────┐
 Navegador ─────▶│ gateway (nginx :80)                                                          │
  (HTTPS vía     │   ├─ /api/*  ──▶ api  (Node 22 + Hono, :4000) ──▶ mysql (8.4, red interna)   │
   Cloudflare    │   │                └─ volumen "uploads" (adjuntos, fuera de la web)          │
   o certbot)    │   └─ /       ──▶ web  (TanStack Start, servidor Node :3000)                  │
                 └──────────────────────────────────────────────────────────────────────────────┘
```

- **Gateway (nginx):** único puerto expuesto. Enruta, limita peticiones por IP (20 r/s con ráfaga de 40), fija el tamaño máximo de cuerpo (30 MB) y añade cabeceras de seguridad y CSP. Cumple el papel de *API Gateway* del curso.
- **API REST:** arquitectura por capas.
  - **Rutas** (`modules/*/routes.ts`): HTTP, validación con Zod y documentación OpenAPI.
  - **Servicios** (`modules/*/service.ts`): reglas de negocio y autorización.
  - **Dominio** (`domain/`): máquina de estados y plazos, sin dependencias de infraestructura.
  - **Datos** (`db/`): esquema Drizzle y migraciones.
- **Frontend:** React con TanStack Router (rutas por archivo) y TanStack Query (caché e invalidación). No contiene reglas de negocio: muestra lo que la API autoriza.
- **Base de datos:** MySQL sin puerto publicado; solo la API la alcanza por la red interna de Docker.

### ¿Por qué TypeScript y no Spring Boot?

El enunciado propone Spring Boot como arquitectura *posible*. El equipo eligió Node + TypeScript porque:

1. Un solo lenguaje en todo el sistema: los tipos de la API y del frontend se leen igual y las validaciones (Zod) se escriben una vez.
2. Hono genera la documentación OpenAPI desde las mismas definiciones que validan las peticiones, así que la documentación no puede desincronizarse del código.
3. Se mantienen los conceptos que pide el curso: controladores (rutas), servicios, DTO (esquemas Zod), validaciones, arquitectura por capas y conexión a MySQL.

## Modelo de datos: la capa de facultades

```
Universidad (UNMSM, única)
 └── Facultad ─┬── Escuela profesional ── Estudiante
               ├── Área responsable ──┬── Técnico / Supervisor
               │                      └── Tipo de trámite ── Solicitud
               └── Secuencia anual (correlativo de expedientes)
```

| Tabla | Propósito |
|---|---|
| `facultades` | Las 20 facultades de la UNMSM. El `codigo` (FISI, FM…) forma parte del código de expediente. |
| `escuelas` | Escuelas profesionales de cada facultad (obligatoria al registrarse si la facultad tiene). |
| `areas` | Oficinas que atienden trámites, con su **ubicación**. |
| `usuarios` | Rol, facultad (NULL solo para el administrador central), área o escuela, contador de intentos y `token_version`. |
| `tipos_tramite` | Categorías: requisitos (JSON), plazo en días hábiles y área que los atiende. |
| `solicitudes` | Expediente: estado, estado previo, prioridad, responsable, respuesta, tipo de cierre, plazo y **versión** (bloqueo optimista). |
| `adjuntos` | Evidencias por etapa (registro, corrección, resultado), guardadas con nombre aleatorio. |
| `observaciones`, `movimientos`, `mensajes`, `notificaciones` | Comentarios, historial, conversación y avisos. |
| `secuencias` | Correlativo por facultad y año. |

## Flujo de una solicitud

```
REGISTRADA ─evaluar─▶ EN_EVALUACION ─asignar─▶ ASIGNADA ─iniciar─▶ EN_ATENCION ─resolver─▶ RESUELTA ─cerrar─▶ CERRADA
                         │   ▲                   ▲   │ reasignar       │   ▲                    │
                 observar│   │corregir           └───┘                 │   │corregir            └─reabrir (1 vez)
                         ▼   │                                 observar▼   │
                       OBSERVADA                                     OBSERVADA

 El estudiante puede DESISTIR (→ CERRADA) mientras la solicitud no esté asignada.
```

| Acción | Quién | Desde |
|---|---|---|
| Evaluar | Supervisor de la facultad | Registrada |
| Observar | Supervisor (en evaluación o atención) o responsable (en atención) | En evaluación / En atención |
| Asignar / reasignar | Supervisor | En evaluación / Asignada / En atención |
| Iniciar atención | Responsable asignado | Asignada |
| Resolver (exige respuesta) | Responsable o supervisor | En atención |
| Cerrar | Estudiante (conformidad) o supervisor | Resuelta |
| Corregir | Estudiante dueño | Observada → vuelve al estado desde el que se observó |
| Desistir | Estudiante dueño | Registrada / En evaluación / Observada |
| Reabrir (una vez) | Estudiante dueño | Resuelta → En atención con el mismo responsable |
| Priorizar | Supervisor | Cualquier estado no terminado |

El administrador (de facultad o central) **consulta pero no actúa** en el flujo: separa la configuración de la operación.

## Decisiones que corrigen problemas lógicos

| Problema | Decisión |
|---|---|
| La interfaz mostraba acciones que el servidor podía rechazar. | La API devuelve `acciones` permitidas para el usuario actual, y el frontend solo dibuja esas. Las reglas viven en un solo lugar (`domain/workflow.ts`). |
| Una corrección reiniciaba todo el flujo aunque la observación viniera de la etapa de atención. | `estado_previo`: la corrección devuelve la solicitud al punto exacto donde se observó, con el mismo técnico. |
| Dos personas podían cambiar la misma solicitud a la vez y pisarse. | Bloqueo optimista con `version`: el segundo cambio recibe **409** y la interfaz recarga el estado real. |
| Dos registros simultáneos podían obtener el mismo código. | Correlativo atómico por facultad y año (`INSERT … ON DUPLICATE KEY UPDATE` con `LAST_INSERT_ID`). Hay prueba con registros en paralelo. |
| Se podía "resolver" sin responder, o responder sin resolver. | Resolver exige la respuesta en la misma acción. |
| Una solicitud resuelta y luego reabierta seguía contando como atendida. | Reabrir borra `resuelta_at`: los indicadores la vuelven a contar como pendiente. |
| Las desistidas bajaban el porcentaje de resolución de la oficina. | El % de resueltas excluye las desistidas. |
| Desactivar a un técnico dejaba solicitudes huérfanas. | Se rechaza desactivarlo o cambiarle el rol mientras tenga solicitudes en curso. |
| Una cuenta desactivada seguía operando hasta que vencía su token. | Cada petición recarga al usuario y compara `token_version`. |
| Eliminar un tipo de trámite borraba el historial. | Con solicitudes registradas responde 409 y sugiere desactivarlo. |
| Límite de intentos por IP bloqueaba a todo el campus (IP compartida). | El límite de login es por IP + correo; el bloqueo por cuenta es independiente. |
| Un estudiante podía solicitar un trámite de otra facultad. | Validación en el servicio: el tipo debe ser de su facultad. |
| Plazos calculados con la hora del servidor (UTC). | Días hábiles contados con el calendario de Lima. |
