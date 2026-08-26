-- El bucket `manuscritos` acepta imágenes, y su tope sube de 20 a 50 MB.
--
-- Cinco de las siete secciones del portal rediseñado piden fotografías o
-- visualizaciones. El código ya las reconocía y las aceptaba; el bucket sólo
-- admitía PDF y Word, así que la subida —que va del navegador directamente a
-- Storage, sin pasar por ninguna ruta nuestra— rebotaba con un error que el
-- autor no podía interpretar y que nadie veía en los registros de la app.
--
-- Los 50 MB son MAX_BYTES_TOTAL (`src/lib/validacion.ts`), el tope de todo el
-- envío junto. Hasta ahora el tope del bucket coincidía exacto con el de un
-- archivo suelto (MAX_BYTES, 20 MB), y eso es un empate que se pierde: la
-- subida firmada viaja como multipart, o sea el archivo envuelto en un
-- formulario con sus cabeceras, así que un archivo de justo 20 MB pasa la
-- validación del formulario y rebota en el almacén por unos cientos de bytes
-- de envoltura. Dejando el bucket en el total del envío, el tope por archivo
-- queda donde sí sabe explicarse: en la validación, que le dice al autor qué
-- archivo pesa de más.
--
-- Lo que NO cambia, y es deliberado:
--
--   * `publicaciones` se queda igual. Nada de esta entrega lo usa; subirlo hoy
--     sería comodidad, no corrección, y va con la entrega de publicación.
--   * Los dos tipos de Word siguen admitidos. `/api/uploads` ya rechaza esas
--     extensiones antes de firmar nada, así que retirarlos de aquí no cambia
--     nada observable y sí ensucia el diff.
--
-- Se reescribe entero el insert de `20260821130000_almacenamiento.sql` en vez
-- de hacer un `update` suelto: es la convención del repositorio. La fila del
-- bucket se declara completa y el `on conflict` la deja en el estado
-- declarado, se aplique sobre una base nueva o sobre una que ya la tenía.
--
-- Los 50 MB son además el techo del plan gratuito de Supabase, que topa cada
-- subida ahí y no es ajustable. O sea que el bucket queda exactamente en su
-- máximo: no hay nada que configurar en el panel, y pasar de ahí exigiría plan
-- de pago. Ver `docs/operacion.md §4`, que explica qué implica eso para el PDF
-- del número completo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('manuscritos', 'manuscritos', false, 52428800, array[
     'application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'image/jpeg',
     'image/png',
     'image/webp'
   ]),
  ('publicaciones', 'publicaciones', true, 20971520, array['application/pdf'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
