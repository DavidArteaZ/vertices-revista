import { test, expect } from "@playwright/test";
import {
  LOCALES,
  PUNTOS_U,
  SATELITES,
  nombreU,
  guionSemilla,
  PUERTO_APP,
  MOVIMIENTO_SATELITE,
  preparaSatelite,
} from "./constantes";

/**
 * La compuerta: la app nueva debe coincidir con las imágenes doradas del sitio
 * legado, en los seis idiomas.
 *
 * La etapa 1 sólo afirmaba español porque no había capa de i18n; las imágenes
 * de los otros cinco idiomas ya estaban capturadas esperando a esta etapa.
 *
 * La tolerancia existe para el antialiasing subpíxel, NO para diferencias
 * reales. Si algo falla, se arregla la causa: no se sube la tolerancia ni se
 * regeneran las imágenes contra la app nueva, porque eso volvería la
 * compuerta autocomplaciente y anularía las dos etapas.
 */

const BASE = `http://localhost:${PUERTO_APP}`;
const TOL = { maxDiffPixelRatio: 0.001 };

/** El español vive en la raíz; los demás llevan prefijo (localePrefix "as-needed"). */
const prefijo = (locale: string) => (locale === "es" ? "" : `/${locale}`);

for (const locale of LOCALES) {
  test(`landing ${locale} matches the legacy baseline at every phase`, async ({ page }) => {
    await page.addInitScript(guionSemilla);
    await page.goto(BASE + (prefijo(locale) || "/"));
    await page.waitForFunction(
      () => typeof (window as unknown as { __qa?: { runTo?: unknown } }).__qa?.runTo === "function",
    );
    await page.evaluate(() => document.fonts.ready);

    // Una sola vez: devuelve el motor al estado recién arrancado y lo congela,
    // que es donde arranca el sitio legado gracias a guionSinRaf. A partir de
    // aquí ambos lados acumulan igual entre llamadas a runTo.
    await page.evaluate(() =>
      (window as unknown as { __qa: { reset: () => void } }).__qa.reset(),
    );

    for (const u of PUNTOS_U) {
      // resembrar antes de cada captura: runTo reconstruye las partículas
      await page.evaluate(() => (window as unknown as { __resembrar: () => void }).__resembrar());
      await page.evaluate(
        (uu) => (window as unknown as { __qa: { runTo: (u: number, s: number) => void } }).__qa.runTo(uu, 3),
        u,
      );
      await expect(page).toHaveScreenshot(`landing-${locale}-${nombreU(u)}.png`, TOL);
    }

    await expect(page).toHaveScreenshot(`landing-portal-${locale}.png`, {
      fullPage: true,
      ...TOL,
    });
  });
}

test.describe("satélites", () => {
  test.use(MOVIMIENTO_SATELITE);

  for (const locale of LOCALES) {
    for (const { ruta, nombre } of SATELITES) {
      test(`${nombre} ${locale} matches the legacy baseline`, async ({ page }) => {
        await page.addInitScript(guionSemilla);
        await page.goto(BASE + prefijo(locale) + ruta);
        await preparaSatelite(page);
        await expect(page).toHaveScreenshot(`${nombre}-${locale}.png`, {
          fullPage: true,
          ...TOL,
        });
      });
    }
  }
});
