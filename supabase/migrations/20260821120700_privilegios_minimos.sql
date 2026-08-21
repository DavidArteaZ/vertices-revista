-- Supabase concede por omisión TODOS los privilegios sobre cada tabla nueva de
-- public a anon, authenticated y service_role. Es decir: antes de esta
-- migración, anon tenía INSERT, UPDATE, DELETE y TRUNCATE sobre
-- envios_autoria, y lo único que lo detenía era RLS.
--
-- RLS lo detiene, sí. Pero la spec §13 dice "anon no tiene INSERT en ninguna
-- parte", y con esos privilegios eso era falso a nivel de permiso: bastaría
-- una política permisiva de más, en cualquier migración futura, para que la
-- escritura anónima quedara abierta. El privilegio es la primera línea; RLS es
-- la segunda. Aquí se recuperan las dos.
--
-- Lo encontró la suite de supabase/tests/rls.sql en su primera corrida, al ver
-- que anon podía consultar public.envios y recibir cero filas en vez de un
-- error de permisos. Es exactamente para lo que la spec pide demostrar el
-- modelo de seguridad antes de que exista una sola pantalla del panel.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Que las tablas futuras nazcan cerradas, en vez de tener que acordarse de
-- revocar cada vez.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- ------------------------------------------------------- lo que sí se concede

-- Catálogos: los necesita el formulario público.
grant select on public.secciones, public.temas, public.tipos_pieza to anon, authenticated;

-- Contenido publicado.
grant select on public.ediciones, public.articulos, public.articulo_temas to anon, authenticated;

-- Lo editorial: sólo personal autenticado, y sólo lectura salvo donde haga
-- falta escribir.
grant select on
  public.usuarios, public.usuario_correos,
  public.rubrica_versiones, public.rubrica_puertas, public.rubrica_dimensiones,
  public.decisiones, public.bandas_decision,
  public.envios, public.envios_autoria, public.envio_archivos, public.envio_archivo_nombres,
  public.asignaciones, public.dictamenes, public.dictamen_puertas, public.dictamen_puntajes,
  public.envio_eventos
  to authenticated;

grant insert, delete on public.asignaciones to authenticated;
grant insert, update on public.dictamenes to authenticated;
grant insert, update, delete on public.dictamen_puertas, public.dictamen_puntajes to authenticated;
grant update on public.envios to authenticated;
grant insert, update, delete on public.ediciones, public.articulos, public.articulo_temas to authenticated;

-- La bitácora sólo se añade: INSERT y SELECT, nunca UPDATE ni DELETE, para
-- nadie. Es lo que sostiene la afirmación de §7 de que la ceguera es
-- responsable aunque no sea absoluta.
grant insert on public.envio_eventos to authenticated;

grant usage on sequence public.asignaciones_id_seq to authenticated;
grant usage on sequence public.envio_eventos_id_seq to authenticated;
grant usage on sequence public.ediciones_id_seq to authenticated;
grant usage on sequence public.articulos_id_seq to authenticated;

-- envio_folios se queda sin un solo privilegio para anon y authenticated: lo
-- toca únicamente el service_role al crear un envío, y ese salta RLS. Por eso
-- el linter reporta "RLS enabled, no policy" sobre esa tabla: es deliberado,
-- y significa denegar a todo el mundo salvo a quien puede saltarse RLS.
