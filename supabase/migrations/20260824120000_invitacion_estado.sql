-- Estado real de la invitación al comité.
--
-- `activo` es un flag manual: dice si alguien puede entrar, no si llegó a
-- entrar alguna vez. La pantalla del comité lo enseñaba como si fuera el
-- estado de la cuenta, y por eso una persona invitada cuyo enlace caducó se
-- veía igual que una que lleva meses dictaminando.
--
-- Estas cuatro columnas separan las tres preguntas que estaban mezcladas:
-- cuándo se le mandó el enlace, si llegó a fijar contraseña, y qué hizo el
-- correo por el camino.

alter table public.usuarios
  add column invitada_en          timestamptz,
  add column clave_fijada_en      timestamptz,
  add column invitacion_email_id  text,
  add column invitacion_estado    text;

comment on column public.usuarios.invitada_en is
  'Cuándo salió el último enlace de invitación. Se reescribe al reenviar: lo '
  'que importa es la antigüedad del enlace vivo, no la del primero.';

comment on column public.usuarios.clave_fijada_en is
  'La única señal fiable de que la cuenta está viva. auth.users.last_sign_in_at '
  'no sirve: verifyOtp abre sesión al abrir el enlace aunque la persona cierre '
  'la pestaña sin elegir contraseña.';

comment on column public.usuarios.invitacion_email_id is
  'El id que devuelve Resend al mandar la invitación. Es lo que permite casar '
  'un webhook con una persona SIN guardar la dirección en la bitácora — la '
  'invitación no lleva folio, así que el asunto no sirve de llave.';

comment on column public.usuarios.invitacion_estado is
  'Lo escribe /api/webhooks/resend: enviado, entregado, rebotado, quejado o '
  'retrasado. Sin esto, una invitación a una dirección mal escrita se ve igual '
  'que una que la persona simplemente no ha abierto.';

create index usuarios_invitacion_email_id_idx
  on public.usuarios (invitacion_email_id);

-- Ni grants ni políticas nuevas: `grant select on public.usuarios to
-- authenticated` es de tabla completa y la política usuarios_lectura ya cubre
-- la lectura. Las escrituras van por service_role, que salta RLS.

-- Relleno de quienes ya estaban dentro. Sin esto, el comité entero aparecería
-- como «Sin invitación» el día que se despliegue la columna nueva.
--
-- `last_sign_in_at` es la última entrada, no el momento en que se eligió la
-- contraseña; para las filas que ya existen es la mejor aproximación que hay, y
-- de aquí en adelante lo escribe fijarClave con la fecha buena.
update public.usuarios u
set invitada_en     = a.invited_at,
    clave_fijada_en = a.last_sign_in_at
from auth.users a
where a.id = u.id
  and a.encrypted_password is not null
  and a.encrypted_password <> ''
  and a.last_sign_in_at is not null;
