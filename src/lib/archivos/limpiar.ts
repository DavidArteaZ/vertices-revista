import { PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { unzipSync, zipSync } from "fflate";
import type { Formato } from "./formato";

/**
 * Quitar del archivo los metadatos que nombran a quien lo escribió (spec §8).
 *
 * Sin esto el doble ciego de §7 es decorativo: Word firma cada .docx con el
 * nombre de la cuenta en docProps/core.xml, y cualquier exportador de PDF
 * copia ese nombre al diccionario /Info y al XMP. Un dictaminador que abra
 * "Propiedades" ve al autor sin haberlo buscado.
 *
 * No es una promesa absoluta y no se presenta como tal. Lo que sí es, es la
 * primera de dos barreras: la segunda es la revisión de anonimización que el
 * comité registra en envios.anonimizacion_revisada_por, y que sigue haciendo
 * falta porque el nombre puede estar en la portada, en el pie de página o en
 * el texto. Por eso `limpiar` informa de lo que NO pudo garantizar en vez de
 * fallar: un archivo que no se pudo limpiar entra igual y entra marcado.
 */

export type Limpieza = {
  bytes: Uint8Array;
  /** Falso cuando el formato no admite limpieza o el archivo se resistió. */
  limpio: boolean;
  /** Por qué no, para que quede en la bitácora y lo vea quien revise. */
  motivo?: string;
};

/** Fecha fija en los PDF: un timestamp también es una huella. */
const EPOCA = new Date(0);

/** Partes de un OOXML que existen sólo para guardar quién y cuándo. */
const PROPIEDADES = ["docProps/core.xml", "docProps/app.xml", "docProps/custom.xml"];

export async function limpiar(bytes: Uint8Array, formato: Formato): Promise<Limpieza> {
  if (formato === "pdf") return limpiarPdf(bytes);
  if (formato === "docx") return limpiarDocx(bytes);
  // El .doc binario es un Compound File de 1997 con el nombre del autor
  // repartido entre varios flujos OLE. Reescribirlo bien pide un
  // implementación completa del contenedor, y hacerlo mal corrompe el
  // manuscrito. Se deja pasar marcado, que es lo honesto.
  return { bytes, limpio: false, motivo: "el .doc binario no admite limpieza automática" };
}

async function limpiarPdf(bytes: Uint8Array): Promise<Limpieza> {
  try {
    // updateMetadata:false evita que pdf-lib escriba su propio Producer y un
    // ModDate nuevo al guardar, que sería cambiar unos metadatos por otros.
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

    // El diccionario /Info es sólo la mitad. La otra es el XMP: un flujo XML
    // colgado del catálogo que suele traer dc:creator con el mismo nombre, y
    // que no se toca al escribir /Info.
    //
    // Quitar la referencia del catálogo NO basta, y esto lo descubrió la
    // prueba: pdf-lib escribe todos los objetos registrados, esté o no
    // alcanzable alguno, así que el XMP seguía dentro del archivo. El visor ya
    // no lo enseña, pero un `strings manuscrito.pdf` sí, y quien dictamina
    // descarga el archivo. Hay que borrar además el objeto indirecto.
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

      // Los comentarios y las marcas de revisión llevan el nombre en un
      // atributo w:author, y esos sí viven dentro de word/. No se puede
      // borrar la parte entera sin borrar el comentario, así que se sustituye
      // el nombre.
      if (nombre.endsWith(".xml") && nombre.startsWith("word/")) {
        salida[nombre] = anonimizaAutores(contenido);
        continue;
      }
      salida[nombre] = contenido;
    }

    // Quitar una parte y dejar su declaración en [Content_Types].xml o su
    // relación en _rels/.rels deja el paquete describiendo algo que ya no
    // está. Word lo tolera; otros lectores no, y un manuscrito que no abre es
    // peor que uno con metadatos.
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
