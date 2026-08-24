import "server-only";
import { createHash, randomUUID } from "node:crypto";

/**
 * Lo pequeño que comparten las tres rutas: identificar a quien pide sin
 * guardar su IP, y registrar lo que pasa de forma que se pueda buscar.
 */

/**
 * La IP en claro es un dato personal y acabaría en una tabla de límites de
 * tasa que nadie recuerda purgar. Lo que hace falta no es la IP sino un
 * identificador estable de quien pide, así que se guarda un hash con sal
 * secreta: sirve para contar y no sirve para reidentificar.
 *
 * La sal es la clave de servicio porque ya es secreta y ya es obligatoria; una
 * variable más sería una variable más que olvidar en un despliegue, y rotarla
 * sólo reinicia los contadores.
 */
export function huellaIp(req: Request): string {
  const cabecera =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "desconocida";
  return createHash("sha256")
    .update(`${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}:${cabecera}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Registro estructurado (spec §15). El defecto que motivó la reescritura fue
 * la pérdida silenciosa de envíos: aquí toda línea lleva ruta y, en cuanto
 * existe, folio, que es el identificador con el que un editor puede
 * correlacionar lo que el autor le cuenta por correo.
 */
export type Bitacora = {
  info: (evento: string, datos?: Record<string, unknown>) => void;
  error: (evento: string, datos?: Record<string, unknown>) => void;
  /** El folio no existe hasta después del insert; se añade al vuelo. */
  conFolio: (folio: string) => void;
};

export function bitacora(ruta: string): Bitacora {
  const peticion = randomUUID();
  let folio: string | undefined;

  const linea = (nivel: "info" | "error", evento: string, datos?: Record<string, unknown>) => {
    const cuerpo = JSON.stringify({ nivel, ruta, peticion, folio, evento, ...datos });
    if (nivel === "error") console.error(cuerpo);
    else console.log(cuerpo);
  };

  return {
    info: (e, d) => linea("info", e, d),
    error: (e, d) => linea("error", e, d),
    conFolio: (f) => { folio = f; },
  };
}

export function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Nada de lo que devuelven estas rutas debe quedar en una caché
      // intermedia: son datos de una persona concreta.
      "cache-control": "no-store",
    },
  });
}

/** JSON de entrada, con techo de tamaño y sin que un cuerpo roto tire la ruta. */
export async function cuerpoJson(req: Request, maxBytes = 256 * 1024): Promise<unknown | null> {
  const largo = Number(req.headers.get("content-length") ?? "0");
  if (largo > maxBytes) return null;
  try {
    const texto = await req.text();
    if (texto.length > maxBytes) return null;
    return JSON.parse(texto);
  } catch {
    return null;
  }
}
