-- Publicación por excepción.
--
-- Una pieza con decisión no aceptante (p. ej. "Revisiones mayores") puede
-- publicarse si el comité lo autoriza expresamente y deja escrito el motivo.
-- El dictamen y su decisión NO cambian: la decisión se graba una sola vez y es
-- el registro editorial. La excepción vive aparte, en su propia columna, y deja
-- su fila en envio_eventos.
--
-- Sólo añade una columna y reemplaza dos funciones; no toca datos existentes.

alter table public.envios
  add column if not exists excepcion_publicacion text;

comment on column public.envios.excepcion_publicacion is
  'Motivo por el que el comité autoriza publicar una pieza cuya decisión no es aceptante. Null = sin excepción.';

-- ==================================================== autorizar la excepción
create or replace function public.autorizar_excepcion(p_envio uuid, p_motivo text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_aceptante boolean;
begin
  if not privado.es_staff() then
    raise exception 'no tienes acceso al panel' using errcode = 'insufficient_privilege';
  end if;

  if trim(coalesce(p_motivo, '')) = '' then
    raise exception 'escribe el motivo de la excepción' using errcode = 'check_violation';
  end if;

  select d.es_aceptante
    into v_aceptante
    from public.envios e
    join public.decisiones d on d.id = e.decision_id
   where e.id = p_envio;

  -- Sin decisión no hay nada que exceptuar: primero se dictamina.
  if not found then
    raise exception 'el envío no existe o todavía no tiene decisión' using errcode = 'check_violation';
  end if;

  if v_aceptante then
    raise exception 'el envío ya fue aceptado; no necesita excepción' using errcode = 'check_violation';
  end if;

  update public.envios
     set excepcion_publicacion = trim(p_motivo),
         updated_at = now()
   where id = p_envio
     and excepcion_publicacion is null;

  if not found then
    raise exception 'el envío ya tiene una excepción autorizada' using errcode = 'check_violation';
  end if;

  insert into public.envio_eventos (envio_id, actor_id, tipo, payload)
  values (p_envio, (select auth.uid()), 'excepcion_publicacion',
          jsonb_build_object('motivo', trim(p_motivo)));
end;
$$;

revoke execute on function public.autorizar_excepcion(uuid, text) from public;
grant execute on function public.autorizar_excepcion(uuid, text) to authenticated;

-- ==================================================== adjuntar_articulo
-- Igual que en 20260822100100_publicacion.sql salvo la comprobación de la
-- decisión, que ahora también admite una excepción autorizada.
create or replace function public.adjuntar_articulo(
  p_envio    uuid,
  p_edicion  bigint,
  p_minutos  smallint default null,
  p_temas    bigint[] default '{}'
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_envio    record;
  v_autor    text;
  v_slug     text;
  v_base     text;
  v_n        integer := 1;
  v_articulo bigint;
  v_tema     bigint;
begin
  select e.id, e.titulo, e.seccion_id, e.decision_id, e.excepcion_publicacion, d.es_aceptante
    into v_envio
    from public.envios e
    left join public.decisiones d on d.id = e.decision_id
   where e.id = p_envio;

  if v_envio.id is null then
    raise exception 'no encuentro el envío %', p_envio using errcode = 'no_data_found';
  end if;

  -- §9.2: sólo se publican las piezas cuya decisión acepta, o las que el
  -- comité autorizó por excepción con motivo escrito. Un "requiere
  -- reelaboración" sin excepción no es material publicable.
  if v_envio.decision_id is null
     or not (coalesce(v_envio.es_aceptante, false) or v_envio.excepcion_publicacion is not null) then
    raise exception 'el envío % no tiene una decisión aceptante ni una excepción autorizada', p_envio
      using errcode = 'check_violation';
  end if;

  select a.nombre into v_autor from public.envios_autoria a where a.envio_id = p_envio;
  if v_autor is null then
    raise exception 'no puedo leer la autoría del envío %', p_envio
      using errcode = 'insufficient_privilege';
  end if;

  v_base := trim(both '-' from regexp_replace(
    lower(public.unaccent_simple(v_envio.titulo)), '[^a-z0-9]+', '-', 'g'));
  v_slug := v_base;
  while exists (select 1 from public.articulos where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;

  insert into public.articulos (
    envio_id, edicion_id, titulo, autor, seccion_id, minutos_lectura, slug
  ) values (
    p_envio, p_edicion, v_envio.titulo, v_autor, v_envio.seccion_id, p_minutos, v_slug
  ) returning id into v_articulo;

  foreach v_tema in array coalesce(p_temas, '{}')
  loop
    insert into public.articulo_temas (articulo_id, tema_id) values (v_articulo, v_tema)
    on conflict do nothing;
  end loop;

  insert into public.envio_eventos (envio_id, actor_id, tipo, payload)
  values (p_envio, (select auth.uid()), 'articulo_creado',
          jsonb_build_object('articulo', v_articulo, 'edicion', p_edicion, 'slug', v_slug));

  return v_articulo;
end;
$$;

notify pgrst, 'reload schema';
