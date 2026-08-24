-- Lo que el panel necesita de la base (spec §4.2, §5.4, §7).
--
-- Las acciones del panel corren como la SESIÓN DE LA PERSONA, no como
-- service_role: es la decisión de la etapa 3 y es la que hace que la suite de
-- RLS signifique algo. Así que casi todo esto es SECURITY INVOKER —las
-- políticas siguen aplicándose por dentro— y sólo dos funciones son DEFINER,
-- cada una por un motivo que se explica donde está.
--
-- Son funciones y no dos sentencias sueltas desde el servidor porque cada una
-- de estas transiciones desvela algo y tiene que quedar en la bitácora. Un
-- UPDATE que sí ocurre y un INSERT en envio_eventos que no, dejan un desvelado
-- sin registro, y entonces la afirmación de §7 —"la ceguera es responsable
-- aunque no absoluta"— pasa a ser falsa. Una función es una transacción.

-- ============================================================ enrutamiento
--
-- El nivel y el instrumento de dictamen se derivan de la sección y del tipo de
-- pieza. Hasta ahora esa derivación vivía dentro de crear_envio, lo cual
-- bastaba mientras la sección no cambiaba nunca. El triaje del panel la cambia:
-- una pieza que llegó como "Por asignar" recibe su sección de verdad, y con
-- ella su nivel y su rúbrica. Dos implementaciones de la misma regla acaban
-- divergiendo, así que se muda a un disparador y crear_envio deja de calcularla.
create function privado.deriva_enrutamiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nivel char(1);
begin
  -- es_investigacion no es un dato que nadie teclee: es el tipo de pieza.
  new.es_investigacion := coalesce(
    (select tp.nombre = 'Paper/Investigación'
       from public.tipos_pieza tp where tp.id = new.tipo_pieza_id), false);

  select s.nivel into v_nivel from public.secciones s where s.id = new.seccion_id;

  -- "Por asignar" no tiene nivel, y por tanto tampoco instrumento: se queda
  -- esperando triaje y no se puede asignar a nadie.
  new.nivel := v_nivel;
  new.seccion_dictamen_id := case when v_nivel is null then null else new.seccion_id end;

  -- La excepción del libro: Horizonte Global con investigación sube a Nivel A
  -- y se dictamina con el instrumento de Miradas Económicas.
  if new.es_investigacion
     and new.seccion_id = (select s.id from public.secciones s where s.slug = 'horizonte-global')
  then
    new.nivel := 'A';
    new.seccion_dictamen_id := (select s.id from public.secciones s where s.slug = 'miradas-economicas');
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function privado.deriva_enrutamiento() from public;

create trigger envios_deriva_enrutamiento
  before insert or update of seccion_id, tipo_pieza_id on public.envios
  for each row execute function privado.deriva_enrutamiento();

-- crear_envio deja de calcular el enrutamiento y lo lee de vuelta: ahora hay
-- una sola implementación de la regla y es el disparador. Se conserva la misma
-- firma, así que la ruta no cambia.
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
  v_envio       uuid;
  v_nivel       char(1);
  v_dictamen    bigint;
  v_archivo     jsonb;
  v_archivo_id  uuid;
  v_i           integer := 0;
  v_ext         text;
  v_ticket      text;
begin
  v_anio := extract(year from (now() at time zone 'America/Mexico_City'))::smallint;

  insert into public.envio_folios (anio, ultimo) values (v_anio, 1)
  on conflict (anio) do update set ultimo = public.envio_folios.ultimo + 1
  returning ultimo into v_n;

  v_folio := format('VTX-%s-%s', v_anio::text, lpad(v_n::text, 3, '0'));

  insert into public.envios (
    folio, titulo, tipo_pieza_id, seccion_id, tema_id, resumen, palabras_clave,
    uso_ia, locale, declaraciones, declaraciones_at
  ) values (
    v_folio,
    p->>'titulo',
    (p->>'tipo_pieza_id')::bigint,
    (p->>'seccion_id')::bigint,
    nullif(p->>'tema_id', '')::bigint,
    p->>'resumen',
    (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(p->'palabras_clave') x),
    p->>'uso_ia',
    coalesce(p->>'locale', 'es'),
    p->'declaraciones',
    now()
  ) returning nivel, seccion_dictamen_id, id into v_nivel, v_dictamen, v_envio;

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
    v_ticket := coalesce(v_archivo->>'subida_path', v_archivo->>'storage_path');

    update privado.subidas
       set consumido_at = now()
     where storage_path = v_ticket and consumido_at is null;

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

revoke execute on function public.crear_envio(jsonb) from public;
grant execute on function public.crear_envio(jsonb) to service_role;

-- ================================================== candidatos a dictaminar
--
-- SECURITY DEFINER porque tiene que comparar el correo del autor con los del
-- personal, y quien abre el formulario de asignación no puede ver ese correo:
-- justamente por eso la comprobación vive aquí dentro.
--
-- Y por eso mismo NO dice por qué falta alguien. "No se puede asignar a Ana,
-- su correo coincide" convertiría el selector en un oráculo: se recorre la
-- lista de diez personas y la única que falta es la autora (spec §7.3).
-- Quien tiene conflicto simplemente no aparece.
--
-- El correo no detecta la coautoría, así que el dictamen lleva además la
-- casilla de autodeclaración (dictamenes.sin_conflicto).
create function public.candidatos_asignacion(p_envio uuid)
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.nombre
    from public.usuarios u
   where privado.es_staff()
     and u.activo
     and not exists (
       select 1 from public.asignaciones a
        where a.envio_id = p_envio and a.revisor_id = u.id)
     and not exists (
       select 1
         from public.envios_autoria au
        where au.envio_id = p_envio
          and lower(au.correo) in (
            select lower(u.email)
            union all
            select lower(c.correo) from public.usuario_correos c where c.usuario_id = u.id))
   order by u.nombre;
