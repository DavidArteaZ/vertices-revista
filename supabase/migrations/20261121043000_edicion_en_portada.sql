-- La edición en la portada: una parada del recorrido que anuncia el número
-- publicado, con su portada al centro y dos pliegos interiores detrás.
--
-- Se enciende con un switch en el panel de la edición. Sólo se enseña si la
-- edición es la activa, está publicada, tiene el switch encendido y sus tres
-- imágenes; la portada lo comprueba al leer, así que apagar la edición
-- activa o cambiarla basta para que la parada desaparezca.

alter table public.ediciones
  add column if not exists portada_en_carrusel boolean not null default false,
  add column if not exists carrusel_portada_path text,
  add column if not exists carrusel_pliego_izq_path text,
  add column if not exists carrusel_pliego_der_path text;

comment on column public.ediciones.portada_en_carrusel is
  'Switch del panel: enseñar esta edición como parada del recorrido de la portada.';

-- Las imágenes van al mismo bucket público que los PDF, con sufijo al azar.
update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 where id = 'publicaciones';
