-- El archivo limpio va a una ruta NUEVA, no encima de la sucia.
--
-- Cómo se descubrió: la prueba de extremo a extremo subió un PDF con
-- "Autora Que No Debe Aparecer" en /Info, el servidor lo limpió y lo escribió
-- sobre la misma ruta, y la comprobación posterior descargó 1054 bytes con el
-- nombre dentro cuando el objeto del bucket medía 579 y estaba limpio. Es
-- caché: entre la subida del navegador y la reescritura del servidor pasan
-- unos segundos, y en esos segundos la ruta ya existe y ya se puede pedir. El
-- CDN se queda la copia sucia y la sigue sirviendo, incluso con
-- cache-control: max-age=0, porque la invalidación al sobrescribir no es
-- inmediata.
--
-- Bajar el max-age ayuda pero no cierra el agujero, y quien descarga el
-- manuscrito es justo la persona a la que hay que ocultarle al autor. Una ruta
-- que nunca se sirvió sucia no se puede cachear sucia: eso sí lo cierra.
--
-- crear_envio recibe entonces dos rutas por archivo:
--   subida_path   la que se firmó y por la que se sube. Es la que se valida y
--                 se consume: es el ticket.
--   storage_path  donde vive el archivo ya limpio. Es la que se guarda.

drop function public.crear_envio(jsonb);

create function public.crear_envio(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anio        smallint;
  v_n           integer;
  v_folio       text;
  v_seccion     bigint  := (p->>'seccion_id')::bigint;
  v_tipo        bigint  := (p->>'tipo_pieza_id')::bigint;
  v_investiga   boolean;
  v_nivel       char(1);
  v_dictamen    bigint;
  v_envio       uuid;
  v_archivo     jsonb;
  v_archivo_id  uuid;
  v_i           integer := 0;
  v_ext         text;
  v_ticket      text;
begin
  -- es_investigacion NO viene del cuerpo de la petición: se deriva del tipo de
  -- pieza. Decide si un envío de Horizonte Global se dictamina con el
  -- instrumento de Nivel A, o sea qué tan exigente es su rúbrica, y eso no
  -- puede quedar en manos de quien envía.
  select tp.nombre = 'Paper/Investigación' into v_investiga
    from public.tipos_pieza tp where tp.id = v_tipo;
  v_investiga := coalesce(v_investiga, false);

  select s.nivel into v_nivel from public.secciones s where s.id = v_seccion;
  v_dictamen := case when v_nivel is null then null else v_seccion end;

  if v_investiga and v_seccion = (select s.id from public.secciones s where s.slug = 'horizonte-global') then
    v_nivel    := 'A';
    v_dictamen := (select s.id from public.secciones s where s.slug = 'miradas-economicas');
  end if;

  v_anio := extract(year from (now() at time zone 'America/Mexico_City'))::smallint;

  insert into public.envio_folios (anio, ultimo) values (v_anio, 1)
  on conflict (anio) do update set ultimo = public.envio_folios.ultimo + 1
  returning ultimo into v_n;

  v_folio := format('VTX-%s-%s', v_anio::text, lpad(v_n::text, 3, '0'));

  insert into public.envios (
    folio, titulo, tipo_pieza_id, seccion_id, tema_id, resumen, palabras_clave,
    es_investigacion, uso_ia, locale, nivel, seccion_dictamen_id,
    declaraciones, declaraciones_at
  ) values (
    v_folio,
    p->>'titulo',
    v_tipo,
    v_seccion,
    nullif(p->>'tema_id', '')::bigint,
    p->>'resumen',
    (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(p->'palabras_clave') x),
    v_investiga,
    p->>'uso_ia',
    coalesce(p->>'locale', 'es'),
    v_nivel,
    v_dictamen,
    p->'declaraciones',
    now()
  ) returning id into v_envio;

  insert into public.envios_autoria (envio_id, nombre, correo, afiliacion, coautores, genero)
  values (
    v_envio,
    p->'autoria'->>'nombre',
    p->'autoria'->>'correo',
    nullif(p->'autoria'->>'afiliacion', ''),
    nullif(p->'autoria'->>'coautores', ''),
    nullif(p->'autoria'->>'genero', '')
  );

  for v_archivo in select * from jsonb_array_elements(p->'archivos')
  loop
    v_i := v_i + 1;

    -- El ticket es la ruta firmada. Si no se manda una aparte, se asume que
    -- el archivo se quedó donde se subió.
    v_ticket := coalesce(v_archivo->>'subida_path', v_archivo->>'storage_path');

    update privado.subidas
       set consumido_at = now()
     where storage_path = v_ticket
       and consumido_at is null;

    if not found then
      raise exception 'la ruta % no fue firmada por este servidor o ya se usó', v_ticket
        using errcode = 'check_violation';
    end if;

    v_ext := lower(coalesce(substring(v_archivo->>'nombre_original' from '\.([A-Za-z0-9]+)$'), 'bin'));

    insert into public.envio_archivos (
      envio_id, storage_path, nombre_publico, mime, bytes, es_principal
    ) values (
      v_envio,
      v_archivo->>'storage_path',
      format('%s-%s.%s', v_folio, lpad(v_i::text, 2, '0'), v_ext),
      v_archivo->>'mime',
      (v_archivo->>'bytes')::bigint,
      v_i = 1
    ) returning id into v_archivo_id;

    insert into public.envio_archivo_nombres (archivo_id, nombre_original)
    values (v_archivo_id, v_archivo->>'nombre_original');
  end loop;

  if v_i = 0 then
    raise exception 'un envío sin archivos no es un envío'
      using errcode = 'check_violation';
  end if;

  insert into public.envio_eventos (envio_id, tipo, payload)
  values (v_envio, 'envio_recibido', jsonb_build_object(
    'archivos', v_i, 'nivel', v_nivel, 'seccion_dictamen_id', v_dictamen));

  return jsonb_build_object('id', v_envio, 'folio', v_folio, 'nivel', v_nivel);
end;
$$;

-- ------------------------------------------------------------------ barrido
--
-- Ahora hay dos formas de dejar basura en el bucket: el asistente que se
-- abandona antes de registrar, y la copia limpia que se escribe justo antes
-- de que crear_envio falle. La segunda no pasa por privado.subidas, así que
-- el barrido deja de mirar el registro de tickets y mira el bucket: huérfano
-- es todo objeto que no aparece en envio_archivos.
drop function public.subidas_huerfanas(interval);

create function public.subidas_huerfanas(p_antiguedad interval default interval '24 hours')
returns table (storage_path text, at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select o.name, o.created_at
    from storage.objects o
   where o.bucket_id = 'manuscritos'
     and o.created_at < now() - p_antiguedad
     and not exists (
       select 1 from public.envio_archivos a where a.storage_path = o.name)
   order by o.created_at;
$$;

revoke execute on function public.crear_envio(jsonb) from public;
revoke execute on function public.subidas_huerfanas(interval) from public;
grant execute on function public.crear_envio(jsonb) to service_role;
grant execute on function public.subidas_huerfanas(interval) to service_role;
