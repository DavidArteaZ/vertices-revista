-- La superficie que consumen las rutas de servidor de la etapa 4.
--
-- Son funciones y no consultas sueltas desde el cliente de Supabase por una
-- razón concreta: PostgREST no tiene transacciones entre peticiones. Un envío
-- toca cinco tablas y toma un folio de un contador; hacerlo en cinco llamadas
-- deja huecos donde una falla a mitad de camino produce un folio quemado o un
-- envío sin autoría. Aquí es una sola sentencia y por tanto una sola
-- transacción.
--
-- Todas se conceden únicamente a service_role. Postgres concede EXECUTE a
-- PUBLIC en cada función nueva, así que hay que revocarlo explícitamente: la
-- revocación de privilegios por omisión de 20260821120700 cubre a los roles
-- anon y authenticated, no al pseudo-rol PUBLIC.

-- ------------------------------------------------------------ preparar subida
--
-- Devuelve la ruta bajo la que el navegador puede subir un archivo, tras
-- comprobar el límite de tasa. La ruta es un uuid: nunca se deriva del nombre
-- del archivo, porque el nombre del archivo delata al autor más veces de las
-- que uno esperaría (en los datos reales hay un
-- "GuiaExpositor_Politica_de_Competencia.pdf").
create function public.preparar_subida(p_mime text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if not privado.limite('subida:' || coalesce(p_ip_hash, 'anon'), interval '1 hour', 40) then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  v_path := gen_random_uuid()::text;

  insert into privado.subidas (storage_path, bucket, mime, ip_hash)
       values (v_path, 'manuscritos', p_mime, p_ip_hash);

  return jsonb_build_object('ok', true, 'path', v_path);
end;
$$;

-- ---------------------------------------------------------------- crear envío
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
begin
  -- es_investigacion NO viene del cuerpo de la petición: se deriva del tipo de
  -- pieza. Es lo que decide si un envío de Horizonte Global se dictamina con
  -- el instrumento de Nivel A, o sea qué tan exigente es su rúbrica, y eso no
  -- puede quedar en manos de quien envía.
  select tp.nombre = 'Paper/Investigación' into v_investiga
    from public.tipos_pieza tp where tp.id = v_tipo;
  v_investiga := coalesce(v_investiga, false);

  -- Enrutamiento de nivel: se toma el de la sección y luego se aplica la
  -- excepción del libro. "Por asignar" no tiene nivel y por tanto tampoco
  -- instrumento: queda esperando triaje.
  select s.nivel into v_nivel from public.secciones s where s.id = v_seccion;
  v_dictamen := case when v_nivel is null then null else v_seccion end;

  if v_investiga and v_seccion = (select s.id from public.secciones s where s.slug = 'horizonte-global') then
    v_nivel    := 'A';
    v_dictamen := (select s.id from public.secciones s where s.slug = 'miradas-economicas');
  end if;

  -- El año en America/Mexico_City, no en UTC: Vercel corre en UTC y la revista
  -- no, así que un envío del 31 de diciembre por la noche recibiría folio de
  -- enero. El upsert toma el candado de la fila, de modo que dos envíos
  -- simultáneos no pueden obtener el mismo número, y si algo falla después el
  -- rollback devuelve el contador — que es exactamente lo que una secuencia no
  -- haría.
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

    -- Sólo se adjunta lo que este servidor firmó y nadie ha reclamado todavía.
    -- Sin esta comprobación el cuerpo del POST podría nombrar el objeto de
    -- otra persona y colgarlo de un envío propio.
    update privado.subidas
       set consumido_at = now()
     where storage_path = v_archivo->>'storage_path'
       and consumido_at is null;

    if not found then
      raise exception 'la ruta % no fue firmada por este servidor o ya se usó',
        v_archivo->>'storage_path'
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

-- ----------------------------------------------------------- consultar estado
--
-- Endurecido según §13, porque tal cual estaba es un oráculo de correos:
-- público, sin autenticar, confirma la pareja folio↔correo y los folios son
-- una secuencia predecible. Un dictaminador ciego ya tiene el folio.
--
--   · límite de tasa por IP y, por separado, por folio;
--   · retroceso exponencial sobre los fallos de la pareja;
--   · respuesta idéntica para "correo equivocado" y "folio inexistente" —el
--     mismo jsonb, el mismo 200 en la ruta—, sin señal de enumeración;
--   · las dos ramas hacen el mismo trabajo, así que tampoco la diferencia el
--     tiempo de respuesta de forma apreciable.
--
-- Lo que el autor ve es la decisión GRABADA por el comité, o "en revisión". No
-- la sugerida por el motor. Es un cambio deliberado frente al libro, donde
-- Registro!S4 lee la decisión vigente y ésta cae en la auto-sugerida: hoy, en
-- cuanto un dictaminador califica una sola dimensión, el estado que ve el
-- autor puede saltar a jerga cruda como "No publicable (falla puerta ★)".
create function public.consultar_estado(p_folio text, p_correo text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folio  text := upper(trim(coalesce(p_folio, '')));
  v_correo text := lower(trim(coalesce(p_correo, '')));
  v_clave  text := 'estado:' || v_folio || ':' || v_correo;
  v_fila   record;
begin
  if not privado.limite('estado-ip:' || coalesce(p_ip_hash, 'anon'), interval '1 hour', 30)
     or not privado.limite('estado-folio:' || v_folio, interval '1 hour', 10)
     or privado.intento_bloqueado(v_clave)
     or privado.intento_bloqueado('estado-ip:' || coalesce(p_ip_hash, 'anon'))
  then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  select e.folio, e.titulo, e.created_at, e.archivado_at, d.etiqueta as decision
    into v_fila
    from public.envios e
    left join public.decisiones d on d.id = e.decision_id
    join public.envios_autoria a on a.envio_id = e.id
   where e.folio = v_folio
     and lower(a.correo) = v_correo;

  if not found then
    perform privado.intento_fallo(v_clave);
    perform privado.intento_fallo('estado-ip:' || coalesce(p_ip_hash, 'anon'));
    return jsonb_build_object('ok', false, 'motivo', 'no_coincide');
  end if;

  perform privado.intento_ok(v_clave);
  perform privado.intento_ok('estado-ip:' || coalesce(p_ip_hash, 'anon'));

  return jsonb_build_object(
    'ok', true,
    'folio', v_fila.folio,
    'titulo', v_fila.titulo,
    'recibido_at', v_fila.created_at,
    'decision', v_fila.decision);
end;
$$;

-- ------------------------------------------------------------------- barrido
--
-- Objetos subidos que nunca llegaron a ser un envío: asistentes abandonados a
-- medias. Informa, no borra — §15 pide expresamente que el barrido no elimine
-- en silencio. Quien decide es la ruta que lo llama.
create function public.subidas_huerfanas(p_antiguedad interval default interval '24 hours')
returns table (storage_path text, at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select s.storage_path, s.at
    from privado.subidas s
   where s.consumido_at is null
     and s.at < now() - p_antiguedad
   order by s.at;
$$;

create function public.olvidar_subida(p_path text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from privado.subidas where storage_path = p_path and consumido_at is null;
$$;

-- ------------------------------------------------------------------- grants
revoke execute on function public.preparar_subida(text, text) from public;
revoke execute on function public.crear_envio(jsonb) from public;
revoke execute on function public.consultar_estado(text, text, text) from public;
revoke execute on function public.subidas_huerfanas(interval) from public;
revoke execute on function public.olvidar_subida(text) from public;

grant execute on function public.preparar_subida(text, text) to service_role;
grant execute on function public.crear_envio(jsonb) to service_role;
grant execute on function public.consultar_estado(text, text, text) to service_role;
grant execute on function public.subidas_huerfanas(interval) to service_role;
grant execute on function public.olvidar_subida(text) to service_role;
