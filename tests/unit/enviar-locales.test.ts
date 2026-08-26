import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarManuscrito, type ArchivoEnvio } from "@/lib/cliente/enviar";
import { vacio, type DatosEnvio } from "@/lib/validacion";
import { LOCALES } from "@/i18n/rutas";

const DATOS: DatosEnvio = {
  ...vacio,
  campos: { ...vacio.campos },
};

const ARCHIVO: ArchivoEnvio = {
  archivo: new File([new Uint8Array([1, 2, 3])], "paper.pdf", { type: "application/pdf" }),
  rol: "paper",
};

const respuesta = (cuerpo: unknown) =>
  ({ ok: true, status: 200, json: async () => cuerpo }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe("enviarManuscrito en otros idiomas", () => {
  for (const locale of LOCALES.filter((x) => x !== "es")) {
    it(`sube archivos y conserva locale=${locale} al registrar`, async () => {
      const vistas: string[] = [];
      let localeRegistrado = "";

      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        vistas.push(url);
        if (url === "/api/uploads") {
          return respuesta({
            subidas: [{ nombre: "paper.pdf", path: "p1", url: "https://firmada/p1" }],
          });
        }
        if (url === "https://firmada/p1") return respuesta({});
        if (url === "/api/envios") {
          localeRegistrado = (JSON.parse(String(init?.body)) as { locale: string }).locale;
          return respuesta({ folio: "VTX-2026-999", acuse: true });
        }
        throw new Error(`fetch inesperado a ${url}`);
      });

      const resultado = await enviarManuscrito(DATOS, [ARCHIVO], locale, () => {});

      expect(resultado).toEqual({ folio: "VTX-2026-999", acuse: true });
      expect(localeRegistrado).toBe(locale);
      expect(vistas).toEqual(["/api/uploads", "https://firmada/p1", "/api/envios"]);
    });
  }
});
