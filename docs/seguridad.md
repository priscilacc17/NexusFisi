# Seguridad de NEXUS

## Autenticación y autorización

- **Contraseñas:** bcrypt (costo 11). Política de 8 a 72 bytes, con letras y números.
- **JWT HS256** firmado con `JWT_SECRET` (mínimo 32 caracteres, validado al arrancar; en producción se rechaza el valor de ejemplo). Incluye emisor, audiencia y vencimiento (8 h por defecto).
- **La sesión web viaja en una cookie `HttpOnly`, `Secure` y `SameSite=Lax`, limitada a `/api`.** JavaScript no puede leerla, así que un XSS no puede robar la sesión. En el navegador solo se guarda el perfil para pintar la interfaz, nunca el token. Los clientes de API (Swagger, curl) pueden seguir usando `Authorization: Bearer`.
- **CSRF:** toda petición autenticada por cookie que modifique datos debe traer la cabecera `X-Nexus: 1`. Un sitio ajeno no puede agregarla sin pasar por CORS, que solo admite el propio dominio. Además, `SameSite=Lax` impide que la cookie viaje en envíos de formularios desde otros sitios.
- **Recuperación de contraseña por correo:**
  - El enlace vale 30 minutos y un solo uso; pedir uno nuevo anula los anteriores.
  - En la base se guarda el _hash_ SHA-256 del token, no el token: quien lea la base no puede usar los enlaces.
  - La respuesta es la misma exista o no la cuenta, y el correo se envía sin esperar (no se puede averiguar qué correos están registrados).
  - Al restablecer se cierran todas las sesiones y se desbloquea la cuenta.
- **Revocación inmediata:** cada petición recarga al usuario. Si la cuenta se desactivó, cambió de rol o cambió su contraseña, `token_version` ya no coincide y la sesión deja de valer al instante.
- **Fuerza bruta:**
  - Bloqueo de la cuenta 15 minutos tras 5 intentos fallidos.
  - Límite de intentos por IP + correo (no solo por IP, porque el campus comparte IP pública).
  - Límite general de peticiones en el gateway.
- **Sin enumeración de usuarios:** el mensaje de error es el mismo para correo inexistente y contraseña incorrecta, y el tiempo de respuesta también (se compara contra un hash señuelo).
- **Autorización en el servidor, siempre:**
  - Alcance por rol y facultad en cada consulta.
  - Permisos del flujo en `domain/workflow.ts`.
  - Una solicitud ajena responde **404**, no 403, para no revelar que existe.
- **Asignación masiva:** el registro público fuerza el rol `ESTUDIANTE`; un administrador de facultad no puede crear administradores centrales ni tocar otra facultad.

## OWASP Top 10 (2021)

| Riesgo                             | Medidas en NEXUS                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Control de acceso roto         | Alcance por rol y facultad en todos los servicios; administradores sin acciones de flujo; pruebas de aislamiento entre facultades, estudiantes y técnicos.                                                                                                                                                                                                     |
| A02 Fallas criptográficas          | bcrypt; JWT con secreto fuerte desde el entorno; HTTPS en el borde (Cloudflare o certbot); la base sin puerto público.                                                                                                                                                                                                                                         |
| A03 Inyección                      | Consultas parametrizadas con Drizzle; búsquedas `LIKE` con comodines escapados; validación Zod de toda entrada; React escapa el contenido al pintar.                                                                                                                                                                                                           |
| A04 Diseño inseguro                | Bloqueo optimista, correlativo atómico, reglas de negocio centralizadas y probadas, límites de tamaño y cantidad de archivos.                                                                                                                                                                                                                                  |
| A05 Configuración insegura         | Variables de entorno validadas al arrancar; contenedores con usuario sin privilegios; `server_tokens off`; CSP con _nonce_ por petición (sin `'unsafe-inline'` en scripts), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS sobre HTTPS; CORS con lista blanca. Las cabeceras las pone la propia app, así que valen igual en Render que detrás de nginx. |
| A06 Componentes vulnerables        | `npm audit --omit=dev --audit-level=high` en cada CI (hoy: 0 vulnerabilidades); versiones fijadas con lockfile.                                                                                                                                                                                                                                                |
| A07 Fallas de identificación       | Bloqueo por intentos, revocación por `token_version`, política de contraseñas, cambio y recuperación de contraseña que cierran las demás sesiones, y cookie `HttpOnly` con protección CSRF.                                                                                                                                                                    |
| A08 Integridad de software y datos | Imágenes construidas por el pipeline desde el repositorio; migraciones versionadas; el CI falla si el esquema cambia sin migración.                                                                                                                                                                                                                            |
| A09 Registro y monitoreo           | Log JSON (pino) de cada petición con `X-Request-Id` (también en el gateway), errores internos registrados sin exponer la traza al usuario y credenciales censuradas en los logs.                                                                                                                                                                               |
| A10 SSRF                           | La API no hace peticiones a URLs que proporcione el usuario.                                                                                                                                                                                                                                                                                                   |

