# Despliegue en Render (Docker)

NexusFisi se despliega en Render como **un servicio web Docker** construido con [`Dockerfile.render`](../Dockerfile.render). La imagen contiene la API y la interfaz:

```
Navegador ──HTTPS──▶ Render (nexusfisi.onrender.com, $PORT)
                        └─ contenedor
                             ├─ interfaz (TanStack Start)  ── /api/* ──▶  API (Hono, 127.0.0.1:4000) ──TLS──▶ MySQL externo
                             └─ adjuntos guardados en MySQL (Render gratis no tiene disco persistente)
```

Ventajas de un solo servicio:

- **Un solo dominio:** la cookie de sesión funciona sin configurar CORS ni cookies de terceros.
- **Sin red privada:** no depende de la red privada de Render, que el plan gratuito limita.
- **Una sola URL** para el equipo y para la sustentación.

## 1. Base de datos MySQL

Render no ofrece MySQL administrado. Opciones:

| Opción | Costo | Notas |
|---|---|---|
| **Aiven for MySQL** (plan gratuito) | Gratis | Recomendado para el curso. Exige TLS: `DATABASE_SSL=true` y pegar su *CA certificate* en `DATABASE_SSL_CA`. Verifica que el plan gratuito siga disponible al crearlo. |
| MySQL como *private service* en Render | De pago (necesita disco) | Bloque comentado al final de [`render.yaml`](../render.yaml). |
| Cualquier MySQL 8 accesible por internet con TLS | Variable | Solo hay que cambiar `DATABASE_URL`. |

Con Aiven:

1. Crea el servicio MySQL en la región más cercana a la que elegiste en Render.
2. Copia la *Service URI* tal cual (`mysql://avnadmin:…@….aivencloud.com:PUERTO/defaultdb?ssl-mode=REQUIRED`): la API entiende `ssl-mode` y activa TLS.
3. Descarga el *CA certificate*.

Las tablas las crea la propia API al arrancar (migraciones automáticas): no hay que ejecutar nada en la base.

> Algunas redes corporativas o universitarias bloquean la salida a puertos no estándar (Aiven usa uno alto, p. ej. 16370). Si desde tu equipo no conecta, no afecta a Render: allí la salida no está restringida.

## 2. Contraseña de aplicación de Gmail

Los correos (recuperación de contraseña y avisos) se envían por SMTP de Gmail. Gmail **no acepta la contraseña normal** de la cuenta:

1. En la cuenta de Gmail que enviará los correos, activa la verificación en dos pasos.
2. Ve a <https://myaccount.google.com/apppasswords> y crea una contraseña de aplicación con el nombre «NexusFisi».
3. Usa esos 16 caracteres en `SMTP_PASS`.

**Nunca escribas esa contraseña en el repositorio**: va solo en las variables de Render. Si alguna vez quedó escrita en otro lugar (un chat, un documento), revócala en la misma página y crea otra.

## 3. Crear el servicio con el Blueprint

1. Sube el repositorio a GitHub.
2. En Render: **New → Blueprint**, elige el repositorio. Render lee [`render.yaml`](../render.yaml).
3. Completa las variables que pide:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La *Service URI* de Aiven, tal cual. |
| `DATABASE_SSL_CA` | Contenido del *CA certificate* (PEM completo, `-----BEGIN CERTIFICATE-----…`). |
| `PUBLIC_URL` y `CORS_ORIGINS` | Pueden quedar **vacías**: la API usa la URL pública que Render inyecta (`RENDER_EXTERNAL_URL`). Defínelas solo si usas un dominio propio. |
| `SMTP_USER` | La cuenta de Gmail que envía. |
| `SMTP_PASS` | La contraseña de aplicación. |
| `MAIL_FROM` | `NexusFisi <cuenta@gmail.com>` |
| `MAIL_REDIRECT_TO` | **En una demo:** tu casilla, para que los correos de las cuentas ficticias te lleguen a ti. **En producción real:** déjalo vacío. |

`JWT_SECRET` lo genera Render automáticamente. `SEED_DEMO_ON_START=true` carga los datos de demostración la primera vez (con la base vacía); en una instalación real ponlo en `false`.

4. **Deploy.** El primer build tarda varios minutos. Cuando el estado sea *Live*, abre la URL y entra con `estudiante.fisi@unmsm.edu.pe` / `Demo1234`.

## 4. Despliegue continuo

El `render.yaml` deja `autoDeploy: false` a propósito: quien despliega es el pipeline, y solo si el CI pasó.

1. En Render: servicio → **Settings → Deploy Hook** → copia la URL.
2. En GitHub: **Settings → Environments → `produccion`**:
   - Secreto `RENDER_DEPLOY_HOOK_URL` con esa URL.
   - Variable `PUBLIC_URL` con la URL pública (el pipeline la usa para verificar que la nueva versión responde).
3. Cada merge a `main` dispara el CI (tipos, pruebas contra MySQL, auditoría, builds e imágenes). Si todo pasa, [`cd.yml`](../.github/workflows/cd.yml) pide a Render desplegar **ese commit exacto** y espera a que `/api/v1/health` responda.

## 5. Limitaciones del plan gratuito

- El servicio **se duerme tras unos 15 minutos sin tráfico**; la primera visita después tarda alrededor de un minuto. Abre la URL unos minutos antes de una demostración.
- **Sin disco persistente:** por eso los adjuntos se guardan en MySQL (`STORAGE_DRIVER=db`, ya fijado en la imagen). El límite es 5 MB por archivo.
- **Memoria limitada:** la API y la interfaz comparten el contenedor. Si se queda corto, sube de plan o separa los servicios. Para separarlos, en lugar de `Dockerfile.render` se usan las imágenes `Dockerfile` y `api/Dockerfile` como dos servicios, con `API_INTERNAL_URL` apuntando a la API.

## Probar la imagen de Render en tu equipo

```bash
docker build -f Dockerfile.render -t nexusfisi-render .
docker run --rm -p 10000:10000 -e PORT=10000 \
  -e DATABASE_URL="mysql://nexusfisi:nexusfisi_dev@host.docker.internal:3317/nexusfisi" \
  -e JWT_SECRET="$(openssl rand -base64 48)" -e PUBLIC_URL=http://localhost:10000 \
  -e SEED_DEMO_ON_START=true nexusfisi-render
# http://localhost:10000
```
