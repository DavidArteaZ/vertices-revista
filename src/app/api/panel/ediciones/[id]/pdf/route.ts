import { personal, sesion } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PUBLICO } from "@/lib/supabase/servidor";
import { rutaEdicionFinal } from "@/app/panel/ediciones/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Un número completo pesa más que una pieza; es el techo del bucket.
const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Firma la subida del PDF de la edición final directo al bucket público.
 *
 * Igual que la de las piezas (`/api/panel/articulos/[id]/pdf`): el navegador
 * sube con esta URL y luego `fijarPdfFinal` lo enlaza a la edición. No toca
 * ningún artículo ni su PDF.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await personal())) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  const sb = await sesion();
  const { data: edicion } = await sb.from("ediciones").select("id").eq("id", Number(id)).maybeSingle();

  if (!edicion) return Response.json({ error: "No se encontró la edición." }, { status: 404 });

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
    return Response.json({ error: "El PDF no puede superar 50 MB." }, { status: 400 });
  }

  const ruta = rutaEdicionFinal(edicion.id);
  const { data, error } = await servidor().storage.from(BUCKET_PUBLICO).createSignedUploadUrl(ruta);

  if (error || !data) {
    console.error(JSON.stringify({ evento: "panel_pdf_final_firma_fallo", edicion: edicion.id, error: error?.message }));
    return Response.json({ error: "No se pudo preparar la subida." }, { status: 502 });
  }

  return Response.json({ ruta, url: data.signedUrl });
}
