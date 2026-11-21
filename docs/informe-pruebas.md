# Informe de pruebas — Fase IV

**Sistema:** NEXUS v1.0.0 · **Fecha de ejecución:** 19 de noviembre de 2026 · **Ambiente:** stack local de producción con `docker compose` (gateway nginx + interfaz + API + MySQL 8.4), salvo que se indique otra cosa.

Este informe reúne todas las pruebas exigidas por la Fase IV: funcionales, de aceptación, de usuario, de seguridad (SAST y DAST), de carga y de estrés. Para cada una se indica la herramienta, qué se probó, el resultado y qué se corrigió a partir de ella.

## 1. Resumen

| Tipo de prueba                      | Herramienta                     | Casos / alcance                                  | Resultado                                                        |
| ----------------------------------- | ------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Unitarias                           | Vitest                          | 38 (dominio, configuración, seguridad)           | 38/38 ✅                                                         |
| Funcionales de la API (integración) | Vitest + MySQL real             | 51 (endpoints HTTP contra MySQL 8.4)             | 51/51 ✅                                                         |
| Frontend (componentes)              | Vitest + Testing Library        | 12                                               | 12/12 ✅                                                         |
| Aceptación (E2E en navegador)       | Playwright                      | 11 escenarios de las HU, en Chrome de escritorio | 11/11 ✅                                                         |
| De usuario (responsive)             | Playwright (Pixel 7)            | 1 (navegación en móvil)                          | 1/1 ✅                                                           |
| Seguridad — SAST                    | Semgrep, CodeQL, `npm audit`    | Todo el repositorio                              | 0 hallazgos en el código de la aplicación; 1 en el CD, corregido |
| Seguridad — DAST                    | OWASP ZAP 2.15 (baseline + API) | Interfaz completa y 32 rutas de la API           | 0 fallas; 2 hallazgos reales, corregidos                         |
| Carga                               | k6                              | 50 usuarios simultáneos, 3 min                   | p95 = 9,6 ms; 0 % de errores ✅                                  |
| Estrés                              | k6                              | Escalones hasta 300 usuarios sin pausa           | Sin errores; techo ≈ 450 req/s con p95 = 648 ms                  |
| Pico contra el gateway              | k6                              | 150 clientes desde una IP                        | nginx corta el exceso con 429; la API sigue sana                 |

Las pruebas automáticas (unitarias, integración, frontend, E2E, SAST con CodeQL y lint) corren en **cada push y pull request** en GitHub Actions. Las de carga, estrés y DAST se ejecutan a mano, porque necesitan varios minutos y el stack completo.

## 2. Pruebas funcionales

Verifican que cada endpoint de la API cumple su contrato: códigos HTTP, validaciones, permisos y efectos en la base. Se ejecutan contra **MySQL real** (no simulaciones); cada archivo parte de una base limpia con las migraciones y los datos de demostración.

```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # MySQL en 127.0.0.1:3317
cd api && npm test                                      # 89 pruebas
```

| Archivo                  | Qué cubre                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `solicitudes.test.ts`    | Registro, validaciones, adjuntos, flujo completo de estados, concurrencia (409), corrección   |
| `auth-admin.test.ts`     | Registro, login, bloqueo, revocación, alcance por facultad, administración de catálogos       |
| `fase3.test.ts`          | Cookie de sesión, CSRF, recuperación de contraseña, avisos por correo, adjuntos en MySQL      |
| `observabilidad.test.ts` | Métricas por patrón de ruta, métricas de negocio, token de Prometheus, `X-Request-Id` saneado |
| `unit/*.test.ts`         | Máquina de estados, días hábiles de Lima, contraseñas, JWT, tipos de archivo                  |

El detalle de cada escenario BDD está en [pruebas.md](pruebas.md).

## 3. Pruebas de aceptación (E2E)

Recorren las historias de usuario **en un navegador real** sobre la aplicación desplegada. Están en [`e2e/tests/aceptacion.spec.ts`](../e2e/tests/aceptacion.spec.ts) y corren en el CI contra la imagen de Render (`Dockerfile.render`) recién construida.

```bash
cd e2e && npm ci && npx playwright install chromium
BASE_URL=http://localhost:8088 npx playwright test     # informe en e2e/informe/
```

