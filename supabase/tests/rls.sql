-- Suite de RLS de la etapa 3 (spec §16, punto 3).
--
-- "corriendo como un JWT de personal sin privilegios, afirmando que los campos
--  de autoría no aparecen en la cola, el detalle, el dictamen, el export ni en
--  el acceso directo por PostgREST. El modelo de seguridad se demuestra antes
--  de que exista una sola pantalla del panel."
--
-- Cada escenario cambia a `authenticated` con SET LOCAL ROLE y fija
-- request.jwt.claims, que es de donde lee auth.uid(). El rol authenticated no
-- tiene BYPASSRLS, así que las políticas se aplican de verdad: esto no es una
-- simulación del modelo, es el modelo.
--
-- Correrla:  psql < supabase/tests/rls.sql   (o por el MCP)
-- Todo el fixture se borra al final; si algo falla, la transacción del bloque
-- DO se aborta y tampoco queda nada.

do $$
declare
  ana    uuid := gen_random_uuid();   -- revisora A
  beto   uuid := gen_random_uuid();   -- revisor B
  curiosa uuid := gen_random_uuid();  -- autenticada pero NO del comité
  v_envio uuid;
  v_archivo uuid;
  v_dictamen uuid;
  v_rubrica bigint;
  v_seccion bigint;
  v_decision bigint;
  n int;
  afirmaciones int := 0;

