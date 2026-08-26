# Implementation notes — traspaso de cuentas y manual no técnico

- **Spec**: n/a (plan acordado en conversación)
- **Started**: 2026-08-24

## Decisiones tomadas fuera de la spec

- **Mixto transferir/recrear, decidido por servicio.** GitHub y Supabase se
  transfieren; Vercel y Resend se recrean. El motivo de Vercel no es
  preferencia: transferir un proyecto exige ser *miembro* del equipo destino
  ([docs](https://vercel.com/docs/projects/transferring-projects)) y el plan
  Hobby no tiene miembros, así que Hobby→Hobby entre dos personas distintas no
  es un camino fiable. Recrear es determinista y no pierde nada porque todo el
  estado vive en Supabase.
- **Supabase se transfiere en vez de recrearse aunque los datos sean solo
  semillas.** Recrear obligaría al operador no técnico a correr 18 migraciones;
  transferir conserva el `project_ref`, y con él las claves, la URL y el
  `.mcp.json` tal cual.
- **`CLAUDE.md` reemplazado, no duplicado.** Decisión del usuario: un solo
  archivo. Se eliminó el workflow personal (modo caveman, Karpathy, superpowers,
  notas de implementación) porque va dirigido a un operador del comité, no a un
  desarrollador.

## Gotchas / sorpresas

- **El cron diario es lo que impide que Supabase se pause.** Los proyectos Free
  se pausan tras una semana de inactividad
  ([docs](https://supabase.com/docs/guides/platform/free-project-pausing)); el
  barrido de huérfanos de las 4:00 consulta la base todos los días y la mantiene
  despierta. Quitar ese cron pausa el proyecto sin que nadie lo relacione con la
  causa. Documentado en `docs/traspaso.md §5`.
- **Los dos crons caben en Hobby por poco.** El mínimo permitido es uno al día y
  la precisión es ±59 min; expresiones más frecuentes **fallan el despliegue**,
  no se degradan.
- **Supabase bloquea la transferencia si hay integración de GitHub activa.** Va
  como paso previo en `§2`, no como sorpresa el día del traspaso.
- **`src/types/index.ts` no existe.** El `CLAUDE.md` anterior mandaba poner ahí
  los tipos compartidos; la regla apuntaba a una ruta inexistente y se eliminó
  en vez de arrastrarse.

## Diferido / pendientes

- **Asientos del plan gratuito de Resend sin confirmar.** La documentación
  pública no especifica cuántos miembros admite. No bloquea: la cuenta va a un
  correo institucional compartido, así que un solo asiento basta. Comprobarlo el
  día del alta.

## Preguntas abiertas para la revisión

- El manual asume que la revista es no comercial, que es lo que exige el plan
  Hobby de Vercel. Si algún día se cobra por publicar o se vende publicidad, hay
  que pasar a Pro; conviene que el comité lo sepa antes de firmar el traspaso.
