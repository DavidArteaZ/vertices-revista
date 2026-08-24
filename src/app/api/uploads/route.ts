import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";
import { bitacora, cuerpoJson, huellaIp, json } from "@/lib/api/peticion";
import { MAX_ARCHIVOS, MAX_BYTES, MAX_BYTES_TOTAL, EXT_OK } from "@/lib/validacion";
import type { RespuestaPrepararSubida } from "@/lib/supabase/tipos";

/**
 * Firma las URLs con las que el navegador sube los archivos directamente a
 * Storage (spec §8). Antes iban en base64 dentro del POST del formulario, que
 * es la razón por la que un manuscrito de 20 MB no cabía en la petición.
 *
 * Lo que este servidor NO hace aquí es ver los bytes: la subida no pasa por
 * él. Por eso el reconocimiento de formato y la limpieza de metadatos ocurren
 * en POST /api/envios, cuando ya están en el bucket y se pueden leer.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Peticion = { archivos?: { nombre?: unknown; bytes?: unknown }[] };

export async function POST(req: Request) {
  const log = bitacora("POST /api/uploads");
  const ip = huellaIp(req);

  const cuerpo = (await cuerpoJson(req, 16 * 1024)) as Peticion | null;
  const lista = Array.isArray(cuerpo?.archivos) ? cuerpo.archivos : null;

  if (!lista || lista.length === 0 || lista.length > MAX_ARCHIVOS) {
    log.info("rechazado", { motivo: "lista", n: lista?.length ?? 0 });
    return json({ error: "archivos" }, 400);
  }

  // Los mismos topes que el formulario, aplicados donde sí valen. El de 20 MB
  // vive además en el propio bucket, porque el navegador podría no pasar por
  // este endpoint pero no puede saltarse Storage.
  let total = 0;
  for (const a of lista) {
    const nombre = typeof a?.nombre === "string" ? a.nombre : "";
    const bytes = typeof a?.bytes === "number" ? a.bytes : NaN;
    if (!EXT_OK.test(nombre) || !Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
      log.info("rechazado", { motivo: "archivo" });
      return json({ error: "archivo" }, 400);
    }
    total += bytes;
  }
  if (total > MAX_BYTES_TOTAL) {
    log.info("rechazado", { motivo: "total", total });
    return json({ error: "total" }, 400);
  }

  const sb = servidor();
  const subidas: { nombre: string; path: string; url: string }[] = [];

  for (const a of lista) {
    // preparar_subida comprueba el límite de tasa y anota la ruta. Que la
    // anote es lo que permite a POST /api/envios aceptar sólo rutas que este
    // servidor firmó, y al barrido saber qué se subió y nunca se usó.
    const { data: crudo, error: eRpc } = await sb.rpc("preparar_subida", {
      p_mime: "application/octet-stream",
      p_ip_hash: ip,
    });
    // La función devuelve jsonb; la forma es el contrato de la migración.
    const preparada = crudo as RespuestaPrepararSubida | null;

    if (eRpc) {
      log.error("rpc_preparar_subida", { error: eRpc.message });
      return json({ error: "servidor" }, 500);
    }
    if (!preparada || !preparada.ok) {
      log.info("limitado", { ip });
      return json({ error: "limite" }, 429);
    }

    const { data: firmada, error } = await sb.storage
      .from(BUCKET_PRIVADO)
      .createSignedUploadUrl(preparada.path);

    if (error || !firmada) {
      // §15 pide alerta sobre cualquier fallo de firma: es una de las dos
      // formas en que un envío se puede perder sin que nadie se entere.
      log.error("firma_fallida", { error: error?.message });
      return json({ error: "servidor" }, 500);
    }

    subidas.push({
      nombre: String((a as { nombre: string }).nombre),
      path: preparada.path,
      url: firmada.signedUrl,
    });
  }

  log.info("firmadas", { n: subidas.length });
  return json({ subidas });
}
