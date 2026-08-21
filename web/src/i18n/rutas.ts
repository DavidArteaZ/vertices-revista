import { defineRouting } from "next-intl/routing";

/**
 * Los seis idiomas del sitio actual (idiomas.js:8-15). El español es el
 * idioma fuente y vive en la raíz: `/`, `/lineamientos`. Los demás llevan
 * prefijo: `/en`, `/fr/lineamientos`.
 *
 * "as-needed" es lo que conserva el mapa de redirecciones de la etapa 1:
 * /lineamientos.html → /lineamientos sigue aterrizando en español sin rebote.
 */

export const LOCALES = ["es", "en", "fr", "it", "pt", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_POR_DEFECTO: Locale = "es";

/** Código corto que muestra la pastilla, igual que idiomas.js:8-15. */
export const CODIGO_CORTO: Record<Locale, string> = {
  es: "ES",
  en: "EN",
  fr: "FR",
  it: "IT",
  pt: "PT",
  ru: "RU",
};

/** Nombre nativo, el texto de cada <option> del selector. */
export const NOMBRE_IDIOMA: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  it: "Italiano",
  pt: "Português",
  ru: "Русский",
};

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: LOCALE_POR_DEFECTO,
  localePrefix: "as-needed",
  // El sitio actual recuerda el idioma en localStorage. Aquí la URL es el
  // estado: sin cookie, una liga compartida abre siempre en el idioma que
  // dice la liga.
  localeDetection: false,
  localeCookie: false,
});
