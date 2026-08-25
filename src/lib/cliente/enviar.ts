import type { RolArchivo } from "@/lib/datos/portal-envios";
import type { Aviso, DatosEnvio } from "@/lib/validacion";

export type Progreso = "subiendo" | "registrando";
export type Resultado = { folio: string; acuse: boolean } | { error: Aviso };
export type ArchivoEnvio = { archivo: File; rol: RolArchivo };

const esError = (r: Resultado): r is { error: Aviso } => "error" in r;
export { esError };

const AVISO_GENERICO: Aviso = { clave: "no_pudimos_registrar_tu_envio" };

export async function enviarManuscrito(
  datos: DatosEnvio,
  archivos: ArchivoEnvio[],
  locale: string,
  avisar: (p: Progreso) => void,
): Promise<Resultado> {
  try {
    avisar("subiendo");

    let subidas: { nombre: string; path: string; url: string }[] = [];
    if (archivos.length) {
      const firmas = await fetch("/api/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          archivos: archivos.map(({ archivo }) => ({ nombre: archivo.name, bytes: archivo.size })),
        }),
      });

      if (!firmas.ok) return { error: await avisoDe(firmas) };
      subidas = ((await firmas.json()) as {
        subidas: { nombre: string; path: string; url: string }[];
      }).subidas;

      for (let i = 0; i < archivos.length; i++) {
        const ok = await subirA(subidas[i].url, archivos[i].archivo);
        if (!ok) {
          return {
            error: {
              clave: "no_pudimos_subir_a",
              valores: { a: archivos[i].archivo.name },
            },
          };
        }
      }
    }

    avisar("registrando");

    const registro = await fetch("/api/envios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        datos,
        locale,
        archivos: archivos.map(({ archivo, rol }, i) => ({
          path: subidas[i].path,
          nombre: archivo.name,
          bytes: archivo.size,
          rol,
        })),
      }),
    });

    if (!registro.ok) return { error: await avisoDe(registro) };

    const { folio, acuse } = (await registro.json()) as { folio: string; acuse: boolean };
    return { folio, acuse };
  } catch {
    return { error: AVISO_GENERICO };
  }
}

async function subirA(url: string, archivo: File): Promise<boolean> {
  const cuerpo = new FormData();
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
