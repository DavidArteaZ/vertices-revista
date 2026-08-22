-- Publicar (spec §9).
--
-- Tres pasos: crear la edición, colgarle piezas aceptadas, y publicarla. Los
-- dos últimos son funciones y no sentencias sueltas por lo de siempre: cada
-- uno tiene que dejar su fila en envio_eventos, y un UPDATE que ocurre junto a
-- un INSERT que no deja un movimiento sin registro.
--
-- Copiar el PDF del bucket privado al público NO se hace aquí: Storage no se
-- toca desde SQL. Lo hace la acción del panel, antes de llamar a
-- publicar_edicion, y por eso el orden importa — si la copia falla, la edición
-- sigue en borrador y no hay nada visible.

-- Postgres no trae `unaccent` activado por omisión y la extensión pide
-- permisos que no hacen falta para esto. El slug sólo tiene que coincidir con
-- el que calcula slug() en src/lib/texto.ts, que es NFD + quitar diacríticos.
create function public.unaccent_simple(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    t,
    'áàâäãåÁÀÂÄÃÅéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜñÑçÇýÿÝ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcCyyY');
$$;

-- ================================================== colgar una pieza aceptada
--
-- SECURITY INVOKER: leer envios_autoria tiene que pasar por la política del
-- doble ciego. Y pasa, porque una pieza con decision_id ya está desvelada para
-- todo el comité (§7.2, disparador 2) — que es exactamente la condición que
-- esta función exige para dejar publicar. Si alguien intentara colgar una
-- pieza sin decisión, no sólo se lo impide la comprobación de abajo: es que no
-- podría leer el nombre del autor para ponerlo en el artículo.
create function public.adjuntar_articulo(
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
  select e.id, e.titulo, e.seccion_id, e.decision_id, d.es_aceptante
    into v_envio
    from public.envios e
    left join public.decisiones d on d.id = e.decision_id
   where e.id = p_envio;

  if v_envio.id is null then
    raise exception 'no encuentro el envío %', p_envio using errcode = 'no_data_found';
  end if;

  -- §9.2: sólo se publican las piezas cuya decisión acepta. Un "requiere
  -- reelaboración" no es material publicable, y dejarlo colgar de una edición
  -- convertiría un veredicto en una publicación por descuido.
  if v_envio.decision_id is null or not coalesce(v_envio.es_aceptante, false) then
    raise exception 'el envío % no tiene una decisión aceptante', p_envio
      using errcode = 'check_violation';
  end if;

  select a.nombre into v_autor from public.envios_autoria a where a.envio_id = p_envio;
  if v_autor is null then
    -- No debería ocurrir: con decisión grabada la autoría es visible. Si pasa,
    -- es que la ceguera está aplicándose donde no toca y hay que enterarse.
    raise exception 'no puedo leer la autoría del envío %', p_envio
      using errcode = 'insufficient_privilege';
  end if;

  -- Slug a partir del título, con sufijo si ya existe. El slug es la URL
  -- pública y es única: dos piezas con el mismo título en números distintos no
  -- pueden pisarse.
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

-- ==================================================== publicar la edición
--
-- Todo el número se vuelve visible de golpe: la política de articulos mira el
-- estado de su edición, así que una sola sentencia publica sus piezas. Es lo
-- que pide §9.3 y evita el estado a medias en que media edición está en la
-- calle y la otra media no.
create function public.publicar_edicion(p_edicion bigint)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_sin_pdf integer;
  v_piezas  integer;
begin
  select count(*) into v_piezas from public.articulos where edicion_id = p_edicion;
  if v_piezas = 0 then
    raise exception 'la edición % no tiene piezas', p_edicion using errcode = 'check_violation';
  end if;

  -- Publicar una pieza sin PDF copiado dejaría una página de artículo sin
  -- documento, que es justo el vacío que los placeholders explican y una pieza
  -- real no.
  select count(*) into v_sin_pdf
    from public.articulos
   where edicion_id = p_edicion and pdf_publico_path is null;

  if v_sin_pdf > 0 then
    raise exception '% pieza(s) de la edición no tienen PDF copiado', v_sin_pdf
      using errcode = 'check_violation';
  end if;

  update public.ediciones
     set estado = 'publicada', publicada_at = now()
   where id = p_edicion and estado = 'borrador';

  if not found then
    raise exception 'la edición % no existe o ya estaba publicada', p_edicion
      using errcode = 'check_violation';
  end if;

  -- Una fila por pieza: publicar es el tercer disparador de desvelado de §7.2,
  -- y el registro es por envío, no por edición.
  insert into public.envio_eventos (envio_id, actor_id, tipo, payload)
  select a.envio_id, (select auth.uid()), 'edicion_publicada',
         jsonb_build_object('edicion', p_edicion, 'articulo', a.id)
    from public.articulos a
   where a.edicion_id = p_edicion and a.envio_id is not null;

  return v_piezas;
end;
$$;

revoke execute on function public.adjuntar_articulo(uuid, bigint, smallint, bigint[]) from public;
revoke execute on function public.publicar_edicion(bigint) from public;
revoke execute on function public.unaccent_simple(text) from public;

grant execute on function public.adjuntar_articulo(uuid, bigint, smallint, bigint[]) to authenticated;
grant execute on function public.publicar_edicion(bigint) to authenticated;
grant execute on function public.unaccent_simple(text) to authenticated;
