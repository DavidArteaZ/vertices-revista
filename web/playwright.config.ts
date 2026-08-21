import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  // Cada prueba del landing toma 8 capturas (una por fase del recorrido) y
  // cada toHaveScreenshot espera a que el cuadro se estabilice. Los 30 s por
  // defecto se agotan en la séptima.
  timeout: 180_000,
  // Ambos specs resuelven al mismo directorio dorado, para que la corrida de
  // paridad compare contra las capturas del sitio legado y no contra sí misma.
  snapshotPathTemplate: "{testDir}/baseline/{arg}{ext}",
  use: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // Sin reducedMotion explícito: el valor por defecto ya es
    // "no-preference", que es lo que hace falta. El motor lee
    // prefers-reduced-motion al arrancar (REDUCIDO, index.html:1088) y con
    // "reduce" desactivaría la animación entera. El determinismo lo da
    // __qa.runTo más el guionSemilla, no la desactivación del movimiento.
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
