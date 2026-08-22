# Operación: puesta en marcha, vigilancia y cambio de dominio

Lo que hay que configurar fuera del repositorio, y el orden en que conviene
hacerlo. Todo lo que aparece aquí necesita a una persona con acceso a las
cuentas: no se puede automatizar desde el código.

Referencias: spec §13 (seguridad), §14 (migración y cutover), §15
(observabilidad).

---

## 1. Variables de entorno

La lista canónica es `.env.example`. En local viven en `.env` de la raíz, y
`web/.env.local` es un enlace simbólico a ese archivo:

```sh
cp .env.example .env      # y rellenar
ln -sfn ../.env web/.env.local
```

En Vercel van en *Settings → Environment Variables*, las mismas claves y sin el
prefijo `NEXT_PUBLIC_`: **ninguna** debe llegar al navegador.

| Variable | Para qué | Si falta |
|---|---|---|
| `SUPABASE_URL` | todo | la app no arranca |
| `SUPABASE_SERVICE_ROLE_KEY` | envíos anónimos, firmas, copia de PDF | la app no arranca |
| `SUPABASE_PUBLISHABLE_KEY` | sesión del panel, lectura pública | la app no arranca |
| `RESEND_API_KEY` | acuse y avisos de decisión | se guarda el envío y **no** se avisa; queda `acuse_no_enviado` en `envio_eventos` |
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
2. Cambiar `CORREO_REMITENTE` a una dirección de ese dominio.
3. **Dar de alta el webhook**: *Webhooks → Add endpoint*, apuntando a
   `https://<dominio>/api/webhooks/resend`, con los eventos `email.delivered`,
   `email.bounced`, `email.complained` y `email.delivery_delayed`. Copiar el
   secreto (`whsec_…`) a `RESEND_WEBHOOK_SECRET`.

Por qué importa el webhook: un envío puede guardarse bien y el acuse no llegar
nunca. Sin esto nadie se entera — el autor espera y el comité cree que avisó.
Con esto queda `correo_rebotado` en la bitácora del envío.

**El rebote no lleva la dirección.** `envio_eventos` lo lee todo el comité,
incluida gente que sigue ciega para ese envío; un aviso con el destinatario
dentro sería una puerta trasera a la autoría. Se guarda el tipo de evento y el
id de Resend, y el folio sale del asunto.

---

## 3. Tareas programadas

`web/vercel.json` las declara; Vercel las activa solo al desplegar y manda
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
| rebote | `"evento":"correo"` con `"tipo":"email.bounced"` | dirección mal escrita |

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
cd web
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
