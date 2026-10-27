"use server";

import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import type { Resultado } from "../../acciones";

/**
 * Autorizar que una pieza no aceptada pueda convertirse en artículo.
 *
 * La decisión del dictamen no se toca: autorizar_excepcion guarda el motivo
 * aparte y deja su fila en el historial del envío.
 */
export async function autorizarExcepcion(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return { ok: false, mensaje: "No tienes acceso al panel." };

  const envio = String(datos.get("envio") ?? "");
  const motivo = String(datos.get("motivo") ?? "").trim();
  if (!envio) return { ok: false, mensaje: "Falta el envío." };
  if (!motivo) return { ok: false, mensaje: "Escribe el motivo de la excepción." };

  const sb = await sesion();
  const { error } = await sb.rpc("autorizar_excepcion", { p_envio: envio, p_motivo: motivo });
  if (error) {
    console.error(JSON.stringify({ evento: "panel_excepcion_fallo", envio, error: error.message }));
    return { ok: false, mensaje: error.message };
  }

  revalidatePath(`/panel/envios/${envio}`);
  return { ok: true, mensaje: "Excepción autorizada. La pieza ya puede convertirse en artículo desde su número." };
}
