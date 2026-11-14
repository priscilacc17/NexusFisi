# Flujo de trabajo con Git

| Rama | Propósito | Quién integra |
|---|---|---|
| `main` | Lo que está en producción. Cada merge despliega (CD). | Pull request desde `develop`, con CI en verde y una revisión. |
| `develop` | Integración del sprint; ambiente de prueba. | Pull requests desde `feature/*`. |
| `feature/<historia>` | Una historia de usuario o tarea (`feature/hu04-observar`). | La persona que la desarrolla. |
| `fix/<tema>` | Corrección puntual. | Igual que `feature/*`. |
| `hotfix/<tema>` | Corrección urgente sobre producción; se integra a `main` y luego a `develop`. | Con aprobación del equipo. |

## Reglas

1. Nadie hace push directo a `main` ni a `develop`: siempre por pull request.
2. Un pull request se integra solo con el **CI en verde** (tipos, pruebas, auditoría y build).
3. Mensajes de commit en español e imperativo, con la historia cuando aplique: `HU04: exigir nota al observar`.
4. **No reescribir historia publicada** (sin `push --force` en ramas compartidas). El repositorio está conectado a Lovable y se perdería el historial del editor.
5. Las versiones de entrega se etiquetan `vX.Y.Z` (por ejemplo `v1.0.0` para la sustentación); el tag también dispara el CD.

## Protección de ramas recomendada (GitHub → Settings → Branches)

Para `main` y `develop`:

- *Require a pull request before merging*, con al menos 1 aprobación.
- *Require status checks to pass*, con los checks `API · tipos, pruebas y build`, `Frontend · tipos, pruebas y build` e `Imágenes Docker`.
- *Do not allow force pushes*.
