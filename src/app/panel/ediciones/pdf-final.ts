"use server";

import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PUBLICO } from "@/lib/supabase/servidor";
import type { Resultado } from "../acciones";
import { PREFIJO_EDICION_FINAL } from "./pdf";

/**
 * Enlaza a la edición el PDF de la edición final que el navegador acaba de
 * subir con la URL firmada de `/api/panel/ediciones/[id]/pdf`.
 *
 * Sólo se acepta la ruta que esa firma pudo haber dado a esta edición, y sólo
 * se borra el PDF final anterior: los PDF de los artículos, y por tanto sus
 * enlaces y los QR que apuntan a ellos, no se tocan.
 */
export async function fijarPdfFinal(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return { ok: false, mensaje: "No tienes acceso al panel." };

  const edicion = Number(datos.get("edicion") ?? 0);
  const ruta = String(datos.get("ruta") ?? "");

  const sb = await sesion();
  const { data: fila } = await sb
    .from("ediciones")
    .select("id, numero, pdf_final_path")
    .eq("id", edicion)
    .maybeSingle();

  if (!fila) return { ok: false, mensaje: "No se encontró la edición." };
  if (!ruta.startsWith(`${fila.id}/${PREFIJO_EDICION_FINAL}-`) || !ruta.endsWith(".pdf")) {
    return { ok: false, mensaje: "La ruta del PDF no corresponde a esta edición." };
  }

  const { error } = await sb.from("ediciones").update({ pdf_final_path: ruta }).eq("id", fila.id);
  if (error) return { ok: false, mensaje: error.message };

  // El anterior deja de estar enlazado; borrarlo evita que circule una versión
  // que el comité ya reemplazó.
  if (fila.pdf_final_path && fila.pdf_final_path !== ruta) {
    const { error: eBorrado } = await servidor().storage.from(BUCKET_PUBLICO).remove([fila.pdf_final_path]);
    if (eBorrado) {
      console.error(JSON.stringify({ evento: "panel_pdf_final_viejo_fallo", edicion: fila.id, error: eBorrado.message }));
    }
  }

  revalidatePath(`/panel/ediciones/${fila.id}`);
  revalidatePath(`/ediciones/${fila.numero}`);
  return { ok: true, mensaje: "PDF de la edición final actualizado." };
}
