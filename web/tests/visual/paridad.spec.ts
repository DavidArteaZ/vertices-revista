import { test, expect } from "@playwright/test";
import {
  PUNTOS_U,
  SATELITES,
  nombreU,
  guionSemilla,
  PUERTO_APP,
  MOVIMIENTO_SATELITE,
} from "./constantes";

/**
 * La compuerta de la etapa 1: la app nueva debe coincidir con las imágenes
 * doradas del sitio legado.
 *
 * Sólo se afirma español. Los otros cinco idiomas se afirman en la etapa 2
 * contra estas mismas imágenes, cuando exista la capa de i18n.
 *
 * La tolerancia existe para el antialiasing subpíxel, NO para diferencias
 * reales. Si algo falla, se arregla la causa: no se sube la tolerancia ni se
 * regeneran las imágenes contra la app nueva, porque eso volvería la
 * compuerta autocomplaciente y anularía la etapa entera.
 */

const BASE = `http://localhost:${PUERTO_APP}`;
const TOL = { maxDiffPixelRatio: 0.001 };

test("landing es matches the legacy baseline at every phase", async ({ page }) => {
  await page.addInitScript(guionSemilla);
  await page.goto(BASE);
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
    await expect(page).toHaveScreenshot(`landing-es-${nombreU(u)}.png`, TOL);
  }

  await expect(page).toHaveScreenshot("landing-portal-es.png", {
    fullPage: true,
    ...TOL,
  });
});

test.describe("satélites", () => {
  test.use(MOVIMIENTO_SATELITE);

  for (const { ruta, nombre } of SATELITES) {
  test(`${nombre} es matches the legacy baseline`, async ({ page }) => {
    await page.addInitScript(guionSemilla);
    await page.goto(BASE + ruta);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() =>
      document.querySelectorAll(".rev").forEach((e) => e.classList.add("rev-on")),
    );
    await expect(page).toHaveScreenshot(`${nombre}-es.png`, {
      fullPage: true,
      ...TOL,
    });
  });
  }
});
