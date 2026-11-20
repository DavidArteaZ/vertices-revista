import { servidor } from "@/lib/supabase/servidor";
import { bitacora, cuerpoJson, huellaIp, json } from "@/lib/api/peticion";
import { suscribirBoletin } from "@/lib/correo/boletin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Suscripción del boletín del pie. El correo vive sólo en la lista «Newsletter»
 * de Resend: desde ahí se manda cada edición, así que guardarlo también en
 * Supabase sería una segunda copia que nadie consulta y que se desincroniza
 * en cuanto alguien se da de baja desde un correo.
 */
export async function POST(req: Request) {
  const log = bitacora("boletin");
  const cuerpo = await cuerpoJson(req, 4 * 1024) as { correo?: unknown } | null;
  const correo = typeof cuerpo?.correo === "string" ? cuerpo.correo.trim().toLowerCase() : "";

  if (!CORREO.test(correo) || correo.length > 254) {
    return json({ mensaje: "Revisa tu correo e inténtalo de nuevo." }, 400);
  }

  // Sin límite cualquiera podría llenar la lista de direcciones ajenas.
  const { data: permitido, error: eLimite } = await servidor().rpc("limitar", {
    p_clave: `boletin:${huellaIp(req)}`,
    p_segundos: 3600,
    p_max: 10,
  });
  if (eLimite) {
    log.error("boletin_limite_fallo", { error: eLimite.message });
    return json({ mensaje: "No se pudo completar la suscripción." }, 500);
  }
  if (!permitido) return json({ mensaje: "Demasiados intentos. Inténtalo más tarde." }, 429);

  const resultado = await suscribirBoletin(correo);
  if (!resultado.guardado) {
    log.error("boletin_no_guardado", { correo, motivo: resultado.motivo });
    return json({ mensaje: "No se pudo completar la suscripción. Inténtalo más tarde." }, 503);
  }

  log.info("boletin_suscrito", { correo });
  return json({ ok: true });
}
