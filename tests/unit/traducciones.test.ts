import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * La precedencia de `generar.mjs`: propias > legado > español.
 *
 * `verificar.mjs` no puede ver esto y por eso hace falta la prueba. Esa
 * comprobación mira que los seis archivos compartan claves y que cada mensaje
 * compile como ICU; si alguien invirtiera el orden y el legado ganara a las
 * traducciones propias, los seis seguirían compartiendo claves y todo seguiría
 * compilando. Lo único que cambiaría es que el texto renderizado sería el
 * equivocado, en silencio.
 *
 * El caso concreto que lo motiva está en el catálogo: `resumen_miradas` y
 * `resumen_horizonte` comparten español («Resumen *»), así que el legado da a
 * las dos la misma traducción. Distinguir *Abstract* de *Summary* depende
 * enteramente de que las propias pisen al legado.
 */

const RAIZ = path.resolve(__dirname, "../..");

const leer = (p: string) => JSON.parse(readFileSync(path.join(RAIZ, p), "utf8"));

const IDIOMAS = ["en", "fr", "it", "pt", "ru"] as const;

describe("traducciones propias", () => {
  for (const idioma of IDIOMAS) {
    it(`${idioma}: cada traducción propia llega a messages/${idioma}.json`, () => {
      const propias: Record<string, string> = leer(`scripts/i18n/traducciones/${idioma}.json`);
      const mensajes: Record<string, Record<string, string>> = leer(`messages/${idioma}.json`);

      for (const [clave, texto] of Object.entries(propias)) {
        const [espacio, nombre] = clave.split(".");
        expect(mensajes[espacio]?.[nombre], `${idioma} · ${clave}`).toBe(texto);
      }
    });
  }

  it("una traducción propia pisa la que hereda del legado", () => {
    const propias: Record<string, string> = leer("scripts/i18n/traducciones/en.json");
    const en = leer("messages/en.json");
    const es = leer("messages/es.json");

    // Mismo español, traducciones distintas: sólo es posible si las propias mandan.
    expect(es.camposarchivosenvio.resumen_miradas).toBe(
      es.camposarchivosenvio.resumen_horizonte,
    );
    expect(propias["camposarchivosenvio.resumen_horizonte"]).toBe("Summary *");
    expect(en.camposarchivosenvio.resumen_horizonte).toBe("Summary *");
    expect(en.camposarchivosenvio.resumen_miradas).not.toBe(
      en.camposarchivosenvio.resumen_horizonte,
    );
  });
});
