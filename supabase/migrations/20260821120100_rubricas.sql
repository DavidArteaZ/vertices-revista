-- La rúbrica es dato versionado, no código (spec §5.2).
--
-- El libro define ocho instrumentos distintos. Codificarlos a mano querría
-- decir un despliegue cada vez que el comité ajusta un criterio. Y la versión
-- no es opcional: sin ella, cambiar un peso o el borde de una banda reescribe
-- en silencio el veredicto de todos los dictámenes históricos, incluidos los
-- que ya se le comunicaron a un autor por correo.

create table public.rubrica_versiones (
  id          bigint generated always as identity primary key,
  seccion_id  bigint not null references public.secciones(id),
  version     smallint not null,
  vigente     boolean not null default false,
  creada_at   timestamptz not null default now(),

  -- Las etiquetas de falla viven en la versión porque NO son iguales entre
  -- secciones. Verificado contra la fórmula W8 de las ocho hojas: Miradas
  -- Económicas dice "No aceptable (revisar puertas ★)" y "No aceptable
  -- (crítico < 2)"; las otras siete dicen "No publicable (falla puerta ★)" y
  -- "Requiere reelaboración (crítico < 2)". No es cosmético: "Requiere
  -- reelaboración" es un veredicto de Nivel C que no existe en el
  -- vocabulario de Nivel A.
  etiqueta_falla_puerta   text not null,
  etiqueta_falla_critico  text not null,
  etiqueta_pendiente      text not null default 'Pendiente de dictamen',

  unique (seccion_id, version)
);

create index rubrica_versiones_seccion_id_idx on public.rubrica_versiones (seccion_id);

-- Una sola versión vigente por sección.
create unique index rubrica_versiones_una_vigente_idx
  on public.rubrica_versiones (seccion_id)
  where vigente;

-- ------------------------------------------------------------------ puertas
create table public.rubrica_puertas (
  id                  bigint generated always as identity primary key,
  rubrica_version_id  bigint not null references public.rubrica_versiones(id) on delete cascade,
  orden               smallint not null,
  etiqueta            text not null,
  es_eliminatoria     boolean not null default false,
  unique (rubrica_version_id, orden)
);

create index rubrica_puertas_version_idx on public.rubrica_puertas (rubrica_version_id);

comment on column public.rubrica_puertas.es_eliminatoria is
  'Sólo las puertas ★ pueden reprobar una pieza. Las demás se registran y no '
  'afectan el resultado: son lista de verificación. Es lo que hace el libro — '
  'Apertura tiene cuatro puertas y su fórmula U8 sólo mira F.';

-- -------------------------------------------------------------- dimensiones
create table public.rubrica_dimensiones (
  id                  bigint generated always as identity primary key,
  rubrica_version_id  bigint not null references public.rubrica_versiones(id) on delete cascade,
  orden               smallint not null,
  etiqueta            text not null,
  es_critica          boolean not null default false,
  peso                smallint not null default 1,
  permite_na          boolean not null default false,
  unique (rubrica_version_id, orden),
  constraint rubrica_dimensiones_peso_positivo check (peso >= 1)
);

create index rubrica_dimensiones_version_idx on public.rubrica_dimensiones (rubrica_version_id);

comment on column public.rubrica_dimensiones.permite_na is
  'Cierto en exactamente una dimensión de todo el libro: Utilidad del how-to '
  'en Datanomics, cuya validación es "0,1,2,3,N/A". Todas las demás son '
  '"0,1,2,3". Marcarla N/A baja el máximo de 15 a 12 y cambia de variante de '
  'banda.';

-- ---------------------------------------------------------------- decisiones
create table public.decisiones (
  id                  bigint generated always as identity primary key,
  rubrica_version_id  bigint not null references public.rubrica_versiones(id) on delete cascade,
  orden               smallint not null,
  etiqueta            text not null,
  es_aceptante        boolean not null default false,
  es_falla            boolean not null default false,
  unique (rubrica_version_id, etiqueta)
);

create index decisiones_version_idx on public.decisiones (rubrica_version_id);

comment on column public.decisiones.es_aceptante is
  'Marca qué resultados permiten publicar (spec §9). Existe para no comparar '
  'cadenas de texto contra el veredicto, que es justo lo que hace que el '
  'Tablero del libro no cuente cuatro de sus casos.';

-- ------------------------------------------------------------------- bandas
create table public.bandas_decision (
  id                  bigint generated always as identity primary key,
  rubrica_version_id  bigint not null references public.rubrica_versiones(id) on delete cascade,
  variante            smallint not null,
  min_puntaje         smallint not null,
  decision_id         bigint not null references public.decisiones(id) on delete cascade,
  unique (rubrica_version_id, variante, min_puntaje)
);

create index bandas_decision_version_idx on public.bandas_decision (rubrica_version_id);
create index bandas_decision_decision_idx on public.bandas_decision (decision_id);

comment on column public.bandas_decision.variante is
  'El máximo al que aplica la banda. Datanomics tiene dos juegos —/15 y /12— '
  'y cuál se usa depende de si el how-to se calificó N/A. Las demás secciones '
  'tienen una sola variante.';
comment on column public.bandas_decision.min_puntaje is
  'Umbral inferior inclusivo. La banda que aplica es la de mayor min_puntaje '
  'que no supere el puntaje obtenido.';
