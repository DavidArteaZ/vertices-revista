import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarManuscrito, esError } from "@/lib/cliente/enviar";
import { validarEnvio, vacio, MAX_ARCHIVOS, type DatosEnvio } from "@/lib/validacion";

/**
 * El defecto 3 de la spec en forma de prueba.
 *
 * El sitio actual, cuando el registro falla, inventa un folio y enseña la
 * pantalla de éxito (index.html:2172-2175): el autor se va convencido de haber
 * enviado su manuscrito y no hay nada guardado en ninguna parte. Estas pruebas
 * existen para que ese comportamiento no pueda volver por accidente: en cuanto
 * cualquier paso falla, `enviarManuscrito` devuelve error y NUNCA un folio.
 */

const DATOS: DatosEnvio = {
  ...vacio,
  nombre: "Autora de Prueba",
  correo: "autora@ejemplo.test",
  perfil: "Estudiante de otra licenciatura",
  afiliacion: "Universidad",
  titulo: "Un título",
  formato: "Artículo",
  seccion: "Datanomics",
  tema: "Macroeconomía",
  resumen: Array.from({ length: 120 }, (_, i) => `palabra${i}`).join(" "),
  claves: "a, b, c",
  usoIA: "No",
  d1: true, d2: true, d3: true, d4: true, d5: true, d6: true,
};

const archivo = (nombre = "manuscrito.pdf") =>
  new File([new Uint8Array([1, 2, 3])], nombre, { type: "application/pdf" });

const respuesta = (cuerpo: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => cuerpo }) as Response;

afterEach(() => vi.unstubAllGlobals());

/** Devuelve una implementación de fetch por ruta, y el registro de llamadas. */
function fingeFetch(por: Record<string, () => Promise<Response>>) {
  const vistas: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    vistas.push(url);
    const clave = Object.keys(por).find((k) => url.includes(k));
    if (!clave) throw new Error(`fetch inesperado a ${url}`);
    return por[clave]();
  });
  return vistas;
}

describe("enviarManuscrito, camino feliz", () => {
  it("firma, sube y registra, y devuelve el folio del servidor", async () => {
    const pasos: string[] = [];
    const vistas = fingeFetch({
      "/api/uploads": async () =>
        respuesta({ subidas: [{ nombre: "manuscrito.pdf", path: "p1", url: "https://firmada/p1" }] }),
      "https://firmada/p1": async () => respuesta({}),
      "/api/envios": async () => respuesta({ folio: "VTX-2026-007", acuse: true }),
    });

    const r = await enviarManuscrito(DATOS, [archivo()], "es", (p) => pasos.push(p));

    expect(esError(r)).toBe(false);
    expect(r).toEqual({ folio: "VTX-2026-007", acuse: true });
    expect(pasos).toEqual(["subiendo", "registrando"]);
    // El archivo va al almacenamiento, no dentro del POST: eso es lo que hace
    // que quepan 20 MB (spec §8).
    expect(vistas).toEqual(["/api/uploads", "https://firmada/p1", "/api/envios"]);
  });

  it("empareja archivo y firma por posición, no por nombre", async () => {
    const subidos: string[] = [];
    fingeFetch({
      "/api/uploads": async () =>
        respuesta({
          subidas: [
            { nombre: "informe.pdf", path: "p1", url: "https://firmada/1" },
            { nombre: "informe.pdf", path: "p2", url: "https://firmada/2" },
          ],
        }),
      // Dos adjuntos con el mismo nombre y distinto tamaño existen: el
      // asistente los admite. Emparejar por nombre haría que uno pisara al
      // otro y se perdería un anexo sin aviso.
      "https://firmada/": async () => respuesta({}),
      "/api/envios": async () => respuesta({ folio: "VTX-2026-008", acuse: true }),
    });

    const a = new File([new Uint8Array(10)], "informe.pdf");
    const b = new File([new Uint8Array(20)], "informe.pdf");
    const r = await enviarManuscrito(DATOS, [a, b], "es", () => subidos.push("x"));

    expect(r).toEqual({ folio: "VTX-2026-008", acuse: true });
  });
});

describe("enviarManuscrito nunca inventa un folio", () => {
  it("si la firma falla", async () => {
    fingeFetch({ "/api/uploads": async () => respuesta({ error: "limite" }, false, 429) });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("demasiados_intentos");
  });

  it("si la subida a Storage falla", async () => {
    fingeFetch({
      "/api/uploads": async () =>
        respuesta({ subidas: [{ nombre: "m.pdf", path: "p1", url: "https://firmada/p1" }] }),
      "https://firmada/p1": async () => respuesta({}, false, 500),
    });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("no_pudimos_subir_a");
    expect(esError(r) && r.error.valores).toEqual({ a: "manuscrito.pdf" });
  });

  it("si el registro falla, y traslada el aviso del servidor", async () => {
    fingeFetch({
      "/api/uploads": async () =>
        respuesta({ subidas: [{ nombre: "m.pdf", path: "p1", url: "https://firmada/p1" }] }),
      "https://firmada/p1": async () => respuesta({}),
      "/api/envios": async () =>
        respuesta({ aviso: "a_no_es_un_pdf_ni_un_documento_de_word", valores: { a: "m.pdf" } }, false, 400),
    });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("a_no_es_un_pdf_ni_un_documento_de_word");
  });

  it("si no hay red", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("sin red"); });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("no_pudimos_registrar_tu_envio");
  });

  it("si el servidor responde 500 con cuerpo vacío", async () => {
    fingeFetch({
      "/api/uploads": async () =>
        ({ ok: false, status: 500, json: async () => { throw new Error("no json"); } }) as unknown as Response,
    });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("no_pudimos_registrar_tu_envio");
  });
});

describe("validarEnvio", () => {
  it("acepta un envío completo", () => {
    expect(validarEnvio(DATOS, [{ name: "m.pdf", size: 100 }])).toBeNull();
  });

  it("aplica las reglas de los cuatro pasos de una vez", () => {
    // El servidor no ve pasos: recibe un cuerpo que puede venir de cualquier
    // sitio y tiene que juzgarlo entero.
    expect(validarEnvio({ ...DATOS, nombre: "" }, [{ name: "m.pdf", size: 1 }])?.clave)
      .toBe("escribe_tu_nombre_completo");
    expect(validarEnvio({ ...DATOS, d4: false }, [{ name: "m.pdf", size: 1 }])?.clave)
      .toBe("confirma_las_cuatro_declaraciones_para_poder_env_9d6c");
    expect(validarEnvio(DATOS, [])?.clave).toBe("adjunta_tu_manuscrito_en_docx_o_pdf");
  });

  it("aplica los topes que el formulario original no tenía", () => {
    const seis = Array.from({ length: MAX_ARCHIVOS + 1 }, (_, i) => ({ name: `${i}.pdf`, size: 1 }));
    expect(validarEnvio(DATOS, seis)).not.toBeNull();

    // 50 MB en total, repartidos en archivos que individualmente caben.
    const gordos = Array.from({ length: 4 }, (_, i) => ({ name: `${i}.pdf`, size: 15 * 1048576 }));
    expect(validarEnvio(DATOS, gordos)).not.toBeNull();
  });
});
