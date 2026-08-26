import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // `server-only` lanza al importarse fuera de un componente de servidor.
      // Es la misma pieza vacía que usa Next cuando sí lo es, así que probar un
      // módulo de servidor no obliga a quitarle el candado.
      "server-only": path.resolve(import.meta.dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
