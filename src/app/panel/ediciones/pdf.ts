import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos";
import { servidor, BUCKET_PRIVADO, BUCKET_PUBLICO } from "@/lib/supabase/servidor";

/**
 * El PDF público de un artículo.
 *
 * Se copia en cuanto la pieza entra a un número, no al publicarlo, para que el
 * comité pueda revisar el enlace definitivo antes de encender el número. Eso
 * deja el archivo en el bucket público mientras la edición sigue en borrador,
 * así que la ruta lleva un sufijo al azar: nadie puede llegar a él adivinando
 * el slug. La página del artículo, que sí es adivinable, sigue sin verse hasta
 * publicar porque la política de `articulos` mira el estado de su edición.
 *
 * Cada subida estrena ruta en vez de pisar la anterior: el CDN de Storage
 * cachea por ruta y un reemplazo con la misma URL seguiría sirviendo el PDF
 * viejo durante un rato.
 */

export function rutaPublica(edicion: number, slug: string): string {
  return `${edicion}/${slug}-${randomUUID().slice(0, 8)}.pdf`;
}

export function urlPublica(ruta: string): string {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_PUBLICO}/${ruta}`;
}

/** Por qué una pieza todavía no tiene PDF copiable, o null si sí lo tiene. */
export function motivoSinPdf(mime: string | undefined): string | null {
  if (!mime) return "No tiene manuscrito principal.";
  if (mime !== "application/pdf") return "Se envió en Word.";
  return null;
}

type Articulo = { id: number; slug: string; envio_id: string | null };

/**
 * Copia el manuscrito principal al bucket público. Devuelve null si lo copió,
 * o el motivo por el que no, para enseñarlo tal cual.
 *
 * Sólo se copia PDF. Un .docx en el bucket público sería un documento editable
 * con la maquetación del autor, no la pieza de la revista: para ésos está la
 * subida del PDF maquetado en la fila del artículo.
 */
export async function copiarManuscrito(
  sb: SupabaseClient<Database>,
  articulo: Articulo,
  edicion: number,
): Promise<string | null> {
  if (!articulo.envio_id) return "No viene de un envío.";

  const { data: archivo } = await sb
    .from("envio_archivos")
    .select("storage_path, mime")
    .eq("envio_id", articulo.envio_id)
    .eq("es_principal", true)
    .maybeSingle();

  const motivo = motivoSinPdf(archivo?.mime);
  if (motivo || !archivo) return motivo;

  const admin = servidor();
  const { data: blob, error: eDescarga } = await admin.storage
    .from(BUCKET_PRIVADO)
    .download(archivo.storage_path);

  if (eDescarga || !blob) {
    console.error(JSON.stringify({ evento: "panel_pdf_descarga_fallo", articulo: articulo.id, error: eDescarga?.message }));
    return "No se pudo leer el PDF del manuscrito.";
  }

  const destino = rutaPublica(edicion, articulo.slug);
  const { error: eSubida } = await admin.storage
    .from(BUCKET_PUBLICO)
    .upload(destino, await blob.arrayBuffer(), { contentType: "application/pdf" });

  if (eSubida) {
    console.error(JSON.stringify({ evento: "panel_pdf_copia_fallo", articulo: articulo.id, error: eSubida.message }));
    return "No se pudo copiar el PDF.";
  }

  const { error: eRuta } = await sb
    .from("articulos")
    .update({ pdf_publico_path: destino })
    .eq("id", articulo.id);

  if (eRuta) {
    await admin.storage.from(BUCKET_PUBLICO).remove([destino]);
    return eRuta.message;
  }

  return null;
}
