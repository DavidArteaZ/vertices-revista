// Carga los cinco diccionarios del sitio legado. Son archivos que asignan a
// `window.VERTICES_TRAD`, así que se evalúan en un contexto de vm con un
// window falso en vez de parsearlos a mano.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

export const LOCALES = ["es", "en", "fr", "it", "pt", "ru"];
export const LOCALES_TRADUCIDOS = ["en", "fr", "it", "pt", "ru"];

export const RAIZ_REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
/** La app dejó de vivir en web/ y pasó a ser la raíz; el nombre se queda por
 *  no tocar los cinco scripts que lo importan. */
export const DIR_WEB = RAIZ_REPO;

export function cargaDiccionariosLegados() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const l of LOCALES_TRADUCIDOS) {
    vm.runInContext(
      readFileSync(path.join(RAIZ_REPO, "legado", "idiomas", `${l}.js`), "utf8"),
      ctx,
    );
  }
  const out = {};
  for (const l of LOCALES_TRADUCIDOS) out[l] = ctx.window.VERTICES_TRAD[l].textos;
  return out;
}

/** La misma normalización que idiomas.js:19 aplica antes de buscar en el diccionario. */
export const norma = (s) => s.replace(/\s+/g, " ").trim();
