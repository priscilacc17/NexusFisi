# Pruebas de rendimiento y seguridad dinámica

| Archivo           | Prueba                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `carga.js`        | Carga: 50 usuarios durante 3 min (umbral p95 < 500 ms, errores < 1 %) |
| `estres.js`       | Estrés: escalones hasta 300 usuarios sin pausas                       |
| `pico-gateway.js` | Pico de 150 clientes desde una IP contra nginx (espera 429)           |
| `comun.js`        | Inicio de sesión de las cuentas demo y recorrido típico               |
| `resultados/`     | Resumen JSON de cada corrida y salida de Semgrep                      |
| `zap/`            | Informes de OWASP ZAP (baseline de la interfaz y API activa)          |

**Ejecutar solo contra el stack local** (`cd deploy && docker compose up -d`), nunca contra Render ni Aiven.

```bash
cd perf
docker run --rm --network nexusfisi_default -v "$PWD:/scripts" -v "$PWD/resultados:/resultados" \
  grafana/k6:0.54.0 run /scripts/carga.js
```

En Git Bash para Windows, anteponer `MSYS_NO_PATHCONV=1` y usar `$(pwd -W)` en lugar de `$PWD`.

Resultados e interpretación: [docs/informe-pruebas.md](../docs/informe-pruebas.md).
