-- Tablas de referencia de Vértices (spec §5.1).
--
-- Convención de llaves primarias: bigint identity para catálogos y rúbricas,
-- uuid sólo donde la spec lo pide (envíos y sus hijos), porque esos
-- identificadores viajan en URLs del panel. A este volumen —decenas de piezas
-- al año— la fragmentación de índice que traería un uuid v4 es irrelevante,
-- pero identity es lo estándar y no hay razón para no usarlo donde se puede.

create schema if not exists privado;
comment on schema privado is
  'Funciones de apoyo que no se exponen por la Data API. Aquí viven los '
  'SECURITY DEFINER, nunca en public.';

revoke all on schema privado from public;

-- ---------------------------------------------------------------- secciones
create table public.secciones (
  id               bigint generated always as identity primary key,
  numero           smallint,
  nombre_canonico  text not null unique,
  nombre_display   text not null,
  slug             text not null unique,
  nivel            char(1),
  descripcion      text,
  orden            smallint not null,
  es_asignable     boolean not null default true,
  publica          boolean not null default true,
  constraint secciones_nivel_valido check (nivel is null or nivel in ('A','B','C')),
  -- "Por asignar" es la única sección sin nivel, y es justamente la que no
  -- puede recibir dictamen hasta que alguien la triage (spec §5.1).
  constraint secciones_sin_nivel_no_asignable check (nivel is not null or not es_asignable)
);

comment on column public.secciones.nombre_canonico is
  'La forma del libro de Excel: "2 · Datanomics". Es lo que se guarda y lo que '
  'viaja al export.';
comment on column public.secciones.nombre_display is
  'Lo que se pinta en la interfaz: "Datanomics".';
comment on column public.secciones.es_asignable is
  'false para "Por asignar": una pieza ahí no puede asignarse a revisión '
  'hasta que el comité le ponga sección de verdad. Es lo que impide que se '
  'repita el defecto 5 de la spec, el registro huérfano que nunca llegó a '
  'ninguna hoja de dictamen.';

-- -------------------------------------------------------------------- temas
create table public.temas (
  id    bigint generated always as identity primary key,
  nombre text not null unique,
  slug   text not null unique,
  orden  smallint not null
);

-- ------------------------------------------------------------- tipos_pieza
create table public.tipos_pieza (
  id     bigint generated always as identity primary key,
  nombre text not null unique,
  orden  smallint not null
);

comment on table public.tipos_pieza is
  'Los nueve tipos canónicos de la hoja Catálogos. El formulario público '
  'ofrecía cinco opciones distintas; la etapa 4 los unifica aquí (spec §8).';

-- ----------------------------------------------------------------- usuarios
create table public.usuarios (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  email      text not null unique,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.usuarios is
  'Personal editorial. Un solo rol: quien está aquí y activo puede entrar al '
  'panel. La ceguera del doble ciego no es un nivel de permiso sino una '
  'función de (quién mira, qué envío) — ver privado.puede_ver_autoria.';

create table public.usuario_correos (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  correo     text not null unique
);

create index usuario_correos_usuario_id_idx on public.usuario_correos (usuario_id);

comment on table public.usuario_correos is
  'Correos alternos del personal. Existe porque en los datos reales hay gente '
  'del comité que envía desde direcciones personales además de la '
  'institucional, y el chequeo de conflicto de interés (spec §7.3) tiene que '
  'mirar todas.';
