-- Segundo switch de la edición en la portada: si la página arranca en la
-- parada de la edición en vez de en la de Vértices.
--
-- Sólo tiene efecto con portada_en_carrusel encendido; la portada lo lee junto
-- con él. Se guarda aparte para que apagar y volver a encender la parada no
-- olvide en qué lugar iba.

alter table public.ediciones
  add column if not exists portada_edicion_primero boolean not null default false;

comment on column public.ediciones.portada_edicion_primero is
  'Switch del panel: la portada abre directo en la parada de esta edición.';

notify pgrst, 'reload schema';
