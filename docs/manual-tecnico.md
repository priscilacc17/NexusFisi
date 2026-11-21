# Manual técnico — NEXUS v1.0.0

Guía para quien **mantenga, despliegue u opere** NEXUS. Reúne lo esencial y enlaza al detalle.

## 1. Visión general

```
Navegador ──HTTPS──▶ nginx (gateway) ──/api/*──▶ API REST Node 22 + Hono ──▶ MySQL 8.4
                        │   20 req/s por IP           │  ├─ adjuntos: disco o MySQL
                        └── / ──▶ Interfaz SSR         │  ├─ correo: SMTP / Brevo / Resend
                                  (TanStack Start)     │  └─ métricas, logs, trazas (opcional)
```

| Componente | Tecnología                                                           | Carpeta                                   |
| ---------- | -------------------------------------------------------------------- | ----------------------------------------- |
| Interfaz   | React 19, TanStack Start/Router/Query, Tailwind, shadcn/Radix        | `src/`                                    |
| API        | Hono + @hono/zod-openapi, Drizzle ORM (mysql2), jose, bcryptjs, pino | `api/src/`                                |
| Base       | MySQL 8.4, migraciones versionadas                                   | `api/drizzle/`                            |
| Despliegue | Docker, docker compose, nginx, Render (`Dockerfile.render`)          | `deploy/`, raíz                           |
| CI/CD      | GitHub Actions                                                       | `.github/workflows/`                      |
| Pruebas    | Vitest, Testing Library, Playwright, k6, ZAP, Semgrep                | `api/test/`, `src/test/`, `e2e/`, `perf/` |

Detalle del diseño y del modelo de datos: [arquitectura.md](arquitectura.md). Referencia de la API: [api.md](api.md) y `/api/docs` (Swagger) en cualquier instancia.

## 2. Estructura del código de la API

```
api/src/
├─ index.ts            arranque: configuración → base → migraciones → servidor
├─ telemetria.ts       OpenTelemetry (se carga con node --import, antes que todo)
├─ app.ts              composición: middlewares, módulos, errores, /health, /metrics
├─ config/env.ts       variables de entorno validadas con Zod
├─ db/                 esquema Drizzle, cliente, migraciones, datos de demostración
├─ domain/             reglas puras: workflow.ts (estados y permisos), plazos.ts
├─ auth/               contraseñas, JWT, middleware de sesión y CSRF
├─ lib/                errores, alcance por facultad, límite de intentos, almacenamiento,
│                      correo, logger, métricas, trazas, OpenAPI
└─ modules/            auth, usuarios, catalogo, solicitudes, notificaciones, dashboard, admin
                       (cada uno: routes.ts = contrato HTTP; service.ts = lógica)
```

**Agregar un endpoint:** definir la ruta con `createRoute` (esquemas Zod de entrada y salida) en el `routes.ts` del módulo, implementar la lógica en `service.ts` usando `alcance` para filtrar por facultad, y agregar su prueba de integración. El OpenAPI se actualiza solo.

**Cambiar el esquema:** editar `db/schema.ts` y ejecutar `npm run db:generate`; se crea una migración en `api/drizzle/` que se versiona. El CI falla si el esquema cambia sin su migración. Las migraciones se aplican solas al arrancar (`MIGRATE_ON_START=true`).

**Cambiar el flujo:** la tabla de transiciones y permisos está en `domain/workflow.ts`; sus pruebas unitarias (`test/unit/workflow.test.ts`) documentan cada regla.

## 3. Entorno de desarrollo

Requisitos: Node 22, Docker y Bun.

```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # MySQL 127.0.0.1:3317 (+ base de pruebas)
cd api && cp .env.example .env && npm install && npm run db:seed && npm run dev   # :4000
cd .. && bun install && bun run dev                     # interfaz; /api → :4000
```

| Comando (en `api/`)   | Hace                                       |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | API con recarga y telemetría (si hay OTLP) |
| `npm test`            | 89 pruebas unitarias + integración (MySQL) |
| `npm run typecheck`   | Tipos                                      |
| `npm run db:generate` | Nueva migración desde el esquema           |
| `npm run db:seed`     | Migra y carga datos de demostración        |

En la raíz: `npx vitest run` (frontend), `npx eslint .`, `npx prettier --check .`. En `e2e/`: `npx playwright test`.

## 4. Configuración

Toda la configuración es por variables de entorno ([`api/src/config/env.ts`](../api/src/config/env.ts) es la fuente de verdad). Una variable vacía cuenta como no definida.

| Grupo          | Variables principales                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Servidor       | `NODE_ENV`, `PORT`, `PUBLIC_URL`, `CORS_ORIGINS`, `TRUST_PROXY`, `LOG_LEVEL`                                                 |
| Base           | `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_SSL_CA`, `MIGRATE_ON_START`, `SEED_DEMO_ON_START`                                  |
| Sesión         | `JWT_SECRET` (≥ 32 caracteres; se rechaza el de ejemplo en producción), `JWT_EXPIRES_IN`, `COOKIE_SECURE`, `AUTH_RATE_LIMIT` |
| Archivos       | `STORAGE_DRIVER` (`disk`/`db`), `UPLOAD_DIR`, `MAX_UPLOAD_MB`                                                                |
| Correo         | `MAIL_PROVIDER` (`smtp`/`brevo`/`resend`), `MAIL_API_KEY`, `SMTP_*`, `MAIL_FROM`, `MAIL_REDIRECT_TO`, `MAIL_NOTIFICACIONES`  |
| Observabilidad | `METRICS_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`                                                          |

