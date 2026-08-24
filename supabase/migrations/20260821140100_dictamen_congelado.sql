-- Un dictamen enviado se congela.
--
-- La etapa 3 hizo irreversible la transición a 'enviado', pero dejaba abierto
-- editar los comentarios y la instantánea de una tarjeta ya enviada: las
-- políticas de dictamen_puertas y dictamen_puntajes exigen estado 'borrador',
-- así que las respuestas ya estaban protegidas, pero la fila de `dictamenes`
-- no.
--
-- Importa por dos motivos. El primero es la instantánea: §5.4 dice que se
-- escribe al enviar y no se recalcula nunca, porque es lo que el comité vio el
-- día que dictaminó, y un registro que se puede reescribir después no sirve
-- para eso. El segundo es que enviar el dictamen es lo que desvela la autoría
-- a quien lo envía (§7.2); si además se pudiera reescribir el contenido
-- después, el precio de desvelarse sería enviar una tarjeta cualquiera y luego
-- arreglarla.

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

  -- Enviado y congelado. updated_at sí puede moverse: no es contenido.
  if old.estado = 'enviado' then
    if new.comentarios          is distinct from old.comentarios
       or new.puntaje           is distinct from old.puntaje
       or new.maximo            is distinct from old.maximo
       or new.puertas_ok        is distinct from old.puertas_ok
       or new.criticos_ok       is distinct from old.criticos_ok
       or new.decision_sugerida_id is distinct from old.decision_sugerida_id
       or new.sin_conflicto     is distinct from old.sin_conflicto
       or new.enviado_at        is distinct from old.enviado_at
    then
      raise exception 'un dictamen enviado ya no se puede modificar'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.estado <> 'enviado' then
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

revoke execute on function privado.valida_dictamen_completo() from public;
