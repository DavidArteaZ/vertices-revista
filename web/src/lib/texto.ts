/**
 * Ayudantes de texto del sitio original.
 * slug y clamp vienen de index.html:1065-1069; norm de index.html:1933.
 *
 * El original escribe el rango de marcas diacríticas con caracteres
 * combinantes literales dentro del archivo. Aquí va escapado: es el mismo
 * rango U+0300–U+036F, pero sobrevive a copiar, pegar y recodificar.
 */

const DIACRITICOS = /[̀-ͯ]/g;

export function slug(txt: string): string {
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const norm = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");

export const clamp = (v: number, a: number, b: number): number =>
  Math.min(b, Math.max(a, v));
