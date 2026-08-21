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
import { LOCALES, DIR_WEB } from "./dicts.mjs";
import { verificaParametros } from "./parametros.mjs";

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
