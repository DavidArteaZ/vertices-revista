# Operación: puesta en marcha, vigilancia y cambio de dominio

Lo que hay que configurar fuera del repositorio, y el orden en que conviene
hacerlo. Todo lo que aparece aquí necesita a una persona con acceso a las
cuentas: no se puede automatizar desde el código.

Referencias: spec §13 (seguridad), §14 (migración y cutover), §15
(observabilidad).

---

## 1. Variables de entorno

La lista canónica es `.env.example`. En local viven en `.env` de la raíz, y
`.env.local` es un enlace simbólico a ese archivo — Next lee el primero y los
scripts el segundo:

```sh
cp .env.example .env      # y rellenar
ln -sfn .env .env.local
```

En Vercel van en *Settings → Environment Variables*, las mismas claves y sin el
prefijo `NEXT_PUBLIC_`: **ninguna** debe llegar al navegador.

| Variable | Para qué | Si falta |
|---|---|---|
| `SUPABASE_URL` | todo | la app no arranca |
| `SUPABASE_SERVICE_ROLE_KEY` | envíos anónimos, firmas, copia de PDF | la app no arranca |
| `SUPABASE_PUBLISHABLE_KEY` | sesión del panel, lectura pública | la app no arranca |
| `RESEND_API_KEY` | acuse y avisos de decisión | se guarda el envío y **no** se avisa; queda `acuse_no_enviado` en `envio_eventos` |
| `RESEND_CONFIRMACION_TEMPLATE_ES` | acuse en español | el acuse sale en texto plano, sin la plantilla de la revista |
| `RESEND_CONFIRMACION_TEMPLATE_ENG` | acuse en los otros cinco idiomas | igual: texto plano |
| `RESEND_LISTA_AUTORES` | lista «Autores» de Resend | el envío se guarda, el autor **no** entra en la lista; queda `contacto_resend_no_guardado` |
| `RESEND_WEBHOOK_SECRET` | entregas y rebotes | `/api/webhooks/resend` responde 503 y no registra nada |
| `CRON_SECRET` | barrido y resumen semanal | los crons responden 401 |
| `CORREO_REMITENTE` | remitente | cae a `onboarding@resend.dev` |

**Rotar la clave de servicio reinicia los contadores de límite de tasa.** Se usa
como sal del hash de IP (`src/lib/api/peticion.ts`), a propósito: así no se
guarda ninguna dirección en claro. Rotarla no rompe nada, sólo perdona los
cupos en curso.

---

## 2. Correo (Resend)

1. **Verificar un dominio.** Con `onboarding@resend.dev` sólo se puede escribir
   a la dirección dueña de la cuenta, así que ningún autor recibiría su acuse.
   Esto es bloqueante para producción.
2. Cambiar `CORREO_REMITENTE` a una dirección de ese dominio. **Este valor le
   gana al `from` de la plantilla**, así que no basta con ponerlo en Resend.
3. **Publicar las dos plantillas de acuse**, una por idioma, y copiar sus alias
   a `RESEND_CONFIRMACION_TEMPLATE_ES` y `RESEND_CONFIRMACION_TEMPLATE_ENG`.
   Son dos y no una porque Resend guarda el texto dentro de la plantilla; el
   español usa la suya y los otros cinco idiomas usan la inglesa.
4. **Copiar el id de la lista «Autores»** (*Audiences*) a `RESEND_LISTA_AUTORES`.
5. **Dar de alta el webhook**: *Webhooks → Add endpoint*, apuntando a
   `https://<dominio>/api/webhooks/resend`, con los eventos `email.delivered`,
   `email.bounced`, `email.complained` y `email.delivery_delayed`. Copiar el
   secreto (`whsec_…`) a `RESEND_WEBHOOK_SECRET`. Ese secreto **no es una clave
   de API**: sale de la pantalla del webhook, no de *API Keys*.

**La clave de API tiene que ser de acceso completo.** Una clave de sólo envío
manda correos pero no puede crear contactos: los envíos llegarían y ningún autor
entraría en la lista. Se reconoce porque Resend contesta
`This API key is restricted to only send emails`.

Por qué importa el webhook: un envío puede guardarse bien y el acuse no llegar
nunca. Sin esto nadie se entera — el autor espera y el comité cree que avisó.
Con esto queda `correo_rebotado` en la bitácora del envío.

**El rebote no lleva la dirección.** `envio_eventos` lo lee todo el comité,
incluida gente que sigue ciega para ese envío; un aviso con el destinatario
dentro sería una puerta trasera a la autoría. Se guarda el tipo de evento y el
id de Resend, y el folio sale del asunto.

