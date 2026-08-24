-- Dos funciones de disparador de la etapa 3 se quedaron con EXECUTE para
-- PUBLIC. Lo encontró supabase/tests/superficie-api.sql, que comprueba el ACL
-- de todas las funciones y no sólo de las que se me ocurrió probar.
--
-- El riesgo real es bajo: son funciones de disparador, así que llamarlas a
-- mano falla en cuanto tocan NEW o TG_OP, y además viven en `privado`, donde
-- anon no tiene USAGE. Pero son SECURITY DEFINER, la excusa "no llegan por dos
-- razones distintas" es exactamente la que deja de ser cierta cuando alguien
-- concede USAGE sobre el esquema en una migración futura, y el trabajo de
-- revocarlas es una línea.
--
-- Es el mismo descuido que 20260821120700: Postgres concede EXECUTE a PUBLIC
-- en toda función nueva, y `alter default privileges … revoke … from anon,
-- authenticated` no cubre al pseudo-rol PUBLIC.

revoke execute on function privado.valida_na_dimension() from public;
revoke execute on function privado.valida_dictamen_completo() from public;

-- Que las funciones futuras nazcan cerradas también en privado.
alter default privileges in schema privado revoke execute on functions from public;
alter default privileges for role postgres in schema privado revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from public;
