import { personal, sesion } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PUBLICO } from "@/lib/supabase/servidor";
import { EXTENSION_IMAGEN, HUECOS_CARRUSEL, rutaCarrusel, type HuecoCarrusel } from "@/app/panel/ediciones/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Una página exportada en JPEG pesa unos cientos de KB; esto deja margen.
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Firma la subida de una de las tres imágenes de la edición en la portada
 * (portada, pliego izquierdo, pliego derecho) directo al bucket público.
 * Igual que la del PDF final: el navegador sube y `fijarImagenCarrusel` la
 * enlaza a la edición.
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

  let cuerpo: { hueco?: unknown; mime?: unknown; bytes?: unknown };
  try {
    cuerpo = (await req.json()) as { hueco?: unknown; mime?: unknown; bytes?: unknown };
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }

  const hueco = HUECOS_CARRUSEL.find((h) => h === cuerpo.hueco) as HuecoCarrusel | undefined;
  const mime = typeof cuerpo.mime === "string" ? cuerpo.mime : "";
  const bytes = typeof cuerpo.bytes === "number" ? cuerpo.bytes : NaN;

  if (!hueco) return Response.json({ error: "Hueco desconocido." }, { status: 400 });
  if (!EXTENSION_IMAGEN[mime]) {
    return Response.json({ error: "La imagen debe ser JPEG, PNG o WebP." }, { status: 400 });
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
    return Response.json({ error: "La imagen no puede superar 8 MB." }, { status: 400 });
  }

  const ruta = rutaCarrusel(edicion.id, hueco, mime);
  const { data, error } = await servidor().storage.from(BUCKET_PUBLICO).createSignedUploadUrl(ruta);

  if (error || !data) {
    console.error(JSON.stringify({ evento: "panel_carrusel_firma_fallo", edicion: edicion.id, hueco, error: error?.message }));
    return Response.json({ error: "No se pudo preparar la subida." }, { status: 502 });
  }

  return Response.json({ ruta, url: data.signedUrl });
}
