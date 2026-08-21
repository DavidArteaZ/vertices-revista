-- Límite de tasa genérico para las rutas de servidor.
--
-- privado.limite existe desde 20260821130000, pero PostgREST sólo expone el
-- esquema public, así que las rutas no pueden llamarlo. preparar_subida y
-- consultar_estado lo usan por dentro; POST /api/envios necesita comprobar el
-- cupo ANTES de descargar y limpiar los archivos, que es la parte cara, y para
-- eso hace falta una llamada propia.
create function public.limitar(p_clave text, p_segundos integer, p_max integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select privado.limite(p_clave, make_interval(secs => p_segundos), p_max);
$$;

revoke execute on function public.limitar(text, integer, integer) from public;
grant execute on function public.limitar(text, integer, integer) to service_role;
