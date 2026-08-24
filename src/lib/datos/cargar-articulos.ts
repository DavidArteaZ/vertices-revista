import "server-only";
import { publico } from "@/lib/supabase/publico";
import type { Articulo } from "./articulos";

/**
 * Trae de la base lo que la portada enseña, en la forma que ya consumían el
 * carrusel y el panel de descubrimiento.
 *
 * El orden es `orden` y luego `id`. `orden` existe justamente para esto: los
 * 26 artículos de muestra tienen que salir en el orden del arreglo original,
 * porque la compuerta visual compara ese panel contra el sitio legado. Sin la
 * columna, `select` los devolvería en el orden que le pareciera al planificador.
 *
 * Qué filas llegan no lo decide esta consulta sino la política
 * `articulos_lectura_publica`: publicados y placeholders. Un número en
 * borrador no aparece aquí aunque se pida.
 */
export async function cargaArticulos(): Promise<Articulo[]> {
  const sb = publico();

  const [{ data: articulos, error }, { data: secciones }, { data: temas }, { data: relaciones }] =
    await Promise.all([
      sb
        .from("articulos")
        .select("id, titulo, autor, seccion_id, minutos_lectura, destacado, slug, es_placeholder")
        .order("orden", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true }),
      sb.from("secciones").select("id, nombre_display"),
      sb.from("temas").select("id, nombre"),
      sb.from("articulo_temas").select("articulo_id, tema_id"),
    ]);

  // Una portada sin artículos es preferible a una portada rota, pero el fallo
  // tiene que ser visible en los registros y no una lista vacía silenciosa.
  if (error) {
    console.error(JSON.stringify({ nivel: "error", evento: "articulos_no_cargados", error: error.message }));
    return [];
  }

  const seccion = new Map((secciones ?? []).map((s) => [s.id, s.nombre_display]));
  const tema = new Map((temas ?? []).map((t) => [t.id, t.nombre]));

  const porArticulo = new Map<number, string[]>();
  for (const r of relaciones ?? []) {
    const nombre = tema.get(r.tema_id);
    if (!nombre) continue;
    const lista = porArticulo.get(r.articulo_id);
    if (lista) lista.push(nombre);
    else porArticulo.set(r.articulo_id, [nombre]);
  }

  return (articulos ?? []).map((a) => ({
    t: a.titulo,
    a: a.autor,
    s: seccion.get(a.seccion_id) ?? "",
    tm: porArticulo.get(a.id) ?? [],
    min: a.minutos_lectura ?? 0,
    ...(a.destacado ? { dest: true as const } : {}),
    slug: a.slug,
    esPlaceholder: a.es_placeholder,
  }));
}