Los mismos cuatro eventos alimentan además el estado de las invitaciones al
comité. Ésas no llevan folio —no cuelgan de ningún envío—, así que se casan por
`usuarios.invitacion_email_id`, que es el id que Resend devolvió al mandarlas.
Un correo de invitación que rebota se ve en `/panel/equipo` como «Correo
rebotado»; antes no se veía en ninguna parte.

---

## 2 bis. Caducidad del enlace de invitación

En el dashboard de Supabase: **Authentication → Sign In / Providers → Email →
`Email OTP expiration`**. No está en la página de plantillas, que es donde se
busca por instinto.

El valor de fábrica es `3600` (una hora), y es corto para el uso real: se invita
a alguien que abre el correo al día siguiente y llega a un enlace muerto.
**Subirlo a `86400` (24 h).**

No es la única causa de un enlace muerto, y por eso el ajuste no basta solo. El
token es de un solo uso, y los escáneres de enlaces del correo institucional
(Safe Links, los antivirus de la facultad) lo abren para comprobarlo antes que
la persona. Por eso el enlace aterriza en `/panel/invitacion`, que no canjea
nada hasta que alguien pulsa el botón, y por eso hay un botón de reenviar en
`/panel/equipo`.

---

## 3. Tareas programadas

`vercel.json` las declara; Vercel las activa solo al desplegar y manda
`Authorization: Bearer $CRON_SECRET`.

| Ruta | Cuándo | Qué hace |
|---|---|---|
| `/api/mantenimiento/huerfanos?borrar=1` | 04:00 diario | borra objetos subidos que nunca llegaron a ser un envío, con más de 24 h |
| `/api/mantenimiento/digest` | lunes 14:00 UTC | resumen de lo atascado, por correo al comité |

Ambas se pueden invocar a mano:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/mantenimiento/digest
```

El barrido **informa** si se le quita `?borrar=1`, que es como conviene correrlo
la primera vez. El resumen no manda nada si no hay nada atascado: un correo
semanal que casi siempre dice «todo bien» es un correo que nadie abre, y
entonces tampoco se lee el que sí traía algo.

---

## 4. Alertas

Todas las rutas escriben JSON por línea con `ruta`, `peticion` y, en cuanto
existe, `folio`. Eso es lo que consumen las alertas.

**La alerta que no puede faltar** (§15): cualquier 5xx en `POST /api/envios`.
Es el defecto que motivó la reescritura — un manuscrito que el autor cree haber
mandado y no existe. Un 4xx ahí es normal (validación, límite de tasa); un 5xx
no lo es nunca.

Recomendadas, por orden de utilidad:

| Señal | Buscar | Por qué |
|---|---|---|
| envío perdido | `"ruta":"POST /api/envios"` con estado 5xx | el defecto original |
| firma de subida fallida | `"evento":"firma_fallida"` | el autor no puede ni empezar |
| acuse no entregado | `"evento":"acuse_no_enviado"` | se guardó y el autor no lo sabe |
| metadatos sin limpiar | `"evento":"metadatos_no_limpiados"` | un .doc o un PDF que se resistió; lo cubre la revisión humana, pero conviene saber cuántos |
| foto sin optimizar | `"evento":"imagen_no_optimizada"` o `"evento":"sharp_no_carga"` | la foto se guardó con su ubicación GPS dentro; el segundo es el optimizador caído entero |
| rebote | `"evento":"correo"` con `"tipo":"email.bounced"` | dirección mal escrita |

**El optimizador de fotos.** Cada envío con imágenes deja un evento con lo que
adelgazó cada archivo; esta consulta da la reducción media de la última semana:

```sql
select round(avg((a->>'reduccion')::numeric), 1) as reduccion_media, count(*) as fotos
  from public.envio_eventos e, jsonb_array_elements(e.payload->'archivos') a
 where e.tipo = 'imagen_optimizada' and e.at > now() - interval '7 days';
