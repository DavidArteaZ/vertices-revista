-- Hora del evento de lanzamiento: se define en los parámetros del número y
-- /registro la muestra junto a la fecha.

alter table public.ediciones
  add column if not exists hora_evento time;

comment on column public.ediciones.hora_evento is
  'Hora del evento de lanzamiento (hora de la Ciudad de México).';
