-- /registro pregunta si la persona llevará a un invitado (+1).

alter table public.registros_evento
  add column if not exists invitado boolean not null default false;

comment on column public.registros_evento.invitado is
  'La persona indicó que llevará a un invitado (+1).';

-- El panel lee los registros con la sesión de quien entra, no con la clave de
-- servicio: así el candado sigue siendo RLS y sólo el comité ve estos datos
-- personales. Sólo lectura; la escritura sigue siendo de /api/registro.
grant select on public.registros_evento to authenticated;

create policy registros_evento_lectura_staff on public.registros_evento
  for select to authenticated using ((select privado.es_staff()));
