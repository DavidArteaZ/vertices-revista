-- Buckets de almacenamiento (spec §9, §13).
--
-- manuscritos  privado. Un manuscrito sin publicar no debe poder alcanzarse
--              adivinando una URL, así que no lleva ni una sola política:
--              storage.objects tiene RLS activo y sin política nadie pasa,
--              salvo los roles que la saltan. En la práctica eso deja el
--              bucket accesible únicamente al service_role, es decir a las
--              rutas de servidor de §4.2, que firman URLs de duración corta.
--
-- publicaciones  público. Aquí sólo llega el PDF de una pieza ya publicada,
--                copiado desde el bucket privado en el momento de publicar la
--                edición. Ser público es el punto: es contenido de la revista.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('manuscritos', 'manuscritos', false, 20971520, array[
     'application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
   ]),
  ('publicaciones', 'publicaciones', true, 20971520, array['application/pdf'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- El límite de 20 MB también vive en el bucket, no sólo en la validación del
-- formulario: la subida va del navegador directamente a Storage y la ruta de
-- API no ve los bytes pasar. Si el único tope estuviera en JavaScript, no
-- habría tope.

-- ------------------------------------------------------------ subidas firmadas
--
-- Cada URL de subida que se firma queda anotada aquí. Sirve para dos cosas:
--
--   1. POST /api/envios acepta una ruta de Storage sólo si la firmó él mismo y
--      todavía no se ha usado. Sin este registro, el cuerpo del POST podría
--      nombrar cualquier objeto del bucket y adjuntarlo a un envío nuevo —el
--      manuscrito de otra persona, por ejemplo—. Que las rutas sean uuid lo
--      hace improbable; esto lo hace imposible.
--   2. El barrido de huérfanos (spec §8) necesita saber qué se subió y nunca
--      se convirtió en envío. Un asistente abandonado a medias deja el objeto
--      en el bucket para siempre.
create table privado.subidas (
  storage_path  text primary key,
  bucket        text not null,
  mime          text not null,
  ip_hash       text,
  at            timestamptz not null default now(),
  consumido_at  timestamptz
);

create index subidas_pendientes_idx on privado.subidas (at) where consumido_at is null;

-- --------------------------------------------------------------- límite de tasa
--
-- Ventana deslizante, no fija: una ventana fija deja pasar el doble del cupo a
-- caballo entre dos ventanas, y una de las cosas que se limitan es un oráculo
-- de correos (§13). El volumen de la revista es de unas decenas de envíos al
-- año, así que contar filas sale gratis y no hace falta Redis.
create table privado.golpes (
  id     bigint generated always as identity primary key,
  clave  text not null,
  at     timestamptz not null default now()
);

create index golpes_clave_at_idx on privado.golpes (clave, at desc);
create index golpes_at_idx on privado.golpes (at);

create function privado.limite(p_clave text, p_ventana interval, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  -- Barrido de lo caducado. A este volumen es más barato que un cron.
  delete from privado.golpes where at < now() - interval '1 day';

  select count(*) into n
    from privado.golpes
   where clave = p_clave and at > now() - p_ventana;

  if n >= p_max then
    return false;
  end if;

  insert into privado.golpes (clave) values (p_clave);
  return true;
end;
$$;

comment on function privado.limite(text, interval, integer) is
  'Devuelve falso si la clave ya agotó su cupo en la ventana, y en ese caso NO '
  'anota el golpe: quien está bloqueado no alarga su propio bloqueo con cada '
  'reintento.';

-- ------------------------------------------------------------ retroceso exponencial
--
-- Para /api/estado, que es un oráculo de correos si se le deja: es público, no
-- autenticado, confirma la pareja folio↔correo, y los folios son una secuencia
-- predecible. Un dictaminador ciego ya tiene el folio y sólo necesita probar
-- direcciones. El límite de tasa por ventana no basta; hace falta que cada
-- fallo encarezca el siguiente.
create table privado.intentos (
  clave            text primary key,
  fallos           integer not null default 0,
  bloqueado_hasta  timestamptz,
  at               timestamptz not null default now()
);

create index intentos_at_idx on privado.intentos (at);

create function privado.intento_bloqueado(p_clave text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    (select bloqueado_hasta > now() from privado.intentos where clave = p_clave),
    false);
$$;

create function privado.intento_fallo(p_clave text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from privado.intentos
   where at < now() - interval '1 day' and coalesce(bloqueado_hasta, at) < now();

  insert into privado.intentos (clave, fallos, at)
       values (p_clave, 1, now())
  on conflict (clave) do update
     set fallos = privado.intentos.fallos + 1,
         at     = now()
  returning fallos into n;

  -- Tres fallos de gracia: teclear mal el correo propio es normal. A partir de
  -- ahí 2^(n-3) segundos, con techo de una hora.
  if n > 3 then
    update privado.intentos
       set bloqueado_hasta = now() + least(
             make_interval(secs => power(2, least(n - 3, 12))::double precision),
             interval '1 hour')
     where clave = p_clave;
  end if;
end;
$$;

create function privado.intento_ok(p_clave text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from privado.intentos where clave = p_clave;
$$;

-- Nada de esto lo llama el navegador: lo llaman las rutas de servidor con la
-- clave de servicio. Se revoca de public por si acaso, porque Postgres concede
-- EXECUTE a PUBLIC en cada función nueva.
revoke execute on function privado.limite(text, interval, integer) from public;
revoke execute on function privado.intento_bloqueado(text) from public;
revoke execute on function privado.intento_fallo(text) from public;
revoke execute on function privado.intento_ok(text) from public;