| #   | Historia / criterio                                                                       | Resultado |
| --- | ----------------------------------------------------------------------------------------- | --------- |
| 1   | HU01 — Un estudiante nuevo se registra con su correo institucional                        | ✅        |
| 2   | HU04 — Registrar con datos incompletos muestra los errores y no crea la solicitud         | ✅        |
| 3   | HU04 — Registro correcto con documento: código único y estado «Registrada»                | ✅        |
| 4   | HU05 — El supervisor evalúa y observa; la nota es obligatoria                             | ✅        |
| 5   | HU06 — El estudiante recibe la notificación y corrige con un nuevo documento              | ✅        |
| 6   | HU07 — Asignación con prioridad alta; el técnico inicia, adjunta y resuelve               | ✅        |
| 7   | HU08 — El estudiante descarga la constancia y da su conformidad                           | ✅        |
| 8   | Autorización — un estudiante no ve la solicitud de otro                                   | ✅        |
| 9   | Autorización — el supervisor de otra facultad no ve la solicitud                          | ✅        |
| 10  | Seguridad — el login no revela si la cuenta existe                                        | ✅        |
| 11  | Seguridad — la sesión va en cookie `HttpOnly` + `SameSite=Lax`, sin JWT en `localStorage` | ✅        |

Evidencia: [informe de Playwright](evidencias/fase4/playwright-informe.png).

## 4. Pruebas de usuario

- **Responsive:** [`e2e/tests/responsive.spec.ts`](../e2e/tests/responsive.spec.ts) abre la aplicación en un Pixel 7 y comprueba que el menú lateral se convierte en menú desplegable y que la navegación funciona. ✅
- **Recorrido guiado por rol:** cada integrante recorre el sistema con una cuenta de demostración siguiendo el [manual de usuario](manual-usuario.md) y anota lo que le resultó confuso. Las observaciones de usabilidad de las fases anteriores (orden de la bandeja, mensajes de error por campo, confirmación antes de acciones irreversibles) ya están incorporadas.

  | Rol           | Cuenta                         | Integrante         | Tareas completadas sin ayuda                    | Observaciones |
  | ------------- | ------------------------------ | ------------------ | ----------------------------------------------- | ------------- |
  | Estudiante    | `estudiante.fisi@unmsm.edu.pe` | Ashley Bayona      | Registrar, corregir, descargar, dar conformidad |               |
  | Supervisor    | `supervisor.fisi@unmsm.edu.pe` | Priscila Carrascal | Evaluar, observar, asignar, cerrar              |               |
  | Técnico       | `tecnico.fisi@unmsm.edu.pe`    | Frank Maylle       | Iniciar atención, adjuntar, resolver            |               |
  | Administrador | `admin.central@unmsm.edu.pe`   | Alberto Gil        | Crear usuario, tipo de trámite y área           |               |

- **Accesibilidad básica:** los formularios usan `<label>` asociados y los botones tienen nombre accesible; las pruebas E2E los localizan por rol y nombre (`getByRole`), lo que falla si se pierde la etiqueta.

## 5. Seguridad — SAST (análisis estático)

| Herramienta                                                        | Dónde corre                             | Resultado                                       |
| ------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------- |
| **CodeQL** (`security-extended`, JS/TS)                            | CI, cada push y semanal                 | Ver _Security → Code scanning_ en GitHub        |
| **Semgrep** (TypeScript, Node, OWASP Top 10, secretos, Dockerfile) | A mano (`perf/resultados/semgrep.json`) | 23 avisos: 0 en el código de la aplicación      |
| **npm audit** (`--audit-level=high`)                               | CI                                      | 0 vulnerabilidades altas o críticas             |
| **Dependabot**                                                     | GitHub, semanal                         | Actualiza dependencias npm y acciones de GitHub |

Clasificación de los 23 avisos de Semgrep:

