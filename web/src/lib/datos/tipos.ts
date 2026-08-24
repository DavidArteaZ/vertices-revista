/**
 * Los nueve tipos de pieza canónicos de la hoja `Catálogos`, en el orden en
 * que están sembrados en public.tipos_pieza.
 *
 * El formulario ofrecía cinco opciones que no coincidían con ninguno de ellos
 * ("Paper o abstract de investigación", "Otro formato"…), de modo que lo que
 * el autor elegía no se podía cruzar con el catálogo del comité. La etapa 4
 * unifica los dos vocabularios en éste (spec §8).
 *
 * El `value` del <option> es la cadena española: el servidor la resuelve
 * contra la tabla, así que la base recibe lo mismo en cualquier idioma.
 */
export const TIPOS_PIEZA = [
  { nombre: "Paper/Investigación", clave: "tipo_paper_investigacion" },
  { nombre: "Artículo", clave: "tipo_articulo" },
  { nombre: "Nota", clave: "tipo_nota" },
  { nombre: "Entrevista", clave: "tipo_entrevista" },
  { nombre: "Visualización", clave: "tipo_visualizacion" },
  { nombre: "Infografía", clave: "tipo_infografia" },
  { nombre: "Cápsula", clave: "tipo_capsula" },
  { nombre: "Crónica", clave: "tipo_cronica" },
  { nombre: "Reseña", clave: "tipo_resena" },
] as const;
