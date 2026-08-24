import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";
import { bitacora, json } from "@/lib/api/peticion";

/**
 * Barrido de objetos que se subieron y nunca llegaron a ser un envío (spec §8).
 *
 * Un asistente abandonado en el paso 3 deja el manuscrito en el bucket para
 * siempre. No es sólo desorden: es un documento con datos personales que nadie
 * pidió conservar y que no aparece en ninguna pantalla, así que nadie lo va a
 * encontrar para borrarlo.
 *
 * Por omisión sólo informa, que es lo que pide §15 — el barrido no debe borrar
 * en silencio—. Para que borre hay que pedírselo con `?borrar=1`, de modo que
 * la decisión esté escrita en el cron y no escondida aquí. Lo que borra queda
 * en la bitácora ruta por ruta.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Margen generoso: alguien puede tardar en rellenar el paso 4. */
const ANTIGUEDAD = "24 hours";

export async function GET(req: Request) {
  const log = bitacora("GET /api/mantenimiento/huerfanos");

  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    // Sin secreto configurado tampoco se abre: un endpoint de mantenimiento
    // accesible por olvido es peor que uno que no existe.
    return json({ error: "no autorizado" }, 401);
  }

  const borrar = new URL(req.url).searchParams.get("borrar") === "1";
  const sb = servidor();

  const { data, error } = await sb.rpc("subidas_huerfanas", { p_antiguedad: ANTIGUEDAD });
  if (error) {
    log.error("rpc_subidas_huerfanas", { error: error.message });
    return json({ error: "servidor" }, 500);
  }

  const rutas = (data ?? []).map((f: { storage_path: string }) => f.storage_path);
  log.info("huerfanos", { n: rutas.length, borrar });

  if (!borrar || rutas.length === 0) {
    return json({ huerfanos: rutas.length, rutas, borrados: 0 });
  }

  const { error: eBorrado } = await sb.storage.from(BUCKET_PRIVADO).remove(rutas);
  if (eBorrado) {
    log.error("borrado_fallido", { error: eBorrado.message });
    return json({ error: "servidor" }, 500);
  }

  for (const ruta of rutas) {
    await sb.rpc("olvidar_subida", { p_path: ruta });
    log.info("borrado", { ruta });
  }

  return json({ huerfanos: rutas.length, rutas, borrados: rutas.length });
}
