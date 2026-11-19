# NexusFisi

Plataforma web para **registrar, gestionar, priorizar, atender y monitorear los trámites académicos de las facultades de la Universidad Nacional Mayor de San Marcos (UNMSM)**.

Cada facultad tiene su propio catálogo de trámites, sus áreas responsables, su personal y su numeración de expedientes (`FISI-2026-00001`, `FM-2026-00001`…). El personal de una facultad nunca ve ni modifica las solicitudes de otra. Un administrador central gestiona las facultades y ve los indicadores de toda la universidad.

> Proyecto del curso _Taller de Construcción de Software Web_ — propuesta «TrámiteUni» adaptada a la UNMSM. El enunciado está en [`docs/presentacion/`](docs/presentacion/).
>
> La interfaz se generó inicialmente con Lovable y el repositorio sigue conectado a su editor, pero **la aplicación no depende de Lovable para funcionar ni para desplegarse**: se construye como imágenes Docker y corre en Render o en cualquier servidor con Docker.

## Arquitectura

```
Navegador ──HTTPS──▶ Gateway nginx ──/api/*──▶ API REST (Node + Hono + TypeScript) ──▶ MySQL 8.4
                         │                          │
                         └──── / ────▶ Frontend      └─ adjuntos en volumen privado
                                     (React + TanStack Start)
```

| Capa           | Tecnología                                                                              | Carpeta                                            |
| -------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Frontend       | React 19, TypeScript, TanStack Router/Start, TanStack Query, Tailwind CSS, Radix/shadcn | [`src/`](src/)                                     |
| API REST       | Node 22, Hono, Zod + OpenAPI 3.1, JWT (jose), bcrypt, Drizzle ORM                       | [`api/`](api/)                                     |
| Base de datos  | MySQL 8.4, migraciones versionadas                                                      | [`api/drizzle/`](api/drizzle/)                     |
| Despliegue     | Docker, docker compose, nginx como API gateway                                          | [`deploy/`](deploy/)                               |
| CI/CD          | GitHub Actions → Render (deploy hook) / GHCR → VM                                       | [`.github/workflows/`](.github/workflows/)         |
| Observabilidad | Prometheus, Grafana, OpenTelemetry + Jaeger, logs JSON (pino)                           | [`deploy/observabilidad/`](deploy/observabilidad/) |

El stack del enunciado (Spring Boot) era referencial: se eligió **TypeScript de punta a punta** para compartir lenguaje, tipos y validaciones entre frontend y API. La justificación está en [docs/arquitectura.md](docs/arquitectura.md).

## Funcionalidades

- **Autenticación:** registro de estudiantes con correo `@unmsm.edu.pe`, sesión con JWT en cookie `HttpOnly` y protección CSRF, cambio y **recuperación de contraseña por correo**, bloqueo tras 5 intentos fallidos y cierre inmediato de sesión al desactivar una cuenta.
- **Avisos por correo** cuando una solicitud se observa, se resuelve o se asigna.
- **Roles:** Estudiante, Técnico, Supervisor y Administrador (de facultad o central).
- **Registro de solicitudes:** código único por facultad, tipo, descripción, ubicación del área que atiende, prioridad, plazo en días hábiles, responsable, evidencias (PDF, JPG, PNG validados por contenido) y comentarios.
- **Gestión:** flujo `Registrada → En evaluación → Asignada → En atención → Resuelta → Cerrada`, con observación y corrección, reasignación, desistimiento y reapertura (una vez). Historial completo y notificaciones.
- **Dashboard:** registradas, pendientes, atendidas, vencidas, % resueltas, tiempo promedio de atención, y conteos por estado, categoría, prioridad, responsable y facultad.
- **Administración:** usuarios y roles, tipos de trámite, áreas responsables, facultades y escuelas, y referencia de estados y prioridades.

## Puesta en marcha (desarrollo)

Requisitos: Node 22, Docker y [Bun](https://bun.sh) (o `npx bun`).

```bash
# 1. Base de datos local (MySQL en 127.0.0.1:3317, incluye la base de pruebas)
docker compose -f deploy/docker-compose.dev.yml up -d

# 2. API (http://localhost:4000, documentación en http://localhost:4000/api/docs)
cd api
cp .env.example .env            # genera un JWT_SECRET propio
npm install
npm run db:seed                 # migra y carga datos de demostración
npm run dev

# 3. Frontend (en otra terminal, desde la raíz)
bun install
bun run dev                     # /api se redirige a la API local
```

### Cuentas de demostración

Contraseña de todas: `Demo1234`. Son datos ficticios, no personas reales.

| Rol                              | Correo                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Estudiante (FISI)                | `estudiante.fisi@unmsm.edu.pe`, `estudiante2.fisi@unmsm.edu.pe`                                                  |
| Técnico (FISI)                   | `tecnico.fisi@unmsm.edu.pe`, `tecnico2.fisi@unmsm.edu.pe`                                                        |
| Supervisor (FISI)                | `supervisor.fisi@unmsm.edu.pe`                                                                                   |
| Administrador de facultad (FISI) | `admin.fisi@unmsm.edu.pe`                                                                                        |
| Administrador central            | `admin.central@unmsm.edu.pe`                                                                                     |
| Medicina / Derecho               | `estudiante.fm@…`, `supervisor.fm@…`, `tecnico.fm@…`, `estudiante.fdcp@…`, `supervisor.fdcp@…`, `tecnico.fdcp@…` |

## Pruebas

```bash
cd api && npm test                       # 89 pruebas: unitarias + integración contra MySQL real
npx vitest run                           # frontend: 12 pruebas
cd e2e && npx playwright test            # 12 pruebas de aceptación en navegador (stack levantado)
```

Además: carga y estrés con k6, SAST (CodeQL, Semgrep) y DAST (OWASP ZAP). Resultados en el [informe de pruebas](docs/informe-pruebas.md); estrategia y escenarios BDD en [docs/pruebas.md](docs/pruebas.md).

## Despliegue

**Render (Docker):** el repositorio incluye [`render.yaml`](render.yaml) y la imagen [`Dockerfile.render`](Dockerfile.render). Paso a paso en [docs/despliegue-render.md](docs/despliegue-render.md).

**VM propia con docker compose:**

```bash
cd deploy
cp .env.example .env    # completa contraseñas y JWT_SECRET
docker compose up -d --build
docker compose exec api node dist/db/seed.js   # solo en entornos de demostración
docker compose --profile observabilidad up -d  # opcional: Prometheus, Grafana y Jaeger
```

Guía completa (VM, TLS, CI/CD, respaldos) en [docs/despliegue.md](docs/despliegue.md).

## Documentación

- [Manual de usuario](docs/manual-usuario.md)
- [Manual técnico](docs/manual-tecnico.md)
- [Arquitectura y modelo de datos](docs/arquitectura.md)
- [API REST](docs/api.md) — referencia interactiva en `/api/docs`
- [Seguridad (OWASP)](docs/seguridad.md)
- [Pruebas](docs/pruebas.md) e [informe de pruebas de la Fase IV](docs/informe-pruebas.md)
- [Observabilidad y gestión de incidentes](docs/observabilidad.md)
- [Revisión final de calidad](docs/revision-final.md)
- [Despliegue en Render](docs/despliegue-render.md)
- [Despliegue en VM y ambientes](docs/despliegue.md)
- [Flujo de ramas](docs/git-ramas.md)
- [Registro de uso de IA](docs/registro-ia.md)
- [Registro de cambios](CHANGELOG.md)
