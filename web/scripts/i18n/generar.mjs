/**
 * Genera messages/{es,en,fr,it,pt,ru}.json a partir de claves.json y los cinco
 * diccionarios del sitio legado.
 *
 * La regla, y es la que sostiene toda la etapa:
 *
 *     mensajes[idioma][clave] = diccionarioLegado[idioma][español] ?? español
 *
 * El sitio actual resuelve el respaldo en tiempo de ejecución con
 * `dicc[s] || s` (idiomas.js:52). Aquí se hornea al generar. Consecuencias:
 * los seis archivos comparten juego de claves siempre, portugués renderiza en
 * español justo las 38 cadenas que hoy no traduce, y next-intl no puede
 * quedarse sin mensaje en producción.
 *
 * Traducir alguna de esas cadenas de respaldo es una mejora real, pero cambia
 * texto renderizado y por tanto rompe la compuerta visual. Es una decisión del
 * comité, no de la migración.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { cargaDiccionariosLegados, LOCALES, DIR_WEB } from "./dicts.mjs";
import { verificaParametros } from "./parametros.mjs";

const RUTA_CLAVES = path.join(DIR_WEB, "scripts/i18n/claves.json");
const DIR_MENSAJES = path.join(DIR_WEB, "messages");

const claves = JSON.parse(readFileSync(RUTA_CLAVES, "utf8"));
const legado = cargaDiccionariosLegados();

const resumen = {};
for (const locale of LOCALES) {
  const salida = {};
  let respaldos = 0;
  let total = 0;

  for (const [espacio, entradas] of Object.entries(claves)) {
    salida[espacio] = {};
    for (const [clave, espanol] of Object.entries(entradas)) {
      total++;
      if (locale === "es") {
        salida[espacio][clave] = espanol;
        continue;
      }
      const traducido = legado[locale][espanol];
      if (traducido === undefined) respaldos++;
      salida[espacio][clave] = traducido ?? espanol;
    }
  }

  mkdirSync(DIR_MENSAJES, { recursive: true });
  writeFileSync(path.join(DIR_MENSAJES, `${locale}.json`), JSON.stringify(salida, null, 2) + "\n");
  resumen[locale] = { total, respaldos };
}

const problemas = verificaParametros(claves);
if (problemas.length) {
  console.error("\nLlaves ICU sin declarar:");
  problemas.forEach((p) => console.error("  " + p));
  process.exit(1);
}

console.log("messages/ generado");
for (const l of LOCALES) {
  const { total, respaldos } = resumen[l];
  console.log(`  ${l}: ${total} claves, ${respaldos} en español por falta de traducción`);
}
