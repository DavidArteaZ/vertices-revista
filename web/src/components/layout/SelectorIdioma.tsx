"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navegacion";
import { LOCALES, CODIGO_CORTO, NOMBRE_IDIOMA, type Locale } from "@/i18n/rutas";

/**
 * Pastilla de idioma. En el sitio actual la inyecta idiomas.js dentro de
 * .marco nav, justo antes del botón de menú (idiomas.js:98-143), así que
 * aparece en las imágenes doradas y hay que reproducirla tal cual.
 *
 * Diferencia de fondo con el original: allí cambiar de idioma reescribía el
 * DOM en el navegador y lo recordaba en localStorage. Aquí el idioma es la
 * URL. Una liga compartida abre siempre en el idioma que dice la liga, y
 * desaparece el parpadeo en español que hoy se ve antes de que cargue el
 * diccionario.
 *
 * Los nombres de los idiomas van en su propia lengua y no se traducen: es lo
 * que hace el original y ningún diccionario los incluye.
 */
export default function SelectorIdioma() {
  const t = useTranslations("idioma");
  const locale = useLocale() as Locale;
  const ruta = usePathname();
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  function cambia(siguiente: Locale) {
    if (siguiente === locale) return;
    // usePathname de next-intl devuelve la ruta ya sin prefijo de idioma, así
    // que basta con volver a pedirla en el idioma nuevo. La página se
    // re-renderiza en el servidor: no hay reescritura del DOM como en
    // idiomas.js, y por eso el <select> se deshabilita mientras llega.
    empezar(() => router.replace(ruta, { locale: siguiente }));
  }

  return (
    <span id="selIdiomaWrap">
      <svg
        id="selIdiomaGlobo"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="8" />
        <ellipse cx="10" cy="10" rx="3.6" ry="8" />
        <path d="M2.4 7.2 H17.6 M2.4 12.8 H17.6" />
      </svg>
      <span id="selIdiomaNombre">{CODIGO_CORTO[locale]}</span>
      <i id="selIdiomaFlecha"></i>
      <select
        id="selIdioma"
        aria-label={t("idioma")}
        value={locale}
        disabled={pendiente}
        onChange={(e) => cambia(e.target.value as Locale)}
      >
        {LOCALES.map((cod) => (
          <option key={cod} value={cod}>
            {NOMBRE_IDIOMA[cod]}
          </option>
        ))}
      </select>
    </span>
  );
}
