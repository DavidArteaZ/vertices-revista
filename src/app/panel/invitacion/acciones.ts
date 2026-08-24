"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sesion } from "@/lib/supabase/sesion";
import type { Resultado } from "../acciones";

/**
 * El canje del enlace de invitación, en un POST y no en el GET del correo.
 *
 * El token es de un solo uso. Cuando el canje vivía en el GET —ver
 * /panel/auth/callback— los escáneres de enlaces del correo institucional
 * (Safe Links, los antivirus de la facultad) lo gastaban al comprobar el
 * mensaje, y la persona llegaba minutos después a un enlace ya usado. Un
 * escáner no pulsa botones: el GET de /panel/invitacion no canjea nada.
 *
 * Escribir cookies desde una acción de servidor sí funciona; lo que Next no
 * permite es escribirlas durante el render de un componente de servidor, que es
 * lo que cubre el `catch` de sesion().
 */

const TIPOS: readonly string[] = ["invite", "recovery", "signup", "email_change", "magiclink"];

const CADUCADO =
  "Este enlace caducó o ya se usó. Pide a quien te invitó que te lo mande otra vez.";

export async function activarInvitacion(datos: FormData): Promise<Resultado> {
  const tokenHash = String(datos.get("token_hash") ?? "");
  const tipo = String(datos.get("type") ?? "");

  // Sólo rutas internas: un `siguiente` con host propio convertiría esto en un
  // redirector abierto, y el enlace llega por correo.
  const crudo = String(datos.get("siguiente") ?? "/panel");
  const siguiente = crudo.startsWith("/") && !crudo.startsWith("//") ? crudo : "/panel";

  if (!tokenHash || !TIPOS.includes(tipo)) return { ok: false, mensaje: CADUCADO };

  const sb = await sesion();
  const { error } = await sb.auth.verifyOtp({
    type: tipo as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) return { ok: false, mensaje: CADUCADO };

  redirect(siguiente);
}
