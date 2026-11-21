# Revisión final de calidad — v1.0.0

Revisión de cierre exigida por la Fase IV: arquitectura, código, patrones, valores fijos (_hardcode_), secretos, manejo de errores, documentación, escenarios y uso de IA. Cada punto indica **qué se revisó, cómo, y el resultado**.

## 1. Arquitectura

| Aspecto             | Decisión                                                                                                              | Valoración                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Separación de capas | Interfaz (TanStack Start) y API REST (Hono) independientes; la interfaz solo habla con la API por HTTP.               | ✅ Se pueden desplegar juntas (Render) o separadas (VM) sin cambiar código.           |
| API por módulos     | `modules/<dominio>/{routes,service}.ts`: las rutas validan y responden; los servicios tienen la lógica.               | ✅ Ninguna ruta accede a la base directamente.                                        |
| Dominio aislado     | `domain/workflow.ts` (máquina de estados) y `domain/plazos.ts` (días hábiles) sin dependencias de HTTP ni de la base. | ✅ Se prueban con pruebas unitarias puras.                                            |
| Multi-facultad      | Cada solicitud, usuario, área y tipo pertenece a una facultad; `lib/alcance.ts` aplica el filtro en un solo lugar.    | ✅ Las pruebas verifican que otra facultad recibe 404, no 403 (no revela que existe). |
| Configuración       | Todo por variables de entorno validadas con Zod al arrancar (`config/env.ts`).                                        | ✅ Si falta algo o es inseguro, la API no levanta y dice qué falta.                   |
| Contrato            | OpenAPI 3.1 generado desde los mismos esquemas Zod que validan (`/api/docs`).                                         | ✅ La documentación no puede desfasarse del código.                                   |
| Observabilidad      | Logs, métricas y trazas opcionales, enlazados por `requestId`/`trace_id`.                                             | ✅ Ver [observabilidad.md](observabilidad.md).                                        |

Deuda conocida: la API corre en un solo proceso (techo medido ≈ 450 req/s, ver [informe de pruebas](informe-pruebas.md)); escalar requiere réplicas o _cluster_. Suficiente para una facultad, no para toda la universidad en matrícula.

## 2. Código

| Control                        | Herramienta                                                   | Resultado                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tipos estrictos                | TypeScript `strict` + `exactOptionalPropertyTypes` (interfaz) | 0 errores; el CI lo exige                                                                                                          |
| Estilo y errores comunes       | ESLint + Prettier                                             | 0 errores (quedan 10 avisos de _fast refresh_ en componentes de shadcn, sin efecto en producción). El CI lo exige desde esta fase. |
| Análisis estático de seguridad | CodeQL, Semgrep                                               | 0 hallazgos en el código de la aplicación                                                                                          |
| Dependencias vulnerables       | `npm audit`, Dependabot                                       | 0 altas o críticas                                                                                                                 |
| Pruebas                        | Vitest, Playwright                                            | 89 API + 12 frontend + 12 E2E, todas en verde                                                                                      |

En esta revisión se formatearon 113 archivos que no seguían el estilo del proyecto (sin cambios de comportamiento: tipos, pruebas y E2E se volvieron a ejecutar después) y se corrigió el único error de lint.

## 3. Patrones aplicados

| Patrón                     | Dónde                                                               | Para qué                                                                     |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Máquina de estados         | `domain/workflow.ts`                                                | Una tabla única define qué acción puede hacer cada rol en cada estado.       |
| Bloqueo optimista          | columna `version` en `solicitudes`                                  | Dos personas actuando a la vez: la segunda recibe 409 en vez de pisar datos. |
| Inyección de dependencias  | `Deps` (db, env, logger, mailer, storage) en `createApp`            | Las pruebas usan otra base y un correo falso sin tocar el código.            |
| Estrategia                 | `lib/storage.ts` (disco/MySQL), `lib/mailer.ts` (SMTP/Brevo/Resend) | Se cambia de proveedor con una variable, sin `if` dispersos.                 |
| Middleware / cadena        | autenticación, CSRF, límite de intentos, métricas                   | Las preocupaciones transversales no se mezclan con la lógica.                |
| Problem Details (RFC 9457) | `lib/errors.ts`                                                     | Todos los errores tienen el mismo formato `application/problem+json`.        |
| Repositorio / Query object | Drizzle ORM                                                         | Consultas tipadas y parametrizadas (sin SQL armado con texto).               |
| Gateway                    | nginx en `deploy/gateway`                                           | Un punto de entrada con TLS, límite por IP e identificador de petición.      |

## 4. Valores fijos (hardcode)

Búsqueda de URLs, puertos, credenciales y parámetros de negocio escritos en el código.

| Hallazgo                                                           | Decisión                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URLs y puertos                                                     | Ninguno en el código de la interfaz; la API los toma de `PUBLIC_URL`, `CORS_ORIGINS`, `PORT`, `API_INTERNAL_URL`. Los `localhost` que quedan son valores por defecto de desarrollo, sobrescribibles. |
| Límites (intentos de login, tamaño de archivo, expiración del JWT) | Variables: `AUTH_RATE_LIMIT`, `MAX_UPLOAD_MB`, `JWT_EXPIRES_IN`.                                                                                                                                     |
| Plazos y prioridades de los trámites                               | En la base (`tipos_tramite.plazo_dias`), editables por el administrador.                                                                                                                             |
| Feriados para los días hábiles                                     | Aún no se descuentan (el plazo se comunica como estimación, ver `domain/plazos.ts`). **Mejora futura:** tabla de feriados administrable por año.                                                     |
| Contraseña `Demo1234`                                              | Solo en el sembrado de demostración (`db/seed.ts`), que en producción real se desactiva (`SEED_DEMO_ON_START=false`).                                                                                |
| Límite de nginx (20 req/s por IP)                                  | En `nginx.conf`, que es configuración de despliegue, no código.                                                                                                                                      |

