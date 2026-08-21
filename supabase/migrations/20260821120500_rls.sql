-- Modelo de seguridad (spec §7 y §13).
--
-- Punto de partida: desde abril de 2026 Supabase ya no expone automáticamente
-- las tablas nuevas de public por la Data API, así que el estado por defecto
-- es cerrado y todo acceso de anon/authenticated aquí es un GRANT explícito.
-- Aun así se activa RLS en todas las tablas: el GRANT decide si la tabla se
-- alcanza, RLS decide qué filas.

-- ------------------------------------------------- funciones de apoyo
--
-- Van en el esquema `privado` y no en public. Postgres concede EXECUTE a
-- PUBLIC en toda función nueva, de modo que un SECURITY DEFINER en public
-- sería un endpoint público que cualquiera puede llamar. Son SECURITY DEFINER
-- a propósito: tienen que leer usuarios y dictamenes sin quedar atrapadas en
-- las políticas de esas mismas tablas.

grant usage on schema privado to authenticated;

create or replace function privado.es_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.activo
  );
$$;

revoke execute on function privado.es_staff() from public, anon;
grant execute on function privado.es_staff() to authenticated;

-- El doble ciego, en una sola función (spec §7.2).
--
--   Nadie del comité ve la autoría de un envío hasta que ELLA MISMA haya
--   enviado un dictamen de ese envío, o hasta que el envío tenga decisión.
--
-- No ser revisor asignado no es motivo para ver al autor: cualquiera puede
-- abrir el panel por descuido o por curiosidad, así que el estado por defecto
-- es ciego. No hay acción de "mostrar autor": quien necesita la identidad
-- presenta antes su dictamen.
create or replace function privado.puede_ver_autoria(p_envio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.es_staff() and (
    exists (
      select 1 from public.dictamenes d
      where d.envio_id = p_envio
        and d.revisor_id = (select auth.uid())
        and d.estado = 'enviado'
    )
    or exists (
      select 1 from public.envios e
      where e.id = p_envio and e.decision_id is not null
    )
  );
$$;

revoke execute on function privado.puede_ver_autoria(uuid) from public, anon;
grant execute on function privado.puede_ver_autoria(uuid) to authenticated;

-- --------------------------------------------------------- activar RLS
do $$
declare t text;
begin
  foreach t in array array[
    'secciones','temas','tipos_pieza','usuarios','usuario_correos',
    'rubrica_versiones','rubrica_puertas','rubrica_dimensiones','decisiones','bandas_decision',
    'envio_folios','envios','envios_autoria','envio_archivos','envio_archivo_nombres',
    'asignaciones','dictamenes','dictamen_puertas','dictamen_puntajes',
    'ediciones','articulos','articulo_temas','envio_eventos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- --------------------------------------------------------------- grants
--
-- anon no tiene INSERT en ninguna parte. Los envíos del público entran por
-- POST /api/envios con un cliente de service_role en el servidor, que salta
-- RLS por diseño y es el único camino de escritura anónima.

grant usage on schema public to anon, authenticated;

-- Catálogos: lectura pública. Los necesita el formulario.
grant select on public.secciones, public.temas, public.tipos_pieza to anon, authenticated;

-- Contenido publicado.
grant select on public.ediciones, public.articulos, public.articulo_temas to anon, authenticated;

-- Todo lo editorial: sólo personal autenticado.
grant select on
  public.usuarios, public.usuario_correos,
  public.rubrica_versiones, public.rubrica_puertas, public.rubrica_dimensiones,
  public.decisiones, public.bandas_decision,
  public.envios, public.envios_autoria, public.envio_archivos, public.envio_archivo_nombres,
  public.asignaciones, public.dictamenes, public.dictamen_puertas, public.dictamen_puntajes,
  public.envio_eventos
  to authenticated;

grant insert on public.asignaciones, public.dictamenes, public.envio_eventos to authenticated;
grant insert, update, delete on public.dictamen_puertas, public.dictamen_puntajes to authenticated;
grant update on public.dictamenes, public.envios to authenticated;
grant insert, update, delete on public.ediciones, public.articulos, public.articulo_temas to authenticated;
grant delete on public.asignaciones to authenticated;

-- envio_eventos es sólo-añadir: nadie recibe UPDATE ni DELETE, ni siquiera el
-- personal. El grant de arriba concede INSERT y SELECT y nada más.

-- ------------------------------------------------------------- políticas

-- Catálogos y rúbricas: legibles por quien tenga el grant.
create policy secciones_lectura on public.secciones for select to anon, authenticated using (true);
create policy temas_lectura on public.temas for select to anon, authenticated using (true);
create policy tipos_pieza_lectura on public.tipos_pieza for select to anon, authenticated using (true);

create policy rubrica_versiones_lectura on public.rubrica_versiones
  for select to authenticated using ((select privado.es_staff()));
create policy rubrica_puertas_lectura on public.rubrica_puertas
  for select to authenticated using ((select privado.es_staff()));
create policy rubrica_dimensiones_lectura on public.rubrica_dimensiones
  for select to authenticated using ((select privado.es_staff()));
create policy decisiones_lectura on public.decisiones
  for select to authenticated using ((select privado.es_staff()));
create policy bandas_lectura on public.bandas_decision
  for select to authenticated using ((select privado.es_staff()));

-- Personal.
create policy usuarios_lectura on public.usuarios
  for select to authenticated using ((select privado.es_staff()));
create policy usuario_correos_lectura on public.usuario_correos
  for select to authenticated using ((select privado.es_staff()));

-- Envíos: el personal ve todos los no archivados. La tabla no lleva PII, así
-- que la cola, el detalle, el dictamen y el export heredan la ceguera sin
-- lógica adicional.
create policy envios_lectura on public.envios
  for select to authenticated using ((select privado.es_staff()));
create policy envios_actualizacion on public.envios
  for update to authenticated
  using ((select privado.es_staff()))
  with check ((select privado.es_staff()));

-- LA política del doble ciego.
create policy autoria_lectura on public.envios_autoria
  for select to authenticated
  using ((select privado.puede_ver_autoria(envio_id)));

create policy archivos_lectura on public.envio_archivos
  for select to authenticated using ((select privado.es_staff()));

-- El nombre original del archivo se oculta con el mismo predicado que la
-- autoría, porque delata igual.
create policy archivo_nombres_lectura on public.envio_archivo_nombres
  for select to authenticated
  using ((select privado.puede_ver_autoria(
    (select a.envio_id from public.envio_archivos a where a.id = archivo_id))));

-- Asignaciones.
create policy asignaciones_lectura on public.asignaciones
  for select to authenticated using ((select privado.es_staff()));
create policy asignaciones_alta on public.asignaciones
  for insert to authenticated with check ((select privado.es_staff()));
create policy asignaciones_baja on public.asignaciones
  for delete to authenticated using ((select privado.es_staff()));

-- Dictámenes: se leen todos —el detalle del envío los muestra lado a lado y
-- marca desacuerdos (spec §6.3)—, pero sólo se escribe el propio.
create policy dictamenes_lectura on public.dictamenes
  for select to authenticated using ((select privado.es_staff()));
create policy dictamenes_alta on public.dictamenes
  for insert to authenticated
  with check ((select privado.es_staff()) and revisor_id = (select auth.uid()));
create policy dictamenes_edicion on public.dictamenes
  for update to authenticated
  using ((select privado.es_staff()) and revisor_id = (select auth.uid()))
  with check ((select privado.es_staff()) and revisor_id = (select auth.uid()));

-- Las respuestas siguen a su dictamen. UPDATE lleva USING y WITH CHECK: sin
-- WITH CHECK se podría mover una fila al dictamen de otra persona.
create policy dictamen_puertas_lectura on public.dictamen_puertas
  for select to authenticated using ((select privado.es_staff()));
create policy dictamen_puertas_escritura on public.dictamen_puertas
  for insert to authenticated
  with check (exists (select 1 from public.dictamenes d
                      where d.id = dictamen_id and d.revisor_id = (select auth.uid())
                        and d.estado = 'borrador'));
create policy dictamen_puertas_edicion on public.dictamen_puertas
  for update to authenticated
  using (exists (select 1 from public.dictamenes d
                 where d.id = dictamen_id and d.revisor_id = (select auth.uid())
                   and d.estado = 'borrador'))
  with check (exists (select 1 from public.dictamenes d
                      where d.id = dictamen_id and d.revisor_id = (select auth.uid())
                        and d.estado = 'borrador'));
create policy dictamen_puertas_baja on public.dictamen_puertas
  for delete to authenticated
  using (exists (select 1 from public.dictamenes d
                 where d.id = dictamen_id and d.revisor_id = (select auth.uid())
                   and d.estado = 'borrador'));

create policy dictamen_puntajes_lectura on public.dictamen_puntajes
  for select to authenticated using ((select privado.es_staff()));
create policy dictamen_puntajes_escritura on public.dictamen_puntajes
  for insert to authenticated
  with check (exists (select 1 from public.dictamenes d
                      where d.id = dictamen_id and d.revisor_id = (select auth.uid())
                        and d.estado = 'borrador'));
create policy dictamen_puntajes_edicion on public.dictamen_puntajes
  for update to authenticated
  using (exists (select 1 from public.dictamenes d
                 where d.id = dictamen_id and d.revisor_id = (select auth.uid())
                   and d.estado = 'borrador'))
  with check (exists (select 1 from public.dictamenes d
                      where d.id = dictamen_id and d.revisor_id = (select auth.uid())
                        and d.estado = 'borrador'));
create policy dictamen_puntajes_baja on public.dictamen_puntajes
  for delete to authenticated
  using (exists (select 1 from public.dictamenes d
                 where d.id = dictamen_id and d.revisor_id = (select auth.uid())
                   and d.estado = 'borrador'));

-- Publicación. El público sólo ve lo publicado y los placeholders; el
-- personal ve también los borradores.
create policy ediciones_lectura_publica on public.ediciones
  for select to anon, authenticated using (estado = 'publicada');
create policy ediciones_lectura_staff on public.ediciones
  for select to authenticated using ((select privado.es_staff()));
create policy ediciones_escritura on public.ediciones
  for all to authenticated
  using ((select privado.es_staff())) with check ((select privado.es_staff()));

create policy articulos_lectura_publica on public.articulos
  for select to anon, authenticated
  using (es_placeholder
         or exists (select 1 from public.ediciones e
                    where e.id = edicion_id and e.estado = 'publicada'));
create policy articulos_lectura_staff on public.articulos
  for select to authenticated using ((select privado.es_staff()));
create policy articulos_escritura on public.articulos
  for all to authenticated
  using ((select privado.es_staff())) with check ((select privado.es_staff()));

create policy articulo_temas_lectura on public.articulo_temas
  for select to anon, authenticated using (true);
create policy articulo_temas_escritura on public.articulo_temas
  for all to authenticated
  using ((select privado.es_staff())) with check ((select privado.es_staff()));

-- Bitácora: el personal la lee y la escribe; nadie la corrige.
create policy eventos_lectura on public.envio_eventos
  for select to authenticated using ((select privado.es_staff()));
create policy eventos_alta on public.envio_eventos
  for insert to authenticated
  with check ((select privado.es_staff()) and actor_id = (select auth.uid()));

-- envio_folios no tiene política ni grant: sólo lo toca el service_role al
-- crear un envío, y ese salta RLS.
