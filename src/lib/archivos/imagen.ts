import type { Formato } from "./formato";

/**
 * Optimización de las fotografías y visualizaciones que llegan por el portal.
 *
 * Tres palabras que el glosario ya distingue y que aquí conviene no mezclar:
 * esto es OPTIMIZACIÓN —menos bytes, mismo contenido— y, como efecto de
 * reescribir el archivo, LIMPIEZA DE METADATOS: fuera el EXIF y el XMP, que
 * traen la ubicación GPS de la toma, el modelo del teléfono y a veces el
 * nombre de la persona. No es ANONIMIZACIÓN: lo que se ve en la foto sigue
 * viéndose, y eso lo cubre la revisión humana. Por eso `limpiar()` delega
 * aquí en vez de crecer: son cosas distintas con resultados distintos.
 *
 * EL FORMATO DE SALIDA ES SIEMPRE EL DE ENTRADA. No se unifica a WebP aunque
 * pesaría menos, por dos razones que no se ven desde este archivo:
 *
 *   1. `crear_envio` deriva la extensión del nombre público del nombre
 *      original (`substring(nombre_original from '\.([A-Za-z0-9]+)$')`).
 *      Transcodificar dejaría un `.png` con bytes WebP dentro, y el comité se
 *      encontraría con archivos que su visor no abre.
 *   2. Una gráfica de Datanomics pasada a JPEG se degrada de forma visible en
 *      el texto fino y en los bordes duros. PNG existe justo para eso.
 *
 * Y NUNCA `withMetadata()` ni `keepMetadata()`: reintroducen el EXIF que
 * venimos a quitar. El comportamiento por defecto de sharp —descartarlo todo—
 * es exactamente el que queremos.
 */

/** Las tres que el portal admite; el resto de formatos no pasan por aquí. */
export type FormatoImagen = Extract<Formato, "jpeg" | "png" | "webp">;

export type MedidaImagen = {
  bytesAntes: number;
  bytesDespues: number;
  ancho: number;
  alto: number;
  /** Porcentaje con un decimal. Negativo si el resultado salió más grande. */
  reduccion: number;
};

export type Optimizacion = {
  bytes: Uint8Array;
  /** Falso cuando se devuelven los bytes originales, con sus metadatos dentro. */
  limpio: boolean;
  motivo?: string;
  /** Ausente si no se llegó a producir una copia con la que comparar. */
  medida?: MedidaImagen;
};

/** 3600 px cubre una A4 a 300 ppp (3508 px) con margen de recorte. */
export const LADO_MAX = 3600;

/**
 * Descomprimir imágenes que manda cualquiera es superficie de ataque conocida:
 * 40 millones de píxeles ocupan cientos de megas ya descomprimidos, y en
 * Vercel varias peticiones simultáneas comparten instancia. El día que se
 * cierra la convocatoria es justo cuando llegan todas a la vez.
 */
export const PIXELES_MAX = 40_000_000;

/** Por debajo de esto y de LADO_MAX, la imagen ya está bien. */
const BYTES_YA_BIEN = 1048576;

/** La función `sharp(...)`; `Tuberia` es lo que devuelve al encadenar. */
type Optimizador = import("sharp").SharpConstructor;
type Tuberia = import("sharp").Sharp;

/**
 * sharp lleva código nativo compilado y puede no cargar tras un cambio de Node
 * o de plataforma. La promesa se guarda —resuelta a `null` si falló— para que
 * el fallo se registre una sola vez por proceso y no una por archivo: cinco
 * líneas idénticas por envío esconden el problema en vez de enseñarlo.
 *
 * Aquí no se puede usar `bitacora()`, que es de servidor y por petición, así
 * que se escribe la misma forma de línea JSON a mano.
 */
let cargando: Promise<Optimizador | null> | null = null;

function cargarSharp(): Promise<Optimizador | null> {
  cargando ??= import("sharp")
    .then((m) => {
      const s = m.default;
      // La caché de sharp guarda imágenes ya descomprimidas entre llamadas, y
      // la memoria de la instancia es el recurso escaso. Un hilo por operación
      // por lo mismo: aquí importa no reventar, no ir rápido.
      s.cache(false);
      s.concurrency(1);
      return s;
    })
    .catch((e: unknown) => {
      console.error(
        JSON.stringify({
          nivel: "error",
          modulo: "archivos/imagen",
          evento: "sharp_no_carga",
          error: (e as Error).message,
        }),
      );
      return null;
    });
  return cargando;
}

