import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // El sitio estático que esto sustituye. Se conserva porque es la
    // referencia con la que se regeneran las imágenes doradas de la compuerta
    // visual, no porque se vaya a tocar: linchar su JavaScript no arregla nada
    // y tentaría a "arreglarlo", que es justo lo que no debe pasarle.
    "legado/**",
  ]),
]);

export default eslintConfig;
