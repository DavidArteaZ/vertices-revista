/**
 * Codemod: sustituye el texto español literal de un componente por llamadas a
 * `t("clave")` y registra las claves en claves.json.
 *
 * Usa el parser de TypeScript, que ya es dependencia del proyecto, en vez de
 * babel o expresiones regulares: hace falta la posición exacta de cada nodo
 * JSX y saber qué es texto y qué es atributo.
 *
 *   node scripts/i18n/convertir.mjs src/components/layout/Marco.tsx marco
 *   node scripts/i18n/convertir.mjs ... --dry     (sólo imprime)
 *
 * Lo que NO hace, y hay que rematar a mano en cada componente:
 *   · declarar `t` (useTranslations en cliente, getTranslations en servidor)
 *   · las cadenas que viven en expresiones JS, no en JSX: arreglos de
 *     constantes, ternarios, plantillas. El codemod las deja intactas a
 *     propósito, porque decidir si una plantilla lleva parámetros ICU no es
 *     mecánico.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { claveDe, hashDe } from "./claves.mjs";
import { norma, DIR_WEB } from "./dicts.mjs";

const ATRIBUTOS = new Set(["placeholder", "aria-label", "title", "alt"]);

/**
 * Sin una sola letra no hay nada que traducir: "27", "✕", "←", "·", "?".
 * El sitio legado tampoco los traduce — no están en ningún diccionario — así
 * que meterlos al catálogo sólo añade claves que siempre valen lo mismo.
 */
const traducible = (s) => /\p{L}/u.test(s);
const RUTA_CLAVES = path.join(DIR_WEB, "scripts/i18n/claves.json");

/** El algoritmo de JSX para colapsar el texto crudo en lo que React renderiza. */
export function textoRenderizado(crudo) {
  const lineas = crudo.split("\n");
  const utiles = [];
  for (let i = 0; i < lineas.length; i++) {
    let l = lineas[i];
    if (i !== 0) l = l.replace(/^[ \t\r]+/, "");
    if (i !== lineas.length - 1) l = l.replace(/[ \t\r]+$/, "");
    if (l) utiles.push(l);
  }
  return utiles.join(" ");
}

function recolecta(codigo, ruta) {
  const fuente = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ediciones = [];

  const visita = (n) => {
    if (ts.isJsxText(n)) {
      const v = textoRenderizado(n.getFullText());
      const nucleo = v.trim();
      if (nucleo && traducible(nucleo)) {
        ediciones.push({
          tipo: "texto",
          // pos/end, no getStart: en JsxText el espacio inicial no es trivia,
          // es parte del nodo, y es justo lo que textoRenderizado interpreta.
          inicio: n.pos,
          fin: n.end,
          espanol: norma(nucleo),
          espacioAntes: v.startsWith(" "),
          espacioDespues: v.endsWith(" "),
        });
      }
    } else if (
      ts.isJsxAttribute(n) &&
      n.initializer &&
      ts.isStringLiteral(n.initializer) &&
      ATRIBUTOS.has(n.name.getText(fuente))
    ) {
      const v = norma(n.initializer.text);
      if (v && traducible(v)) {
        ediciones.push({
          tipo: "atributo",
          inicio: n.initializer.getStart(fuente),
          fin: n.initializer.getEnd(),
          espanol: v,
        });
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(fuente);
  return ediciones;
}

function main() {
  const [rutaRel, espacio, ...banderas] = process.argv.slice(2);
  if (!rutaRel || !espacio) {
    console.error("uso: convertir.mjs <archivo.tsx> <espacio-de-nombres> [--dry]");
    process.exit(2);
  }
  const seco = banderas.includes("--dry");
  const ruta = path.resolve(DIR_WEB, rutaRel);
  const codigo = readFileSync(ruta, "utf8");

  const ediciones = recolecta(codigo, ruta);
  if (!ediciones.length) {
    console.log("nada que convertir");
    return;
  }

  const claves = existsSync(RUTA_CLAVES) ? JSON.parse(readFileSync(RUTA_CLAVES, "utf8")) : {};
  claves[espacio] ??= {};

  // Dos textos idénticos en el mismo componente comparten clave a propósito:
  // el sitio actual también los traduce con la misma entrada del diccionario.
  //
  // Dos textos DISTINTOS pueden caer en el mismo slug — "tu correo" y
  // "Tu correo" son el placeholder y el aria-label del mismo input, y el
  // diccionario legado los traduce por separado. Se desempatan con el hash.
  for (const e of ediciones) {
    const base = claveDe(e.espanol);
    const previo = claves[espacio][base];
    e.clave = previo === undefined || previo === e.espanol ? base : `${base}_${hashDe(e.espanol)}`;
    claves[espacio][e.clave] = e.espanol;
  }

  // De atrás hacia adelante, para no invalidar los offsets pendientes.
  let salida = codigo;
  for (const e of [...ediciones].sort((a, b) => b.inicio - a.inicio)) {
    const llamada = `{t("${e.clave}")}`;
    const reemplazo =
      e.tipo === "atributo"
        ? `{t("${e.clave}")}`
        : (e.espacioAntes ? '{" "}' : "") + llamada + (e.espacioDespues ? '{" "}' : "");
    salida = salida.slice(0, e.inicio) + reemplazo + salida.slice(e.fin);
  }

  if (seco) {
    console.log(salida);
    return;
  }
  writeFileSync(ruta, salida);
  writeFileSync(RUTA_CLAVES, JSON.stringify(claves, null, 2) + "\n");
  console.log(`${rutaRel}: ${ediciones.length} cadenas → ${espacio}.*`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
