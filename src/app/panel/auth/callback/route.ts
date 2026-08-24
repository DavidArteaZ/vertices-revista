import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sesion } from "@/lib/supabase/sesion";

/**
 * Donde aterriza el enlace de una invitación o de un cambio de contraseña.
 *
 * Hay dos formas de llegar y sólo se sostenía una:
 *
 *   · con `code`, cuando el enlace nació de un flujo PKCE que empezó aquí. El
 *     verificador vive en una cookie httpOnly, así que el canje tiene que pasar
 *     en el servidor — de ahí que esto sea un route handler y no una página.
 *
 *   · con `token_hash`, que es como llegan los enlaces que genera el lado
 *     administrador: una invitación, un restablecimiento. Ahí no hubo flujo
 *     previo y por tanto no hay verificador ni `code` que canjear.
 *
 * Sólo se contemplaba el primero. El segundo caía al `return` de abajo y
 * mandaba a la pantalla de entrar a pedir una contraseña que la persona todavía
 * no tiene — que es justo el estado en el que llega quien acaba de ser
 * invitada. Nadie lo vio porque ninguna invitación había llegado nunca a
 * destino: el correo no salía del dominio de pruebas.
 */

const TIPOS: readonly EmailOtpType[] = ["invite", "recovery", "signup", "email_change", "magiclink"];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type");

  // Sólo rutas internas: un `siguiente` con host propio convertiría esto en un
  // redirector abierto, y el enlace llega por correo.
  const crudo = url.searchParams.get("siguiente") ?? "/panel";
  const siguiente = crudo.startsWith("/") && !crudo.startsWith("//") ? crudo : "/panel";

  const aEntrar = NextResponse.redirect(new URL("/panel/entrar", url.origin));
  const sb = await sesion();

  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    return error ? aEntrar : NextResponse.redirect(new URL(siguiente, url.origin));
  }

  if (tokenHash && tipo && (TIPOS as readonly string[]).includes(tipo)) {
    const { error } = await sb.auth.verifyOtp({ type: tipo as EmailOtpType, token_hash: tokenHash });
    return error ? aEntrar : NextResponse.redirect(new URL(siguiente, url.origin));
  }

  return aEntrar;
}
