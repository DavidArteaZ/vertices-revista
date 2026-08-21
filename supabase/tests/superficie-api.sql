-- Suite de la superficie de servidor de la etapa 4 (spec §4.2, §13).
--
-- La suite de RLS demuestra que las POLÍTICAS aguantan. Ésta demuestra lo
-- otro: que las funciones que puede llamar el servidor no las puede llamar
-- nadie más. Hace falta porque son seis funciones SECURITY DEFINER en el
-- esquema `public`, es decir seis funciones que corren como su dueño y que
-- PostgREST expone por HTTP. Postgres concede EXECUTE a PUBLIC en cada función
-- nueva, así que "no la concedí a anon" no significa nada: hay que revocarla
-- explícitamente, y hay que comprobar que se revocó.
--
-- Si alguna de éstas quedara abierta, `crear_envio` sería escritura anónima
-- directa saltándose RLS —exactamente lo que §13 prohíbe— y
-- `consultar_estado` sería el oráculo de correos sin ninguno de sus límites,
-- porque quien la llama puede inventarse el hash de IP.
--
-- Correrla:  psql < supabase/tests/superficie-api.sql   (o por el MCP)

do $$
declare
  afirmaciones int := 0;
  fila         record;
  abiertas     int;
begin
  -- ============================================ ninguna función queda abierta
  -- Comprobación por ACL, que es la fuente de verdad y no depende de que se me
  -- ocurra probar todos los roles. proacl NULL significa "sin ACL", que en
  -- Postgres NO quiere decir cerrada sino EXECUTE para PUBLIC.
  select count(*) into abiertas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'privado')
     and (
       p.proacl is null
       or exists (
         select 1 from aclexplode(p.proacl) a
          where a.grantee = 0                                   -- PUBLIC
             or a.grantee = 'anon'::regrole
             or (a.grantee = 'authenticated'::regrole
                 and p.proname not in ('es_staff', 'puede_ver_autoria'))
       ));

  if abiertas > 0 then
    for fila in
      select n.nspname, p.proname,
             coalesce(array_to_string(p.proacl, ' | '), 'sin ACL = PUBLIC') as acl
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'privado') and p.proacl is null
    loop
      raise warning 'abierta: %.% → %', fila.nspname, fila.proname, fila.acl;
    end loop;
    raise exception 'hay % funciones alcanzables por PUBLIC/anon', abiertas;
  end if;
  afirmaciones := afirmaciones + 1;

  -- Y que las de la etapa 4 sí las tenga service_role, porque una función que
  -- no puede llamar nadie tampoco sirve.
  select count(*) into abiertas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('crear_envio', 'preparar_subida', 'consultar_estado',
                       'limitar', 'subidas_huerfanas', 'olvidar_subida')
     and not exists (
       select 1 from aclexplode(p.proacl) a
        where a.grantee = 'service_role'::regrole and a.privilege_type = 'EXECUTE');

  if abiertas > 0 then
    raise exception '% funciones de la etapa 4 no las puede llamar service_role', abiertas;
  end if;
  afirmaciones := afirmaciones + 1;

  -- ============================================ y en ejecución, no sólo en ACL
  set local role anon;

  begin
    perform public.crear_envio('{}'::jsonb);
    raise exception 'FALLO: anon puede escribir un envío saltándose RLS';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;

  begin
    perform public.preparar_subida('application/pdf', 'falsificado');
    raise exception 'FALLO: anon puede firmar subidas al bucket privado';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;

  begin
    -- Si anon pudiera llamarla, pasaría un hash de IP distinto en cada intento
    -- y el límite de tasa dejaría de existir.
    perform public.consultar_estado('VTX-2026-001', 'a@b.test', 'inventado');
    raise exception 'FALLO: anon puede consultar estados sin pasar por la ruta';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;

  begin
    perform public.limitar('x', 1, 1);
    raise exception 'FALLO: anon puede gastar cupo ajeno';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;

  begin
    -- Enumerar el bucket privado es enumerar manuscritos sin publicar.
    perform public.subidas_huerfanas();
    raise exception 'FALLO: anon puede listar el contenido del bucket privado';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;

  reset role;

  -- ==================================== el personal tampoco, y esto importa
  -- El panel corre como el usuario, no como service_role (esa es la decisión
  -- que hace significativa la suite de RLS). Si una persona del comité pudiera
  -- llamar consultar_estado, tendría un camino a la autoría que no pasa por
  -- privado.puede_ver_autoria: le basta el folio y probar direcciones.
  set local role authenticated;

  begin
    perform public.consultar_estado('VTX-2026-001', 'a@b.test', 'x');
    raise exception 'FALLO: el personal puede saltarse la ceguera vía consultar_estado';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;

  begin
    perform public.crear_envio('{}'::jsonb);
    raise exception 'FALLO: el personal puede fabricar envíos sin pasar por la ruta';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;

  reset role;

  -- ================================================ las tablas de privado
  -- privado.subidas es el registro que impide adjuntar el manuscrito de otra
  -- persona a un envío propio. Si se pudiera escribir, no impediría nada.
  set local role anon;
  begin
    perform 1 from privado.subidas limit 1;
    raise exception 'FALLO: anon lee privado.subidas';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;
  reset role;

  set local role authenticated;
  begin
    insert into privado.subidas (storage_path, bucket, mime) values ('x', 'manuscritos', 'application/pdf');
    raise exception 'FALLO: el personal puede falsificar un ticket de subida';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;
  reset role;

  -- ================================================== los buckets, tal cual
  if (select public from storage.buckets where id = 'manuscritos') then
    raise exception 'FALLO: el bucket de manuscritos es público';
  end if;
  afirmaciones := afirmaciones + 1;

  if not (select public from storage.buckets where id = 'publicaciones') then
    raise exception 'FALLO: el bucket de publicaciones no es público';
  end if;
  afirmaciones := afirmaciones + 1;

  -- Las dos mitades de "nadie que no salte RLS toca el bucket privado": RLS
  -- activo sobre storage.objects, y ni una política que lo abra. Cualquiera de
  -- las dos por separado no dice nada — RLS sin políticas deniega, políticas
  -- sin RLS no se aplican—, así que se comprueban juntas y hay que volver a
  -- pensar el modelo si alguna cambia.
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'FALLO: storage.objects tiene RLS desactivado';
  end if;
  afirmaciones := afirmaciones + 1;

  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects') then
    raise exception 'FALLO: apareció una política sobre storage.objects; revisar que no abra manuscritos';
  end if;
  afirmaciones := afirmaciones + 1;

  raise notice 'superficie de API: % afirmaciones, todas pasaron', afirmaciones;
  if afirmaciones <> 15 then
    raise exception 'se esperaban 15 afirmaciones y corrieron %', afirmaciones;
  end if;
end $$;
