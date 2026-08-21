import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/rutas";

/**
 * Resuelve el idioma de cada petición y reescribe a /[locale].
 *
 * El archivo se llama proxy.ts y no middleware.ts: Next 16 renombró la
 * convención y avisa en cada arranque si se usa la anterior. La función que
 * devuelve next-intl sigue llamándose createMiddleware.
 */
export default createMiddleware(routing);

export const config = {
  /**
   * Todo menos las rutas de API, los internos de Next y cualquier cosa con
   * extensión. Sin excluir las extensiones, /index.html y los demás stubs de
   * la etapa 1 entrarían aquí antes que a `redirects()`.
   */
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