export async function optimizar(
  bytes: Uint8Array,
  formato: FormatoImagen,
): Promise<Optimizacion> {
  const sharp = await cargarSharp();
  if (!sharp) {
    return {
      bytes,
      limpio: false,
      motivo: "el optimizador de imágenes no cargó en este servidor",
    };
  }

  try {
    // La cabecera se lee sin el tope de píxeles a propósito: `metadata()` no
    // descomprime nada, así que preguntarle el tamaño a una imagen enorme es
    // barato, y con el tope puesto reventaría aquí mismo con un mensaje en
    // inglés en vez de con el nuestro. El tope va en la tubería de abajo, que
    // es la que sí descomprime, y ahí sirve de segunda barrera.
    const meta = await sharp(bytes, { failOn: "none", limitInputPixels: false }).metadata();

    // `autoOrient` da las medidas ya con la orientación EXIF aplicada, que son
    // las que el lector verá; `width`/`height` a secas dan las del sensor.
    const ancho = meta.autoOrient.width || meta.width;
    const alto = meta.autoOrient.height || meta.height;

    if (ancho * alto > PIXELES_MAX) {
      return {
        bytes,
        limpio: false,
        motivo: `la imagen tiene ${ancho}×${alto} píxeles y no se procesa por encima de ${PIXELES_MAX}`,
      };
    }

    // Las que ya están bien no se reescalan: el remuestreo es lo que degrada, y
    // una imagen ya optimizada sólo pierde con él. Aun así se reescriben,
    // porque sharp sólo descarta el EXIF al volver a escribir el archivo:
    // «devolverla tal cual» y «quitarle los metadatos» no pueden ser lo mismo,
    // y aquí manda el metadato. Si de esa reescritura sale un archivo mayor que
    // el original, gana el original — eso se decide más abajo.
    const yaEstaBien =
      bytes.byteLength <= BYTES_YA_BIEN && ancho <= LADO_MAX && alto <= LADO_MAX;

    // .rotate() sin argumentos hornea la orientación EXIF en los píxeles. Es la
    // línea crítica del módulo: quitar el EXIF sin hornearla primero deja
    // tumbadas todas las fotos verticales de celular, que son casi todas.
    let tuberia = sharp(bytes, { failOn: "none", limitInputPixels: PIXELES_MAX }).rotate();
    if (!yaEstaBien) {
      tuberia = tuberia.resize({
        width: LADO_MAX,
        height: LADO_MAX,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    // Color correcto sin conservar EXIF/XMP: se convierte a sRGB y se adjunta
    // ese perfil, en vez de arrastrar el del original.
    tuberia = tuberia.withIccProfile("srgb");

    const { data, info } = await codificar(tuberia, formato).toBuffer({
      resolveWithObject: true,
    });

    const medida: MedidaImagen = {
      bytesAntes: bytes.byteLength,
      bytesDespues: data.byteLength,
      ancho: info.width,
      alto: info.height,
      reduccion:
        Math.round(((bytes.byteLength - data.byteLength) / bytes.byteLength) * 1000) / 10,
    };

    if (data.byteLength >= bytes.byteLength) {
      // El almacén gratuito es el recurso que se acaba, así que una copia que
      // no adelgaza no se guarda. El precio está a la vista y no se maquilla:
      // el original conserva sus metadatos salvo que no trajera ninguno, y la
      // medida queda registrada con porcentaje negativo.
      const traeMetadatos = Boolean(meta.exif || meta.xmp || meta.iptc || meta.tifftagPhotoshop);
      return {
        bytes,
        limpio: !traeMetadatos,
        motivo: traeMetadatos
          ? `la copia optimizada salía más grande (${medida.reduccion} %); se conserva el original`
          : undefined,
        medida,
      };
    }

    return { bytes: new Uint8Array(data), limpio: true, medida };
  } catch (e) {
    return {
      bytes,
      limpio: false,
      motivo: `sharp no pudo procesar la imagen: ${(e as Error).message}`,
    };
  }
}

function codificar(
  tuberia: Tuberia,
  formato: FormatoImagen,
): Tuberia {
  if (formato === "jpeg") return tuberia.jpeg({ quality: 85, mozjpeg: true });
  if (formato === "png") return tuberia.png({ palette: true });
  return tuberia.webp({ quality: 85 });
}
