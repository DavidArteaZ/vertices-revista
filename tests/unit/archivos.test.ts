import { describe, expect, it, vi } from "vitest";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { reconocer, MIME } from "@/lib/archivos/formato";
import { limpiar } from "@/lib/archivos/limpiar";
import { optimizar, LADO_MAX, PIXELES_MAX } from "@/lib/archivos/imagen";

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

/**
 * Ruido reproducible. Una foto de verdad no comprime bien, y las fotos que no
 * comprimen bien son las únicas donde se puede afirmar que la copia adelgazó:
 * con un color plano el recodificado sale más grande y la prueba mediría el
 * camino contrario al que dice medir.
 */
function ruido(ancho: number, alto: number, canales: 3 | 4 = 3) {
  const px = Buffer.alloc(ancho * alto * canales);
  let s = 42;
  for (let i = 0; i < px.length; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    px[i] = (s >>> 16) & 0xff;
  }
  return sharp(px, { raw: { width: ancho, height: alto, channels: canales } });
}

/**
 * EXIF escrito a mano porque sharp no sabe fabricarlo: `withExif` normaliza
 * Orientation a 1 al escribir, así que la única forma de tener un fixture con
 * la orientación 6 —la del celular en vertical, que es casi todo lo que llega
 * por el portal— es armar el APP1 byte a byte.
 *
 * APP1 = 0xFFE1 · largo · "Exif\0\0" · cabecera TIFF · IFD0 · área de datos.
 * IFD0 lleva dos entradas de 12 bytes (Orientation y Artist) y las etiquetas
 * van en orden ascendente, que es lo que exige el formato.
 */
function app1Exif(orientacion: number, artista: string): Buffer {
  const nombre = Buffer.from(`${artista}\0`, "ascii");
  const tiff = Buffer.from("MM\0\x2a\0\0\0\x08", "ascii");
  const ifd = Buffer.alloc(2 + 12 * 2 + 4);
  ifd.writeUInt16BE(2, 0);
  ifd.writeUInt16BE(0x0112, 2);
  ifd.writeUInt16BE(3, 4);
  ifd.writeUInt32BE(1, 6);
  ifd.writeUInt16BE(orientacion, 10);
  ifd.writeUInt16BE(0x013b, 14);
  ifd.writeUInt16BE(2, 16);
  ifd.writeUInt32BE(nombre.length, 18);
  ifd.writeUInt32BE(tiff.length + ifd.length, 22);
  const cuerpo = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff, ifd, nombre]);
  const largo = Buffer.alloc(2);
  largo.writeUInt16BE(cuerpo.length + 2, 0);
  return Buffer.concat([Buffer.from([0xff, 0xe1]), largo, cuerpo]);
}

/** El APP1 va justo detrás del SOI, que es donde lo buscan los lectores. */
function conExif(jpeg: Buffer, orientacion: number, artista: string): Buffer {
  return Buffer.concat([jpeg.subarray(0, 2), app1Exif(orientacion, artista), jpeg.subarray(2)]);
}

const TABLA_CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of bytes) c = TABLA_CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozoPng(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([largo, cuerpo, crc]);
}

/**
 * PNG con la cabecera declarando un tamaño enorme y un cuerpo de mentira. No es
 * trampa: el guardia de píxeles existe justamente para rechazar antes de
 * descomprimir, así que si la prueba tuviera que generar 48 millones de píxeles
 * de verdad estaría probando otra cosa —y reventaría la memoria del ejecutor
 * para nada.
 */
function pngGigante(ancho: number, alto: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozoPng("IHDR", ihdr),
    trozoPng("IDAT", deflateSync(Buffer.alloc(ancho + 1))),
    trozoPng("IEND", Buffer.alloc(0)),
  ]);
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

  it("delega las imágenes en el optimizador y devuelve su medida", async () => {
    const original = conExif(await ruido(500, 400).jpeg({ quality: 100 }).toBuffer(), 1, AUTOR);
    const { bytes, limpio, medida } = await limpiar(original, "jpeg");
    expect(limpio).toBe(true);
    expect(medida?.bytesAntes).toBe(original.byteLength);
    expect((await sharp(bytes).metadata()).exif).toBeUndefined();
  });
});

