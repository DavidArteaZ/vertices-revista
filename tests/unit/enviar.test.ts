import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarManuscrito, esError, type ArchivoEnvio } from "@/lib/cliente/enviar";
import { vacio, type DatosEnvio } from "@/lib/validacion";

const DATOS: DatosEnvio = {
  ...vacio,
  campos: { ...vacio.campos, textoExplicativo: Array(200).fill("dato").join(" ") },
  nombre: "Autora de Prueba",
  correo: "autora@ejemplo.test",
  perfil: "Estudiante de otra licenciatura",
  afiliacion: "Universidad",
  seccion: "Datanomics",
  genero: "Femenino",
  titulo: "Un título",
  tema: "Macroeconomía",
  claves: "a, b, c",
  usoIA: "No",
  d1: true, d2: true, d3: true, d4: true, d5: true, d6: true,
};

const archivo = (nombre = "grafica.png"): ArchivoEnvio => ({
  archivo: new File([new Uint8Array([1, 2, 3])], nombre, { type: "image/png" }),
  rol: "visualizacion",
});

const respuesta = (cuerpo: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => cuerpo }) as Response;

afterEach(() => vi.unstubAllGlobals());

// El `init` se le pasa al doble porque varias pruebas miran el cuerpo que sale,
// no sólo la URL: es donde se comprueban el tipo MIME de la parte subida y el
// emparejamiento archivo↔firma.
function fingeFetch(por: Record<string, (init?: RequestInit) => Promise<Response>>) {
  const vistas: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    vistas.push(url);
    const clave = Object.keys(por).find((k) => url.includes(k));
    if (!clave) throw new Error(`fetch inesperado a ${url}`);
    return por[clave](init);
  });
  return vistas;
}

/** Lo que `/api/envios` recibe: sólo se mira la lista de archivos. */
type CuerpoRegistro = {
  archivos: { path: string; nombre: string; bytes: number; rol: string }[];
};

const cuerpoJson = (init?: RequestInit): CuerpoRegistro =>
  JSON.parse(String(init?.body)) as CuerpoRegistro;

/** La parte del multipart que Storage lee: nombre y tipo son lo que importa. */
const parteSubida = (init?: RequestInit): File => (init?.body as FormData).get("") as File;

