-- /registro pregunta si la persona llevará a un invitado (+1).

alter table public.registros_evento
  add column if not exists invitado boolean not null default false;

comment on column public.registros_evento.invitado is
  'La persona indicó que llevará a un invitado (+1).';
