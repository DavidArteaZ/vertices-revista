import { NextResponse } from "next/server";
import { sesion, personal } from "@/lib/supabase/sesion";
import { generaRegistro } from "@/lib/export/registro";
import { bitacora } from "@/lib/api/peticion";

/**
 * Descarga del Registro en .xlsx (spec §12).
 *
 * Es un route handler y no una acción de servidor porque lo que devuelve es un
 * archivo: una acción tendría que serializar el binario a través del protocolo
 * de React para que el navegador lo volviera a ensamblar, y una descarga con
 * Content-Disposition es lo que el navegador ya sabe hacer.
 *
 * La ceguera la aplica la sesión, no este código: el cliente es el de la
 * persona, así que envios_autoria llega ya filtrada por la política.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  const log = bitacora("GET /panel/exportar");
  const quien = await personal();

  // La base es la de la petición: cualquier otra manda al visitante a otro
  // sitio. La prueba sólo miraba que fuera un 3xx y no vio que apuntaba al
  // dominio de Supabase.
  if (!quien) {
    return NextResponse.redirect(new URL("/panel/entrar", peticion.url));
  }

  try {
    const sb = await sesion();
    const { buffer, filas, cegados } = await generaRegistro(sb);

    // §12: cada export deja constancia. Sin envio_id porque es del registro
    // entero, y con el recuento de filas cegadas, que es la prueba de que el
    // export respetó el ciego de quien lo pidió.
    await sb.from("envio_eventos").insert({
      envio_id: null,
      actor_id: quien.id,
      tipo: "export_generado",
      payload: { filas, cegados },
    });

    log.info("export", { filas, cegados, actor: quien.id });

    const fecha = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="vertices-registro-${fecha}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    log.error("export_fallido", { error: (e as Error).message });
    return NextResponse.json({ error: "no se pudo generar el export" }, { status: 500 });
  }
}