## Archivos adjuntos

- El tipo se decide por los **primeros bytes** del archivo (PDF, PNG o JPEG), no por la extensión ni por el Content-Type del navegador. Un ejecutable renombrado a `.pdf` se rechaza con 415.
- Máximo 5 MB por archivo y 5 archivos por envío; el gateway limita el cuerpo total.
- Se guardan con un nombre aleatorio (UUID) en un volumen que no es público, y se sirven solo tras verificar el permiso, con `Content-Disposition: attachment`, `nosniff` y `no-store`.
- Si falla la base de datos después de escribir los archivos, se borran (no quedan huérfanos).

## Secretos

- Ningún secreto está en el código: `.env` está excluido de git y hay plantillas `.env.example`.
- En producción (Render) los secretos son variables del servicio (`JWT_SECRET` lo genera Render; clave de Brevo, URL y CA de Aiven). En CI/CD viven en el _GitHub Environment_ `produccion` (`RENDER_DEPLOY_HOOK_URL` y, para la VM, `VM_HOST`, `VM_USER`, `VM_SSH_KEY`).
- El historial completo se revisó con **gitleaks** (sin secretos reales) en la [revisión final](revision-final.md#5-secretos).
- Las cuentas de demostración se crean con `npm run db:seed`, `node dist/db/seed.js` o, solo si la base está vacía, con `SEED_DEMO_ON_START=true` (usado en la demo de Render). En producción real se deja en `false` y se oculta el recuadro de demostración con `MOSTRAR_DEMO=false`.

## Correo saliente

- SMTP sobre TLS (Gmail, puerto 465) con una **contraseña de aplicación**, o la API HTTPS de Brevo/Resend (Render bloquea SMTP); las claves van solo en variables de entorno.
- `MAIL_REDIRECT_TO` desvía todos los correos a una casilla en las demostraciones: las cuentas demo usan direcciones `@unmsm.edu.pe` ficticias y no deben recibir correo real.
- Un fallo del correo nunca deshace ni demora una operación; se registra en el log.

## Análisis de seguridad (Fase IV)

- **SAST:** CodeQL en cada push y semanal; Semgrep (OWASP Top 10, secretos, Node, Dockerfile); `npm audit` en el CI; Dependabot.
- **DAST:** OWASP ZAP baseline sobre la interfaz y escaneo activo de la API autenticado (112 reglas: inyección SQL, XSS, SSTI, _path traversal_…): **0 fallas**.
- Hallazgos corregidos: CD explotable desde un _fork_, estáticos sin cabeceras de seguridad y cookie de _logout_ sin atributos. Detalle en el [informe de pruebas](informe-pruebas.md#5-seguridad--sast-análisis-estático).
- **Métricas:** `/api/v1/metrics` exige `METRICS_TOKEN` en producción; los puertos de Grafana, Prometheus y Jaeger solo escuchan en `127.0.0.1`.

## Pendiente (conocido)

- **Detrás de varios proxies** (Render), la IP para el límite de intentos sale de `X-Forwarded-For`, que un atacante puede falsear si llama a la API directamente. El bloqueo por cuenta tras 5 intentos no depende de la IP y sigue protegiendo.
- **`style-src` mantiene `'unsafe-inline'`**, porque lo usan los componentes de interfaz para posicionar elementos. El riesgo es mucho menor que en scripts.
- **Acciones de GitHub fijadas por versión mayor (`@v4`), no por SHA:** riesgo aceptado, mitigado con Dependabot.
