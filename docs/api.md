# API REST de NEXUS

- **Base:** `/api/v1` (mismo origen que la interfaz, detrás del gateway).
- **Documentación interactiva:** `/api/docs` (Swagger UI). La especificación OpenAPI 3.1 está en `/api/v1/openapi.json` y se genera desde el código: lo que valida la API es exactamente lo que documenta.
- **Formato:** JSON. Los errores siguen RFC 9457 (`application/problem+json`).
- **Autenticación:**
  - **Interfaz web:** cookie `HttpOnly` que fija `POST /auth/login`, más la cabecera `X-Nexus: 1` en toda petición que modifique datos (protección CSRF).
  - **Clientes de API (Swagger, curl):** `Authorization: Bearer <JWT>`, con el token que devuelve el mismo login.

## Recursos

| Método          | Ruta                                                       | Rol                                            | Descripción                                                                                           |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| POST            | `/auth/registro`                                           | público                                        | Crea una cuenta de **estudiante** (el rol nunca viene del cliente).                                   |
| POST            | `/auth/login`                                              | público                                        | Devuelve `{ token, usuario }`.                                                                        |
| GET             | `/auth/me`                                                 | autenticado                                    | Usuario de la sesión.                                                                                 |
| POST            | `/auth/cambiar-password`                                   | autenticado                                    | Invalida las sesiones anteriores y renueva la cookie (y devuelve un token nuevo).                     |
| POST            | `/auth/logout`                                             | —                                              | Borra la cookie de sesión.                                                                            |
| POST            | `/auth/recuperar`                                          | público                                        | Envía por correo un enlace para restablecer la contraseña (respuesta idéntica exista o no la cuenta). |
| POST            | `/auth/restablecer`                                        | público                                        | Fija la contraseña nueva con el token del enlace (30 min, un solo uso).                               |
| GET             | `/facultades`                                              | público                                        | Facultades activas con sus escuelas (para el registro).                                               |
| GET             | `/tipos-tramite`                                           | autenticado                                    | Catálogo de la facultad del usuario.                                                                  |
| GET             | `/areas`                                                   | autenticado                                    | Áreas responsables de la facultad.                                                                    |
| GET             | `/solicitudes`                                             | autenticado                                    | Lista paginada y filtrable, con alcance según el rol.                                                 |
| POST            | `/solicitudes`                                             | estudiante                                     | Registro con documentos (`multipart/form-data`): se guarda todo o nada.                               |
| GET             | `/solicitudes/{codigo}`                                    | participante                                   | Expediente completo con las `acciones` permitidas.                                                    |
| POST            | `/solicitudes/{codigo}/transiciones`                       | según acción                                   | Ejecuta una acción del flujo.                                                                         |
| POST            | `/solicitudes/{codigo}/adjuntos`                           | estudiante (corrección) / personal (resultado) | Adjunta documentos.                                                                                   |
| GET             | `/solicitudes/{codigo}/adjuntos/{id}`                      | participante                                   | Descarga autenticada.                                                                                 |
| POST            | `/solicitudes/{codigo}/mensajes`                           | participante                                   | Mensaje en el expediente.                                                                             |
| GET             | `/notificaciones`                                          | autenticado                                    | Últimas 30 y cantidad sin leer.                                                                       |
| POST            | `/notificaciones/{id}/leida`, `/notificaciones/leer-todas` | autenticado                                    | Marcar como leídas.                                                                                   |
| GET             | `/dashboard`                                               | autenticado                                    | Indicadores dentro del alcance del usuario.                                                           |
| GET/POST/PUT    | `/admin/usuarios`…                                         | admin                                          | Usuarios, roles, contraseña temporal.                                                                 |
| POST/PUT/DELETE | `/admin/tipos-tramite/{id}`                                | admin                                          | Tipos de trámite (no se eliminan si tienen solicitudes).                                              |
| POST/PUT/DELETE | `/admin/areas/{id}`                                        | admin                                          | Áreas responsables.                                                                                   |
| GET/POST/PUT    | `/admin/facultades`, `/admin/facultades/{id}/escuelas`     | admin central                                  | Facultades y escuelas.                                                                                |
| GET             | `/health`                                                  | público                                        | Estado de la API y de la base de datos.                                                               |

### Parámetros de `GET /solicitudes`

