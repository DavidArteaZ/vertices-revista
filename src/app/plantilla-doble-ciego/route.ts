import { parte1 } from "@/lib/plantilla-doble-ciego/parte1";
import { parte2 } from "@/lib/plantilla-doble-ciego/parte2";
import { parte3 } from "@/lib/plantilla-doble-ciego/parte3";
import { parte4 } from "@/lib/plantilla-doble-ciego/parte4";
import { parte5 } from "@/lib/plantilla-doble-ciego/parte5";
import { parte6 } from "@/lib/plantilla-doble-ciego/parte6";

export const runtime = "nodejs";

export async function GET() {
  const contenido = Buffer.from(
    parte1 + parte2 + parte3 + parte4 + parte5 + parte6,
    "base64",
  );

  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition":
        "attachment; filename=Plantilla_Doble_ciego.docx",
      "Content-Length": String(contenido.length),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
