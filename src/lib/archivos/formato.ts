import { unzipSync } from "fflate";

/** Reconocimiento de formato por contenido, no por extensión. */
export type Formato = "pdf" | "docx" | "doc" | "jpeg" | "png" | "webp";

export const MIME: Record<Formato, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const empieza = (b: Uint8Array, firma: number[]) =>
  firma.length <= b.length && firma.every((x, i) => b[i] === x);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function reconocer(bytes: Uint8Array): Formato | null {
  if (empieza(bytes, PDF)) return "pdf";
  if (empieza(bytes, JPEG)) return "jpeg";
  if (empieza(bytes, PNG)) return "png";
  if (
    bytes.length >= 12 &&
    empieza(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "webp";
  if (empieza(bytes, OLE2)) return "doc";

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