En la interfaz: `API_INTERNAL_URL` (a dónde reenvía `/api` el servidor SSR) y `NITRO_PRESET=node-server` al construir para Docker.

## 5. Ambientes y despliegue

| Ambiente    | Dónde                                     | Cómo                                             |
| ----------- | ----------------------------------------- | ------------------------------------------------ |
| Desarrollo  | Equipo de cada integrante                 | Sección 3                                        |
| Prueba      | GitHub Actions                            | Cada push / PR: MySQL efímero, pruebas, E2E      |
| Producción  | **Render** (Docker) + Aiven MySQL + Brevo | Merge a `main` → CI → CD → deploy hook de Render |
| Alternativa | VM con `docker compose`                   | Imágenes de GHCR, despliegue por SSH             |

- Render: [despliegue-render.md](despliegue-render.md).
- VM, TLS y respaldos: [despliegue.md](despliegue.md).

### Pipeline

| Workflow                                              | Cuándo                             | Qué hace                                                                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`ci.yml`](../.github/workflows/ci.yml)               | push y PR a `main`/`develop`       | API: tipos, migraciones, 89 pruebas con MySQL, `npm audit`, build. Interfaz: tipos, **lint y formato**, pruebas, build. Imágenes Docker. **E2E con Playwright** sobre la imagen de Render. |
| [`cd.yml`](../.github/workflows/cd.yml)               | CI exitoso de un **push** a `main` | Deploy hook de Render con el SHA exacto y espera a `/api/v1/health`; imágenes a GHCR; VM opcional.                                                                                         |
| [`codeql.yml`](../.github/workflows/codeql.yml)       | push, PR y semanal                 | SAST de CodeQL (JS/TS).                                                                                                                                                                    |
| [`monitoreo.yml`](../.github/workflows/monitoreo.yml) | cada 10 min (horario de atención)  | Verifica la salud de producción; falla y avisa si no responde.                                                                                                                             |
| Dependabot                                            | semanal                            | PRs de actualización de dependencias y acciones.                                                                                                                                           |

Flujo de ramas (`feature/*` → `develop` → `main`): [git-ramas.md](git-ramas.md).

## 6. Operación

- **Salud:** `GET /api/v1/health` → `{"status":"ok","db":"ok"}` (503 si la base no responde).
- **Logs, métricas, trazas, alertas e incidentes:** [observabilidad.md](observabilidad.md).
- **Respaldo de la base:** en la VM, `docker compose exec mysql mysqldump …` (ver [despliegue.md](despliegue.md)); en Aiven, los respaldos automáticos del servicio.
- **Rotar `JWT_SECRET`:** cambiarla cierra todas las sesiones (todas las firmas dejan de ser válidas).
- **Revertir un despliegue:** Render → _Events_ → _Rollback_; VM → `docker compose up -d` con el tag anterior.

## 7. Seguridad

Controles implementados y su relación con OWASP Top 10: [seguridad.md](seguridad.md). Resultado de SAST y DAST: [informe-pruebas.md](informe-pruebas.md#5-seguridad--sast-análisis-estático).

## 8. Rendimiento

Medido con k6 ([informe](informe-pruebas.md#7-pruebas-de-carga-y-de-estrés)): con 50 usuarios simultáneos p95 = 9,6 ms; techo de ≈ 450 req/s por proceso. Para escalar: varias réplicas de `api` tras el gateway (la API no guarda estado en memoria salvo el contador de intentos de login, que en ese caso conviene llevar a la base o a Redis).

## 9. Problemas frecuentes

| Síntoma                                                     | Causa probable / solución                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| La API no arranca: «Configuración inválida: …»              | Falta o es inválida la variable indicada.                                                             |
| `db: "error"` en `/health`                                  | MySQL caído o inaccesible; en Aiven revisar `DATABASE_SSL_CA` y que la URL tenga el puerto correcto.  |
| No salen correos en Render                                  | Render gratis bloquea SMTP 25/465/587: usar `MAIL_PROVIDER=brevo` o SMTP de Brevo por el puerto 2525. |
| Desde la red de la universidad u oficina no conecta a Aiven | Puertos no estándar bloqueados en esa red; desde Render funciona.                                     |
| 403 en un POST desde un cliente propio                      | Falta la cabecera anti-CSRF `x-nexus: 1` (con cookie) o usar `Authorization: Bearer`.                 |
| 429                                                         | Límite de nginx (20 req/s por IP) o de intentos de login (`AUTH_RATE_LIMIT`).                         |
| Lint con miles de errores «Delete ␍» en Windows             | No debería pasar: `.prettierrc` usa `endOfLine: auto`. Si aparece, revisar `core.autocrlf`.           |
