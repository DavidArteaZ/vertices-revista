-- Plantilla de doble ciego adjunta al dictamen.
--
-- El archivo vive en el bucket privado "manuscritos", pero su metadato queda
-- ligado 1:1 al dictamen. La transición a enviado exige que exista esta fila,
-- de modo que la obligatoriedad no dependa sólo de la interfaz.

create table public.dictamen_archivos (
  dictamen_id      uuid primary key references public.dictamenes(id) on delete cascade,
  storage_path     text not null unique,
  nombre_original  text not null,
  mime             text not null,
  bytes            bigint not null,
  guardado_at      timestamptz not null default now(),

  constraint dictamen_archivos_mime_valido check (
    mime in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  constraint dictamen_archivos_bytes_validos check (bytes between 1 and 20971520)
);

alter table public.dictamen_archivos enable row level security;

create policy dictamen_archivos_lectura on public.dictamen_archivos
  for select to authenticated
  using ((select privado.es_staff()));

create policy dictamen_archivos_alta on public.dictamen_archivos
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.dictamenes d
       where d.id = dictamen_id
         and d.revisor_id = (select auth.uid())
         and d.estado = 'borrador'
    )
  );

create policy dictamen_archivos_edicion on public.dictamen_archivos
  for update to authenticated
  using (
    exists (
      select 1
        from public.dictamenes d
       where d.id = dictamen_id
         and d.revisor_id = (select auth.uid())
         and d.estado = 'borrador'
    )
  )
  with check (
    exists (
      select 1
        from public.dictamenes d
       where d.id = dictamen_id
         and d.revisor_id = (select auth.uid())
         and d.estado = 'borrador'
    )
  );

create policy dictamen_archivos_baja on public.dictamen_archivos
  for delete to authenticated
  using (
    exists (
      select 1
        from public.dictamenes d
       where d.id = dictamen_id
         and d.revisor_id = (select auth.uid())
         and d.estado = 'borrador'
    )
  );

grant select, insert, update, delete on public.dictamen_archivos to authenticated;

-- Segunda barrera, además del required del formulario: la base no permite que
-- un dictamen cambie a enviado si no tiene adjunta la plantilla llenada.
create or replace function privado.valida_archivo_doble_ciego()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.estado <> 'enviado' and new.estado = 'enviado' then
    if not exists (
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

create trigger dictamenes_valida_archivo_doble_ciego
  before update on public.dictamenes
  for each row execute function privado.valida_archivo_doble_ciego();

revoke execute on function privado.valida_archivo_doble_ciego() from public;

-- El barrido de huérfanos debe reconocer también los adjuntos de dictamen.
-- De otro modo, cualquier plantilla guardada durante más de 24 h sería
-- considerada basura porque antes sólo se miraba envio_archivos.
create or replace function public.subidas_huerfanas(p_antiguedad interval default interval '24 hours')
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
     and not exists (
       select 1 from public.dictamen_archivos d where d.storage_path = o.name)
   order by o.created_at;
$$;

revoke execute on function public.subidas_huerfanas(interval) from public;
grant execute on function public.subidas_huerfanas(interval) to service_role;
