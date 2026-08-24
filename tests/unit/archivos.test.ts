import { describe, expect, it } from "vitest";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { PDFDocument, PDFName, PDFRawStream, PDFDict } from "pdf-lib";
import { reconocer, MIME } from "@/lib/archivos/formato";
import { limpiar } from "@/lib/archivos/limpiar";

/**
 * Las dos mitades de "los archivos son lo que dicen ser y no delatan a quien
 * los escribió" (spec §8).
 *
 * Los fixtures se construyen aquí en vez de versionarse: un .docx de verdad
 * traería el nombre de una persona real, que es justo lo que este código
 * existe para quitar, y no puede entrar al repositorio.
 */

const AUTOR = "Nombre Que No Debe Sobrevivir";

/**
 * `useObjectStreams: false` a propósito: por omisión pdf-lib mete /Info dentro
 * de un ObjStm comprimido con Flate y entonces el nombre no aparece en los
 * bytes crudos ni antes ni después de limpiar, con lo que la prueba pasaría
 * sin comprobar nada. Sin comprimir, el antes y el después se pueden leer.
 */
async function pdfConAutor(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.setAuthor(AUTOR);
  pdf.setTitle("Título privado");
  pdf.setCreator(AUTOR);
  pdf.setProducer(AUTOR);
  return pdf.save({ useObjectStreams: false });
}

/** Un PDF con XMP, que es la otra mitad de los metadatos y no vive en /Info. */
async function pdfConXmp(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const xmp = `<?xpacket?><x:xmpmeta><dc:creator>${AUTOR}</dc:creator></x:xmpmeta>`;
  const flujo = PDFRawStream.of(
    pdf.context.obj({ Type: "Metadata", Subtype: "XML", Length: xmp.length }) as PDFDict,
    new TextEncoder().encode(xmp),
  );
  pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(flujo));
  return pdf.save({ useObjectStreams: false });
}

function docxConAutor(extras: Record<string, string> = {}): Uint8Array {
  return zipSync({
    "[Content_Types].xml":
      strToU8(
        '<?xml version="1.0"?><Types xmlns="x">' +
          '<Override PartName="/docProps/core.xml" ContentType="a"/>' +
          '<Override PartName="/word/document.xml" ContentType="b"/>' +
          "</Types>",
      ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0"?><Relationships xmlns="y">' +
        '<Relationship Id="r1" Type="t" Target="docProps/core.xml"/>' +
        '<Relationship Id="r2" Type="t" Target="word/document.xml"/>' +
        "</Relationships>",
    ),
    "docProps/core.xml": strToU8(
      `<?xml version="1.0"?><cp:coreProperties><dc:creator>${AUTOR}</dc:creator>` +
        `<cp:lastModifiedBy>${AUTOR}</cp:lastModifiedBy></cp:coreProperties>`,
    ),
    "docProps/app.xml": strToU8(`<?xml version="1.0"?><Properties><Company>${AUTOR}</Company></Properties>`),
    "word/document.xml": strToU8('<?xml version="1.0"?><w:document><w:body/></w:document>'),
    ...Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, strToU8(v)])),
  });
}

const texto = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

/**
 * Buscar el nombre tal cual no basta. pdf-lib escribe las cadenas de /Info en
 * UTF-16BE y además las serializa como cadena hexadecimal —
 * `/Author <FEFF004E006F...>` —, así que hay tres formas en que el nombre
 * puede seguir dentro del archivo. Comprobar sólo la primera daría una prueba
 * que pasa siempre.
 */
