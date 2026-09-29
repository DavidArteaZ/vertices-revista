import { randomUUID } from "node:crypto";
import { personal, sesion } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;

type Peticion = {
  nombre?: unknown;
  bytes?: unknown;
};

function tipo(nombre: string): { extension: "pdf" | "docx"; mime: string } | null {
  const n = nombre.toLowerCase();
  if (n.endsWith(".pdf")) return { extension: "pdf", mime: "application/pdf" };
  if (n.endsWith(".docx")) {
    return {
      extension: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const quien = await personal();
  if (!quien) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  const sb = await sesion();
  const { data: dictamen } = await sb
    .from("dictamenes")
    .select("id, revisor_id, estado")
    .eq("id", id)
    .maybeSingle();

  if (!dictamen || dictamen.revisor_id !== quien.id || dictamen.estado !== "borrador") {
    return Response.json({ error: "El dictamen no está disponible para edición." }, { status: 403 });
  }

  let cuerpo: Peticion;
  try {
    cuerpo = (await req.json()) as Peticion;
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }

  const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre : "";
  const bytes = typeof cuerpo.bytes === "number" ? cuerpo.bytes : NaN;
  const formato = tipo(nombre);

  if (!formato) {
    return Response.json({ error: "La plantilla debe ser PDF o DOCX." }, { status: 400 });
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
    return Response.json({ error: "La plantilla no puede superar 20 MB." }, { status: 400 });
  }

  const path = `dictamenes/${id}/${randomUUID()}.${formato.extension}`;
  const { data, error } = await servidor()
    .storage
    .from(BUCKET_PRIVADO)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return Response.json({ error: "No se pudo preparar la subida." }, { status: 502 });
  }

  return Response.json({
    path,
    url: data.signedUrl,
    mime: formato.mime,
  });
}
