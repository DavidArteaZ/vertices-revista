# Traspaso de cuentas

Cómo pasar el proyecto de las cuentas personales de quien lo construyó a las
cuentas de la revista, sin pagar nada y sin que el sitio deje de funcionar.

Cuatro servicios: **GitHub** (el código), **Vercel** (el sitio publicado),
**Supabase** (la base de datos y los PDF), **Resend** (el correo).

Referencias: `docs/operacion.md` (variables y vigilancia del día a día),
`docs/manual-claude.md` (cómo hacer cambios después, sin saber programar).

---

## 0. La regla de oro

**Las cuatro cuentas van a un correo institucional compartido de la revista, no
al correo personal de nadie.**

Algo como `revista@…` o `vertices@…`, con la contraseña guardada donde el comité
la pueda recuperar. Si las cuentas quedan a nombre de una persona, dentro de un
año la revista está exactamente en el mismo problema que hoy: el sitio depende
de alguien que ya no está.

Esto importa más que cualquier paso técnico de este documento. Vercel en su plan
gratuito **no tiene equipos ni miembros**: hay un dueño y nadie más. La única
forma de que la revista sea la dueña es que la cuenta sea de la revista.

---

## 1. Qué se mueve y cómo

| Servicio | Qué hacemos | Por qué así |
|---|---|---|
| GitHub | **Transferir** el repo a la organización `lec-cdmx` | Gratis, un clic, conserva historial e issues. |
| Supabase | **Transferir** el proyecto a la organización de la revista | Conserva el mismo identificador de proyecto y las mismas claves: las variables no cambian y no hay que volver a correr las migraciones. |
| Vercel | **Crear de nuevo** en la cuenta de la revista | Transferir exigiría que el saliente fuera *miembro* del equipo destino, y el plan gratuito no tiene miembros. Crear de nuevo son diez minutos y no se pierde nada, porque todo el estado vive en Supabase. |
| Resend | **Crear cuenta nueva** | Las claves de API no se pueden mover entre cuentas. |

Ninguno de estos pasos cuesta dinero.

---

## 2. Antes del día del traspaso

El DNS tarda, así que esto se hace con días de anticipación. Nada de aquí toca
el sitio en producción.

- [x] Crear el correo institucional compartido de la revista.
- [x] Con ese correo, crear cuenta en **Vercel**, en **Supabase** y en **Resend**.
- [x] En Supabase, crear la organización de la revista (plan Free).
- [x] Confirmar que esa cuenta de Supabase **no tiene ya dos proyectos**: el plan
      gratuito permite dos por persona, contando todas las organizaciones donde
      sea dueña o administradora.
- [ ] En **Resend**, dar de alta el dominio de la revista y publicar en el DNS
      los registros TXT que pida (SPF y DKIM). Esperar a que aparezca como
      verificado. *Sin esto los autores no reciben su acuse de recibo.*
- [x] La revista invita al saliente a su organización de Supabase (rol
      Administrador). Hace falta para poder transferir; se le quita al final.
- [ ] Quien sale confirma que el proyecto de Supabase **no tiene integración de
      GitHub activa** (*Settings → Integrations*). Si la tiene, desconectarla:
      con la integración conectada la transferencia está bloqueada.

---

## 3. El día del traspaso

Orden pensado para que el sitio siga en pie hasta el último momento posible. El
único hueco de caída son unos dos minutos en el paso 3.5.

### 3.1 GitHub

- [x] En el repo → *Settings → General → Transfer ownership* → organización
      `lec-cdmx`.
- [x] La organización acepta la transferencia.
- [ ] En la copia local, apuntar el remoto a la organización:

```sh
git remote set-url origin git@github.com:lec-cdmx/vertices.git
```

### 3.2 Supabase

- [x] En el proyecto → *Settings → General → Transfer project* → la organización
      de la revista.
- [x] Esperar. Puede haber uno o dos minutos de caída de la base.
- [x] Verificar que el identificador del proyecto **no cambió**: la URL
      `https://….supabase.co` y las claves siguen siendo las mismas. Esto es lo
      que evita tener que tocar nada más.

### 3.3 Vercel, proyecto nuevo

- [x] Desde la cuenta de la revista: *Add New → Project* → importar
      `lec-cdmx/vertices`.
- [x] **Antes de desplegar**, copiar las siete variables de entorno en
      *Settings → Environment Variables*, marcando en cada una **Production,
      Preview y Development**. La lista canónica está en `.env.example`; la
      explicación de cada una, en `docs/operacion.md §1`:

  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
  `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `CRON_SECRET`, `CORREO_REMITENTE`

  De momento van los valores viejos; se rotan en el paso 3.7.

  > **Ninguna lleva el prefijo `NEXT_PUBLIC_`.** Ese prefijo publica la variable
  > en el navegador. `SUPABASE_SERVICE_ROLE_KEY` en el navegador significa que
  > cualquiera puede leer y borrar toda la base de datos.

  > **Esto va antes del primer despliegue, no después.** La portada lee los
  > artículos de Supabase *durante la compilación*, para prerenderizar las 28
  > páginas de los seis idiomas. Sin las variables el build falla así:
  >
  > ```
  > Generating static pages using 1 worker (0/28) ...
  > Error occurred prerendering page "/es"
  > Error: faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY; ver .env.example
  > ```
  >
  > Si ya pasó: añadir las variables y volver a desplegar desde *Deployments →
  > Redeploy*. Un despliegue ya fallido no recoge variables nuevas; hace falta
  > uno nuevo.

- [x] Desplegar. Vercel da una dirección `…vercel.app`.

### 3.4 Probar en la dirección temporal

Todavía sin tocar el dominio. Si algo está mal, aquí es donde se ve.

- [ ] Abrir la portada y cambiar de idioma.
- [ ] Mandar un envío de prueba con un PDF y confirmar que llega el acuse.
- [ ] Entrar al panel del comité.
- [ ] Disparar un cron a mano:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://<la-de-vercel>.vercel.app/api/mantenimiento/digest
```

