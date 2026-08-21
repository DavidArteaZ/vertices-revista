-- Asignaciones y dictámenes (spec §5.4).

create table public.asignaciones (
  id          bigint generated always as identity primary key,
  envio_id    uuid not null references public.envios(id) on delete cascade,
  revisor_id  uuid not null references public.usuarios(id) on delete cascade,
  asignado_por uuid references public.usuarios(id),
  asignado_at timestamptz not null default now(),
  unique (envio_id, revisor_id)
);

create index asignaciones_envio_id_idx on public.asignaciones (envio_id);
create index asignaciones_revisor_id_idx on public.asignaciones (revisor_id);
create index asignaciones_asignado_por_idx on public.asignaciones (asignado_por);

create table public.dictamenes (
  id                  uuid primary key default gen_random_uuid(),
  envio_id            uuid not null references public.envios(id) on delete cascade,
  revisor_id          uuid not null references public.usuarios(id) on delete cascade,
  rubrica_version_id  bigint not null references public.rubrica_versiones(id),
  estado              text not null default 'borrador',
  comentarios         text,
  -- "No participé en la elaboración de esta pieza". El cruce de correos no
  -- detecta coautoría, así que hace falta la declaración (spec §7.3).
  sin_conflicto       boolean not null default false,
  enviado_at          timestamptz,

  -- Instantánea escrita al enviar; nunca se recalcula. Es lo que hace que
  -- editar la rúbrica viva no reescriba veredictos ya comunicados.
  puntaje              smallint,
  maximo               smallint,
  puertas_ok           boolean,
  criticos_ok          boolean,
  decision_sugerida_id bigint references public.decisiones(id),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (envio_id, revisor_id),
  constraint dictamenes_estado_valido check (estado in ('borrador','enviado')),
  constraint dictamenes_enviado_completo check (
    estado = 'borrador'
    or (enviado_at is not null and puntaje is not null and maximo is not null
        and puertas_ok is not null and criticos_ok is not null
        and decision_sugerida_id is not null and sin_conflicto)
  ),

  -- Un dictamen no puede existir sin asignación previa. Sin esto, cualquier
  -- persona del comité podría crear una tarjeta para cualquier envío con el
  -- único fin de desvelarse a sí misma quién lo escribió.
  foreign key (envio_id, revisor_id)
    references public.asignaciones (envio_id, revisor_id) on delete cascade
);

create index dictamenes_envio_id_idx on public.dictamenes (envio_id);
create index dictamenes_revisor_id_idx on public.dictamenes (revisor_id);
create index dictamenes_decision_sugerida_idx on public.dictamenes (decision_sugerida_id);
create index dictamenes_rubrica_version_idx on public.dictamenes (rubrica_version_id);
-- Índice que sirve al predicado de ceguera: ¿tiene ESTA persona un dictamen
-- enviado para ESTE envío?
create index dictamenes_enviados_idx on public.dictamenes (envio_id, revisor_id) where estado = 'enviado';

-- ------------------------------------------------------- respuestas
--
-- Semántica de tres estados, igual que el libro:
--   fila ausente  puerta: no contestada → reprueba   dimensión: sin calificar
--   NULL          puerta: no contestada → reprueba   dimensión: N/A, sólo donde permite_na
--   valor         tal cual
create table public.dictamen_puertas (
  dictamen_id uuid not null references public.dictamenes(id) on delete cascade,
  puerta_id   bigint not null references public.rubrica_puertas(id) on delete cascade,
  valor       boolean,
  primary key (dictamen_id, puerta_id)
);

create index dictamen_puertas_puerta_idx on public.dictamen_puertas (puerta_id);

create table public.dictamen_puntajes (
  dictamen_id  uuid not null references public.dictamenes(id) on delete cascade,
  dimension_id bigint not null references public.rubrica_dimensiones(id) on delete cascade,
  valor        smallint,
  primary key (dictamen_id, dimension_id),
  constraint dictamen_puntajes_rango check (valor is null or valor between 0 and 3)
);

create index dictamen_puntajes_dimension_idx on public.dictamen_puntajes (dimension_id);

-- NULL en una dimensión significa N/A, y sólo una dimensión de todo el libro
-- lo admite. En cualquier otra, un NULL sería "sin calificar" disfrazado de
-- respuesta, que es precisamente la ambigüedad que la cascada de §6 tiene que
-- poder distinguir.
create or replace function privado.valida_na_dimension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.valor is null then
    if not exists (
      select 1 from public.rubrica_dimensiones d
      where d.id = new.dimension_id and d.permite_na
    ) then
      raise exception
        'la dimensión % no admite N/A: usa un valor de 0 a 3, o borra la fila para dejarla sin calificar',
        new.dimension_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger dictamen_puntajes_valida_na
  before insert or update on public.dictamen_puntajes
  for each row execute function privado.valida_na_dimension();

-- ------------------------------------------- completitud al enviar
--
-- Pasar a 'enviado' exige la tarjeta completa: toda puerta ★ contestada y
-- toda dimensión calificada salvo las que admiten N/A. Sin esto, enviar una
-- tarjeta en blanco desvelaría al autor produciendo "Pendiente de dictamen",
-- indistinguible de no haber empezado. La transición es irreversible.
create or replace function privado.valida_dictamen_completo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  faltan_puertas int;
  faltan_dims    int;
begin
  if old.estado = 'enviado' and new.estado <> 'enviado' then
    raise exception 'un dictamen enviado no puede volver a borrador'
      using errcode = 'check_violation';
  end if;

  if new.estado <> 'enviado' or old.estado = 'enviado' then
    return new;
  end if;

  select count(*) into faltan_puertas
  from public.rubrica_puertas p
  where p.rubrica_version_id = new.rubrica_version_id
    and p.es_eliminatoria
    and not exists (
      select 1 from public.dictamen_puertas dp
      where dp.dictamen_id = new.id and dp.puerta_id = p.id and dp.valor is not null
    );

  if faltan_puertas > 0 then
    raise exception 'faltan % puerta(s) ★ por contestar', faltan_puertas
      using errcode = 'check_violation';
  end if;

  select count(*) into faltan_dims
  from public.rubrica_dimensiones d
  where d.rubrica_version_id = new.rubrica_version_id
    and not exists (
      select 1 from public.dictamen_puntajes dpz
      where dpz.dictamen_id = new.id
        and dpz.dimension_id = d.id
        and (dpz.valor is not null or d.permite_na)
    );

  if faltan_dims > 0 then
    raise exception 'faltan % dimensión(es) por calificar', faltan_dims
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger dictamenes_valida_completo
  before update on public.dictamenes
  for each row execute function privado.valida_dictamen_completo();
