-- La plantilla de doble ciego sólo se exige en Miradas Económicas y
-- Horizonte Global. En las demás secciones el panel ya no la pide, así que el
-- disparador tampoco debe exigirla: si no, esos dictámenes no podrían
-- enviarse nunca. La lista es la misma que SECCIONES_DOBLE_CIEGO en
-- src/lib/dictamen/doble-ciego.ts.

create or replace function privado.valida_archivo_doble_ciego()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.estado <> 'enviado' and new.estado = 'enviado' then
    if exists (
      select 1
        from public.envios e
        join public.secciones s on s.id = e.seccion_id
       where e.id = new.envio_id
         and s.slug in ('miradas-economicas', 'horizonte-global')
    ) and not exists (
      select 1
        from public.dictamen_archivos a
       where a.dictamen_id = new.id
    ) then
      raise exception 'es obligatorio adjuntar la plantilla de doble ciego'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function privado.valida_archivo_doble_ciego() from public;
