import { servidor } from "@/lib/supabase/servidor";
import { bitacora, cuerpoJson, huellaIp, json } from "@/lib/api/peticion";
import type { RespuestaConsultarEstado } from "@/lib/supabase/tipos";

/**
 * Consulta pública de estado por folio + correo (spec §10), endurecida (§13).
 *
 * Sin endurecer esto es un oráculo de correos: público, sin autenticar,
 * confirma la pareja folio↔correo, y los folios son una secuencia predecible.
 * Un dictaminador ciego ya tiene el folio del manuscrito que está evaluando y
 * sólo necesita probar direcciones hasta acertar. Las defensas viven en
 * public.consultar_estado, que es una sola llamada y por tanto un solo camino:
 * límite por IP y por folio, retroceso exponencial por pareja, y la misma
 * respuesta para "correo equivocado" que para "folio inexistente".
 *
 * Aquí arriba se mantiene lo mismo: un único 200 con el mismo cuerpo para los
 * dos casos. Distinguirlos con un 404 devolvería por el código de estado
 * justo lo que la función se cuida de no decir.
 *
 * Es POST y no GET a propósito: un folio y un correo en la query string
 * acaban en los registros de acceso del proxy y en el historial del navegador.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const log = bitacora("POST /api/estado");
  const ip = huellaIp(req);

  const cuerpo = (await cuerpoJson(req, 4 * 1024)) as
    | { folio?: unknown; correo?: unknown }
    | null;

  const folio = typeof cuerpo?.folio === "string" ? cuerpo.folio : "";
  const correo = typeof cuerpo?.correo === "string" ? cuerpo.correo : "";

  // Un cuerpo vacío se trata como una consulta que no coincide, no como un
  // 400: cualquier respuesta distinta es una señal más que enumerar.
  try {
    const { data: crudo, error } = await servidor().rpc("consultar_estado", {
      p_folio: folio,
      p_correo: correo,
      p_ip_hash: ip,
    });

    if (error) {
      log.error("rpc_consultar_estado", { error: error.message });
      return json({ estado: "error" }, 500);
    }

    // jsonb: la forma la fija la migración, no PostgREST.
    const data = crudo as RespuestaConsultarEstado | null;

    if (!data || !data.ok) {
      log.info("sin_coincidencia", { motivo: data?.motivo });
      // El límite sí se distingue, porque decir "espera" no revela nada sobre
      // ninguna dirección y callarlo dejaría al autor reintentando a ciegas.
      if (data?.motivo === "limite") return json({ estado: "limite" }, 429);
      return json({ estado: "no_coincide" }, 200);
    }

    log.conFolio(data.folio);
    log.info("consultado");

    // La decisión que se devuelve es la GRABADA por el comité. Antes de que
    // exista una, "en revisión" — y no la que el motor sugiere, que es lo que
    // hoy filtra jerga cruda al autor en cuanto alguien califica una sola
    // dimensión (spec §10).
    return json({
      estado: "ok",
      folio: data.folio,
      titulo: data.titulo,
      recibido_at: data.recibido_at,
      decision: data.decision ?? null,
    });
  } catch (e) {
    log.error("excepcion", { error: (e as Error).message });
    return json({ estado: "error" }, 500);
  }
}
