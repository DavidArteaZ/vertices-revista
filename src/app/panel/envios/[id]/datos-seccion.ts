import {
  CAMPOS_SECCION,
  CLAVES_CAMPO_SECCION,
  type CampoSeccion,
} from "@/lib/datos/portal-envios";

export type CampoConTexto = { clave: CampoSeccion; etiqueta: string; texto: string };

/**
 * Lo que el autor escribió, en el orden declarado.
 *
 * Se recorre la lista de campos declarados y no las claves del JSON: así el
 * orden es editorial y estable, y una clave que no reconocemos —un envío
 * hecho con otra versión del formulario— nunca se pinta. `/api/envios` guarda
 * las ocho claves siempre, la mayoría vacías, de modo que descartar lo vacío
 * es lo único que separa lo escrito de lo que sólo viaja.
 *
 * Un `datos_seccion` que no sea un objeto —nulo, o de un envío anterior a la
 * migración— devuelve lista vacía en vez de reventar: quien llama decide qué
 * enseñar en su lugar.
 */
export function camposConTexto(datos: unknown): CampoConTexto[] {
  if (typeof datos !== "object" || datos === null || Array.isArray(datos)) return [];
  const d = datos as Record<string, unknown>;

  return CLAVES_CAMPO_SECCION.flatMap((clave) => {
    const valor = d[clave];
    if (typeof valor !== "string" || valor.trim() === "") return [];
    return [{ clave, etiqueta: CAMPOS_SECCION[clave].etiqueta, texto: valor.trim() }];
  });
}

/**
 * El repositorio se pinta como enlace sólo si de verdad se puede seguir. El
 * campo del formulario es texto libre y llega con «pendiente» o con un DOI
 * suelto más veces de las que llega con una URL.
 */
export function enlaceRepositorio(texto: string): string | null {
  try {
    const u = new URL(texto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