## 5. Secretos

| Control                                         | Resultado                                                                                                                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **gitleaks** sobre los 36 commits del historial | 2 coincidencias, ambas falsos positivos: el valor de ejemplo `reemplaza-esto-…` de `api/.env.example` (que la API **rechaza** en producción) y la prueba que verifica ese rechazo.     |
| Semgrep `p/secrets` sobre el árbol actual       | 0 hallazgos.                                                                                                                                                                           |
| `.env` en `.gitignore`                          | Sí (`api/.env`, `deploy/.env`). Solo se versionan los `.env.example` con valores de relleno.                                                                                           |
| Secretos de producción                          | Solo en las variables de Render (`JWT_SECRET` generado por Render, clave de Brevo, URL y CA de Aiven) y en los secretos del entorno `produccion` de GitHub (`RENDER_DEPLOY_HOOK_URL`). |
| Logs                                            | `authorization`, `password`, `passwordHash` y `token` se ocultan.                                                                                                                      |
| Métricas                                        | En producción exigen `METRICS_TOKEN`; sin él, el endpoint no existe.                                                                                                                   |

## 6. Manejo de errores

- **Un solo formato:** toda respuesta de error es `application/problem+json` con `status`, `code` y un mensaje en español para el usuario (por ejemplo `SOLICITUD_INVALIDA` con el detalle por campo, `NO_AUTENTICADO`, `PROHIBIDO`, `NO_ENCONTRADO`, `CONFLICTO`, `REGLA_DE_NEGOCIO`).
- **Sin filtrar detalles internos:** un error no controlado devuelve 500 con un mensaje genérico y el `requestId`; la pila solo va al log y a la traza. ZAP lo confirmó («Application Error Disclosure» aprobado).
- **Validación en el borde:** Zod valida cuerpo, parámetros y consulta antes de llegar al servicio; los archivos se validan por contenido (_magic bytes_), no por extensión.
- **Arranque seguro:** configuración inválida → la API no levanta y explica qué variable falla.
- **Interfaz:** el cliente HTTP convierte el _problem+json_ en mensajes legibles; una sesión vencida lleva al login; ante un 409 (otra persona cambió la solicitud) se recarga el expediente para mostrar su estado real.
- **Dependencias externas:** si el correo falla, la operación principal (por ejemplo, observar una solicitud) no se revierte; el fallo se registra en el log.

## 7. Documentación

| Documento                                                            | Público                         |
| -------------------------------------------------------------------- | ------------------------------- |
| [README](../README.md)                                               | Todos: qué es y cómo arrancarlo |
| [Manual de usuario](manual-usuario.md)                               | Estudiantes y personal          |
| [Manual técnico](manual-tecnico.md)                                  | Quien mantenga o despliegue     |
| [Arquitectura](arquitectura.md), [API](api.md)                       | Desarrolladores                 |
| [Seguridad](seguridad.md)                                            | Desarrolladores y revisores     |
| [Pruebas](pruebas.md), [Informe de pruebas](informe-pruebas.md)      | Equipo y docente                |
| [Observabilidad](observabilidad.md)                                  | Operación                       |
| [Despliegue en Render](despliegue-render.md), [en VM](despliegue.md) | Operación                       |
| [Flujo de Git](git-ramas.md), [CHANGELOG](../CHANGELOG.md)           | Equipo                          |
| [Registro de uso de IA](registro-ia.md)                              | Docente                         |

## 8. Escenarios

Los escenarios BDD de las historias de usuario están cubiertos en tres niveles: unitario (reglas del dominio), integración (API + MySQL) y aceptación (navegador). El detalle está en [pruebas.md](pruebas.md) y el resultado en el [informe de pruebas](informe-pruebas.md). Escenarios no funcionales verificados: concurrencia (bloqueo optimista y correlativo atómico), carga, estrés, abuso desde una IP, caída de la API (simulacro de incidente) y aislamiento entre facultades.

## 9. Uso de IA

La IA (Lovable para la interfaz inicial y Claude Code para el resto) se usó como asistente de desarrollo; cada uso está en el [registro de uso de IA](registro-ia.md) con su validación. Revisión de esta fase:

- **Todo lo generado pasó por las mismas puertas que el código humano:** tipos, lint, 113 pruebas automáticas, SAST, DAST y revisión del equipo.
- **Errores de la IA detectados en la revisión** (ejemplos de las fases III y IV): una columna mal mapeada (`updated_at`), un límite de login que bloqueaba a todo el campus, la cookie de _logout_ sin atributos y archivos estáticos sin cabeceras. Todos se detectaron con pruebas o escáneres, no por confianza.
- **Secretos y la IA:** para configurar el despliegue se pegaron en el chat con la IA credenciales reales (contraseña de aplicación de Gmail, contraseña de Aiven, clave de Brevo). Nunca se versionaron, pero contradice el criterio 2 del registro de IA: **antes de cerrar el curso se rotan las tres** y en adelante se cargan directamente en Render sin pasar por el asistente.
- **Historial honesto:** no se reescribió el historial de Git ni se alteraron fechas de commits; las ramas y merges reflejan el trabajo real.
- **Pendiente del equipo:** completar la columna «Responsable» del registro con el integrante que revisó cada uso.

## Veredicto

Sin defectos abiertos de severidad media o alta. Deuda técnica conocida y aceptada: escalado horizontal de la API, feriados no descontados en los plazos y _tags_ de acciones de GitHub sin fijar por SHA (mitigado con Dependabot). **Se aprueba la liberación de la versión 1.0.0.**
