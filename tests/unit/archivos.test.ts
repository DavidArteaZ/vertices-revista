import { describe, expect, it } from "vitest";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { PDFDocument } from "pdf-lib";
import { reconocer, MIME } from "@/lib/archivos/formato";
import { limpiar } from "@/lib/archivos/limpiar";

const AUTOR = "Nombre Que No Debe Sobrevivir";

async function pdfConAutor(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.setAuthor(AUTOR);
  pdf.setCreator(AUTOR);
  return pdf.save({ useObjectStreams: false });
}

function docxConAutor(): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types><Override PartName="/docProps/core.xml"/><Override PartName="/word/document.xml"/></Types>'),
    "_rels/.rels": strToU8('<?xml version="1.0"?><Relationships><Relationship Target="docProps/core.xml"/><Relationship Target="word/document.xml"/></Relationships>'),
    "docProps/core.xml": strToU8(`<cp:coreProperties><dc:creator>${AUTOR}</dc:creator></cp:coreProperties>`),
    "word/document.xml": strToU8("<w:document><w:body/></w:document>"),
  });
}

describe("reconocer", () => {
  it("reconoce documentos por firma", async () => {
    expect(reconocer(await pdfConAutor())).toBe("pdf");
    expect(reconocer(docxConAutor())).toBe("docx");
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(reconocer(ole)).toBe("doc");
  });

  it("reconoce JPEG, PNG y WebP por contenido", () => {
    expect(reconocer(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]))).toBe("jpeg");
    expect(reconocer(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toBe("png");
    expect(reconocer(new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50]))).toBe("webp");
  });

  it("rechaza un ZIP que no es docx y bytes arbitrarios", () => {
    expect(reconocer(zipSync({ "hoja.txt": strToU8("no soy Word") }))).toBeNull();
    expect(reconocer(strToU8("texto"))).toBeNull();
  });
});

describe("limpiar", () => {
  it("borra metadatos de autor de un PDF y lo mantiene legible", async () => {
    const original = await pdfConAutor();
    const { bytes, limpio } = await limpiar(original, "pdf");
    expect(limpio).toBe(true);
    const releido = await PDFDocument.load(bytes);
    expect(releido.getPageCount()).toBe(1);
    expect(releido.getAuthor() ?? "").toBe("");
  });

  it("quita docProps de un docx", async () => {
    const { bytes, limpio } = await limpiar(docxConAutor(), "docx");
    expect(limpio).toBe(true);
    const partes = unzipSync(bytes);
    expect(Object.keys(partes)).not.toContain("docProps/core.xml");
    expect(Object.keys(partes)).toContain("word/document.xml");
  });

  it("conserva imágenes pero las marca como no limpiadas", async () => {
    const imagen = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
    const { bytes, limpio, motivo } = await limpiar(imagen, "jpeg");
    expect(bytes).toBe(imagen);
    expect(limpio).toBe(false);
    expect(motivo).toMatch(/imagen/);
  });
});

describe("MIME", () => {
  it("incluye documentos e imágenes", () => {
    expect(MIME.pdf).toBe("application/pdf");
    expect(MIME.docx).toContain("wordprocessingml");
    expect(MIME.doc).toBe("application/msword");
    expect(MIME.jpeg).toBe("image/jpeg");
    expect(MIME.png).toBe("image/png");
    expect(MIME.webp).toBe("image/webp");
  });
});