describe("enviarManuscrito", () => {
  it("firma, sube, registra y devuelve únicamente el folio del servidor", async () => {
    const pasos: string[] = [];
    const vistas = fingeFetch({
      "/api/uploads": async () => respuesta({ subidas: [{ nombre: "grafica.png", path: "p1", url: "https://firmada/p1" }] }),
      "https://firmada/p1": async () => respuesta({}),
      "/api/envios": async () => respuesta({ folio: "VTX-2026-007", acuse: true }),
    });

    const r = await enviarManuscrito(DATOS, [archivo()], "es", (p) => pasos.push(p));
    expect(esError(r)).toBe(false);
    expect(r).toEqual({ folio: "VTX-2026-007", acuse: true });
    expect(pasos).toEqual(["subiendo", "registrando"]);
    expect(vistas).toEqual(["/api/uploads", "https://firmada/p1", "/api/envios"]);
  });

  it("permite registrar una sección sin archivos, como ¿Sabías Qué?", async () => {
    const vistas = fingeFetch({
      "/api/envios": async () => respuesta({ folio: "VTX-2026-008", acuse: true }),
    });
    const r = await enviarManuscrito(DATOS, [], "es", () => {});
    expect(r).toEqual({ folio: "VTX-2026-008", acuse: true });
    expect(vistas).toEqual(["/api/envios"]);
  });

  it("sube con el tipo que dice la extensión aunque el navegador no lo diga", async () => {
    // Safari entrega tipo vacío en los archivos que vienen de iCloud. Sin
    // forzarlo, Storage rechaza por su lista de tipos admitidos un archivo
    // perfectamente válido y el autor no entiende por qué.
    const partes: File[] = [];
    fingeFetch({
      "/api/uploads": async () =>
        respuesta({ subidas: [{ nombre: "foto.jpg", path: "p1", url: "https://firmada/p1" }] }),
      "https://firmada/p1": async (init) => {
        partes.push(parteSubida(init));
        return respuesta({});
      },
      "/api/envios": async () => respuesta({ folio: "VTX-2026-009", acuse: true }),
    });

    const sinTipo: ArchivoEnvio = {
      archivo: new File([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "" }),
      rol: "foto",
    };
    const r = await enviarManuscrito(DATOS, [sinTipo], "es", () => {});

    expect(esError(r)).toBe(false);
    expect(partes[0].type).toBe("image/jpeg");
    expect(partes[0].name).toBe("foto.jpg");
    expect(partes[0].size).toBe(3);
  });

  it("manda el rol de cada archivo tal cual al registro", async () => {
    let cuerpo: CuerpoRegistro = { archivos: [] };
    fingeFetch({
      "/api/uploads": async () =>
        respuesta({
          subidas: [
            { nombre: "paper.pdf", path: "p1", url: "https://firmada/p1" },
            { nombre: "anexo.pdf", path: "p2", url: "https://firmada/p2" },
          ],
        }),
      "https://firmada/": async () => respuesta({}),
      "/api/envios": async (init) => {
        cuerpo = cuerpoJson(init);
        return respuesta({ folio: "VTX-2026-010", acuse: true });
      },
    });

    const archivos: ArchivoEnvio[] = [
      { archivo: new File(["a"], "paper.pdf", { type: "application/pdf" }), rol: "paper" },
      { archivo: new File(["b"], "anexo.pdf", { type: "application/pdf" }), rol: "anexo" },
    ];
    await enviarManuscrito(DATOS, archivos, "es", () => {});

    expect(cuerpo.archivos.map((a) => a.rol)).toEqual(["paper", "anexo"]);
  });

  it("empareja cada archivo con la firma que le toca, no con la primera", async () => {
    // El bucle recorre dos listas en paralelo: un desfase de uno subiría la
    // cesión de derechos a la ruta del paper y el comité vería el archivo
    // equivocado. Con un solo archivo el fallo es invisible.
    const puestos: string[] = [];
    let cuerpo: CuerpoRegistro = { archivos: [] };
    const vistas = fingeFetch({
      "/api/uploads": async () =>
        respuesta({
          subidas: [
            { nombre: "uno.png", path: "envios/uno.png", url: "https://firmada/uno" },
            { nombre: "dos.png", path: "envios/dos.png", url: "https://firmada/dos" },
            { nombre: "tres.png", path: "envios/tres.png", url: "https://firmada/tres" },
          ],
        }),
      "https://firmada/": async (init) => {
        puestos.push(parteSubida(init).name);
        return respuesta({});
      },
      "/api/envios": async (init) => {
        cuerpo = cuerpoJson(init);
        return respuesta({ folio: "VTX-2026-011", acuse: true });
      },
    });

    const archivos = [archivo("uno.png"), archivo("dos.png"), archivo("tres.png")];
    const r = await enviarManuscrito(DATOS, archivos, "es", () => {});

    expect(r).toEqual({ folio: "VTX-2026-011", acuse: true });
    expect(vistas).toEqual([
      "/api/uploads",
      "https://firmada/uno",
      "https://firmada/dos",
      "https://firmada/tres",
      "/api/envios",
    ]);
    expect(puestos).toEqual(["uno.png", "dos.png", "tres.png"]);
    expect(cuerpo.archivos).toEqual([
      { path: "envios/uno.png", nombre: "uno.png", bytes: 3, rol: "visualizacion" },
      { path: "envios/dos.png", nombre: "dos.png", bytes: 3, rol: "visualizacion" },
      { path: "envios/tres.png", nombre: "tres.png", bytes: 3, rol: "visualizacion" },
    ]);
  });

  it("nunca inventa un folio si falla la firma", async () => {
    fingeFetch({ "/api/uploads": async () => respuesta({ error: "limite" }, false, 429) });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("demasiados_intentos");
  });

  it("traduce el 429 del registro, no sólo el de la firma", async () => {
    // El límite de peticiones vigila las dos rutas. Sin este caso, un autor
    // frenado al registrar veía el aviso genérico y volvía a intentarlo.
    fingeFetch({
      "/api/uploads": async () =>
        respuesta({ subidas: [{ nombre: "grafica.png", path: "p1", url: "https://firmada/p1" }] }),
      "https://firmada/p1": async () => respuesta({}),
      "/api/envios": async () => respuesta({ error: "limite" }, false, 429),
    });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("demasiados_intentos");
  });

  it("nunca inventa un folio si falla Storage", async () => {
    fingeFetch({
      "/api/uploads": async () => respuesta({ subidas: [{ nombre: "grafica.png", path: "p1", url: "https://firmada/p1" }] }),
      "https://firmada/p1": async () => respuesta({}, false, 500),
    });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("no_pudimos_subir_a");
  });

  it("traslada el aviso del servidor si falla el registro", async () => {
    fingeFetch({
      "/api/uploads": async () => respuesta({ subidas: [{ nombre: "grafica.png", path: "p1", url: "https://firmada/p1" }] }),
      "https://firmada/p1": async () => respuesta({}),
      "/api/envios": async () => respuesta({ aviso: "portal_archivo_tipo" }, false, 400),
    });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("portal_archivo_tipo");
  });

  it("devuelve error genérico sin red", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("sin red"); });
    const r = await enviarManuscrito(DATOS, [archivo()], "es", () => {});
    expect(esError(r) && r.error.clave).toBe("no_pudimos_registrar_tu_envio");
  });
});
