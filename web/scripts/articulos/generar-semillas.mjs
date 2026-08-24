/**
 * Emite la migración que siembra los 26 artículos de demostración.
 *
 *     node scripts/articulos/generar-semillas.mjs
 *
 * Hasta la etapa 5 esos artículos vivían en src/lib/datos/articulos.ts, un
 * arreglo estático que el panel de descubrimiento leía directamente. La etapa 6
 * los mueve a la base (spec §5.5) para que el descubrimiento por tema y por
 * sección lea de un solo sitio, y para que el comité pueda borrarlos desde el
 * panel cuando haya contenido real.
 *
 * Se generan en vez de teclearse por la misma razón que las rúbricas: son 26
 * filas con 60 relaciones a temas, y la compuerta visual compara el panel
 * renderizado contra el sitio legado píxel a píxel. Un título mal copiado no
 * sería un detalle, sería un fallo de la compuerta — que es exactamente lo que
 * se quiere: si esta semilla no reproduce el arreglo original, se nota.
 *
 * El arreglo fuente ya no existe en el árbol; su contenido quedó aquí, que es
 * donde tiene sentido para regenerar la migración si hiciera falta.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { ARTICULOS, slug } from "./muestra.mjs";

const slugs = ARTICULOS.map((a) => slug(a.t));
const repetidos = slugs.filter((s, i) => slugs.indexOf(s) !== i);
if (repetidos.length) throw new Error(`slugs repetidos: ${repetidos.join(", ")}`);

const datos = ARTICULOS.map((a, i) => ({
  titulo: a.t,
  autor: a.a,
  seccion: a.s,
  temas: a.tm ?? [],
  minutos: a.min,
  destacado: !!a.dest,
  slug: slugs[i],
  // El orden del arreglo original es el orden en que el panel los enseña, y la
  // compuerta visual lo compara. Sin esta columna, `order by` sería arbitrario.
  orden: i,
}));

const sql = `-- Los 26 artículos de demostración (spec §5.5).
--
-- GENERADO por scripts/articulos/generar-semillas.mjs. No editar a mano.
--
-- Van con es_placeholder = true y sin edición: se ven desde el primer día para
-- que el descubrimiento por tema y por sección funcione antes de que exista el
-- primer número. No tienen PDF, así que /articulos/[slug] les pinta un vacío
-- definido — hoy esos enlaces son anclas muertas (index.html:1942). El comité
-- los borra desde el panel cuando haya contenido real.
--
-- El orden es el del arreglo que estaba en src/lib/datos/articulos.ts, y no es
-- decorativo: es el orden en que el panel de descubrimiento los lista, y la
-- compuerta visual lo compara contra el sitio legado.

do $$
declare
  fila jsonb;
  v_articulo bigint;
  v_tema text;
begin
  for fila in select * from jsonb_array_elements($semilla$
[
${datos.map((d) => JSON.stringify(d)).join(",\n")}
]
$semilla$::jsonb)
  loop
    insert into public.articulos (
      titulo, autor, seccion_id, minutos_lectura, destacado, slug,
      es_placeholder, orden
    ) values (
      fila->>'titulo',
      fila->>'autor',
      (select s.id from public.secciones s where s.nombre_display = fila->>'seccion'),
      (fila->>'minutos')::smallint,
      (fila->>'destacado')::boolean,
      fila->>'slug',
      true,
      (fila->>'orden')::smallint
    )
    on conflict (slug) do nothing
    returning id into v_articulo;

    if v_articulo is null then
      continue;
    end if;

    for v_tema in select * from jsonb_array_elements_text(fila->'temas')
    loop
      insert into public.articulo_temas (articulo_id, tema_id)
      values (v_articulo, (select t.id from public.temas t where t.nombre = v_tema));
    end loop;
  end loop;
end $$;

-- Que la semilla haya encontrado sección y tema para todo, y no dejado nulos.
do $$
declare n int;
begin
  select count(*) into n from public.articulos where es_placeholder;
  if n <> ${datos.length} then
    raise exception 'se esperaban ${datos.length} artículos de muestra y hay %', n;
  end if;

  select count(*) into n from public.articulo_temas at
    join public.articulos a on a.id = at.articulo_id where a.es_placeholder;
  if n <> ${datos.reduce((s, a) => s + a.temas.length, 0)} then
    raise exception 'se esperaban ${datos.reduce((s, a) => s + a.temas.length, 0)} relaciones artículo-tema y hay %', n;
  end if;

  select count(*) into n from public.articulos where es_placeholder and destacado;
  if n <> ${datos.filter((a) => a.destacado).length} then
    raise exception 'se esperaban ${datos.filter((a) => a.destacado).length} destacados y hay %', n;
  end if;
end $$;
`;

const salida = path.join(
  process.cwd(),
  "../supabase/migrations/20260822100000_semillas_articulos.sql",
);
writeFileSync(salida, sql);

console.log(`escrito ${salida}`);
console.log(`  ${datos.length} artículos`);
console.log(`  ${datos.reduce((s, a) => s + a.temas.length, 0)} relaciones a temas`);
console.log(`  ${datos.filter((a) => a.destacado).length} destacados`);
