-- Dictaminaciones: decisión final común, parámetros de edición y borrado previo a decisión.
--
-- Las rúbricas conservan sus vocabularios y sus decisiones sugeridas. La nueva
-- columna decision_final guarda exclusivamente el vocabulario común del comité.
-- decision_id sigue apuntando a la decisión equivalente del instrumento para
-- conservar las reglas existentes de ceguera y de elegibilidad para publicar.

alter table public.ediciones
  add column fecha_lanzamiento date,
  add column ubicacion_evento_lanzamiento text,
  add column fecha_limite_revisiones date;

alter table public.envios
  add column decision_final text,
  add constraint envios_decision_final_valida check (
    decision_final is null or decision_final in (
      'Aceptada',
      'Aceptada con revisiones menores',
      'Revisiones mayores',
      'Rechazado'
    )
  );

comment on column public.envios.decision_final is
  'Decisión final del comité en el vocabulario común. decision_id conserva la '
  'fila equivalente de la rúbrica para compatibilidad con ceguera y publicación.';

comment on column public.ediciones.fecha_lanzamiento is
  'Fecha comunicada al autor en los correos de aceptación. NULL se muestra como por decidir.';
comment on column public.ediciones.ubicacion_evento_lanzamiento is
  'Ubicación comunicada al autor en los correos de aceptación. NULL se muestra como por decidir.';
comment on column public.ediciones.fecha_limite_revisiones is
  'Fecha límite comunicada al autor cuando la decisión pide revisiones mayores. NULL se muestra como por decidir.';

