-- Rediseño del portal de envíos: datos específicos por sección y rol de cada
-- archivo. La estructura queda en JSONB porque cada sección pide un conjunto
-- distinto y el formulario puede evolucionar sin añadir columnas vacías.

alter table public.envios
  add column datos_seccion jsonb not null default '{}'::jsonb;

alter table public.envio_archivos
  add column rol text not null default 'adjunto';

alter table public.envio_archivos
  add constraint envio_archivos_rol_valido check (
    rol in ('visualizacion','foto','cesion_imagen','paper','anexo','articulo','adjunto')
  );

create or replace function public.crear_envio(p jsonb)
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
begin
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
    datos_seccion, declaraciones, declaraciones_at
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
    coalesce(p->'datos_seccion', '{}'::jsonb),
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

  for v_archivo in select * from jsonb_array_elements(coalesce(p->'archivos', '[]'::jsonb))
  loop
    v_i := v_i + 1;

    -- La ruta firmada es el ticket consumible; la ruta limpia es un objeto
    -- nuevo y es la que se conserva en el envío.
    update privado.subidas
       set consumido_at = now()
     where storage_path = v_archivo->>'subida_path'
       and consumido_at is null;

    if not found then
      raise exception 'la ruta % no fue firmada por este servidor o ya se usó',
        v_archivo->>'subida_path'
        using errcode = 'check_violation';
    end if;

    v_ext := lower(coalesce(substring(v_archivo->>'nombre_original' from '\.([A-Za-z0-9]+)$'), 'bin'));

    insert into public.envio_archivos (
      envio_id, storage_path, nombre_publico, mime, bytes, es_principal, rol
    ) values (
      v_envio,
      v_archivo->>'storage_path',
      format('%s-%s.%s', v_folio, lpad(v_i::text, 2, '0'), v_ext),
      v_archivo->>'mime',
      (v_archivo->>'bytes')::bigint,
      (v_archivo->>'rol') in ('paper','articulo'),
      coalesce(nullif(v_archivo->>'rol', ''), 'adjunto')
    ) returning id into v_archivo_id;

    insert into public.envio_archivo_nombres (archivo_id, nombre_original)
    values (v_archivo_id, v_archivo->>'nombre_original');
  end loop;

  insert into public.envio_eventos (envio_id, tipo, payload)
  values (v_envio, 'envio_recibido', jsonb_build_object(
    'archivos', v_i, 'nivel', v_nivel, 'seccion_dictamen_id', v_dictamen));

  return jsonb_build_object('id', v_envio, 'folio', v_folio, 'nivel', v_nivel);
end;
$$;