```

Lo normal es **entre 70 y 85**. Por debajo de 50 hay que mirar por qué, y un
resultado vacío con envíos recientes que llevaban fotos significa que el
optimizador no está corriendo: es lo preocupante de verdad, porque las fotos se
están guardando con su EXIF dentro.

**El plan gratuito de Supabase tope la subida en 50 MB por archivo, y ese
número es fijo: no es un ajuste, no se puede subir.** La migración
`20260825190000_almacenamiento_imagenes.sql` deja `manuscritos` exactamente ahí,
así que el bucket ya está en su techo y no hay nada que tocar en el panel. El
tope que de verdad decide es el del formulario —20 MB por archivo, 50 MB entre
todos (`MAX_BYTES` y `MAX_BYTES_TOTAL` en `src/lib/validacion.ts`)—, y ése está
donde sí sabe explicarse: le dice al autor qué archivo pesa de más.

Si alguna vez hiciera falta pasar de 50 MB por archivo, la única salida es un
plan de pago. El síntoma de chocar contra ese techo es feo y conviene
reconocerlo: la subida rebota en Storage, el autor ve un error que no explica
nada, y en los registros de la app no aparece nada, porque la subida va del
navegador directo a Storage y no pasa por ellos.

**Esto manda sobre la publicación del número entero.** El PDF de una revista
completa con fotografías puede pasar de 50 MB con facilidad, y en plan gratuito
no cabría. Producción tiene que dejarlo por debajo de ese peso —Acrobat lo hace
con *Reducir tamaño de archivo*— o la revista necesita plan de pago antes del
primer número publicado.

En Vercel: *Observability → Log Drains* a Sentry, Datadog o similar, y las
alertas del lado del destino. **Esto no está configurado**: necesita una cuenta
y un despliegue, y ninguna de las dos cosas puede salir del repositorio.

---

## 5. Cambio de dominio

El sitio actual está en Netlify con un Worker de Cloudflare delante. Ambos
siguen en pie hasta el final.

**Antes de tocar el DNS**

1. Desplegar en Vercel y comprobar en la URL de previsualización:
   - `npm run visual` en local contra esa build (24 pruebas, seis idiomas);
   - un envío de verdad de principio a fin, con un PDF real;
   - que llega el acuse (esto exige el dominio ya verificado en Resend);
   - entrar al panel y consultar el estado de ese envío.
2. Invitar al comité desde `/panel/equipo` y confirmar que cada persona puede
   fijar contraseña y entrar.
3. Correr las tres suites SQL (`supabase/tests/`) contra el proyecto real.
4. Comprobar los redirects, que son seis y todos con 301:

```sh
for r in index lineamientos quienes-somos equipo-ds mision-ds vision-ds; do
  curl -sI "https://<dominio>/$r.html" | head -2
done
```

`mision-ds.html` y `vision-ds.html` son hoy stubs de meta-refresh y tienen que
seguir funcionando (§14).

**El cambio**

5. Bajar el TTL del DNS a 300 s con un día de antelación.
6. Apuntar el dominio a Vercel.
7. Vigilar los registros una hora. El 404 que más probablemente aparezca es una
   ruta antigua que no está en el mapa de redirects.

**Volver atrás**: devolver el DNS a Netlify. Nada de lo que hace la app nueva
toca el sitio viejo, así que la vuelta es sólo DNS. Lo único que no vuelve son
los envíos recibidos mientras tanto: viven en Supabase y hay que atenderlos
desde el panel aunque el dominio apunte otra vez a Netlify.

8. Retirar Netlify y el Worker **una semana después**, no el mismo día.

---

## 6. Lo que no se migra

La base arranca vacía a propósito (§14). Las filas del libro no se importan:
son pocas, varias son pruebas y una nunca llegó a dictamen. El libro se queda
como archivo histórico.

Los 26 artículos de demostración sí se siembran, con `es_placeholder = true`,
para que el descubrimiento por tema y por sección funcione desde el primer día.
El comité los borra cuando haya contenido real.

**`Vertices_BaseDatos_Editorial.xlsx` no se versiona nunca.** Trae nombres,
correos y enlaces a manuscritos de personas reales. Está en `.gitignore` por
nombre y por extensión.

---

## 7. Comprobaciones periódicas

```sh
npm test        # unidad + juego de claves i18n
npm run visual  # paridad visual, 24 pruebas
npm run panel   # panel y publicación en navegador, contra la base real
npm run e2e     # tubería de envío de principio a fin, contra la base real
```

Las dos últimas **escriben en el proyecto real** y limpian al terminar. `npm run
e2e` gasta uno de los diez envíos por hora de su IP; si devuelve 429, es el
límite haciendo su trabajo:

```sql
delete from privado.golpes;   -- para volver a correrla enseguida
```

Y las suites SQL, pegándolas en el editor de Supabase:

- `supabase/tests/rls.sql` — 26 afirmaciones sobre las políticas
- `supabase/tests/superficie-api.sql` — 19 sobre quién puede llamar qué
- El `do $$` final de cada migración de semillas se comprueba solo al aplicarse

---

## 8. Dos avisos del linter que son correctos

No hay que «arreglarlos»:

- **`envio_folios` tiene RLS y ninguna política.** Es deliberado: denegar a todo
  el mundo salvo a quien salta RLS, que es el `service_role` al crear un envío.
- **`candidatos_asignacion` es `SECURITY DEFINER` y la puede llamar el personal.**
  Es el motivo de que exista: compara el correo del autor —que quien la llama no
  puede ver— con los del comité, y devuelve sólo id y nombre. Por dentro
  comprueba `es_staff()`.
