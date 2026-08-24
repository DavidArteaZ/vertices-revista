/**
 * Los artículos que enseña la portada.
 *
 * Hasta la etapa 5 esto era un arreglo estático de 26 piezas de muestra. Ahora
 * sale de la base (spec §5.5) y por tanto crece cuando el comité publica un
 * número, sin tocar el código.
 *
 * La forma se conserva exactamente —`t`, `a`, `s`, `tm`, `min`, `dest`—, y no
 * por pereza: es la que consumen el carrusel y el panel de descubrimiento, que
 * están dentro de la compuerta visual. Cambiar la fuente de los datos no puede
 * cambiar un píxel de lo que se dibuja, así que lo único que cambia es de
 * dónde vienen.
 */

export type Articulo = {
  /** título */
  t: string;
  /** autoría */
  a: string;
  /** sección, con el nombre español que también usa el motor del lienzo */
  s: string;
  /** temas, en español */
  tm: string[];
  /** minutos de lectura */
  min: number;
  /** destacado: sale en el carrusel */
  dest?: boolean;
  /** para enlazar a /articulos/[slug] */
  slug: string;
  /** falso en cuanto la pieza es real; los de muestra no tienen PDF */
  esPlaceholder: boolean;
};
