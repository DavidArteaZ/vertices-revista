-- Envíos (spec §5.3).
--
-- La identidad del autor vive en una tabla hija 1:1. Ese es el mecanismo que
-- hace exigible el doble ciego de §7: RLS en Postgres es por FILA, y los
-- privilegios de columna son por rol, así que "esta persona del comité puede
-- leer esta fila pero no cuatro de sus columnas" no se puede expresar —menos
-- todavía con un solo rol—. Partir la tabla convierte todo el doble ciego en
-- una sola política de lectura.

-- ------------------------------------------------------------------- folios
create table public.envio_folios (
  anio   smallint primary key,
  ultimo integer not null default 0
);

comment on table public.envio_folios is
  'Contador de folio por año, no una secuencia. Una secuencia pediría DDL en '
  'tiempo de ejecución cada enero, y nextval no participa del rollback: un '
  'insert fallido quemaría un número y dejaría un hueco visible en un '
  'identificador que el autor ve. El año se calcula en America/Mexico_City, '
  'no en UTC — Vercel corre en UTC y la revista no, así que un envío del 31 '
  'de diciembre por la noche recibiría folio de enero.';

-- ------------------------------------------------------------------- envíos
create table public.envios (
  id      uuid primary key default gen_random_uuid(),
  folio   text not null unique,

  -- manuscrito: nunca se oculta
  titulo            text not null,
  tipo_pieza_id     bigint references public.tipos_pieza(id),
  seccion_id        bigint not null references public.secciones(id),
  tema_id           bigint references public.temas(id),
  resumen           text not null,
  palabras_clave    text[] not null default '{}',
  es_investigacion  boolean not null default false,
  uso_ia            text,
  locale            text not null default 'es',

  -- capturado por el comité
  extension                   text,
  antiplagio                  text,
  anonimizacion_revisada_por  uuid references public.usuarios(id),
  anonimizacion_revisada_at   timestamptz,

  -- derivado al insertar
  nivel                char(1),
  seccion_dictamen_id  bigint references public.secciones(id),

  -- flujo
  estado                text not null default 'recibido',
  decision_id           bigint references public.decisiones(id),
  decision_final_por    uuid references public.usuarios(id),
  decision_final_at     timestamptz,
  revision_de_envio_id  uuid references public.envios(id),

  -- consentimiento
  declaraciones     jsonb not null,
  declaraciones_at  timestamptz not null,

  archivado_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint envios_folio_formato check (folio ~ '^VTX-\d{4}-\d{1,4}$'),
  constraint envios_estado_valido check (
    estado in ('recibido','triage','asignado','en_dictamen','decidido')),
  constraint envios_nivel_valido check (nivel is null or nivel in ('A','B','C')),
  constraint envios_locale_valido check (locale in ('es','en','fr','it','pt','ru')),
  -- Una decisión final siempre trae quién y cuándo: es el registro de
  -- responsabilidad que sostiene §7, donde grabar la decisión desvela al autor
  -- para todo el comité.
  constraint envios_decision_con_actor check (
    (decision_id is null and decision_final_por is null and decision_final_at is null)
    or (decision_id is not null and decision_final_por is not null and decision_final_at is not null)
  ),
  constraint envios_no_es_revision_de_si_mismo check (revision_de_envio_id is distinct from id)
);

comment on column public.envios.folio is
  'VTX-2026-001, inmutable. El libro genera VTX-001 con ="VTX-"&TEXT(ROW()-3) '
  'y el sitio valida VTX-2026-001, de modo que hoy la consulta pública no '
  'puede encontrar nunca un folio real (defecto 1). Además el folio del libro '
  'depende de la posición de la fila, así que borrar una renumera todas las de '
  'abajo (defecto 2). Aquí no depende de nada más que del contador.';
comment on column public.envios.seccion_dictamen_id is
  'A qué instrumento se enruta. Replica el libro: se toma el nivel de la '
  'sección y luego se aplica la excepción — Horizonte Global con '
  'es_investigacion pasa a Nivel A y se dictamina con el instrumento de '
  'Miradas Económicas.';
comment on column public.envios.declaraciones is
  'Las cuatro declaraciones más la versión del texto aceptado. Hoy se validan '
  'en el navegador pero no tienen atributo name y no viajan en el POST '
  '(index.html:2109-2124). d4 es la licencia de publicación y §9 copia PDFs a '
  'un bucket público: tiene que existir constancia de que el autor lo '
  'autorizó.';
comment on column public.envios.archivado_at is
  'Borrado suave. Un envío ya decidido no se borra en duro: eso destruiría el '
  'registro de consentimiento y la historia de dictamen.';

create index envios_seccion_id_idx on public.envios (seccion_id);
create index envios_seccion_dictamen_id_idx on public.envios (seccion_dictamen_id);
create index envios_tema_id_idx on public.envios (tema_id);
create index envios_tipo_pieza_id_idx on public.envios (tipo_pieza_id);
create index envios_decision_id_idx on public.envios (decision_id);
create index envios_revision_de_idx on public.envios (revision_de_envio_id);
create index envios_decision_final_por_idx on public.envios (decision_final_por);
create index envios_anonimizacion_por_idx on public.envios (anonimizacion_revisada_por);
-- La cola del panel: lo vivo, más reciente primero.
create index envios_cola_idx on public.envios (estado, created_at desc) where archivado_at is null;

-- ------------------------------------------------------------------ autoría
create table public.envios_autoria (
  envio_id        uuid primary key references public.envios(id) on delete cascade,
  nombre          text not null,
  correo          text not null,
  afiliacion      text,
  coautores       text,
  genero          text,
  notas_internas  text
);

comment on table public.envios_autoria is
  'Los campos que el doble ciego oculta. notas_internas está aquí porque las '
  'notas del comité van a nombrar autores, y porque el export replica la '
  'columna T de Registro, que es exactamente este campo.';

create index envios_autoria_correo_idx on public.envios_autoria (lower(correo));

-- ----------------------------------------------------------------- archivos
create table public.envio_archivos (
  id             uuid primary key default gen_random_uuid(),
  envio_id       uuid not null references public.envios(id) on delete cascade,
  storage_path   text not null unique,
  nombre_publico text not null,
  mime           text not null,
  bytes          bigint not null,
  version        smallint not null default 1,
  es_principal   boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint envio_archivos_bytes_positivo check (bytes > 0)
);

comment on column public.envio_archivos.storage_path is
  'Un uuid, jamás derivado de un nombre. El nombre original identifica al '
  'autor más veces de las que uno esperaría: en los datos reales hay un '
  'Registro!O8 = GuiaExpositor_Politica_de_Competencia.pdf.';

create index envio_archivos_envio_id_idx on public.envio_archivos (envio_id);
-- Un solo manuscrito principal por envío.
create unique index envio_archivos_un_principal_idx
  on public.envio_archivos (envio_id) where es_principal;

create table public.envio_archivo_nombres (
  archivo_id      uuid primary key references public.envio_archivos(id) on delete cascade,
  nombre_original text not null
);

comment on table public.envio_archivo_nombres is
  'Nombre original del archivo, oculto por la misma razón que la autoría.';
