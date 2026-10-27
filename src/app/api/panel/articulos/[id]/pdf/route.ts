import { personal, sesion } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PUBLICO } from "@/lib/supabase/servidor";
import { rutaPublica } from "@/app/panel/ediciones/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El límite del bucket `publicaciones`.
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Firma la subida del PDF maquetado de un artículo directo al bucket público.
 *
 * El navegador sube el archivo con esta URL y luego la acción `fijarPdf` lo
 * enlaza al artículo. Si nunca llega a enlazarlo, el archivo queda suelto en
 * una ruta con sufijo al azar que nada enlaza.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await personal())) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  const sb = await sesion();
  const { data: articulo } = await sb
    .from("articulos")
    .select("id, slug, edicion_id")
    .eq("id", Number(id))
    .maybeSingle();

  if (!articulo?.edicion_id) return Response.json({ error: "No se encontró el artículo." }, { status: 404 });

  let cuerpo: { nombre?: unknown; bytes?: unknown };
  try {
    cuerpo = (await req.json()) as { nombre?: unknown; bytes?: unknown };
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }

  const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre : "";
  const bytes = typeof cuerpo.bytes === "number" ? cuerpo.bytes : NaN;

  if (!nombre.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "El archivo debe ser PDF." }, { status: 400 });
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
    return Response.json({ error: "El PDF no puede superar 20 MB." }, { status: 400 });
  }

  const ruta = rutaPublica(articulo.edicion_id, articulo.slug);
  const { data, error } = await servidor().storage.from(BUCKET_PUBLICO).createSignedUploadUrl(ruta);

  if (error || !data) {
    console.error(JSON.stringify({ evento: "panel_pdf_firma_fallo", articulo: articulo.id, error: error?.message }));
    return Response.json({ error: "No se pudo preparar la subida." }, { status: 502 });
  }

  return Response.json({ ruta, url: data.signedUrl });
}
