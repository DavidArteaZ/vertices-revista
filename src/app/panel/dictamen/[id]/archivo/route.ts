import { sesion, personal } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const quien = await personal();
  if (!quien) return new Response("No autorizado.", { status: 401 });

  const { id } = await params;
  const sb = await sesion();
  const { data: archivo } = await sb
    .from("dictamen_archivos")
    .select("storage_path, nombre_original, mime")
    .eq("dictamen_id", id)
    .maybeSingle();

  if (!archivo) return new Response("No hay archivo adjunto.", { status: 404 });

  const { data: blob, error } = await servidor()
    .storage
    .from(BUCKET_PRIVADO)
    .download(archivo.storage_path);

  if (error || !blob) return new Response("No se pudo descargar el archivo.", { status: 502 });

  const nombre = encodeURIComponent(archivo.nombre_original);
  return new Response(await blob.arrayBuffer(), {
    headers: {
      "Content-Type": archivo.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${nombre}`,
      "Cache-Control": "private, no-store",
    },
  });
}
