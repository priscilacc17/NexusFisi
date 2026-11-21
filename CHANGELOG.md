# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [1.0.0] — 2026-11-19 · Fase IV: calidad, observabilidad y release

### Agregado

- **Observabilidad:** métricas Prometheus en `/api/v1/metrics` (técnicas y de negocio, protegidas con `METRICS_TOKEN`), trazas OpenTelemetry con instrumentación de HTTP y MySQL, logs enlazados a las trazas por `trace_id`, y perfil `observabilidad` de docker compose con Prometheus, Grafana (tablero de 11 paneles) y Jaeger.
- **Alertas:** API caída, tasa de errores, latencia, memoria y solicitudes vencidas. Runbook de incidentes y simulacro documentado.
- **Monitoreo de producción:** workflow que verifica `/api/v1/health` cada 10 minutos.
- **Pruebas de aceptación E2E** con Playwright (11 escenarios + responsive), ejecutadas en el CI sobre la imagen de Render.
- **Pruebas de carga, estrés y pico** con k6 (`perf/`).
- **SAST:** CodeQL en el CI y análisis con Semgrep; **Dependabot** para npm y acciones.
- **DAST:** OWASP ZAP (baseline de la interfaz y escaneo activo de la API).
- Lint y formato (ESLint + Prettier) obligatorios en el CI.
- Documentación: informe de pruebas, observabilidad, revisión final, manual de usuario y manual técnico.

### Cambiado

- **Nuevo nombre: NEXUS — Núcleo de EXpediente Único Sanmarquino** (antes NexusFisi), acorde al alcance de toda la universidad. Cambian la interfaz, los correos, la documentación y los identificadores técnicos: cabecera anti-CSRF `x-nexus`, cookie `nexus_sesion`, métricas `nexus_*`, servicio `nexus-api` e imágenes `nexus-api`/`nexus-web`. Al desplegar, las sesiones abiertas se cierran una vez. Se conservan los nombres de la base de datos, los volúmenes, el servicio de Render y el repositorio, para no perder datos ni enlaces.

### Corregido

- El CD podía desplegar código de un PR desde un _fork_ (ahora exige un `push` a `main`).
- Los archivos estáticos se servían sin cabeceras de seguridad.
- La cookie que borra la sesión al salir no llevaba `HttpOnly` ni `SameSite`.
- El `X-Request-Id` recibido se copiaba a los logs sin validar.
- Cabeceras de seguridad duplicadas entre nginx y la API; `X-Frame-Options` unificado en `DENY`.

## [0.3.0] — 2026-11-14 · Fase III: API, nube y CI/CD

### Agregado

- API REST (Node 22 + Hono + TypeScript) con 29 rutas documentadas en OpenAPI 3.1 y capa **multi-facultad** de la UNMSM.
- MySQL 8.4 con migraciones versionadas (Drizzle), correlativo por facultad y bloqueo optimista.
- Sesión con JWT en cookie `HttpOnly` + protección CSRF, revocación por `token_version`, límite de intentos y bloqueo de cuenta.
- Recuperación de contraseña y avisos por correo (SMTP, Brevo o Resend).
- Adjuntos validados por contenido, en disco o en MySQL.
- Docker (API, interfaz, gateway nginx), despliegue en **Render** con Aiven MySQL y Brevo, alternativa en VM.
- CI/CD en GitHub Actions; flujo de ramas `feature/*` → `develop` → `main`.
- Pruebas unitarias y de integración contra MySQL real.

### Corregido

- Columna `updated_at` mal mapeada, orden de la bandeja, límite de login que bloqueaba a todo el campus, variables vacías que impedían arrancar y contexto FISI (Ingeniería de Sistemas e Informática).

## [0.2.0] — 2026-10-17 · Fase II: interfaz

- Interfaz inicial con Lovable (React + TanStack Start): roles, panel, catálogo, registro y seguimiento de solicitudes, con datos locales de demostración.
