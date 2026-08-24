"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { slug } from "@/lib/texto";
import { TOPICS } from "@/lib/datos/temas";
import { SECTIONS } from "@/lib/datos/secciones";
import { SUBTITULO_ES } from "@/lib/motor/motor";

/**
 * Temas y secciones son datos, no copia de interfaz: aparecen en el lienzo,
 * en el panel de descubrimiento y en los <select> del formulario, y la base de
 * datos los guarda SIEMPRE en español (spec §11). Por eso su clave se deriva
 * del propio literal español con el mismo `slug` que ya usa el sitio para las
 * anclas de artículo, y el español nunca sale del código: sólo se traduce al
 * pintar.
 *
 * `traducir` reproduce la forma de TR() del original — recibe el literal
 * español y devuelve la traducción o el propio literal (index.html:1933,
 * idiomas.js:63) — para que el motor de partículas, que es un puerto
 * verbatim, no necesite conocer next-intl.
 */
export function useCatalogo() {
  const tTemas = useTranslations("temas");
  const tSecciones = useTranslations("secciones");
  const tLienzo = useTranslations("lienzo");

  return useMemo(() => {
    const tema = (es: string) => tTemas(slug(es));
    const seccion = (es: string) => tSecciones(slug(es));
    const descSeccion = (es: string) => tSecciones(`${slug(es)}__desc`);

    const porEspanol = new Map<string, string>();
    for (const x of TOPICS) porEspanol.set(x, tema(x));
    for (const s of SECTIONS) {
      porEspanol.set(s.label, seccion(s.label));
      porEspanol.set(s.desc, descSeccion(s.label));
    }
    porEspanol.set(SUBTITULO_ES, tLienzo("subtitulo"));

    return {
      tema,
      seccion,
      descSeccion,
      traducir: (es: string) => porEspanol.get(es) ?? es,
    };
  }, [tTemas, tSecciones, tLienzo]);
}
