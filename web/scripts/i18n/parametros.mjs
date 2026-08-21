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

export const PARAMETRIZADOS = {
  "panel.n_de_m_temas": ["n", "m"],
  "panel.n_articulos": ["n"],
  "avisos.el_resumen_lleva_n_palabras_se_piden_al_menos_100": ["n"],
  "avisos.el_resumen_lleva_n_palabras_el_maximo_es_300": ["n"],
  "avisos.a_no_es_pdf_ni_docx": ["a"],
  "avisos.a_pesa_mas_de_20_mb": ["a"],
  "formulario.n_palabra_se_piden_entre_100_y_300": ["n"],
  "formulario.n_palabras_se_piden_entre_100_y_300": ["n"],
};

export function verificaParametros(claves) {
  const problemas = [];
  for (const [espacio, entradas] of Object.entries(claves)) {
    for (const [clave, espanol] of Object.entries(entradas)) {
      const completa = `${espacio}.${clave}`;
      const llaves = [...espanol.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
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
