import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./rutas";

/**
 * Los archivos de mensajes los genera `npm run i18n:generar`, que ya hornea el
 * respaldo al español: si un idioma no traduce una clave, su archivo trae el
 * literal español, exactamente lo que el sitio actual muestra con `dicc[s] || s`
 * (idiomas.js:52). Por eso los seis archivos comparten juego de claves y
 * next-intl nunca puede quedarse sin mensaje.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const pedido = await requestLocale;
  const locale = hasLocale(routing.locales, pedido) ? pedido : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
