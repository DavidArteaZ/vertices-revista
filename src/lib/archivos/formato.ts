import { unzipSync } from "fflate";

/**
 * Reconocimiento de formato por contenido, no por extensión (spec §8).
 *
 * Antes la extensión bastaba porque el archivo viajaba en base64 dentro del
 * POST y nadie lo miraba. Ahora sube directo del navegador a Storage y el
 * servidor lo revisa después: si el juicio siguiera siendo `/\.pdf$/`, subir
 * cualquier cosa llamada `manuscrito.pdf` sería trivial.
 */

export type Formato = "pdf" | "docx" | "doc";

export const MIME: Record<Formato, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

const empieza = (b: Uint8Array, firma: number[]) =>
  firma.length <= b.length && firma.every((x, i) => b[i] === x);

/** "%PDF-" */
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
/** Cabecera local de ZIP, que es lo que es un .docx por dentro. */
const ZIP = [0x50, 0x4b, 0x03, 0x04];
/** Compound File Binary, el contenedor del .doc de Word 97-2003. */
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function reconocer(bytes: Uint8Array): Formato | null {
  if (empieza(bytes, PDF)) return "pdf";
  if (empieza(bytes, OLE2)) return "doc";

  // Un ZIP no basta: un .xlsx, un .odt y un .jar empiezan igual. Lo que hace
  // que un ZIP sea un .docx es traer dentro word/document.xml.
  if (empieza(bytes, ZIP)) {
    try {
      const partes = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
      if (partes["word/document.xml"]) return "docx";
    } catch {
      return null;
    }
  }
  return null;
}