### 3.5 El dominio

- [x] En el proyecto **viejo** de Vercel: quitar el dominio.
- [ ] En el proyecto **nuevo**: añadirlo y seguir las instrucciones de DNS.
- [ ] Esperar a que el certificado salga válido (suele ser un minuto).

### 3.6 Resend

- [x] *Webhooks → Add endpoint* apuntando a
      `https://<dominio>/api/webhooks/resend`, con los eventos
      `email.delivered`, `email.bounced`, `email.complained` y
      `email.delivery_delayed`.
- [x] Copiar el secreto (`whsec_…`).
- [x] Crear una clave de API nueva.
- [x] Poner `CORREO_REMITENTE` con una dirección del dominio verificado.

### 3.7 Rotar los secretos

Quien sale ha visto todas estas claves. Mientras sigan vivas, sigue teniendo
acceso a la base de datos y al correo de la revista. **Este paso no es opcional
y no se pospone.**

- [x] `RESEND_API_KEY` y `RESEND_WEBHOOK_SECRET`: los del paso 3.6.
- [ ] `CRON_SECRET`: valor nuevo, `openssl rand -hex 32`.
- [x] `SUPABASE_SERVICE_ROLE_KEY`: rotarla en *Settings → API*.

  Rotar esta clave **reinicia los contadores de límite de tasa** y no rompe nada
  más. Se usa además como sal del hash de IP, a propósito, para no guardar
  ninguna dirección en claro (`docs/operacion.md §1`).

- [x] Actualizar las cuatro en Vercel y volver a desplegar.
- [x] Repetir la prueba de envío del paso 3.4, ahora sobre el dominio real.

### 3.8 Cerrar la puerta

- [ ] Quien sale borra su proyecto de Vercel.
- [ ] Quien sale sale de la organización de Supabase, o la revista lo quita.
- [ ] Quien sale se quita del repo de la organización en GitHub.
- [ ] Quien sale borra su cuenta vieja de Resend, o al menos la clave de API.
- [ ] La revista cambia la contraseña del correo institucional.

---

## 4. Verificación final

Todo esto sobre el dominio real, no sobre la dirección de Vercel.

- [ ] La portada carga y el selector de idioma funciona.
- [ ] Un envío de prueba completo: PDF sube, folio se genera, acuse llega.
- [ ] El panel del comité abre y se ve el envío de prueba.
- [ ] En Resend, ese correo aparece como `delivered`.
- [ ] En la bitácora del envío (`envio_eventos`) aparece el evento de entrega
      — eso prueba que el webhook está bien firmado.
- [ ] Los dos crons aparecen listados en Vercel → *Settings → Cron Jobs*.
- [ ] Borrar el envío de prueba.

---

## 5. Los límites del plan gratuito

Lo que la revista necesita saber para no llevarse un susto.

| Servicio | Límite | Qué significa aquí |
|---|---|---|
| Vercel Hobby | **Solo uso no comercial** | Una revista académica sin fines de lucro cabe. Si algún día se cobra por publicar o se vende publicidad, deja de caber y hay que pasar a Pro. |
| Vercel Hobby | Sin equipos: un solo dueño | Por eso la cuenta es institucional (§0). |
| Vercel Hobby | Crons: mínimo uno al día, precisión ±59 min | Los dos crons del proyecto (diario 4:00 y lunes 14:00) caben. El de las 4:00 puede correr a cualquier hora entre 4:00 y 4:59. No intentar poner uno más frecuente: el despliegue falla. |
| Vercel Hobby | 100 despliegues al día | De sobra. |
| Supabase Free | 500 MB de base, 1 GB de archivos | El límite real es el de archivos: son PDF de hasta 20 MB. Vigilar cuando se acerque; el cron diario de huérfanos ayuda borrando lo que quedó sin envío. |
| Supabase Free | **Se pausa tras una semana sin actividad** | En la práctica no pasa: el cron diario de mantenimiento consulta la base todos los días y la mantiene despierta. Si alguien quita ese cron, el proyecto se pausa solo. Un proyecto pausado se restaura desde el panel. |
| Supabase Free | Dos proyectos por cuenta | No crear proyectos de prueba con la cuenta de la revista. |
| Resend Free | 3.000 correos al mes, 100 al día | Muy por encima de lo que mueve la revista. |
| Resend Free | Un dominio | El de la revista. |

Fuentes: [plan Hobby de Vercel](https://vercel.com/docs/plans/hobby),
[crons en Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[pausado de proyectos en Supabase](https://supabase.com/docs/guides/platform/free-project-pausing),
[transferencia de proyectos en Supabase](https://supabase.com/docs/guides/platform/project-transfer),
[precios de Resend](https://resend.com/pricing).

---

## 6. Si algo sale mal

**Durante el traspaso.** Hasta el paso 3.5 el sitio viejo sigue publicado y
sirviendo: para volver atrás basta con no mover el dominio. Después del 3.5, se
devuelve el dominio al proyecto viejo — mientras no se haya borrado en el 3.8.

Por eso el 3.8 va al final y no antes.

**Después.** Todo cambio en el sitio se puede deshacer de dos formas:

- En Vercel → *Deployments* → un despliegue anterior → *Instant Rollback*. El
  sitio vuelve como estaba en segundos.
- En el código, `git revert` del cambio y desplegar otra vez.

Lo que **no** se deshace con eso son los cambios hechos directamente en la base
de datos. Por eso el manual de operación pide no correr SQL a mano sin haber
entendido qué hace.
