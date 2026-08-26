/**
 * next-intl compila cada mensaje como ICU MessageFormat. Dos cosas de ICU
 * muerden aquí:
 *
 *   · `{` y `}` delimitan parámetros. El sitio legado ya escribe sus cadenas
 *     dinámicas así — `TR("{n} de {m} temas").replace("{n}", …)` — de modo que
 *     portan verbatim. Pero una llave que no sea un parámetro real revienta el
 *     mensaje en tiempo de compilación, no de ejecución.
 *   · `'` escapa cuando va antes de `{`, `}`, `#` o de otra `'`. Las
 *     traducciones al francés y al italiano están llenas de apóstrofos. Uno
 *     suelto es inofensivo; `d'{n}` no lo es.
 *
 * Por eso toda clave con llaves tiene que estar declarada aquí con los
 * parámetros que admite. Si no está, generar.mjs falla.
 */
import { parse as parseICU, TYPE } from "@formatjs/icu-messageformat-parser";

export const PARAMETRIZADOS = {
  "panelarticulos.n_de_m_temas": ["n", "m"],
  "panelarticulos.n_articulos": ["n"],
  "avisos.el_resumen_lleva_n_palabras_se_piden_al_menos_10_c4d7": ["n"],
  "avisos.el_resumen_lleva_n_palabras_el_maximo_es_300": ["n"],
  "avisos.a_no_es_pdf_ni_docx": ["a"],
  "avisos.a_pesa_mas_de_20_mb": ["a"],
  "formularioenvio.contador_singular": ["n"],
  "formularioenvio.contador_plural": ["n"],
  "camposarchivosenvio.contador_min_max": ["n", "min", "max"],
  "camposarchivosenvio.contador_max": ["n", "max"],
  "camposarchivosenvio.n_archivos": ["n"],
  "camposarchivosenvio.quitar_a": ["a"],
  "avisos.no_pudimos_subir_a": ["a"],
  "avisos.a_no_es_un_pdf_ni_un_documento_de_word": ["a"],
  "estadoenvio.recibido_el_f": ["f"],
  "correo.asunto_acuse": ["folio"],
  "correo.hola_nombre": ["nombre"],
  "correo.registramos_tu_manuscrito_titulo": ["titulo"],
  "correo.tu_folio_es_folio": ["folio"],
  "correo.asunto_decision": ["folio"],
  "correo.el_comite_registro_decision": ["titulo", "decision"],
  "articulo.numero_n": ["n"],
};

/**
 * Recoge los nombres de argumento de un mensaje recorriendo su árbol ICU.
 *
 * Leerlos con una expresión regular sobre las llaves parecía suficiente
 * mientras todos los mensajes eran `{n} de {m}`, pero un plural
 * —`{n, plural, one {# palabra} other {# palabras}}`— anida llaves, y el regex
 * devolvía «n, plural, one {# palabra» como si fuera un parámetro. Ninguna
 * clave con plural podía declararse, así que la generación entera fallaba.
 */
export function argumentosDe(elementos, acc = new Set()) {
  for (const el of elementos) {
    if (el.type === TYPE.literal || el.type === TYPE.pound) continue;
    if (el.type === TYPE.tag) {
      argumentosDe(el.children, acc);
      continue;
    }
    acc.add(el.value);
    // select y plural llevan su propio sub-árbol por opción, y ahí dentro
    // puede haber más argumentos.
    if (el.options) for (const o of Object.values(el.options)) argumentosDe(o.value, acc);
  }
  return acc;
}

export function verificaParametros(claves) {
  const problemas = [];
  for (const [espacio, entradas] of Object.entries(claves)) {
    for (const [clave, espanol] of Object.entries(entradas)) {
      const completa = `${espacio}.${clave}`;
      let llaves;
      try {
        llaves = [...argumentosDe(parseICU(espanol))];
      } catch (e) {
        // Un mensaje que no compila es un problema más de esta lista, no una
        // excepción que tumbe la generación sin decir de qué clave se trata.
        problemas.push(`${completa} no compila como ICU: ${e.message}`);
        continue;
      }
      if (!llaves.length) continue;
      const declarados = PARAMETRIZADOS[completa];
      if (!declarados) {
        problemas.push(`${completa} usa {…} y no está en PARAMETRIZADOS: ${espanol}`);
        continue;
      }
      for (const l of llaves) {
        if (!declarados.includes(l)) problemas.push(`${completa}: parámetro {${l}} no declarado`);
      }
    }
  }
  return problemas;
}