| Aviso                                              | Cantidad | Decisión                                                                                                                                                                                                               |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow-run-target-code-checkout` (cd.yml)       | 1        | **Real, corregido.** El CD se dispara al terminar el CI en `main`; un PR desde un _fork_ con una rama llamada `main` podía hacer que se desplegara su código. Ahora el CD exige además `workflow_run.event == 'push'`. |
| `github-actions-mutable-action-tag`                | 20       | Riesgo aceptado y mitigado: se usan solo acciones oficiales (`actions/*`, `docker/*`, `github/*`) con versión mayor fija, y Dependabot las mantiene al día.                                                            |
| `x-frame-options-misconfiguration` (src/server.ts) | 1        | Falso positivo: el valor es la constante `DENY`, no viene del usuario.                                                                                                                                                 |
| `request-host-used` (nginx.conf)                   | 1        | Falso positivo: los enlaces de los correos se arman con `PUBLIC_URL`, nunca con la cabecera `Host`.                                                                                                                    |
| `bun-missing-minimum-release-age` (bunfig.toml)    | 1        | Falso positivo: `minimumReleaseAge = 86400` ya está definido.                                                                                                                                                          |

```bash
docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep:1.95.0 semgrep scan \
  --config p/typescript --config p/nodejs --config p/secrets --config p/dockerfile --config p/owasp-top-ten \
  --exclude node_modules --exclude dist --metrics=off
```

## 6. Seguridad — DAST (análisis dinámico)

OWASP ZAP 2.15 contra el stack en ejecución, en dos modalidades:

1. **Baseline (pasivo)** sobre la interfaz web a través del gateway: araña el sitio y analiza cabeceras, cookies y contenido.
2. **Escaneo activo de la API** a partir de su OpenAPI (32 rutas), autenticado como supervisor. Prueba inyección SQL, XSS, inyección de comandos, _path traversal_, SSTI, XXE, _Log4Shell_, entre otras 112 reglas.

| Escaneo        | Primera ejecución  | Tras las correcciones                                        |
| -------------- | ------------------ | ------------------------------------------------------------ |
| Baseline (web) | 0 fallas, 7 avisos | 0 fallas, 4 avisos informativos (+ versión de ZAP)           |
| API (activo)   | 0 fallas, 3 avisos | **0 fallas, 1 aviso** (versión de ZAP), 112 reglas aprobadas |

Hallazgos reales y su corrección:

| Hallazgo                                                                                            | Causa                                                                                                       | Corrección                                                                                                                                      |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Faltaban `X-Content-Type-Options` y `Permissions-Policy` en `/assets/*.js` y `robots.txt` (12 URLs) | Nitro sirve los archivos estáticos antes de llegar a `src/server.ts`, que es donde se ponían las cabeceras. | `routeRules` de Nitro en [`vite.config.ts`](../vite.config.ts): las mismas cabeceras para todo, y caché de un año para `/assets` (llevan hash). |
| La cookie que borra la sesión al salir no tenía `HttpOnly` ni `SameSite`                            | `deleteCookie` se llamaba solo con `path` y `secure`.                                                       | Se borra con los mismos atributos con que se crea; la prueba de _logout_ ahora lo verifica.                                                     |

Avisos aceptados (informativos):

- **«Comentarios sospechosos»:** son las palabras `from` y `query` dentro del JavaScript minificado, no comentarios.
- **`style-src 'unsafe-inline'` en la CSP:** lo requieren los componentes de Radix UI, que fijan estilos en línea. Los _scripts_ sí van con _nonce_ por petición, que es lo que impide el XSS.
- **Sin _Subresource Integrity_:** todos los scripts son del mismo origen; SRI aplica a recursos de terceros (CDN).
- **«Contenido almacenable en caché»:** intencional para `/assets` (nombres con hash).

Además se eliminaron las cabeceras duplicadas que nginx agregaba a `/api` (ahora las pone solo la API, igual en Render donde no hay nginx) y la API pasó de `X-Frame-Options: SAMEORIGIN` a `DENY`.

Evidencias: [`perf/zap/baseline.html`](../perf/zap/baseline.html), [`perf/zap/api.html`](../perf/zap/api.html), capturas en [`evidencias/fase4/`](evidencias/fase4/).

```bash
# Baseline de la interfaz (desde la red de docker compose)
docker run --rm --network nexusfisi_default -v "$PWD/perf/zap:/zap/wrk" zaproxy/zap-stable:2.15.0 \
  zap-baseline.py -t http://gateway/ -r baseline.html -J baseline.json
# API con su OpenAPI, autenticada (TOKEN = JWT de una cuenta demo)
docker run --rm --network nexusfisi_default -v "$PWD/perf/zap:/zap/wrk" zaproxy/zap-stable:2.15.0 \
  zap-api-scan.py -t http://api:4000/api/v1/openapi.json -f openapi -O http://api:4000 -r api.html \
  -z "-config replacer.full_list(0).matchtype=REQ_HEADER -config replacer.full_list(0).matchstr=Authorization -config replacer.full_list(0).replacement=Bearer\ $TOKEN -config replacer.full_list(0).enabled=true"
```

## 7. Pruebas de carga y de estrés

Scripts de k6 en [`perf/`](../perf/). Cada usuario virtual inicia sesión una sola vez y luego repite el recorrido típico: bandeja o «mis solicitudes», panel, detalle de un expediente, notificaciones y catálogo (5 peticiones por vuelta). Se ejecutan **dentro de la red de docker compose contra la API**, para medir la aplicación y no el límite de nginx. **Nunca contra Render ni Aiven**: los planes gratuitos no son para eso y se afectaría el servicio real.

Equipo: portátil de desarrollo (Docker Desktop, WSL 2), API con un solo proceso Node.

### 7.1 Carga — uso esperado

Escenario: hora punta de una facultad grande. **50 usuarios simultáneos** durante 3 minutos, con 1 a 3 s de lectura entre recorridos.
Criterios de aceptación: p95 < 500 ms, errores < 1 %, _checks_ > 99 %.

| Métrica            | Valor         |
| ------------------ | ------------- |
| Peticiones         | 25 317        |
| Rendimiento        | 109 req/s     |
| Latencia promedio  | 4,5 ms        |
| Latencia p90 / p95 | 7,3 / 9,6 ms  |
| Latencia máxima    | 132 ms        |
| Tasa de error      | 0 %           |
| **Umbrales**       | **Aprobados** |

### 7.2 Estrés — buscar el límite

Escalones de 50 → 100 → 200 → 300 usuarios **sin pausas** (cada usuario dispara peticiones sin cesar, muy por encima del uso real) y bajada a 0.

| Métrica                  | Valor        |
| ------------------------ | ------------ |
| Peticiones               | 88 107       |
| Rendimiento sostenido    | ≈ 450 req/s  |
| Latencia promedio        | 304 ms       |
| Latencia p90 / p95       | 579 / 648 ms |
| Latencia máxima          | 1,24 s       |
| Tasa de error            | **0 %**      |
| Memoria de la API (pico) | ≈ 390 MiB    |

**Interpretación:** con un solo proceso, la API se satura alrededor de **450 req/s**; a partir de ahí, más usuarios no aumentan el rendimiento sino la latencia (se ve en el tablero de Grafana como la meseta de p95 cercana a 1 s). Aun así **no hubo ni un error** y, al bajar la carga, la latencia volvió a valores normales en segundos: el sistema se degrada de forma controlada y se recupera solo. 450 req/s equivalen a unos 90 usuarios activos por segundo, muy por encima de la demanda de trámites de una facultad.

Cuellos de botella y cómo escalar si hiciera falta: el event loop de Node (un solo núcleo) y la cantidad de consultas del panel. Opciones: varias réplicas de la API detrás del gateway, o el modo _cluster_ de Node; caché corta del panel.

### 7.3 Pico contra el gateway — protección contra abuso

150 clientes desde **una misma IP** sin pausas contra `/api/v1/facultades`, a través de nginx (límite de 20 peticiones/s por IP con ráfaga de 40).

| Métrica                          | Valor                       |
| -------------------------------- | --------------------------- |
| Peticiones enviadas              | 3 733 418 (≈ 68 000/s)      |
| Rechazadas por nginx con **429** | 99,97 %                     |
| Atendidas por la API             | ≈ 1 100 (≈ 20/s, el límite) |
| Latencia p95                     | 4,4 ms                      |
| Estado de la API después         | `/api/v1/health` → 200      |

Un cliente abusivo no llega a la API: nginx lo corta en la entrada sin afectar a los demás usuarios.

```bash
cd deploy && docker compose up -d
cd ../perf
docker run --rm --network nexusfisi_default -v "$PWD:/scripts" -v "$PWD/resultados:/resultados" \
  grafana/k6:0.54.0 run /scripts/carga.js        # también estres.js y pico-gateway.js
```

Resultados en JSON: [`perf/resultados/`](../perf/resultados/).

## 8. Defectos encontrados en la Fase IV

| #   | Defecto                                                                 | Detectado por       | Severidad | Estado                          |
| --- | ----------------------------------------------------------------------- | ------------------- | --------- | ------------------------------- |
| 1   | CD podía desplegar código de un PR externo (`workflow_run`)             | Semgrep             | Alta      | Corregido                       |
| 2   | Archivos estáticos sin cabeceras de seguridad                           | ZAP baseline        | Media     | Corregido                       |
| 3   | Cookie de cierre de sesión sin `HttpOnly`/`SameSite`                    | ZAP API             | Baja      | Corregido                       |
| 4   | `X-Request-Id` del cliente se copiaba sin validar a los logs            | Revisión de código  | Baja      | Corregido                       |
| 5   | Trazas sin nombre de ruta (todas se llamaban «GET»)                     | Revisión en Jaeger  | Baja      | Corregido                       |
| 6   | Panel «Errores 5xx» sin datos cuando no hay errores                     | Revisión en Grafana | Baja      | Corregido                       |
| 7   | Código sin formato uniforme (113 archivos) y una regla de lint fallando | ESLint/Prettier     | Baja      | Corregido; ahora el CI lo exige |

## 9. Conclusión

Todas las pruebas funcionales, de aceptación y de usuario pasan. Los análisis de seguridad no encontraron vulnerabilidades explotables en la aplicación; los hallazgos de configuración se corrigieron y se dejaron pruebas automáticas para que no vuelvan. El sistema atiende la carga esperada con amplio margen (p95 de 10 ms con 50 usuarios), se degrada sin errores bajo estrés extremo y el gateway lo protege del abuso. **NEXUS queda apto para su liberación como v1.0.0.**
