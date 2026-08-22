import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/rutas";

/**
 * Dos trabajos que no se mezclan.
 *
 * La revista pública resuelve idioma y reescribe a /[locale]. El panel no: es
 * interno, va en español y vive fuera del enrutado por idioma (ver
 * app/panel/layout.tsx). Lo que sí necesita es que la sesión de Supabase se
 * refresque aquí, porque un componente de servidor no puede escribir cookies
 * mientras renderiza y el token caducaría a media sesión.
 *
 * El archivo se llama proxy.ts y no middleware.ts: Next 16 renombró la
 * convención. La función de next-intl sigue llamándose createMiddleware.
 */

const idiomas = createMiddleware(routing);

export default async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/panel")) return sesionDelPanel(req);
  return idiomas(req);
}

/**
 * Refresca el token si toca y devuelve la respuesta con las cookies nuevas.
 *
 * NO decide aquí quién entra. El proxy sólo sabe que hay una cookie; que la
 * persona siga activa en el comité lo comprueba el layout del panel contra la
 * base, y ése es el único sitio donde debe comprobarse — una autorización que
 * vive en dos lugares acaba divergiendo, y el lado equivocado del que
 * divergiría es éste.
 */
async function sesionDelPanel(req: NextRequest) {
  let respuesta = NextResponse.next({ request: req });

  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return respuesta;

  const sb = createServerClient(url, clave, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (nuevas) => {
        nuevas.forEach(({ name, value }) => req.cookies.set(name, value));
        respuesta = NextResponse.next({ request: req });
        nuevas.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  // Llamar a getUser() es lo que dispara el refresco. El resultado no se usa.
  await sb.auth.getUser();
  return respuesta;
}

export const config = {
  /**
   * Todo menos las rutas de API, los internos de Next y cualquier cosa con
   * extensión. Sin excluir las extensiones, /index.html y los demás stubs de
   * la etapa 1 entrarían aquí antes que a `redirects()`.
   */
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
