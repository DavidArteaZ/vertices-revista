-- Cupo del evento de lanzamiento: al llenarse, /registro deja de aceptar
-- registros y avisa que los lugares se agotaron. Vacío = sin límite.

alter table public.ediciones
  add column if not exists cupo_invitados integer check (cupo_invitados > 0);

comment on column public.ediciones.cupo_invitados is
  'Personas que caben en el evento de lanzamiento (quien lleva +1 cuenta por dos). Vacío = sin límite.';
