# vertices

Sitio de la Revista Vértices: portada pública, envío de artículos y panel de
dictamen del comité editorial.

## Por dónde empezar

| Si eres… | Lee |
|---|---|
| Quien mantiene la revista y no programa | [`docs/manual-claude.md`](docs/manual-claude.md) |
| Quien recibe el proyecto y sus cuentas | [`docs/traspaso.md`](docs/traspaso.md) |
| Quien opera el día a día (claves, correo, crons) | [`docs/operacion.md`](docs/operacion.md) |
| Quien va a tocar el código | [`CONTEXT.md`](CONTEXT.md) y [`docs/adr/`](docs/adr) |

## Desarrollo

```sh
npm install
cp .env.example .env      # y rellenar; ver docs/operacion.md §1
ln -sfn .env .env.local
npm run dev               # http://localhost:3100
npm test                  # verificación de i18n + pruebas unitarias
```
