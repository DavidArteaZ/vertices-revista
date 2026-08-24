import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificación de la firma de Svix, que es la que usa Resend en sus webhooks.
 *
 * Se comprueba a mano en vez de traerse la librería: son veinte líneas y una
 * dependencia menos que auditar en una ruta que, si falla abierta, deja que
 * cualquiera escriba en la bitácora del comité.
 *
 * Vive aparte de la ruta para poder probarla. Un verificador roto no da error
 * ni se nota: acepta todo, y eso es exactamente lo que no puede pasar sin que
 * salte una prueba.
 */

/** Cinco minutos. Sin ventana, una petición capturada vale para siempre. */
export const VENTANA_SEGUNDOS = 300;

export type Cabeceras = {
  id: string | null;
  timestamp: string | null;
  firma: string | null;
};

export function verificaSvix(
  cabeceras: Cabeceras,
  cuerpo: string,
  secreto: string,
  ahora: number = Date.now(),
): boolean {
  const { id, timestamp, firma } = cabeceras;
  if (!id || !timestamp || !firma || !secreto) return false;

  const edad = Math.abs(ahora / 1000 - Number(timestamp));
  if (!Number.isFinite(edad) || edad > VENTANA_SEGUNDOS) return false;

  const clave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  if (clave.length === 0) return false;

  const esperada = createHmac("sha256", clave)
    .update(`${id}.${timestamp}.${cuerpo}`)
    .digest();

  // La cabecera puede traer varias firmas —"v1,xxx v1,yyy"— durante una
  // rotación de clave, y basta con que una valga.
  return firma.split(" ").some((entrada) => {
    const [version, valor] = entrada.split(",");
    if (version !== "v1" || !valor) return false;
    let recibida: Buffer;
    try {
      recibida = Buffer.from(valor, "base64");
    } catch {
      return false;
    }
    // timingSafeEqual exige longitudes iguales; comparar antes evita que una
    // firma de otro tamaño lance en vez de devolver falso.
    return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
  });
}

/** Para las pruebas y para poder reproducir una firma a mano si hace falta. */
export function firmaSvix(id: string, timestamp: string, cuerpo: string, secreto: string): string {
  const clave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", clave).update(`${id}.${timestamp}.${cuerpo}`).digest("base64")}`;
}
