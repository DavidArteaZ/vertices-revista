import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import {
  LOCALES,
  PUNTOS_U,
  SATELITES,
  nombreU,
  PUERTO_LEGADO,
  guionSemilla,
} from "./constantes";

/**
 * Captura las imágenes doradas desde el SITIO LEGADO, no desde la app nueva.
 * Así la referencia queda fija y la etapa 1 puede capturar los seis idiomas
 * aunque la app todavía sea sólo español (el i18n es etapa 2).
 */

const RAIZ = path.resolve(__dirname, "../../..");
const BASE = `http://127.0.0.1:${PUERTO_LEGADO}`;

let servidor: ChildProcess;

test.beforeAll(async () => {
  servidor = spawn(
    "python3",
    ["-m", "http.server", String(PUERTO_LEGADO), "--bind", "127.0.0.1", "--directory", RAIZ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/index.html`)).ok) return;
    } catch {
      /* todavía no levanta */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("el servidor del sitio legado no arrancó");
});

test.afterAll(() => {
  servidor?.kill();
});

for (const locale of LOCALES) {
  test(`baseline landing ${locale}`, async ({ page }) => {
    await page.addInitScript(guionSemilla);
    await page.goto(`${BASE}/index.html`);
    await page.evaluate((l) => localStorage.setItem("vertices_lang", l), locale);
    await page.reload();
    await page.waitForFunction(
      () => typeof (window as unknown as { __qa?: { runTo?: unknown } }).__qa?.runTo === "function",
    );
    await page.evaluate(() => document.fonts.ready);
    // el diccionario se carga por <script> inyectado; esperar a que aplique
    await page.waitForFunction(
      (l) => l === "es" || Boolean((window as unknown as { __dicc?: unknown }).__dicc),
      locale,
    );

    // Capturas de VIEWPORT, no de body. El lienzo es position:fixed y ocupa
    // 100vh; el body mide ~8700px por el espaciador #recorrido de 680vh. Una
    // captura de body ahoga la animación en un 10% del cuadro y vuelve
    // inservible cualquier tolerancia por proporción de píxeles.
    for (const u of PUNTOS_U) {
      await page.evaluate(
        (uu) => (window as unknown as { __qa: { runTo: (u: number, s: number) => void } }).__qa.runTo(uu, 3),
        u,
      );
      await expect(page).toHaveScreenshot(`landing-${locale}-${nombreU(u)}.png`, {
        maxDiffPixelRatio: 0,
      });
    }

    // Una toma completa aparte para el contenido estático del portal
    // (convocatoria, formulario, lateral, estado, pie), que las capturas de
    // viewport no alcanzan.
    await expect(page).toHaveScreenshot(`landing-portal-${locale}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0,
    });
  });
}

for (const locale of LOCALES) {
  for (const { legado, nombre } of SATELITES) {
    test(`baseline ${nombre} ${locale}`, async ({ page }) => {
      // fondo-flujo.js también usa Math.random para sus partículas
      await page.addInitScript(guionSemilla);
      await page.goto(`${BASE}/${legado}`);
      await page.evaluate((l) => localStorage.setItem("vertices_lang", l), locale);
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(
        (l) => l === "es" || Boolean((window as unknown as { __dicc?: unknown }).__dicc),
        locale,
      );
      // el revelado por scroll deja elementos en opacity:0; forzarlos visibles
      await page.evaluate(() =>
        document.querySelectorAll(".rev").forEach((e) => e.classList.add("rev-on")),
      );
      await expect(page).toHaveScreenshot(`${nombre}-${locale}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0,
      });
    });
  }
}
