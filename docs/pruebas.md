# Pruebas de NexusFisi

| Nivel | Herramienta | Dónde | Cantidad |
|---|---|---|---|
| Unitarias (dominio y configuración) | Vitest | `api/test/unit/` | 30 |
| Integración de la API (HTTP + MySQL real) | Vitest + `app.request()` | `api/test/integration/` | 48 |
| Frontend (cliente HTTP, rutas, componentes) | Vitest + Testing Library | `src/test/` | 12 |
| De punta a punta en navegador | Playwright (manual / demo) | ver abajo | 8 pasos |

Las pruebas corren en cada push y pull request ([CI](../.github/workflows/ci.yml)). Las de integración usan un servicio MySQL 8.4 del propio pipeline, no simulaciones.

## Cómo ejecutarlas

```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # MySQL 127.0.0.1:3317 con la base nexusfisi_test
cd api && npm test                                      # unitarias + integración
npm run test:unit                                       # solo unitarias (no necesitan base)
cd .. && npx vitest run                                 # frontend
```

Cada archivo de integración parte de una base limpia: borra las tablas, aplica las migraciones y siembra los datos de demostración con el mismo código de producción.

## Escenarios BDD cubiertos

**HU02 · Registro de solicitud**

| Escenario | Dado / Cuando / Entonces | Prueba |
|---|---|---|
| Registro correcto | Dado un estudiante autenticado, cuando registra con todos los datos, entonces se crea con código único y estado «Registrada». | `solicitudes.test.ts › Escenario 1` |
| Datos incompletos | Dado un estudiante registrando, cuando omite campos, entonces ve el mensaje por campo y la solicitud no se registra. | `Escenario 2` (verifica que el total no cambia) |
| Sin documentos | Cuando no adjunta archivos, entonces se rechaza. | `exige al menos un documento` |
| Archivo disfrazado | Cuando sube un ejecutable con extensión .pdf, entonces se rechaza (415). | `rechaza un archivo…` |
| Otra facultad | Cuando elige un trámite de otra facultad, entonces se rechaza (422). | `no permite registrar…` |
| Concurrencia | Cuando 6 registros llegan a la vez, entonces los 6 códigos son distintos. | `registros simultáneos…` |

**Gestión del flujo**

| Escenario | Prueba |
|---|---|
| Flujo completo registrar → evaluar → observar → corregir → asignar → atender → resolver → cerrar, con el historial exacto. | `recorre todos los estados…` |
| Observar sin nota → 400; resolver sin respuesta → 400. | idem |
| Un técnico no asignado no puede iniciar la atención (404). | idem |
| La corrección de una observación hecha en atención vuelve a «En atención» con el mismo técnico. | `observada durante la atención…` |
| Dos personas actúan a la vez → la segunda recibe 409. | `dos personas actuando a la vez…` |
| El estudiante desiste antes de la atención. | `el estudiante puede desistir…` |
| No se puede asignar a personal de otra facultad. | `no se puede asignar…` |
| Al reasignar, el técnico anterior pierde el acceso y el nuevo lo gana. | `auth-admin.test.ts › al reasignar…` |
| Notificación al estudiante cuando cambia el estado. | `notifica al estudiante…` |

**Seguridad y administración:** registro solo como estudiante (aunque se envíe otro rol), correo institucional, duplicados (409), política de contraseñas, mensaje genérico de login, bloqueo tras 5 intentos (423), token inválido (401), revocación al cambiar contraseña o desactivar la cuenta, alcance del administrador de facultad (403), protección de técnicos con solicitudes en curso (422), tipo con solicitudes no se elimina (409), trámite desactivado no se puede solicitar, solo el central crea facultades, y límite de intentos por cuenta sin bloquear al resto del campus.

**Fase III — sesión, correo y almacenamiento:**

- **Cookie de sesión:** es `HttpOnly`, `SameSite=Lax` y limitada a `/api`; sin la cabecera anti-CSRF una modificación se rechaza (403) y con ella pasa; cerrar sesión borra la cookie.
- **Recuperación de contraseña:**
  - La respuesta es idéntica con y sin cuenta, y solo hay correo si la cuenta existe.
  - El enlace cambia la contraseña, cierra las sesiones y no se puede reutilizar.
  - Un enlace nuevo anula el anterior, y los enlaces vencen a los 30 minutos.
- **Avisos por correo:** el correo de «observada» llega al estudiante con la nota y el enlace al expediente.
- **Adjuntos en MySQL** (`STORAGE_DRIVER=db`, Render): se guardan y se descargan byte por byte.

**Unitarias del dominio:** matriz de permisos del flujo por rol y facultad, días hábiles con calendario de Lima (incluido el cruce de medianoche en UTC), vencimiento, política de contraseñas, JWT alterado o firmado con otro secreto, detección de tipo por contenido y limpieza de nombres de archivo.

## Prueba de punta a punta en navegador

Con Playwright se recorrió el flujo completo sobre la interfaz real en cuatro configuraciones:

- el servidor de desarrollo;
- el stack de producción en Docker con gateway nginx;
- el servidor de producción sin nginx (cookie de sesión y CSP con *nonce*);
- la imagen combinada de Render (`Dockerfile.render`, adjuntos en MySQL).

También se probó la recuperación de contraseña desde la interfaz, con envío real por Gmail.

1. Registro de un estudiante nuevo, incluida la validación de campos.
2. Registro de una solicitud con documento.
3. El supervisor evalúa y observa (verifica que la nota es obligatoria).
4. El estudiante corrige adjuntando un documento.
5. El supervisor asigna con prioridad alta.
6. El técnico inicia la atención, adjunta la constancia y resuelve.
7. El estudiante descarga la constancia.
8. El estudiante da su conformidad.

Resultado: 8/8 pasos y ningún error en la consola del navegador. Las capturas se usaron para revisar la interfaz en escritorio y en móvil.

## Pruebas asistidas por IA

Las pruebas se escribieron con asistencia de IA (ver [registro-ia.md](registro-ia.md)) y el equipo las revisó. Al revisarlas, varias fallas resultaron ser errores de la propia prueba y no del sistema. Por ejemplo, una consultaba la versión con un usuario sin acceso y no con uno autorizado. Por eso el criterio del equipo es revisar cada falla antes de «arreglarla», y comprobar que una prueba nueva puede fallar (por ejemplo, rompiendo la regla que verifica) antes de darla por buena.