begin
  -- ------------------------------------------------------------- fixture
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (ana,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@prueba.test',     '', now(), now()),
    (beto,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beto@prueba.test',    '', now(), now()),
    (curiosa, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'curiosa@prueba.test', '', now(), now());

  insert into public.usuarios (id, nombre, email) values
    (ana,  'Ana Revisora', 'ana@prueba.test'),
    (beto, 'Beto Revisor', 'beto@prueba.test');
  -- `curiosa` existe en auth pero NO en usuarios: es cualquier persona con
  -- sesión que llegue al panel por accidente.

  select id into strict v_seccion from public.secciones where nombre_canonico = '4 · Miradas Económicas';
  select id into strict v_rubrica from public.rubrica_versiones where seccion_id = v_seccion and vigente;

  insert into public.envios (folio, titulo, seccion_id, seccion_dictamen_id, nivel, resumen,
                             declaraciones, declaraciones_at)
  values ('VTX-2026-001', 'Un manuscrito de prueba', v_seccion, v_seccion, 'A', 'Resumen.',
          '{"d1":true,"d2":true,"d3":true,"d4":true,"version":"2026-01"}', now())
  returning id into v_envio;

  insert into public.envios_autoria (envio_id, nombre, correo, afiliacion)
  values (v_envio, 'Autora Secreta', 'autora@ejemplo.mx', 'Tec CCM');

  insert into public.envio_archivos (envio_id, storage_path, nombre_publico, mime, bytes, es_principal)
  values (v_envio, gen_random_uuid()::text, 'VTX-2026-001-01.pdf', 'application/pdf', 1000, true)
  returning id into v_archivo;

  insert into public.envio_archivo_nombres (archivo_id, nombre_original)
  values (v_archivo, 'GuiaExpositor_Politica_de_Competencia.pdf');

  -- ================================================================ ANÓNIMO
  set local role anon;

  begin
    select count(*) into n from public.envios;
    raise exception 'FALLO: anon pudo consultar envios (% filas)', n;
  exception when insufficient_privilege then
    afirmaciones := afirmaciones + 1;   -- anon ni siquiera alcanza la tabla
  end;

  begin
    select count(*) into n from public.envios_autoria;
    raise exception 'FALLO: anon pudo consultar envios_autoria';
  exception when insufficient_privilege then
    afirmaciones := afirmaciones + 1;
  end;

  begin
    insert into public.envios (folio, titulo, seccion_id, resumen, declaraciones, declaraciones_at)
    values ('VTX-2026-999', 'x', v_seccion, 'x', '{}', now());
    raise exception 'FALLO: anon pudo insertar un envío';
  exception when insufficient_privilege then
    afirmaciones := afirmaciones + 1;   -- spec §13: anon no tiene INSERT en ninguna parte
  end;

  -- anon SÍ debe poder leer los catálogos: los necesita el formulario
  select count(*) into n from public.secciones;
  if n <> 9 then raise exception 'FALLO: anon ve % secciones, esperaba 9', n; end if;
  afirmaciones := afirmaciones + 1;

  reset role;

  -- ============================================== AUTENTICADA, PERO NO STAFF
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', curiosa, 'role', 'authenticated')::text, true);

  select count(*) into n from public.envios;
  if n <> 0 then raise exception 'FALLO: quien no es del comité vio % envíos', n; end if;
  afirmaciones := afirmaciones + 1;

  select count(*) into n from public.envios_autoria;
  if n <> 0 then raise exception 'FALLO: quien no es del comité vio autoría'; end if;
  afirmaciones := afirmaciones + 1;

  reset role;

  -- =================================================== ANA, STAFF, SIN DICTAMEN
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);

  select count(*) into n from public.envios where id = v_envio;
  if n <> 1 then raise exception 'FALLO: Ana no ve el envío en la cola'; end if;
  afirmaciones := afirmaciones + 1;

  -- LA afirmación central: ciega por defecto, aunque sea del comité.
  select count(*) into n from public.envios_autoria where envio_id = v_envio;
  if n <> 0 then raise exception 'FALLO: Ana vio la autoría sin haber dictaminado'; end if;
  afirmaciones := afirmaciones + 1;

  -- El nombre original del archivo delata igual, y se oculta igual.
  select count(*) into n from public.envio_archivo_nombres where archivo_id = v_archivo;
  if n <> 0 then raise exception 'FALLO: Ana vio el nombre original del archivo'; end if;
  afirmaciones := afirmaciones + 1;

  -- El manuscrito sí se ve: es lo que tiene que dictaminar.
  select count(*) into n from public.envio_archivos where envio_id = v_envio;
  if n <> 1 then raise exception 'FALLO: Ana no ve el archivo del manuscrito'; end if;
  afirmaciones := afirmaciones + 1;

  -- Un join no puede ser una puerta trasera.
  select count(*) into n
    from public.envios e left join public.envios_autoria a on a.envio_id = e.id
   where e.id = v_envio and a.nombre is not null;
  if n <> 0 then raise exception 'FALLO: el join filtró la autoría'; end if;
  afirmaciones := afirmaciones + 1;

  reset role;

  -- ============================== ANA SE ASIGNA Y ABRE UN DICTAMEN EN BORRADOR
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);

  insert into public.asignaciones (envio_id, revisor_id, asignado_por) values (v_envio, ana, ana);
  insert into public.asignaciones (envio_id, revisor_id, asignado_por) values (v_envio, beto, ana);

  -- Nadie puede abrir un dictamen a nombre de otra persona.
  begin
    insert into public.dictamenes (envio_id, revisor_id, rubrica_version_id)
    values (v_envio, beto, v_rubrica);
    raise exception 'FALLO: Ana abrió un dictamen a nombre de Beto';
  exception when insufficient_privilege then
    afirmaciones := afirmaciones + 1;
  end;

  insert into public.dictamenes (envio_id, revisor_id, rubrica_version_id, sin_conflicto)
  values (v_envio, ana, v_rubrica, true)
  returning id into v_dictamen;

  -- Con la tarjeta abierta pero sin enviar, sigue ciega.
  select count(*) into n from public.envios_autoria where envio_id = v_envio;
  if n <> 0 then raise exception 'FALLO: abrir un borrador desveló la autoría'; end if;
  afirmaciones := afirmaciones + 1;

  reset role;

  -- ==================== UN DICTAMEN EN BLANCO NO PUEDE ENVIARSE (spec §5.4)
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);

  begin
    update public.dictamenes
       set estado = 'enviado', enviado_at = now(), puntaje = 0, maximo = 21,
           puertas_ok = false, criticos_ok = false,
           decision_sugerida_id = (select id from public.decisiones
                                    where rubrica_version_id = v_rubrica and es_falla limit 1)
     where id = v_dictamen;
    raise exception 'FALLO: se envió una tarjeta en blanco';
  exception when check_violation then
    -- Sin esto, enviar en blanco desvelaría al autor produciendo "Pendiente
    -- de dictamen", indistinguible de no haber empezado.
    afirmaciones := afirmaciones + 1;
  end;

  reset role;

  -- ============================================ N/A DONDE NO SE ADMITE
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);

  begin
    insert into public.dictamen_puntajes (dictamen_id, dimension_id, valor)
    select v_dictamen, id, null from public.rubrica_dimensiones
     where rubrica_version_id = v_rubrica and not permite_na limit 1;
    raise exception 'FALLO: se aceptó N/A en una dimensión que no lo admite';
  exception when check_violation then
    afirmaciones := afirmaciones + 1;
  end;

  reset role;

  -- ============================================ ANA COMPLETA Y ENVÍA
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);

  insert into public.dictamen_puertas (dictamen_id, puerta_id, valor)
  select v_dictamen, id, true from public.rubrica_puertas where rubrica_version_id = v_rubrica;

  insert into public.dictamen_puntajes (dictamen_id, dimension_id, valor)
  select v_dictamen, id, 3 from public.rubrica_dimensiones where rubrica_version_id = v_rubrica;

  select id into v_decision from public.decisiones
   where rubrica_version_id = v_rubrica and etiqueta = 'Aceptado';

  update public.dictamenes
     set estado = 'enviado', enviado_at = now(), puntaje = 21, maximo = 21,
         puertas_ok = true, criticos_ok = true, decision_sugerida_id = v_decision
   where id = v_dictamen;

  -- Ahora, y sólo ahora, Ana ve al autor.
  select count(*) into n from public.envios_autoria where envio_id = v_envio;
  if n <> 1 then raise exception 'FALLO: Ana no ve la autoría después de enviar su dictamen'; end if;
  afirmaciones := afirmaciones + 1;

  select count(*) into n from public.envio_archivo_nombres where archivo_id = v_archivo;
  if n <> 1 then raise exception 'FALLO: Ana no ve el nombre original tras enviar'; end if;
  afirmaciones := afirmaciones + 1;

  -- Y no puede deshacerlo.
  begin
    update public.dictamenes set estado = 'borrador' where id = v_dictamen;
    raise exception 'FALLO: un dictamen enviado volvió a borrador';
  exception when check_violation then
    afirmaciones := afirmaciones + 1;
  end;

  reset role;

  -- ===================== BETO SIGUE CIEGO: la ceguera es por persona
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);

  select count(*) into n from public.envios_autoria where envio_id = v_envio;
  if n <> 0 then raise exception 'FALLO: el dictamen de Ana desveló al autor para Beto'; end if;
  afirmaciones := afirmaciones + 1;

  -- Beto sí ve la tarjeta de Ana: el detalle las muestra lado a lado (§6.3).
  select count(*) into n from public.dictamenes where envio_id = v_envio;
  if n <> 1 then raise exception 'FALLO: Beto no ve el dictamen de Ana'; end if;
  afirmaciones := afirmaciones + 1;

  -- Pero no puede tocarlo.
  update public.dictamenes set comentarios = 'metiendo mano' where id = v_dictamen;
  if found then raise exception 'FALLO: Beto editó el dictamen de Ana'; end if;
  afirmaciones := afirmaciones + 1;

  reset role;

  -- ===================== DECISIÓN GRABADA: desvela para todo el comité
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);

  update public.envios
     set decision_id = v_decision, decision_final_por = beto, decision_final_at = now(),
         estado = 'decidido'
   where id = v_envio;

  select count(*) into n from public.envios_autoria where envio_id = v_envio;
  if n <> 1 then raise exception 'FALLO: la decisión final no desveló la autoría'; end if;
  afirmaciones := afirmaciones + 1;

  reset role;

  -- ===================== LA BITÁCORA SÓLO SE AÑADE
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);

  insert into public.envio_eventos (envio_id, actor_id, tipo) values (v_envio, ana, 'dictamen_enviado');

  begin
    update public.envio_eventos set tipo = 'otra cosa' where envio_id = v_envio;
    raise exception 'FALLO: se pudo modificar la bitácora';
  exception when insufficient_privilege then
    afirmaciones := afirmaciones + 1;
  end;

  begin
    delete from public.envio_eventos where envio_id = v_envio;
    raise exception 'FALLO: se pudo borrar de la bitácora';
  exception when insufficient_privilege then
    afirmaciones := afirmaciones + 1;
  end;

  -- Y nadie puede firmar un evento con el nombre de otra persona.
  begin
    insert into public.envio_eventos (envio_id, actor_id, tipo) values (v_envio, beto, 'suplantación');
    raise exception 'FALLO: Ana firmó un evento como Beto';
  exception when insufficient_privilege then
    afirmaciones := afirmaciones + 1;
  end;

  reset role;

  -- ===================== UN DICTAMEN EXIGE ASIGNACIÓN PREVIA
  -- El caso que importa no es quien no es del comité —esa ni llega— sino una
  -- persona del comité SIN asignación para este envío.
  delete from public.asignaciones where envio_id = v_envio and revisor_id = beto;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);

  begin
    insert into public.dictamenes (envio_id, revisor_id, rubrica_version_id)
    values (v_envio, beto, v_rubrica);
    raise exception 'FALLO: se abrió un dictamen sin asignación previa';
  exception when foreign_key_violation then
    -- Sin esta llave, cualquiera del comité podría abrir una tarjeta para
    -- cualquier envío con el único fin de desvelarse a sí misma la autoría.
    afirmaciones := afirmaciones + 1;
  end;

  reset role;

  -- ------------------------------------------------------------- limpieza
  delete from public.envios where id = v_envio;
  delete from public.usuarios where id in (ana, beto);
  delete from auth.users where id in (ana, beto, curiosa);

  raise notice 'RLS: % afirmaciones, todas pasaron', afirmaciones;
  if afirmaciones <> 26 then
    raise exception 'se esperaban 26 afirmaciones y corrieron %', afirmaciones;
  end if;
end $$;