function contieneNombre(bytes: Uint8Array, nombre: string): boolean {
  const plano = texto(bytes);
  const utf16 = [...nombre].map((c) => `\u0000${c}`).join("");
  const hex = [...nombre]
    .map((c) => c.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("")
    .toUpperCase();
  return plano.includes(nombre) || plano.includes(utf16) || plano.toUpperCase().includes(hex);
}

describe("reconocer", () => {
  it("reconoce un PDF real por su cabecera", async () => {
    expect(reconocer(await pdfConAutor())).toBe("pdf");
  });

  it("reconoce un .docx por traer word/document.xml dentro", () => {
    expect(reconocer(docxConAutor())).toBe("docx");
  });

  it("reconoce un .doc binario por su firma OLE2", () => {
    const ole = new Uint8Array(64);
    ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(reconocer(ole)).toBe("doc");
  });

  // Éste es el motivo de que el reconocimiento no mire la extensión: un zip
  // cualquiera renombrado a .docx pasaba el filtro anterior sin más.
  it("rechaza un ZIP que no es un .docx", () => {
    const zip = zipSync({ "hoja.txt": strToU8("no soy Word") });
    expect(reconocer(zip)).toBeNull();
  });

  it("rechaza cualquier otra cosa", () => {
    expect(reconocer(strToU8("%PDF pero no al principio"))).toBeNull();
    expect(reconocer(new Uint8Array(0))).toBeNull();
    expect(reconocer(strToU8("\x89PNG\r\n\x1a\n"))).toBeNull();
  });
});

describe("limpiar un PDF", () => {
  it("borra el autor del diccionario /Info y deja el PDF legible", async () => {
    const original = await pdfConAutor();
    expect(contieneNombre(original, AUTOR)).toBe(true);

    const { bytes, limpio } = await limpiar(original, "pdf");
    expect(limpio).toBe(true);
    expect(contieneNombre(bytes, AUTOR)).toBe(false);

    // Y sigue siendo un PDF que se puede abrir con su página dentro: quitar
    // metadatos no puede costar el manuscrito.
    const releido = await PDFDocument.load(bytes);
    expect(releido.getPageCount()).toBe(1);
    expect(releido.getAuthor() ?? "").toBe("");
  });

  // Escribir /Info y olvidarse del XMP es el error clásico: el visor sigue
  // enseñando el nombre en "Propiedades" porque lo lee del XMP.
  it("borra también el flujo XMP colgado del catálogo", async () => {
    const original = await pdfConXmp();
    expect(contieneNombre(original, AUTOR)).toBe(true);

    const { bytes, limpio } = await limpiar(original, "pdf");
    expect(limpio).toBe(true);
    expect(contieneNombre(bytes, AUTOR)).toBe(false);

    const releido = await PDFDocument.load(bytes);
    expect(releido.catalog.get(PDFName.of("Metadata"))).toBeUndefined();
  });

  it("no revienta con un PDF corrupto: lo deja pasar marcado", async () => {
    const roto = strToU8("%PDF-1.7\nesto no es un PDF");
    const { limpio, motivo, bytes } = await limpiar(roto, "pdf");
    expect(limpio).toBe(false);
    expect(motivo).toBeTruthy();
    // Los bytes originales se conservan: el envío entra y lo atrapa la
    // revisión de anonimización, que es la segunda barrera.
    expect(bytes).toBe(roto);
  });
});

describe("limpiar un .docx", () => {
  it("quita docProps y sus referencias, y conserva el documento", async () => {
    const original = docxConAutor();
    // El zip va comprimido, así que el nombre no está en los bytes crudos:
    // la precondición se comprueba sobre la parte descomprimida.
    expect(new TextDecoder().decode(unzipSync(original)["docProps/core.xml"])).toContain(AUTOR);

    const { bytes, limpio } = await limpiar(original, "docx");
    expect(limpio).toBe(true);

    const partes = unzipSync(bytes);
    expect(Object.keys(partes)).not.toContain("docProps/core.xml");
    expect(Object.keys(partes)).not.toContain("docProps/app.xml");
    expect(Object.keys(partes)).toContain("word/document.xml");

    // Dejar la declaración de una parte que ya no está deja el paquete
    // describiendo algo inexistente, y hay lectores que se niegan a abrirlo.
    const tipos = new TextDecoder().decode(partes["[Content_Types].xml"]);
    expect(tipos).not.toContain("docProps/core.xml");
    expect(tipos).toContain("word/document.xml");
    const rels = new TextDecoder().decode(partes["_rels/.rels"]);
    expect(rels).not.toContain("docProps/core.xml");
    expect(rels).toContain("word/document.xml");
  });

  it("anonimiza los w:author de comentarios y marcas de revisión", async () => {
    const original = docxConAutor({
      "word/comments.xml":
        `<?xml version="1.0"?><w:comments><w:comment w:author="${AUTOR}" w:initials="NQ">` +
        "<w:p/></w:comment></w:comments>",
    });

    const { bytes } = await limpiar(original, "docx");
    const partes = unzipSync(bytes);
    const comentarios = new TextDecoder().decode(partes["word/comments.xml"]);

    expect(comentarios).not.toContain(AUTOR);
    expect(comentarios).toContain('w:author="Autor"');
    expect(comentarios).toContain('w:initials="A"');
    // El comentario en sí sobrevive: se quita el nombre, no la observación.
    expect(comentarios).toContain("<w:p/>");
  });
});

describe("limpiar un .doc binario", () => {
  it("lo deja pasar marcado, porque no se puede reescribir sin corromperlo", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    const { bytes, limpio, motivo } = await limpiar(ole, "doc");
    expect(limpio).toBe(false);
    expect(motivo).toMatch(/\.doc/);
    expect(bytes).toBe(ole);
  });
});

describe("MIME", () => {
  it("da el tipo canónico de cada formato, no el que dijo el navegador", () => {
    expect(MIME.pdf).toBe("application/pdf");
    expect(MIME.docx).toContain("wordprocessingml");
    expect(MIME.doc).toBe("application/msword");
  });
});
