/**
 * Genera messages/{es,en,fr,it,pt,ru}.json a partir de claves.json, las
 * traducciones propias y los cinco diccionarios del sitio legado.
 *
 * La regla, en orden de preferencia:
 *
 *     mensajes[idioma][clave] = propias[idioma][espacio.clave]
 *                            ?? diccionarioLegado[idioma][español]
 *                            ?? español
 *
 * El sitio actual resuelve el respaldo en tiempo de ejecución con
 * `dicc[s] || s` (idiomas.js:52). Aquí se hornea al generar. Consecuencias:
 * los seis archivos comparten juego de claves siempre, y next-intl no puede
 * quedarse sin mensaje en producción.
 *
 * `traducciones/` es el camino para todo texto que el sitio legado no conoce,
 * y existe porque sin él ese texto quedaba condenado al español para siempre:
 * el legado está congelado y no se toca. Va indexado por clave, no por texto
 * español como el legado, y esa diferencia es deliberada. Las claves derivan
 * del español, así que si alguien reescribe una frase la clave cambia con
 * ella, la traducción vieja queda huérfana y `verificar.mjs` la señala. Una
 * traducción que se quedó atrás molesta menos siendo un error ruidoso que
 * siendo un texto que ya no dice lo que dice el original.
 *
 * Ojo con el orden: las propias ganan al legado. Es lo que permite corregir
 * una traducción heredada sin tocar `legado/`, que es intocable.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  cargaDiccionariosLegados,
  cargaTraduccionesPropias,
  LOCALES,
  DIR_WEB,
} from "./dicts.mjs";
import { verificaParametros } from "./parametros.mjs";

const RUTA_CLAVES = path.join(DIR_WEB, "scripts/i18n/claves.json");
const DIR_MENSAJES = path.join(DIR_WEB, "messages");

const claves = JSON.parse(readFileSync(RUTA_CLAVES, "utf8"));
const legado = cargaDiccionariosLegados();
const propias = cargaTraduccionesPropias();

const resumen = {};
for (const locale of LOCALES) {
  const salida = {};
  let respaldos = 0;
  let nuestras = 0;
  let total = 0;

  for (const [espacio, entradas] of Object.entries(claves)) {
    salida[espacio] = {};
    for (const [clave, espanol] of Object.entries(entradas)) {
      total++;
      if (locale === "es") {
        salida[espacio][clave] = espanol;
        continue;
      }
      const propia = propias[locale][`${espacio}.${clave}`];
      if (propia !== undefined) nuestras++;
      const traducido = propia ?? legado[locale][espanol];
      if (traducido === undefined) respaldos++;
      salida[espacio][clave] = traducido ?? espanol;
    }
  }

  mkdirSync(DIR_MENSAJES, { recursive: true });
  writeFileSync(path.join(DIR_MENSAJES, `${locale}.json`), JSON.stringify(salida, null, 2) + "\n");
  resumen[locale] = { total, respaldos, nuestras };
}

const problemas = verificaParametros(claves);
if (problemas.length) {
  console.error("\nLlaves ICU sin declarar:");
  problemas.forEach((p) => console.error("  " + p));
  process.exit(1);
}

console.log("messages/ generado");
for (const l of LOCALES) {
  const { total, respaldos, nuestras } = resumen[l];
  const propias = l === "es" ? "" : `, ${nuestras} de traducciones/`;
  console.log(
    `  ${l}: ${total} claves${propias}, ${respaldos} en español por falta de traducción`,
  );
}