describe("optimizar", () => {
  it("baja el lado largo a 3600, adelgaza y no deja EXIF", async () => {
    const original = conExif(await ruido(4000, 3000).jpeg({ quality: 100 }).toBuffer(), 1, AUTOR);
    const { bytes, limpio, medida } = await optimizar(original, "jpeg");

    expect(limpio).toBe(true);
    expect(bytes.byteLength).toBeLessThan(original.byteLength);
    expect(medida).toEqual({
      bytesAntes: original.byteLength,
      bytesDespues: bytes.byteLength,
      ancho: LADO_MAX,
      alto: 2700,
      reduccion: expect.any(Number),
    });

    const salida = await sharp(bytes).metadata();
    expect(salida.width).toBe(LADO_MAX);
    expect(salida.exif).toBeUndefined();
  }, 30_000);

  // La prueba que justifica el `.rotate()` de imagen.ts. Sin él la foto sale
  // sin EXIF —parece correcta— pero tumbada, y eso no se ve hasta que el número
  // está impreso. Por eso se comprueba el ancho y el alto, no sólo el EXIF.
  it("hornea la orientación EXIF en los píxeles antes de descartarla", async () => {
    const apaisada = await ruido(800, 400).jpeg({ quality: 100 }).toBuffer();
    const original = conExif(apaisada, 6, AUTOR);
    expect((await sharp(original).metadata()).orientation).toBe(6);

    const { bytes, limpio } = await optimizar(original, "jpeg");
    expect(limpio).toBe(true);

    const salida = await sharp(bytes).metadata();
    expect(salida.width).toBe(400);
    expect(salida.height).toBe(800);
    expect(salida.orientation).toBeUndefined();
    expect(salida.exif).toBeUndefined();
  });

  it("quita el EXIF también de las imágenes que no necesitan reescalado", async () => {
    const original = conExif(await ruido(500, 400).jpeg({ quality: 100 }).toBuffer(), 1, AUTOR);
    expect(original.byteLength).toBeLessThan(1048576);

    const { bytes, limpio } = await optimizar(original, "jpeg");
    expect(limpio).toBe(true);

    const salida = await sharp(bytes).metadata();
    expect(salida.width).toBe(500);
    expect(salida.height).toBe(400);
    expect(salida.exif).toBeUndefined();
  });

  it("mantiene el PNG en PNG y no se come la transparencia", async () => {
    const ancho = 1200;
    const px = Buffer.alloc(ancho * ancho * 4);
    for (let y = 0; y < ancho; y++) {
      for (let x = 0; x < ancho; x++) {
        const i = (y * ancho + x) * 4;
        px[i] = 10;
        px[i + 1] = 120;
        px[i + 2] = 200;
        px[i + 3] = x < ancho / 2 ? 0 : 255;
      }
    }
    const original = await sharp(px, { raw: { width: ancho, height: ancho, channels: 4 } })
      .png()
      .toBuffer();

    const { bytes, limpio } = await optimizar(original, "png");
    expect(limpio).toBe(true);
    expect(reconocer(bytes)).toBe("png");

    const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    expect(data[(ancho - 1) * 4 + 3]).toBe(255);
  }, 30_000);

  it("mantiene el WebP en WebP", async () => {
    const original = await ruido(700, 500).webp({ quality: 95 }).toBuffer();
    const { bytes, limpio, medida } = await optimizar(original, "webp");

    expect(limpio).toBe(true);
    expect(reconocer(bytes)).toBe("webp");
    expect(medida).toMatchObject({ ancho: 700, alto: 500 });
  });

  it("no agranda una imagen que ya cabe de sobra", async () => {
    const original = await ruido(200, 200).jpeg({ quality: 100 }).toBuffer();
    const { bytes, limpio, medida } = await optimizar(original, "jpeg");

    expect(limpio).toBe(true);
    expect(medida).toMatchObject({ ancho: 200, alto: 200 });
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 200, height: 200 });
  });

  it("conserva el original marcado cuando los bytes están corruptos", async () => {
    const corrupta = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3, 4, 5, 6, 7, 8]);
    const { bytes, limpio, motivo, medida } = await optimizar(corrupta, "jpeg");

    expect(bytes).toBe(corrupta);
    expect(limpio).toBe(false);
    expect(motivo).toMatch(/no pudo procesar la imagen/);
    expect(medida).toBeUndefined();
  });

  it("conserva el original marcado por encima del límite de píxeles", async () => {
    const enorme = pngGigante(8000, 6000);
    expect(8000 * 6000).toBeGreaterThan(PIXELES_MAX);

    const { bytes, limpio, motivo, medida } = await optimizar(enorme, "png");
    expect(bytes).toBe(enorme);
    expect(limpio).toBe(false);
    expect(motivo).toMatch(/8000×6000 píxeles/);
    expect(medida).toBeUndefined();
  });

  it("conserva el original, y lo dice, cuando la copia sale más grande", async () => {
    // Color plano guardado con mala calidad: recodificarlo a 85 lo engorda. Es
    // el caso real de la imagen que ya venía optimizada.
    const plana = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 20, g: 40, b: 60 } },
    })
      .jpeg({ quality: 20 })
      .toBuffer();
    const original = conExif(plana, 1, AUTOR);

    const { bytes, limpio, motivo, medida } = await optimizar(original, "jpeg");
    expect(bytes).toBe(original);
    expect(limpio).toBe(false);
    expect(motivo).toMatch(/más grande/);
    // El porcentaje se registra tal cual salió, sin maquillar: negativo.
    expect(medida?.reduccion).toBeLessThan(0);
  });

  it("degrada todos los archivos, y avisa una sola vez, si sharp no carga", async () => {
    vi.resetModules();
    vi.doMock("sharp", () => {
      throw new Error("el binario nativo no está compilado para esta plataforma");
    });
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { optimizar: sinSharp } = await import("@/lib/archivos/imagen");
      const foto = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
      const grafica = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const a = await sinSharp(foto, "jpeg");
      const b = await sinSharp(grafica, "png");

      expect(a.bytes).toBe(foto);
      expect(a.limpio).toBe(false);
      expect(a.motivo).toMatch(/no cargó/);
      expect(b.limpio).toBe(false);
      // Una línea por archivo escondería el problema entre el ruido del envío.
      expect(registro).toHaveBeenCalledTimes(1);
      expect(String(registro.mock.calls[0][0])).toContain("sharp_no_carga");
    } finally {
      registro.mockRestore();
      vi.doUnmock("sharp");
      vi.resetModules();
    }
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
