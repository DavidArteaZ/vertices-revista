-- Piezas por título: lo que entra a un número en las secciones que el comité
-- no dictamina (todas salvo Miradas Económicas y Horizonte Global).
--
-- Tabla aparte y no filas de `articulos` a propósito: un artículo tiene
-- autor, PDF, página propia en /articulos/<slug> y aparece en la portada, y
-- publicar exige su PDF. Una pieza de esta tabla sólo tiene título y sólo se
-- enseña en la página del número, agrupada en su sección. Así nada de lo que
-- ya hacen los artículos —ni sus enlaces— cambia.

create table public.edicion_piezas (
  id          bigint generated always as identity primary key,
  edicion_id  bigint not null references public.ediciones(id) on delete cascade,
  seccion_id  bigint not null references public.secciones(id),
  titulo      text not null check (char_length(btrim(titulo)) between 1 and 300),
  created_at  timestamptz not null default now()
);

create index edicion_piezas_edicion_idx on public.edicion_piezas (edicion_id);

alter table public.edicion_piezas enable row level security;
alter table public.edicion_piezas force row level security;

grant select on public.edicion_piezas to anon, authenticated;
grant insert, update, delete on public.edicion_piezas to authenticated;

-- Misma regla que `articulos`: el público sólo ve las de números publicados;
-- el personal las ve y las edita todas.
create policy edicion_piezas_lectura_publica on public.edicion_piezas
  for select to anon, authenticated
  using (exists (select 1 from public.ediciones e
                  where e.id = edicion_id and e.estado = 'publicada'));
create policy edicion_piezas_lectura_staff on public.edicion_piezas
  for select to authenticated using ((select privado.es_staff()));
create policy edicion_piezas_escritura on public.edicion_piezas
  for all to authenticated
  using ((select privado.es_staff())) with check ((select privado.es_staff()));

comment on table public.edicion_piezas is
  'Piezas de un número que sólo llevan título (secciones no dictaminadas). Se ven en /ediciones/<número>.';
