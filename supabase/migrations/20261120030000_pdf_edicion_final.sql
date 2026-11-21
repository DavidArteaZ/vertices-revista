-- PDF de la edición final: el número entero maquetado en un solo documento.
--
-- Vive en la edición, no en sus artículos: cada pieza conserva su propio PDF
-- y su enlace tal como estaban (los QR impresos apuntan a esos archivos), y
-- este documento es uno más, aparte. Se sube al bucket público con sufijo al
-- azar, igual que el de las piezas, y la página /ediciones/<número> sólo lo
-- enseña cuando la edición está publicada.

alter table public.ediciones
  add column if not exists pdf_final_path text;

comment on column public.ediciones.pdf_final_path is
  'Ruta en el bucket publicaciones del PDF con el número completo. Requisito para publicar.';

-- Un número entero pesa más que una pieza. El límite por pieza lo sigue
-- imponiendo la ruta que firma su subida (20 MB); este es el techo del bucket.
update storage.buckets
   set file_size_limit = 52428800
 where id = 'publicaciones';

-- Idéntica a la de 20260822100100_publicacion.sql salvo la comprobación del
-- PDF final: sin él, publicar se niega y la edición sigue en borrador.
create or replace function public.publicar_edicion(p_edicion bigint)
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

  select count(*) into v_sin_pdf
    from public.articulos
   where edicion_id = p_edicion and pdf_publico_path is null;

  if v_sin_pdf > 0 then
    raise exception '% pieza(s) de la edición no tienen PDF copiado', v_sin_pdf
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.ediciones
              where id = p_edicion and pdf_final_path is null) then
    raise exception 'la edición % no tiene el PDF de la edición final', p_edicion
      using errcode = 'check_violation';
  end if;

  update public.ediciones
     set estado = 'publicada', publicada_at = now()
   where id = p_edicion and estado = 'borrador';

  if not found then
    raise exception 'la edición % no existe o ya estaba publicada', p_edicion
      using errcode = 'check_violation';
  end if;

  insert into public.envio_eventos (envio_id, actor_id, tipo, payload)
  select a.envio_id, (select auth.uid()), 'edicion_publicada',
         jsonb_build_object('edicion', p_edicion, 'articulo', a.id)
    from public.articulos a
   where a.edicion_id = p_edicion and a.envio_id is not null;

  return v_piezas;
end;
$$;
