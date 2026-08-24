-- El retroceso exponencial por IP era demasiado estricto para esta revista.
--
-- Medido contra el servidor: tres consultas con el correo equivocado y la
-- cuarta ya recibe 429 — incluida la del autor que por fin escribió bien su
-- dirección. Para un oráculo de correos anónimo eso está bien. Para Vértices
-- no: es una revista universitaria y media facultad sale a internet por la
-- misma IP, así que un solo curioso deja sin consulta a todo el edificio, y un
-- autor que se equivoca tres veces tecleando su propio correo se autobloquea.
--
-- La defensa que de verdad para la enumeración no es ésa. El ataque de §13 es
-- un dictaminador ciego que ya tiene el folio y prueba direcciones: varía el
-- CORREO sobre un folio fijo. Quien lo corta es el límite por folio —10 por
-- hora, venga de donde venga—, y ése no castiga a nadie más. El retroceso por
-- pareja folio+correo sigue estricto, porque insistir sobre la misma pareja no
-- tiene lectura inocente pasados unos intentos.
--
-- Así que la IP se queda como tercera línea, con margen: diez fallos de gracia
-- y techo de quince minutos en vez de una hora.

-- Ojo: `create or replace` con una firma nueva no reemplaza, crea una
-- sobrecarga, y entonces la llamada de un solo argumento queda ambigua
-- (42725, "function is not unique"). Hay que quitar la vieja primero.
drop function privado.intento_fallo(text);

create function privado.intento_fallo(
  p_clave  text,
  p_gracia integer  default 3,
  p_techo  interval default interval '1 hour'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from privado.intentos
   where at < now() - interval '1 day' and coalesce(bloqueado_hasta, at) < now();

  insert into privado.intentos (clave, fallos, at)
       values (p_clave, 1, now())
  on conflict (clave) do update
     set fallos = privado.intentos.fallos + 1,
         at     = now()
  returning fallos into n;

  if n > p_gracia then
    update privado.intentos
       set bloqueado_hasta = now() + least(
             make_interval(secs => power(2, least(n - p_gracia, 12))::double precision),
             p_techo)
     where clave = p_clave;
  end if;
end;
$$;

revoke execute on function privado.intento_fallo(text, integer, interval) from public;

create or replace function public.consultar_estado(p_folio text, p_correo text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folio  text := upper(trim(coalesce(p_folio, '')));
  v_correo text := lower(trim(coalesce(p_correo, '')));
  v_clave  text := 'estado:' || v_folio || ':' || v_correo;
  v_ip     text := 'estado-ip:' || coalesce(p_ip_hash, 'anon');
  v_fila   record;
begin
  -- El límite por folio es el que corta la enumeración: diez intentos por hora
  -- sobre un manuscrito, los pida quien los pida.
  if not privado.limite(v_ip, interval '1 hour', 30)
     or not privado.limite('estado-folio:' || v_folio, interval '1 hour', 10)
     or privado.intento_bloqueado(v_clave)
     or privado.intento_bloqueado(v_ip)
  then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  select e.folio, e.titulo, e.created_at, d.etiqueta as decision
    into v_fila
    from public.envios e
    left join public.decisiones d on d.id = e.decision_id
    join public.envios_autoria a on a.envio_id = e.id
   where e.folio = v_folio
     and lower(a.correo) = v_correo;

  if not found then
    perform privado.intento_fallo(v_clave);
    perform privado.intento_fallo(v_ip, 10, interval '15 minutes');
    return jsonb_build_object('ok', false, 'motivo', 'no_coincide');
  end if;

  perform privado.intento_ok(v_clave);
  perform privado.intento_ok(v_ip);

  return jsonb_build_object(
    'ok', true,
    'folio', v_fila.folio,
    'titulo', v_fila.titulo,
    'recibido_at', v_fila.created_at,
    'decision', v_fila.decision);
end;
$$;

revoke execute on function public.consultar_estado(text, text, text) from public;
grant execute on function public.consultar_estado(text, text, text) to service_role;
