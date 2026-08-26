import { PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { unzipSync, zipSync } from "fflate";
import type { Formato } from "./formato";
import { optimizar, type MedidaImagen } from "./imagen";

export type Limpieza = {
  bytes: Uint8Array;
  limpio: boolean;
  motivo?: string;
  /** Sólo las imágenes la traen: cuánto adelgazó la copia. Ver `imagen.ts`. */
  medida?: MedidaImagen;
};

const EPOCA = new Date(0);
const PROPIEDADES = ["docProps/core.xml", "docProps/app.xml", "docProps/custom.xml"];

export async function limpiar(bytes: Uint8Array, formato: Formato): Promise<Limpieza> {
  if (formato === "pdf") return limpiarPdf(bytes);
  if (formato === "docx") return limpiarDocx(bytes);
  if (formato === "jpeg" || formato === "png" || formato === "webp") {
    // El rediseño recibe fotografías y visualizaciones. Quitarles el EXIF/XMP
    // —ubicación GPS incluida— exige volver a escribir el archivo, así que la
    // limpieza y la optimización son la misma pasada. Vive en su propio módulo
    // porque devuelve además la medida de lo que adelgazó, y porque «limpiar»
    // aquí sigue significando sólo quitar los metadatos que delatan al autor.
    return optimizar(bytes, formato);
  }
  return { bytes, limpio: false, motivo: "el .doc binario no admite limpieza automática" };
}

async function limpiarPdf(bytes: Uint8Array): Promise<Limpieza> {
  try {
    const pdf = await PDFDocument.load(bytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });

    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("");
    pdf.setCreator("");
    pdf.setCreationDate(EPOCA);
    pdf.setModificationDate(EPOCA);

    const refXmp = pdf.catalog.get(PDFName.of("Metadata"));
    pdf.catalog.delete(PDFName.of("Metadata"));
    if (refXmp instanceof PDFRef) pdf.context.delete(refXmp);

    return { bytes: await pdf.save({ useObjectStreams: false }), limpio: true };
  } catch (e) {
    return {
      bytes,
      limpio: false,
      motivo: `pdf-lib no pudo reescribir el PDF: ${(e as Error).message}`,
    };
  }
}

function limpiarDocx(bytes: Uint8Array): Limpieza {
  try {
    const partes = unzipSync(bytes);
    const salida: Record<string, Uint8Array> = {};

    for (const [nombre, contenido] of Object.entries(partes)) {
      if (PROPIEDADES.includes(nombre)) continue;
      if (nombre.endsWith(".xml") && nombre.startsWith("word/")) {
        salida[nombre] = anonimizaAutores(contenido);
        continue;
      }
      salida[nombre] = contenido;
    }

    for (const nombre of ["[Content_Types].xml", "_rels/.rels"]) {
      if (salida[nombre]) salida[nombre] = quitaReferencias(salida[nombre]);
    }

    return { bytes: zipSync(salida, { level: 6 }), limpio: true };
  } catch (e) {
    return {
      bytes,
      limpio: false,
      motivo: `no se pudo reescribir el .docx: ${(e as Error).message}`,
    };
  }
}

const dec = new TextDecoder();
const enc = new TextEncoder();

function anonimizaAutores(xml: Uint8Array): Uint8Array {
  const texto = dec.decode(xml);
  const limpio = texto
    .replace(/\bw:author="[^"]*"/g, 'w:author="Autor"')
    .replace(/\bw:initials="[^"]*"/g, 'w:initials="A"')
    .replace(/\bw:lastModifiedBy="[^"]*"/g, 'w:lastModifiedBy="Autor"');
  return limpio === texto ? xml : enc.encode(limpio);
}

function quitaReferencias(xml: Uint8Array): Uint8Array {
  const texto = dec.decode(xml);
  const limpio = texto
    .replace(/<Override[^>]*PartName="\/docProps\/[^"]*"[^>]*\/>/g, "")
    .replace(/<Relationship[^>]*Target="docProps\/[^"]*"[^>]*\/>/g, "");
  return enc.encode(limpio);
}
