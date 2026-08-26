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
             -- Lo que SÍ puede llamar el personal, y por qué cada una.
             --   es_staff / puede_ver_autoria  las usan las propias políticas
             --   candidatos_asignacion         SECURITY DEFINER, pero comprueba
             --                                 es_staff() por dentro y sólo
             --                                 devuelve id y nombre
             --   enviar_dictamen, registrar_decision, marcar_anonimizacion,
             --   vincular_revision, adjuntar_articulo, publicar_edicion
             --                                 SECURITY INVOKER: RLS sigue
             --                                 aplicándose dentro. Existen para
             --                                 que el UPDATE y su fila en
             --                                 envio_eventos vayan en la misma
             --                                 transacción
             --   unaccent_simple               pura, sin acceso a datos
             or (a.grantee = 'authenticated'::regrole
                 and p.proname not in (
                   'es_staff', 'puede_ver_autoria', 'candidatos_asignacion',
                   'enviar_dictamen', 'registrar_decision',
                   'marcar_anonimizacion', 'vincular_revision',
                   'adjuntar_articulo', 'publicar_edicion', 'unaccent_simple'))
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

  -- Y QUÉ ACEPTA cada uno, que es la otra mitad y la que faltaba. Ser privado
  -- no dice nada sobre si la subida llega: la del portal va del navegador
  -- directamente a Storage, sin pasar por ninguna ruta nuestra, así que un tipo
  -- que el código admite y el bucket no rebota con un error que el autor no
  -- sabe leer y que no aparece en los registros de la app. Es exactamente lo
  -- que pasó con las fotografías: `EXT_OK` (`src/lib/validacion.ts`) las
  -- aceptaba desde el primer día del rediseño y `allowed_mime_types` seguía
  -- teniendo sólo PDF y Word. Nada habría chillado hasta el primer envío con
  -- foto de la convocatoria, que es el peor momento para enterarse.
  if not exists (
    select 1 from storage.buckets
     where id = 'manuscritos'
       and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']) then
    raise exception 'FALLO: manuscritos no admite los tipos de imagen que el portal deja subir';
  end if;
  afirmaciones := afirmaciones + 1;

  -- Y que al añadir los nuevos no se hayan caído los de antes: la migración
  -- reescribe la fila entera (`insert … on conflict do update`), así que
  -- olvidar una línea no da error, da un bucket que deja de aceptar
  -- manuscritos. Son los tres no-imagen de `MIME` (`src/lib/archivos/formato.ts`).
  if not exists (
    select 1 from storage.buckets
     where id = 'manuscritos'
       and allowed_mime_types @> array[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']) then
    raise exception 'FALLO: manuscritos dejó de admitir PDF o Word';
  end if;
  afirmaciones := afirmaciones + 1;

  -- El tope del bucket es MAX_BYTES_TOTAL (50 MB, el del envío entero), no
  -- MAX_BYTES (20 MB, el de un archivo suelto). La subida firmada viaja como
  -- multipart —el archivo envuelto en un formulario con sus cabeceras—, así
  -- que si los dos números coincidieran, un archivo de justo 20 MB pasaría la
  -- validación del formulario y rebotaría en el almacén por unos cientos de
  -- bytes de envoltura, otra vez sin nada que lo cuente. Se afirma exacto: si
  -- cambia el tope del formulario, esta línea obliga a mirar el bucket.
  if not exists (
    select 1 from storage.buckets
     where id = 'manuscritos' and file_size_limit = 52428800) then
    raise exception 'FALLO: el tope de manuscritos no es 50 MB (MAX_BYTES_TOTAL)';
  end if;
  afirmaciones := afirmaciones + 1;

  -- `publicaciones` NO cambia con las imágenes, y se afirma justamente por eso:
  -- la migración vuelve a declarar su fila entera cada vez que se aplica, y un
  -- arrastre sin querer —admitir imágenes en el bucket PÚBLICO— no se vería en
  -- ningún otro sitio.
  if not exists (
    select 1 from storage.buckets
     where id = 'publicaciones'
       and file_size_limit = 20971520
       and allowed_mime_types = array['application/pdf']) then
    raise exception 'FALLO: publicaciones cambió de tope o de tipos admitidos';
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

  -- ============================== y las del panel no las alcanza el público
  set local role anon;
  begin
    perform public.registrar_decision(gen_random_uuid(), 1);
    raise exception 'FALLO: anon puede grabar decisiones';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;
  begin
    -- Sería un oráculo de autoría: la función compara el correo del autor con
    -- los del personal, y quien la llama no puede ver ese correo.
    perform public.candidatos_asignacion(gen_random_uuid());
    raise exception 'FALLO: anon puede listar candidatos';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;
  reset role;

  -- ==================================== y publicar tampoco lo alcanza el público
  set local role anon;
  begin
    -- Sería publicar un número entero, con sus PDF, sin ser del comité.
    perform public.publicar_edicion(1);
    raise exception 'FALLO: anon puede publicar una edición';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;
  begin
    perform public.adjuntar_articulo(gen_random_uuid(), 1);
    raise exception 'FALLO: anon puede colgar piezas de un número';
  exception when insufficient_privilege then afirmaciones := afirmaciones + 1;
  end;
  reset role;

  raise notice 'superficie de API: % afirmaciones, todas pasaron', afirmaciones;
  if afirmaciones <> 23 then
    raise exception 'se esperaban 23 afirmaciones y corrieron %', afirmaciones;
  end if;
end $$;
