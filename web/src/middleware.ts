import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/rutas";

export default createMiddleware(routing);

export const config = {
  /**
   * Todo menos las rutas de API, los internos de Next y cualquier cosa con
   * extensión. Sin excluir las extensiones, /index.html y los demás stubs de
   * la etapa 1 entrarían al middleware antes que a `redirects()`.
   */
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
