# Despliegue y ambientes

> **¿Render?** Sigue [despliegue-render.md](despliegue-render.md). Esta guía cubre la alternativa con una VM propia y `docker compose`.

## Ambientes

| Ambiente | Dónde | Base de datos | Cómo se activa |
|---|---|---|---|
| **Desarrollo** | Equipo de cada integrante | MySQL en Docker (`deploy/docker-compose.dev.yml`, 127.0.0.1:3317) | `npm run dev` (API) + `bun run dev` (frontend), con `api/.env` |
| **Prueba** | GitHub Actions | Servicio MySQL efímero del pipeline | Cada push / pull request a `develop` o `main` |
| **Producción** | VM con Docker | Contenedor MySQL con volumen persistente | Push a `main` (CD) o `docker compose up -d` manual |

La configuración cambia solo por variables de entorno (`NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, etc.), nunca editando código.

## Plataforma cloud

Se eligió una **VM con Docker** (Huawei Cloud, Azure, AWS o cualquier VPS):

- Una sola máquina con 2 vCPU y 4 GB de RAM alcanza para el MVP.
- La misma `docker compose` corre igual en local y en la nube.
- No depende de servicios propietarios de un proveedor.
- El TLS se resuelve en el borde con **Cloudflare** (proxy con DNS) o con **certbot** en la VM.

## Primer despliegue en la VM

```bash
# En la VM (Ubuntu o HCE), con Docker instalado
sudo mkdir -p /opt/nexusfisi && cd /opt/nexusfisi
# Copiar desde el repositorio la carpeta deploy/ (docker-compose.yml, gateway/, .env.example)
cp .env.example .env
nano .env        # MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, JWT_SECRET (openssl rand -base64 48), PUBLIC_URL
docker compose pull          # imágenes publicadas por CD en ghcr.io
docker compose up -d
docker compose ps            # mysql, api y web deben quedar "healthy"
curl http://localhost/api/v1/health
# Solo en una demostración: datos de ejemplo
docker compose exec api node dist/db/seed.js
```

Si las imágenes de GHCR son privadas, primero `docker login ghcr.io` con un token con permiso `read:packages`.

**Firewall:** abrir solo 80 (y 443 si el TLS se termina en la VM). MySQL no publica puertos.

**HTTPS obligatorio para iniciar sesión:** la cookie de sesión es `Secure` en producción, así que el navegador no la guarda por `http://` (salvo en `localhost`). Configura TLS (siguiente sección). Para una prueba rápida sin TLS, pon `COOKIE_SECURE=false` en `.env` y nunca lo dejes así en producción.

### HTTPS

- **Con Cloudflare:** un registro A apuntando a la VM, con proxy (nube naranja) y modo SSL «Full». En el firewall, el 80 se abre solo a los rangos de IP de Cloudflare.
- **Con certbot:** agregar un bloque `listen 443 ssl` al gateway con los certificados de Let's Encrypt y redirigir el 80 al 443.

## CI/CD

```
feature/* ──PR──▶ develop ──PR──▶ main ──▶ CD: imágenes → ghcr.io ──SSH──▶ VM: compose pull && up -d ──▶ verificación /health
     └──────────── CI en cada push y PR: tipos · pruebas (MySQL real) · auditoría · build · imágenes ────────────┘
```

- **[`ci.yml`](../.github/workflows/ci.yml):**
  - API: chequeo de tipos, verificación de migraciones, pruebas contra MySQL, `npm audit` y build.
  - Frontend: chequeo de tipos, pruebas y build.
  - Construcción de ambas imágenes Docker.
- **[`cd.yml`](../.github/workflows/cd.yml):**
  - Publica `nexusfisi-api` y `nexusfisi-web` en GHCR, con las etiquetas `latest` y `rama-sha`.
  - Despliega por SSH en el entorno protegido `produccion` y verifica `/api/v1/health`. Si la API no responde, el job falla y muestra los logs.

Secretos del entorno `produccion` en GitHub (*Settings → Environments*): `VM_HOST`, `VM_USER`, `VM_SSH_KEY` y opcionalmente `VM_PATH`. Sin `VM_HOST`, el CD publica las imágenes y omite el despliegue con un aviso.

### Volver a una versión anterior

```bash
cd /opt/nexusfisi
sed -i 's/^TAG=.*/TAG=main-abc1234/' .env   # etiqueta anterior (ver paquetes en GitHub)
docker compose pull && docker compose up -d
```

Las migraciones solo agregan; si una versión nueva cambió el esquema, revisar antes de volver atrás.

## Respaldos

```bash
# Base de datos
docker compose exec -T mysql sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction nexusfisi' | gzip > respaldo-$(date +%F).sql.gz
# Adjuntos
docker run --rm -v nexusfisi_uploads:/data -v "$PWD":/out alpine tar czf /out/adjuntos-$(date +%F).tgz -C /data .
```

## Operación

- **Logs:** `docker compose logs -f api`. Son JSON, una línea por petición con `requestId`, método, ruta, estado y duración.
- **Estado:** `GET /api/v1/health` responde 503 si la base no está disponible, y Docker marca el contenedor como *unhealthy*.
- **Reinicio:** `restart: unless-stopped` en todos los servicios.
