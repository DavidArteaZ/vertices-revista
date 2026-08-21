import type { Aviso, DatosEnvio } from "@/lib/validacion";

/**
 * Las tres llamadas que hace el asistente al enviar, fuera del componente para
 * que éste siga siendo formulario y no cliente HTTP.
 *
 * Los archivos NO viajan dentro del POST. Suben del navegador directamente a
 * Storage con una URL firmada; el servidor sólo recibe las rutas (spec §8).
 * Ese es el cambio que permite adjuntar 20 MB, que en base64 dentro de un JSON
 * eran 27 y no cabían.
 */

export type Progreso = "subiendo" | "registrando";
export type Resultado = { folio: string; acuse: boolean } | { error: Aviso };

const esError = (r: Resultado): r is { error: Aviso } => "error" in r;
export { esError };

const AVISO_GENERICO: Aviso = { clave: "no_pudimos_registrar_tu_envio" };

export async function enviarManuscrito(
  datos: DatosEnvio,
  archivos: File[],
  locale: string,
  avisar: (p: Progreso) => void,
): Promise<Resultado> {
  try {
    avisar("subiendo");

    const firmas = await fetch("/api/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        archivos: archivos.map((f) => ({ nombre: f.name, bytes: f.size })),
      }),
    });

    if (!firmas.ok) return { error: await avisoDe(firmas) };
    const { subidas } = (await firmas.json()) as {
      subidas: { nombre: string; path: string; url: string }[];
    };

    // Las firmas vuelven en el mismo orden en que se pidieron, y el primer
    // archivo es el manuscrito principal. Emparejar por índice y no por nombre
    // evita que dos adjuntos homónimos se pisen.
    for (let i = 0; i < archivos.length; i++) {
      const ok = await subirA(subidas[i].url, archivos[i]);
      if (!ok) return { error: { clave: "no_pudimos_subir_a", valores: { a: archivos[i].name } } };
    }

    avisar("registrando");

    const registro = await fetch("/api/envios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        datos,
        locale,
        archivos: archivos.map((f, i) => ({
          path: subidas[i].path,
          nombre: f.name,
          bytes: f.size,
        })),
      }),
    });

    if (!registro.ok) return { error: await avisoDe(registro) };

    const { folio, acuse } = (await registro.json()) as { folio: string; acuse: boolean };
    return { folio, acuse };
  } catch {
    // Sin red, o el servidor caído. Lo importante es que el asistente NO
    // muestre éxito: el respaldo que inventaba un folio es el defecto 3.
    return { error: AVISO_GENERICO };
  }
}

/**
 * La URL firmada espera exactamente lo que manda `uploadToSignedUrl` de
 * supabase-js: un PUT con multipart cuyo campo sin nombre es el archivo. Se
 * hace a mano para no cargar el SDK de Supabase en el bundle del navegador —
 * el navegador no tiene cliente de Supabase, ni siquiera anónimo (§4.2).
 */
async function subirA(url: string, archivo: File): Promise<boolean> {
  const cuerpo = new FormData();
  // cacheControl 0, y no el 3600 por omisión de supabase-js. Lo que se sube
  // aquí son los bytes ORIGINALES, con los metadatos del autor todavía dentro;
  // el servidor los sustituye por la versión limpia unos segundos después,
  // bajo la misma ruta. Con max-age=3600 el CDN se queda una copia del
  // original y la sirve durante una hora a quien pida esa ruta —incluido quien
  // dictamina—. Se detectó justamente así: una descarga de comprobación
  // devolvió el archivo sucio mientras el objeto del bucket ya estaba limpio.
  cuerpo.append("cacheControl", "0");
  cuerpo.append("", archivo);
  try {
    const r = await fetch(url, { method: "PUT", body: cuerpo });
    return r.ok;
  } catch {
    return false;
  }
}

async function avisoDe(r: Response): Promise<Aviso> {
  try {
    const cuerpo = (await r.json()) as { aviso?: string; valores?: Aviso["valores"] };
    if (cuerpo.aviso) return { clave: cuerpo.aviso, valores: cuerpo.valores };
  } catch {
    /* cuerpo vacío o no-JSON: cae al aviso genérico */
  }
  return r.status === 429 ? { clave: "demasiados_intentos" } : AVISO_GENERICO;
}
