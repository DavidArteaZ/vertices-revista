import { createHash } from "node:crypto";
import { norma } from "./dicts.mjs";

/**
 * Genera la clave semántica de una cadena española.
 *
 * Las claves no se escriben a mano: son 458 y teclearlas es un día de trabajo
 * y una fuente nueva de erratas. Se derivan del propio texto, con el espacio
 * de nombres del componente delante, de modo que sean legibles y greppables:
 *
 *   convocatoria.el_punto_donde_las_ideas_se_conectan
 *
 * Los párrafos largos se truncan a 48 caracteres y llevan un hash de cuatro
 * dígitos del texto completo, para que sigan siendo únicos y estables.
 */
export const hashDe = (texto) =>
  createHash("sha1").update(norma(texto)).digest("hex").slice(0, 4);

export function claveDe(texto) {
  const limpio = norma(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const hash = createHash("sha1").update(norma(texto)).digest("hex").slice(0, 4);

  // Cadenas que se quedan sin letras: "✕", "←", "·", "12". El slug no las
  // distingue, así que el hash es toda la clave.
  if (!limpio) return `s_${hash}`;
  if (limpio.length <= 48) return limpio;
  return `${limpio.slice(0, 48).replace(/_+$/, "")}_${hash}`;
}
