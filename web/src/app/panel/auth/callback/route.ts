import { NextResponse, type NextRequest } from "next/server";
import { sesion } from "@/lib/supabase/sesion";

/**
 * Donde aterriza el enlace de una invitación.
 *
 * Supabase manda a la persona a /auth/v1/verify, que valida el token y
 * redirige aquí con un `code`. Cambiarlo por una sesión tiene que pasar en el
 * servidor —el verificador PKCE vive en una cookie httpOnly— y por eso esto es
 * un route handler y no una página.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // Sólo rutas internas: un `siguiente` con host propio convertiría esto en un
  // redirector abierto, y el enlace llega por correo.
  const crudo = url.searchParams.get("siguiente") ?? "/panel";
  const siguiente = crudo.startsWith("/") && !crudo.startsWith("//") ? crudo : "/panel";

  if (!code) return NextResponse.redirect(new URL("/panel/entrar", url.origin));

  const sb = await sesion();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/panel/entrar", url.origin));

  return NextResponse.redirect(new URL(siguiente, url.origin));
}