`q` (código, asunto, estudiante o código de alumno), `estado`, `tipoId`, `prioridad`, `desde`/`hasta` (`AAAA-MM-DD`, hora de Lima), `vencidas=true`, `asignadasAMi=true`, `facultadId` (solo administrador central), `orden=recientes|prioridad|vencimiento`, `page`, `size` (máximo 50).

### Transiciones

```http
POST /api/v1/solicitudes/FISI-2026-00006/transiciones
Authorization: Bearer eyJ...
Content-Type: application/json

{ "accion": "OBSERVAR", "version": 3, "nota": "La carta no tiene la firma del representante." }
```

| Acción                                  | Campos obligatorios                    |
| --------------------------------------- | -------------------------------------- |
| `EVALUAR`, `INICIAR_ATENCION`, `CERRAR` | —                                      |
| `OBSERVAR`, `CORREGIR`, `REABRIR`       | `nota` (≥ 10 caracteres)               |
| `DESISTIR`                              | `nota` (≥ 5 caracteres)                |
| `ASIGNAR`, `REASIGNAR`                  | `responsableId` (opcional `prioridad`) |
| `RESOLVER`                              | `respuesta` (≥ 10 caracteres)          |
| `PRIORIZAR`                             | `prioridad`                            |

`version` es obligatoria: si alguien modificó la solicitud después de que la leíste, la API responde **409**.

## Códigos HTTP

| Código          | Cuándo                                                                                |
| --------------- | ------------------------------------------------------------------------------------- |
| 200 / 201 / 204 | Éxito / creado / eliminado.                                                           |
| 400             | Datos inválidos. `errors` trae el mensaje por campo.                                  |
| 401             | Sin token, token inválido, vencido o revocado.                                        |
| 403             | Autenticado pero sin permiso para la acción.                                          |
| 404             | No existe **o no tienes acceso**: no se revela si una solicitud ajena existe.         |
| 409             | Conflicto: versión desactualizada, duplicado o borrado de algo en uso.                |
| 413 / 415       | Archivo demasiado grande / tipo no permitido (se revisa el contenido real).           |
| 422             | Regla de negocio: acción no disponible en el estado actual, trámite de otra facultad… |
| 423             | Cuenta bloqueada temporalmente por intentos fallidos.                                 |
| 429             | Demasiadas peticiones (API o gateway).                                                |

```json
{
  "type": "about:blank",
  "title": "SOLICITUD_INVALIDA",
  "status": 400,
  "detail": "Revisa los campos marcados.",
  "errors": { "asunto": "El asunto debe tener entre 5 y 120 caracteres." }
}
```

## Pruebas de la API

`api/test/integration/` levanta la aplicación real contra MySQL y la recorre con peticiones HTTP: registro, validaciones, aislamiento entre facultades, flujo completo, concurrencia, adjuntos, administración y límites de intentos. Detalle en [pruebas.md](pruebas.md).

Ejemplo manual con curl:

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"supervisor.fisi@unmsm.edu.pe","password":"Demo1234"}' | jq -r .token)
curl -s "localhost:4000/api/v1/solicitudes?vencidas=true" -H "authorization: Bearer $TOKEN" | jq '.items[].codigo'
```

## Panorama: REST frente a GraphQL, gRPC y webhooks

| Opción             | ¿Conviene aquí?                                                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **REST (elegido)** | Recursos claros (solicitudes, adjuntos, usuarios), cacheable, fácil de documentar y probar con OpenAPI. Cubre todas las pantallas sin sobrecarga.                                                                                            |
| **GraphQL**        | Útil si muchos clientes distintos pidieran combinaciones variables de datos. Aquí hay un solo cliente y el detalle ya viene armado en una petición; agregaría complejidad (autorización por campo, costo de consultas) sin beneficio.        |
| **gRPC**           | Pensado para comunicación entre servicios internos de alto volumen. El navegador no lo habla de forma nativa; no aplica a un único backend.                                                                                                  |
| **Webhooks**       | Encajan como **extensión**: avisar a otros sistemas universitarios (por ejemplo, el de matrícula) cuando una solicitud se resuelve. La tabla de notificaciones ya centraliza esos eventos; publicarlos hacia afuera sería el siguiente paso. |
| **API Gateway**    | Implementado con nginx: punto único de entrada, enrutamiento, límite de peticiones, tamaño máximo de cuerpo y cabeceras de seguridad.                                                                                                        |
