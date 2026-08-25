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

  it("nunca inventa un folio si falla la firma", async () => {
    fingeFetch({ "/api/uploads": async () => respuesta({ error: "limite" }, false, 429) });
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
