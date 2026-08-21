-- Publicación (spec §5.5) y bitácora (spec §5.6).

create table public.ediciones (
  id            bigint generated always as identity primary key,
  numero        integer not null unique,
  titulo        text not null,
  estado        text not null default 'borrador',
  publicada_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint ediciones_estado_valido check (estado in ('borrador','publicada')),
  constraint ediciones_publicada_con_fecha check (
    (estado = 'borrador' and publicada_at is null)
    or (estado = 'publicada' and publicada_at is not null))
);

create table public.articulos (
  id                bigint generated always as identity primary key,
  envio_id          uuid references public.envios(id) on delete set null,
  edicion_id        bigint references public.ediciones(id) on delete set null,
  titulo            text not null,
  autor             text not null,
  seccion_id        bigint not null references public.secciones(id),
  minutos_lectura   smallint,
  destacado         boolean not null default false,
  slug              text not null unique,
  pdf_publico_path  text,
  es_placeholder    boolean not null default false,
  orden             smallint,
  created_at        timestamptz not null default now(),
  constraint articulos_minutos_positivos check (minutos_lectura is null or minutos_lectura > 0)
);

comment on column public.articulos.envio_id is
  'ON DELETE SET NULL: quitar un envío nunca debe dejar en 404 una URL ya '
  'publicada.';
comment on column public.articulos.es_placeholder is
  'Cierto en los 26 artículos de demostración que ya muestra el sitio. Van '
  'visibles para que el descubrimiento por tema y sección funcione antes de '
  'que exista la primera edición. No tienen PDF, así que /articulos/[slug] '
  'les pinta un vacío definido — hoy esos enlaces son anclas muertas '
  '(index.html:1942). El comité los borra desde el panel cuando haya '
  'contenido real.';

create index articulos_envio_id_idx on public.articulos (envio_id);
create index articulos_edicion_id_idx on public.articulos (edicion_id);
create index articulos_seccion_id_idx on public.articulos (seccion_id);
create index articulos_destacado_idx on public.articulos (destacado) where destacado;

create table public.articulo_temas (
  articulo_id bigint not null references public.articulos(id) on delete cascade,
  tema_id     bigint not null references public.temas(id) on delete cascade,
  primary key (articulo_id, tema_id)
);

comment on table public.articulo_temas is
  'Muchos a muchos porque el corpus actual asigna hasta tres temas por pieza '
  'y el panel de descubrimiento filtra por tema.';

create index articulo_temas_tema_idx on public.articulo_temas (tema_id);

-- ---------------------------------------------------------------- bitácora
create table public.envio_eventos (
  id        bigint generated always as identity primary key,
  envio_id  uuid references public.envios(id) on delete cascade,
  actor_id  uuid references public.usuarios(id),
  tipo      text not null,
  payload   jsonb not null default '{}',
  at        timestamptz not null default now()
);

comment on table public.envio_eventos is
  'Sólo se añade: no hay grant de UPDATE ni de DELETE para nadie. Aquí se '
  'escribe cada transición que desvela algo —dictamen enviado, anonimización '
  'revisada, decisión grabada, revisión vinculada, edición publicada, export '
  'generado—. Sin esto, la afirmación de §7 de que la ceguera es "responsable '
  'aunque no absoluta" no tendría nada detrás.';

create index envio_eventos_envio_id_at_idx on public.envio_eventos (envio_id, at desc);
create index envio_eventos_actor_idx on public.envio_eventos (actor_id);
create index envio_eventos_tipo_at_idx on public.envio_eventos (tipo, at desc);
