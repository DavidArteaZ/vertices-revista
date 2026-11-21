"use server";

import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import type { Resultado } from "../acciones";

/**
 * Piezas por título: altas y bajas en las secciones que no se dictaminan.
 *
 * Viven en `edicion_piezas`, no en `articulos`, así que no tocan ningún
 * artículo, PDF ni enlace. Como los artículos, sólo se mueven mientras el
 * número está en borrador: lo publicado no cambia por debajo del lector.
 */

const NO_AUTORIZADO: Resultado = { ok: false, mensaje: "No tienes acceso al panel." };

async function enBorrador(edicion: number): Promise<string | null> {
  const sb = await sesion();
  const { data } = await sb.from("ediciones").select("estado").eq("id", edicion).maybeSingle();
  if (!data) return "No se encontró el número.";
  if (data.estado !== "borrador") return "El número ya está publicado.";
  return null;
}

export async function agregarPiezaTitulo(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const edicion = Number(datos.get("edicion") ?? 0);
  const seccion = Number(datos.get("seccion") ?? 0);
  const titulo = String(datos.get("titulo") ?? "").trim();

  if (!edicion || !seccion) return { ok: false, mensaje: "Falta el número o la sección." };
  if (!titulo) return { ok: false, mensaje: "Escribe el título de la pieza." };
  if (titulo.length > 300) return { ok: false, mensaje: "El título no puede pasar de 300 caracteres." };

  const motivo = await enBorrador(edicion);
  if (motivo) return { ok: false, mensaje: motivo };

  const sb = await sesion();
  const { error } = await sb.from("edicion_piezas").insert({ edicion_id: edicion, seccion_id: seccion, titulo });
  if (error) {
    console.error(JSON.stringify({ evento: "panel_pieza_titulo_alta_fallo", edicion, seccion, error: error.message }));
    return { ok: false, mensaje: error.message };
  }

  revalidatePath(`/panel/ediciones/${edicion}`);
  return { ok: true, mensaje: "Pieza agregada." };
}

export async function quitarPiezaTitulo(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const edicion = Number(datos.get("edicion") ?? 0);
  const pieza = Number(datos.get("pieza") ?? 0);
  if (!edicion || !pieza) return { ok: false, mensaje: "Falta la pieza." };

  const motivo = await enBorrador(edicion);
  if (motivo) return { ok: false, mensaje: motivo };

  const sb = await sesion();
  const { error } = await sb.from("edicion_piezas").delete().eq("id", pieza).eq("edicion_id", edicion);
  if (error) {
    console.error(JSON.stringify({ evento: "panel_pieza_titulo_baja_fallo", edicion, pieza, error: error.message }));
    return { ok: false, mensaje: error.message };
  }

  revalidatePath(`/panel/ediciones/${edicion}`);
  return { ok: true, mensaje: "Pieza quitada." };
}
