/**
 * Comprobación de CI que pide la spec §11: los seis archivos de mensajes tienen
 * que compartir juego de claves.
 *
 * Con el respaldo horneado en generar.mjs eso se cumple por construcción, así
 * que lo que esta comprobación caza de verdad es otra cosa: una clave añadida a
 * un componente sin volver a generar, o un messages/*.json editado a mano.
 * Además compila cada mensaje con el propio formateador de ICU, que es donde
 * salta un apóstrofo mal puesto en francés.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseICU } from "@formatjs/icu-messageformat-parser";
import { LOCALES, LOCALES_TRADUCIDOS, DIR_WEB, cargaTraduccionesPropias } from "./dicts.mjs";
import { verificaParametros, argumentosDe } from "./parametros.mjs";

const claves = JSON.parse(readFileSync(path.join(DIR_WEB, "scripts/i18n/claves.json"), "utf8"));

const aplana = (o, pre = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === "string" ? [[pre + k, v]] : aplana(v, `${pre}${k}.`),
  );

let fallas = 0;
const fallo = (m) => { console.error("✗ " + m); fallas++; };

const esperadas = new Set(aplana(claves).map(([k]) => k));
const mensajes = {};
for (const l of LOCALES) {
  mensajes[l] = Object.fromEntries(
    aplana(JSON.parse(readFileSync(path.join(DIR_WEB, "messages", `${l}.json`), "utf8"))),
  );
}

for (const l of LOCALES) {
  const tiene = new Set(Object.keys(mensajes[l]));
  for (const k of esperadas) if (!tiene.has(k)) fallo(`${l}: falta ${k}`);
  for (const k of tiene) if (!esperadas.has(k)) fallo(`${l}: sobra ${k} (regenera)`);
}

for (const p of verificaParametros(claves)) fallo(p);

// Las traducciones propias, contra el catálogo español.
//
// Dos cosas que sólo se ven aquí. Una: una traducción cuya clave ya no existe
// —porque alguien reescribió la frase española y la clave se derivó otra vez—
// se queda en el archivo sin que nada la use, y el idioma parece traducido
// cuando ya no lo está. Dos: una traducción que se come un parámetro. En
// español «{n} palabras» y en inglés «words», y el número desaparece de la
// pantalla sin que nada falle.
const propias = cargaTraduccionesPropias();
for (const l of LOCALES_TRADUCIDOS) {
  for (const [clave, texto] of Object.entries(propias[l])) {
    if (!esperadas.has(clave)) {
      fallo(`traducciones/${l}.json: sobra ${clave} (el español cambió o la clave se borró)`);
      continue;
    }
    let suyos, nuestros;
    try {
      suyos = argumentosDe(parseICU(texto));
      nuestros = argumentosDe(parseICU(mensajes.es[clave]));
    } catch (e) {
      fallo(`traducciones/${l}.json: ${clave} no compila como ICU: ${e.message}`);
      continue;
    }
    for (const a of nuestros) {
      if (!suyos.has(a)) fallo(`traducciones/${l}.json: ${clave} pierde el parámetro {${a}}`);
    }
    for (const a of suyos) {
      if (!nuestros.has(a)) fallo(`traducciones/${l}.json: ${clave} inventa el parámetro {${a}}`);
    }
  }
}

// Compilación ICU real, idioma por idioma.
for (const l of LOCALES) {
  for (const [k, v] of Object.entries(mensajes[l])) {
    try {
      parseICU(v);
    } catch (e) {
      fallo(`${l}.${k} no compila como ICU: ${e.message}\n    ${v}`);
    }
  }
}

if (fallas) {
  console.error(`\n${fallas} problema(s) de i18n`);
  process.exit(1);
}
console.log(`i18n ok — ${esperadas.size} claves × ${LOCALES.length} idiomas`);
