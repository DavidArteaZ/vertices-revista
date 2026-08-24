# Implementation notes — invitaciones: enlace robusto, reinvitar y estado real

- **Spec**: n/a (defecto reportado en operación, no venía de la spec)
- **Plan**: `~/.claude/plans/lazy-wondering-gadget.md`
- **Started**: 2026-08-24

## Decisiones tomadas fuera del plan

- **`activarInvitacion` vive en `src/app/panel/invitacion/acciones.ts`**, no en
  `equipo/acciones.ts` como decía el plan. La página puente la usa quien todavía
  no es del comité; colgarla del módulo de altas y bajas obligaba a que
  `/panel/invitacion` importara de `/panel/equipo` sin ninguna razón.

- **Las dos funciones puras van juntas en `src/lib/invitaciones.ts`**, no
  repartidas entre `lib/correo/` y `app/panel/equipo/`. Son la misma tabla de
  estados vista desde los dos extremos —el webhook escribe, la pantalla lee— y
  separarlas la dejaba en dos sitios donde podía divergir. Además el módulo no
  lleva `server-only`, que es lo que permite probarlo en vitest sin shim.

- **Se rellenaron las columnas nuevas para las seis personas que ya existían**
  (`update ... from auth.users` al final de la migración). Sin eso, el comité
  entero habría aparecido como «Sin invitación» el día del despliegue, que es
  otra versión del mismo defecto que se estaba arreglando.

- **`quejado` se pinta igual que `rebotado`** en la etiqueta. Marcar la
  invitación como spam y que la dirección no exista son causas distintas con la
  misma consecuencia operativa: esa persona no va a recibir el enlace.

- **El botón de reenviar sirve además de recuperación de contraseña** para quien
  ya la fijó (`generateLink` cae a `recovery`), con la etiqueta cambiada. El
  panel no tiene ruta de «olvidé mi contraseña» y esto la cubre sin código
  nuevo.

## Tradeoffs

- **El relleno usa `auth.users.last_sign_in_at` como fecha de «fijó
  contraseña»**, que es la última entrada, no el momento real. Para las filas
  que ya existían no hay mejor dato; de aquí en adelante lo escribe
  `fijarClave` con la fecha buena. El coste es que la fecha histórica de seis
  filas es aproximada, y nada la lee salvo para decidir «Activa».

- **La página puente añade un clic al flujo de invitación.** Es el precio de que
  un escáner de correo no gaste el token. Se acepta porque el fallo que evita es
  silencioso y el clic no lo es.

- **`invitacion_estado` es `text` libre, sin CHECK.** Cinco valores posibles y
  un solo escritor por valor; una restricción aquí obligaría a una migración
  cada vez que Resend añada un evento, a cambio de nada que el tipo no dé ya.

## Gotchas / sorpresas

- **`Email OTP expiration` no está en la página de plantillas** del dashboard de
  Supabase, que es donde se buscó primero. Vive en Authentication → Sign In /
  Providers → Email. Valor encontrado: `3600` s (1 h) — que es exactamente lo
  que explica el defecto reportado.

- **La causa más probable no era la caducidad sino el escáner.** Todas las
  invitaciones del proyecto fueron a direcciones `@tec.mx` y `@gmail.com`, y las
  institucionales pasan por comprobadores de enlaces que hacen GET. Un token de
  un solo uso canjeado en el GET se gasta ahí. Explica que el síntoma apareciera
  «al día siguiente» tanto como a los cinco minutos.

- **`auth.users.encrypted_password` no distingue a quien fijó contraseña.** Salió
  no vacío para las seis filas, incluidas las recién invitadas. Por eso el
  estado se guarda en columna propia y no se deduce de Auth.

## Diferido / seguimiento

- **Subir `Email OTP expiration` a 86400** es un ajuste manual del dashboard y
  queda pendiente de que lo haga una persona. Documentado en
  `docs/operacion.md §2 bis`.
- **La rama `token_hash` de `/panel/auth/callback` es ahora código de
  compatibilidad**: sólo la usan los enlaces de invitación que sigan en
  circulación. Se puede borrar cuando caduquen todos.
- **Ningún test cubre `reinvitar` ni `activarInvitacion`**: ambas hablan con la
  API de administración de Supabase y con `verifyOtp`, y montar ese doble cuesta
  más de lo que atrapa. Lo que sí está probado son las dos funciones puras donde
  vive la lógica que puede volver a mentir.

## Preguntas abiertas para la revisión

- La comprobación de extremo a extremo (invitar de verdad, ver la tabla pasar de
  «pendiente» a «Activa», provocar un rebote) necesita una sesión iniciada en el
  panel y no se hizo desde aquí. Lo verificado sin sesión: la página puente
  pinta el botón sin canjear nada, el callback redirige con `motivo`, el aviso
  aparece en `/panel/entrar` sólo con `motivo`, y las seis filas existentes
  quedaron como «Activa» tras el relleno.