-- La firma nueva vuelve obligatorios la decisión canónica, el nombre escrito
-- en la confirmación, los comentarios cuando corresponden y la edición usada
-- para construir el correo. La edición queda en la bitácora, no como relación
-- editorial del envío ni como artículo.
create function public.registrar_decision(
  p_envio uuid,
  p_decision bigint,
  p_decision_final text,
  p_nombre_confirmacion text,
  p_comentarios text,
  p_edicion bigint
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_seccion bigint;
  v_orden smallint;
  v_esperada text;
begin
  if not privado.es_staff() then
    raise exception 'no tienes acceso al panel' using errcode = 'insufficient_privilege';
  end if;

  if trim(coalesce(p_nombre_confirmacion, '')) = '' then
    raise exception 'escribe tu nombre para confirmar la decisión' using errcode = 'check_violation';
  end if;

  select e.seccion_dictamen_id
    into v_seccion
    from public.envios e
   where e.id = p_envio
     and e.decision_id is null;

  if not found then
    raise exception 'el envío no existe o ya tiene una decisión' using errcode = 'check_violation';
  end if;

  if v_seccion is null then
    raise exception 'el envío todavía no tiene instrumento de dictamen' using errcode = 'check_violation';
  end if;

  select d.orden
    into v_orden
    from public.decisiones d
    join public.rubrica_versiones r on r.id = d.rubrica_version_id
   where d.id = p_decision
     and r.seccion_id = v_seccion
     and r.vigente
     and not d.es_falla
     and d.orden between 1 and 4;

  if not found then
    raise exception 'la decisión técnica no corresponde al instrumento vigente' using errcode = 'check_violation';
  end if;

  v_esperada := case v_orden
    when 1 then 'Aceptada'
    when 2 then 'Aceptada con revisiones menores'
    when 3 then 'Revisiones mayores'
    when 4 then 'Rechazado'
  end;

  if p_decision_final is distinct from v_esperada then
    raise exception 'la decisión final no coincide con la opción seleccionada' using errcode = 'check_violation';
  end if;

  if p_decision_final <> 'Aceptada' and trim(coalesce(p_comentarios, '')) = '' then
    raise exception 'los comentarios son obligatorios para esta decisión' using errcode = 'check_violation';
  end if;

  perform 1 from public.ediciones where id = p_edicion;
  if not found then
    raise exception 'elige una edición válida' using errcode = 'check_violation';
  end if;

  update public.envios
     set decision_id        = p_decision,
         decision_final     = p_decision_final,
         decision_final_por = (select auth.uid()),
         decision_final_at  = now(),
         estado             = 'decidido',
         updated_at         = now()
   where id = p_envio
     and decision_id is null;

  if not found then
    raise exception 'no se pudo registrar la decisión del envío %', p_envio
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.envio_eventos (envio_id, actor_id, tipo, payload)
  values (
    p_envio,
    (select auth.uid()),
    'decision_registrada',
    jsonb_build_object(
      'decision', p_decision,
      'decision_final', p_decision_final,
      'nombre_confirmacion', trim(p_nombre_confirmacion),
      'comentarios', nullif(trim(coalesce(p_comentarios, '')), ''),
      'edicion', p_edicion
    )
  );
end;
$$;

-- La firma anterior ya no puede usarse desde el panel: así nadie puede saltar
-- los nuevos campos obligatorios invocando directamente la función vieja.
revoke execute on function public.registrar_decision(uuid, bigint) from authenticated;
revoke execute on function public.registrar_decision(uuid, bigint, text, text, text, bigint) from public;
grant execute on function public.registrar_decision(uuid, bigint, text, text, text, bigint) to authenticated;

-- Borrado duro sólo antes de que exista una decisión. Las tablas hijas de la
-- base se eliminan por sus FK en cascada. Los objetos de Storage no se tocan.
create function public.borrar_envio_sin_decision(p_envio uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.es_staff() then
    raise exception 'no tienes acceso al panel' using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.envios r where r.revision_de_envio_id = p_envio
  ) then
    raise exception 'no se puede borrar: otro envío está vinculado como revisión de éste'
      using errcode = 'check_violation';
  end if;

  delete from public.envios
   where id = p_envio
     and decision_id is null;

  if not found then
    raise exception 'el envío no existe o ya tiene una decisión' using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.borrar_envio_sin_decision(uuid) from public;
grant execute on function public.borrar_envio_sin_decision(uuid) to authenticated;

-- La consulta pública muestra el vocabulario final nuevo cuando existe y cae al
-- vocabulario histórico para los envíos decididos antes de esta migración.
create or replace function public.consultar_estado(p_folio text, p_correo text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folio  text := upper(trim(coalesce(p_folio, '')));
  v_correo text := lower(trim(coalesce(p_correo, '')));
  v_clave  text := 'estado:' || v_folio || ':' || v_correo;
  v_ip     text := 'estado-ip:' || coalesce(p_ip_hash, 'anon');
  v_fila   record;
begin
  if not privado.limite(v_ip, interval '1 hour', 30)
     or not privado.limite('estado-folio:' || v_folio, interval '1 hour', 10)
     or privado.intento_bloqueado(v_clave)
     or privado.intento_bloqueado(v_ip)
  then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  select e.folio, e.titulo, e.created_at, coalesce(e.decision_final, d.etiqueta) as decision
    into v_fila
    from public.envios e
    left join public.decisiones d on d.id = e.decision_id
    join public.envios_autoria a on a.envio_id = e.id
   where e.folio = v_folio
     and lower(a.correo) = v_correo;

  if not found then
    perform privado.intento_fallo(v_clave);
    perform privado.intento_fallo(v_ip, 10, interval '15 minutes');
    return jsonb_build_object('ok', false, 'motivo', 'no_coincide');
  end if;

  perform privado.intento_ok(v_clave);
  perform privado.intento_ok(v_ip);

  return jsonb_build_object(
    'ok', true,
    'folio', v_fila.folio,
    'titulo', v_fila.titulo,
    'recibido_at', v_fila.created_at,
    'decision', v_fila.decision);
end;
$$;

revoke execute on function public.consultar_estado(text, text, text) from public;
grant execute on function public.consultar_estado(text, text, text) to service_role;