$$;

-- ==================================================== enviar un dictamen
--
-- El paso a 'enviado' es el desvelado por-persona de §7.2: quien lo hace ve la
-- autoría de ese envío a partir de ese momento, y nadie más. El disparador de
-- la etapa 3 exige la tarjeta completa y hace la transición irreversible; esto
-- añade la instantánea y la bitácora, en la misma transacción.
--
-- La instantánea la calcula el servidor con el motor de decidir.ts y se guarda
-- tal cual: es lo que el comité vio el día que dictaminó. No se recalcula
-- nunca, ni aunque la rúbrica cambie después.
create function public.enviar_dictamen(
  p_dictamen      uuid,
  p_puntaje       integer,
  p_maximo        integer,
  p_puertas_ok    boolean,
  p_criticos_ok   boolean,
  p_decision      bigint,
  p_comentarios   text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_envio uuid;
begin
  update public.dictamenes
     set estado               = 'enviado',
         enviado_at           = now(),
         puntaje              = p_puntaje,
         maximo               = p_maximo,
         puertas_ok           = p_puertas_ok,
         criticos_ok          = p_criticos_ok,
         decision_sugerida_id = p_decision,
         comentarios          = coalesce(p_comentarios, comentarios),
         updated_at           = now()
   where id = p_dictamen
  returning envio_id into v_envio;

  -- Si RLS lo bloqueó, el UPDATE afecta cero filas y no lanza error. Hay que
  -- mirar FOUND, no esperar una excepción.
  if not found then
    raise exception 'no se pudo enviar el dictamen %', p_dictamen
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.envio_eventos (envio_id, actor_id, tipo, payload)
  values (v_envio, (select auth.uid()), 'dictamen_enviado',
          jsonb_build_object('dictamen', p_dictamen, 'puntaje', p_puntaje,
                             'maximo', p_maximo, 'decision_sugerida', p_decision));

  -- El envío entra en dictamen en cuanto llega el primero.
  update public.envios set estado = 'en_dictamen', updated_at = now()
   where id = v_envio and estado in ('recibido', 'triage', 'asignado');
end;
$$;

-- ================================================== registrar la decisión
--
-- El desvelado para TODO el comité (§7.2, disparador 2). La restricción
-- envios_decision_con_actor exige que la decisión venga siempre con quién y
-- cuándo: es el registro de responsabilidad, y por eso se escriben juntos.
create function public.registrar_decision(p_envio uuid, p_decision bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.envios
     set decision_id        = p_decision,
         decision_final_por = (select auth.uid()),
         decision_final_at  = now(),
         estado             = 'decidido',
         updated_at         = now()
   where id = p_envio;

  if not found then
    raise exception 'no se pudo registrar la decisión del envío %', p_envio
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.envio_eventos (envio_id, actor_id, tipo, payload)
  values (p_envio, (select auth.uid()), 'decision_registrada',
          jsonb_build_object('decision', p_decision));
end;
$$;

-- ============================================ revisión de anonimización
create function public.marcar_anonimizacion(p_envio uuid, p_antiplagio text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.envios
     set anonimizacion_revisada_por = (select auth.uid()),
         anonimizacion_revisada_at  = now(),
         antiplagio                 = coalesce(p_antiplagio, antiplagio),
         updated_at                 = now()
   where id = p_envio;

  if not found then
    raise exception 'no se pudo marcar la anonimización de %', p_envio
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.envio_eventos (envio_id, actor_id, tipo, payload)
  values (p_envio, (select auth.uid()), 'anonimizacion_revisada', '{}'::jsonb);
end;
$$;

-- ==================================================== vincular una revisión
--
-- Cuatro de los ocho veredictos piden al autor rehacer la pieza. Sin cuentas de
-- autor, quien reenvía pasa otra vez por el formulario público y recibe un
-- folio nuevo; el comité une los dos aquí para que la historia de dictamen se
-- pueda seguir (spec §10.1).
create function public.vincular_revision(p_envio uuid, p_original uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_envio = p_original then
    raise exception 'un envío no es revisión de sí mismo' using errcode = 'check_violation';
  end if;

  update public.envios
     set revision_de_envio_id = p_original, updated_at = now()
   where id = p_envio;

  if not found then
    raise exception 'no se pudo vincular la revisión %', p_envio
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.envio_eventos (envio_id, actor_id, tipo, payload)
  values (p_envio, (select auth.uid()), 'revision_vinculada',
          jsonb_build_object('original', p_original));
end;
$$;

-- ==================================================================== grants
--
-- Postgres concede EXECUTE a PUBLIC en cada función nueva; los ALTER DEFAULT
-- PRIVILEGES de 20260821130500 ya lo cierran, pero se revoca explícitamente
-- porque el coste es una línea y el fallo es silencioso.
revoke execute on function public.candidatos_asignacion(uuid) from public;
revoke execute on function public.enviar_dictamen(uuid, integer, integer, boolean, boolean, bigint, text) from public;
revoke execute on function public.registrar_decision(uuid, bigint) from public;
revoke execute on function public.marcar_anonimizacion(uuid, text) from public;
revoke execute on function public.vincular_revision(uuid, uuid) from public;

grant execute on function public.candidatos_asignacion(uuid) to authenticated;
grant execute on function public.enviar_dictamen(uuid, integer, integer, boolean, boolean, bigint, text) to authenticated;
grant execute on function public.registrar_decision(uuid, bigint) to authenticated;
grant execute on function public.marcar_anonimizacion(uuid, text) to authenticated;
grant execute on function public.vincular_revision(uuid, uuid) to authenticated;
