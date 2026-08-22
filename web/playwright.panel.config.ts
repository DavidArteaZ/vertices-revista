import { defineConfig } from "@playwright/test";

/**
 * Configuración aparte para la suite del panel.
 *
 * No comparte la de paridad visual por dos motivos: aquélla apunta a
 * tests/visual y resuelve capturas doradas, y sobre todo la del panel ESCRIBE
 * en el proyecto real de Supabase. Mezclarlas haría que `npm run visual`
 * —que se corre a menudo— creara y borrara usuarios y envíos de prueba.
 *
 *     npm run build && npm run start   # en otra terminal
 *     npm run panel
 */
export default defineConfig({
  testDir: "./tests/panel",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
