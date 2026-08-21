import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  // Cada prueba del landing toma 8 capturas (una por fase del recorrido) y
  // cada toHaveScreenshot espera a que el cuadro se estabilice. Los 30 s por
  // defecto se agotan en la séptima.
  timeout: 180_000,
  expect: {
    /**
     * toHaveScreenshot reintenta hasta que dos cuadros seguidos salen iguales,
     * y por defecto se rinde a los 5 s. En una máquina cargada eso caduca sin
     * que haya un solo píxel distinto: se vio como cuatro fallos por
     * "Timeout 5000ms exceeded", ninguno con diferencia de imagen, en una
     * corrida que compartía CPU con otra. Subir la espera no afloja la
     * comparación — la tolerancia de píxeles sigue igual —, sólo evita
     * confundir una máquina ocupada con una regresión.
     */
    timeout: 30_000,
  },
  // Ambos specs resuelven al mismo directorio dorado, para que la corrida de
  // paridad compare contra las capturas del sitio legado y no contra sí misma.
  snapshotPathTemplate: "{testDir}/baseline/{arg}{ext}",
  use: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // Sin reducedMotion aquí: es el valor que necesita el LANDING. El motor
    // lee prefers-reduced-motion al arrancar (REDUCIDO, index.html:1088) y
    // con "reduce" desactivaría la animación entera; su determinismo lo dan
    // __qa.runTo y el guionSemilla. Las páginas satélite hacen justo lo
    // contrario y lo declaran ellas mismas — ver SATELITES en constantes.ts.
  },
  // La suite corre contra una build de producción, no contra `next dev`.
  // El indicador de desarrollo de Next se dibuja encima de la página y sale
  // en las capturas; además el HTML de dev trae nodos que la build no emite.
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
