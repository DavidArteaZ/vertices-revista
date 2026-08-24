/**
 * Claves de la etapa 6: la página de artículo, que no existía en el sitio
 * legado —sus enlaces eran anclas muertas (index.html:1942)— y por tanto no
 * está en ningún diccionario.
 *
 *     node scripts/i18n/etapa6.mjs && npm run i18n:generar
 *
 * Sale en español en los seis idiomas, como todo lo que no tiene traducción
 * legada. Es la misma regla de generar.mjs desde la etapa 2.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DIR_WEB } from "./dicts.mjs";

const RUTA = path.join(DIR_WEB, "scripts/i18n/claves.json");
const claves = JSON.parse(readFileSync(RUTA, "utf8"));

const AGREGAR = {
  articulo: {
    min_de_lectura: "min de lectura",
    descargar_el_pdf: "Descargar el PDF",
    volver_a_la_portada: "← Volver a la portada",
    temas: "Temas",
    seccion: "Sección",
    numero_n: "Número {n}",
    // El vacío definido que pide §5.5 para las piezas de muestra. No es un
    // error ni un "próximamente": es una pieza de ejemplo que existe para que
    // el descubrimiento por tema funcione antes del primer número.
    pieza_de_muestra:
      "Esta es una pieza de muestra: existe para que el índice de temas y el recorrido por secciones funcionen desde el primer día. No hay documento que descargar.",
    la_convocatoria_esta_abierta: "La convocatoria está abierta.",
    enviar_un_manuscrito: "Enviar un manuscrito",
    no_encontramos_esa_pieza: "No encontramos esa pieza.",
  },
};

for (const [espacio, entradas] of Object.entries(AGREGAR)) {
  claves[espacio] ??= {};
  for (const [clave, texto] of Object.entries(entradas)) claves[espacio][clave] = texto;
}

writeFileSync(RUTA, JSON.stringify(claves, null, 2) + "\n");
console.log("claves.json actualizado para la etapa 6");
