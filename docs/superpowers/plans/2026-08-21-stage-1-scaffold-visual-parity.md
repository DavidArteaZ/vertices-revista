# Vértices Stage 1 — Scaffold & Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing static Vértices site as a Next.js application that is visually indistinguishable from the original, with no backend.

**Architecture:** A Next.js App Router app lives in `web/` while the legacy static site stays untouched at the repo root, so the original remains deployable and serves as the visual reference. The canvas particle engine is ported verbatim into a framework-agnostic imperative module driven by a thin `"use client"` React host; pure logic (phase math, 3D projection, graph construction, text helpers) is extracted into separately testable modules. Correctness is proven by unit tests on the pure modules plus Playwright screenshot diffs against golden baselines captured from the legacy site.

**Tech Stack:** Next.js (App Router) · TypeScript · Vitest · Playwright · plain CSS (no framework) · Node 26 · npm 11

**Spec:** `docs/superpowers/specs/2026-08-20-vertices-nextjs-supabase-design.md`

## Global Constraints

- **No visual change is acceptable.** Spec §2: *"Preserve the visual design exactly: same fonts, colors, canvas animation, scroll choreography, copy."* Any pixel difference is a defect, not a judgement call.
- **No CSS framework.** The existing CSS is hand-written and must be copied verbatim. Do not introduce Tailwind, CSS modules, or a preprocessor. Do not "tidy" declarations, reorder rules, or rename custom properties.
- **Note the inverted colour names.** `--negro:#E7DECB` is the *background* (cream) and `--crema:#2d232e` is the *ink* (plum). This is deliberate and documented in the source comment at `index.html:24-26`. Do not "fix" it.
- **The canvas engine is ported verbatim.** Spec §4.1. Copy the code; change only module wiring (imports/exports, `document.getElementById` → injected element). Do not refactor into React idioms, do not convert loops, do not rename variables. It is a deliberate, documented exemption from the project's 400-line file limit.
- **`fondo-flujo.js` cannot be ported verbatim.** Spec §4.1: it mutates `document.body.children`, which under Next.js includes framework-injected nodes. It needs a real stacking context. This is the one exception.
- **Spanish is the source language.** No i18n framework in this stage — that is Stage 2. All copy is Spanish, hardcoded, character-for-character identical to the original including accents and `·` separators.
- **No backend.** The submission form, status lookup, and newsletter are UI-only. Wizard navigation and validation work fully; submit does nothing.
- **`window.__qa.runTo(u, seconds)` must survive the port** (spec §4.1). The visual test suite depends on it.
- **Preserve `prefers-reduced-motion` handling** (`REDUCIDO`, `index.html:1088`).

## Deviation from the spec

Spec §16 puts *"Playwright screenshot diffs across all six locales"* in Stage 1,
but the i18n migration is Stage 2 — so in Stage 1 the app has no localization
to diff. Resolved by splitting the two halves:

- **Stage 1 captures golden baselines from the legacy site in all six locales**
  (Task 2) and asserts **Spanish** parity for the new app (Task 16).
- **Stage 2 asserts the remaining five locales against those same baselines**,
  which turns this stage's screenshot suite into the safety net for the riskiest
  part of the i18n migration.

Nothing is dropped; the six-locale assertion moves one stage later, and the
captures that make it possible happen here.

---

## File Structure

```
web/
  package.json                       npm scripts, deps
  tsconfig.json
  next.config.ts                     redirect map
  vitest.config.ts
  playwright.config.ts
  public/fonts/*.woff2               6 files, copied from ../fonts/
  src/
    app/
      layout.tsx                     <html>/<body>, font preloads, metadata
      globals.css                    verbatim CSS from index.html:16-585
      page.tsx                       landing composition
      lineamientos/page.tsx
      lineamientos/lineamientos.css
      quienes-somos/page.tsx
      quienes-somos/quienes-somos.css
      equipo/page.tsx
    components/
      layout/Marco.tsx               fixed header, nav, hamburger panel
      layout/Pie.tsx                 footer incl. newsletter form
      landing/Lienzo.tsx             "use client" canvas host
      landing/Capas.tsx              the four scroll layers
      landing/Riel.tsx               right-edge progress rail
      landing/FichaSeccion.tsx       floating section card
      landing/Carrusel.tsx           featured articles
      landing/PanelArticulos.tsx     discovery side panel
      landing/Convocatoria.tsx       stats + 4 steps
      landing/FormularioEnvio.tsx    4-step wizard, UI only
      landing/EstadoEnvio.tsx        folio lookup, UI only
      satelite/FondoFlujo.tsx        flow-field background
      satelite/Revelar.tsx           scroll reveal
    lib/
      texto.ts                       slug, norm, clamp
      datos/temas.ts                 TOPICS (27)
      datos/secciones.ts             SECTIONS (8) + SEC_EDGES
      datos/articulos.ts             ARTICULOS (26) + tipos
      motor/fases.ts                 PH, ss, phaseParams
      motor/proyeccion.ts            project, edgeCtrl3D, edgePoint3D, targetPoint3D
      motor/grafo.ts                 buildNetwork, buildSections, edgeExtras, makeBeads
      motor/motor.ts                 the imperative engine: crearMotor()
  tests/
    unit/texto.test.ts
    unit/datos.test.ts
    unit/fases.test.ts
    unit/proyeccion.test.ts
    unit/grafo.test.ts
    visual/capturar-baseline.spec.ts
    visual/paridad.spec.ts
    visual/baseline/*.png            committed golden images
```

**Why `web/` and not the repo root:** the legacy site must keep serving as the visual reference throughout this stage and must stay deployable on Netlify until cutover (spec §14). At cutover, Vercel's project *Root Directory* setting is pointed at `web/`.

**Why the engine splits into four modules:** `fases`, `proyeccion`, and `grafo` are pure functions with no canvas or DOM dependency, so they are unit-testable in isolation. What remains in `motor.ts` is the genuinely imperative part — particle state, the RAF loop, and 2D drawing — which is verified by pixel comparison instead. This split is module boundaries only; the code inside is copied unchanged.

---

## Task 1: Scaffold, fonts, and global stylesheet

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/vitest.config.ts`
- Create: `web/src/app/layout.tsx`, `web/src/app/globals.css`, `web/src/app/page.tsx`
- Create: `web/public/fonts/` (6 `.woff2` files)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: a running dev server on `http://localhost:3000`; `npm test` runs Vitest; CSS custom properties `--negro`, `--crema`, `--hueso`, `--texto`, `--gris`, `--gris-osc`, `--indigo`, `--indigo-claro`, `--naranja`, `--ambar`, `--linea`, `--linea-fuerte`, `--vidrio`, `--f-titulo`, `--f-ui`, `--f-sub` available globally

- [ ] **Step 1: Scaffold the app**

Run from the repo root:

```bash
npx create-next-app@latest web \
  --typescript --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm --yes
```

Then move the generated `app/` into `src/`:

```bash
cd web && mkdir -p src && mv app src/app && rm -f src/app/page.module.css src/app/favicon.ico
```

Set `"paths": { "@/*": ["./src/*"] }` in `web/tsconfig.json`.

- [ ] **Step 2: Copy the fonts**

```bash
mkdir -p web/public/fonts && cp fonts/*.woff2 web/public/fonts/
ls web/public/fonts/
```

Expected: `Garet-Book.woff2`, `Garet-Heavy.woff2`, `NeueMontreal-Bold.woff2`, `NeueMontreal-Italic.woff2`, `NeueMontreal-Medium.woff2`, `NeueMontreal-Regular.woff2`

- [ ] **Step 3: Create globals.css**

Copy `index.html` lines 16–585 (everything between `<style>` and `</style>`) verbatim into `web/src/app/globals.css`.

Make exactly one class of change — the six `@font-face` `src` URLs gain a leading slash, because Next serves `public/` from the root:

```css
/* before */  src:url("fonts/NeueMontreal-Regular.woff2") format("woff2");
/* after  */  src:url("/fonts/NeueMontreal-Regular.woff2") format("woff2");
```

Change nothing else. Not whitespace, not property order, not the `--negro`/`--crema` naming.

- [ ] **Step 4: Create the root layout**

```tsx
// web/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg fill='none' stroke='%232d232e' stroke-width='1.6'%3E%3Cpath d='M16 4 L28 26 L4 26 Z'/%3E%3Cpath d='M16 4 L17 18.5 M4 26 L17 18.5 M28 26 L17 18.5' opacity='.55'/%3E%3C/g%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Vértices · Revista académica de economía · Sistema de diseño",
  description:
    "Vértices es la revista académica de economía creada por la comunidad estudiantil de la Licenciatura en Economía del Tec de Monterrey, Campus Ciudad de México. Rigurosa en evidencia y amable en lectura. Explora por tema y sección, y publica tu trabajo.",
  openGraph: {
    title: "Vértices · Revista académica de economía",
    description:
      "El punto donde las ideas se conectan. Explora la revista y publica tu trabajo.",
  },
  icons: { icon: FAVICON },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preload" href="/fonts/NeueMontreal-Medium.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/NeueMontreal-Bold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Garet-Book.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

The three preloads and their order come from `index.html:11-13`.

- [ ] **Step 5: Add Vitest**

```bash
cd web && npm install -D vitest @vitest/coverage-v8
```

```ts
// web/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Add to `web/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 6: Verify the shell renders with the right background**

Replace `web/src/app/page.tsx` with a placeholder:

```tsx
export default function Home() {
  return <h1 className="sr-solo">Vértices</h1>;
}
```

Run: `cd web && npm run dev`
Expected: `http://localhost:3000` renders a cream page (`#E7DECB`). Confirm in DevTools that `getComputedStyle(document.body).backgroundColor` is `rgb(231, 222, 203)` and that `document.fonts.check('16px "Neue Montreal"')` is `true`.

- [ ] **Step 7: Ignore build artefacts**

Append to the repo-root `.gitignore`:

```
web/node_modules/
web/.next/
web/out/
test-results/
playwright-report/
```

- [ ] **Step 8: Commit**

```bash
git add .gitignore web/
git commit -m "feat(web): scaffold Next.js app with verbatim global stylesheet and fonts"
```

---

## Task 2: Golden baseline capture from the legacy site

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/tests/visual/constantes.ts`
- Create: `web/tests/visual/capturar-baseline.spec.ts`
- Create: `web/tests/visual/baseline/` (generated PNGs, committed)

**Interfaces:**
- Consumes: the legacy static site at the repo root
- Produces: `web/tests/visual/baseline/<page>-<locale>-<u>.png`; `constantes.ts` exporting `LOCALES`, `PUNTOS_U`, `SATELITES`, `nombreU(u)` — imported by Task 16

Baselines come from the **legacy** site, not the new app. That makes them a fixed reference the rebuild is measured against, and it lets this stage capture all six locales even though the new app is Spanish-only until Stage 2.

- [ ] **Step 1: Install Playwright**

```bash
cd web && npm install -D @playwright/test && npx playwright install chromium
```

- [ ] **Step 2: Configure Playwright**

```ts
// web/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  // Both specs resolve to the same golden directory, so the parity run in
  // Task 16 compares against the legacy baselines rather than its own output.
  snapshotPathTemplate: "{testDir}/baseline/{arg}{ext}",
  use: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // The engine reads prefers-reduced-motion at startup; keep motion ON so
    // the particle system runs, and rely on __qa.runTo for determinism.
    reducedMotion: "no-preference",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
```

Add to `web/package.json` scripts:
`"baseline": "playwright test capturar-baseline"`, `"visual": "playwright test paridad"`.

- [ ] **Step 3: Extract the shared constants**

These live in a plain module, not in a spec file — importing from a `.spec.ts` would make Playwright register its tests twice.

```ts
// web/tests/visual/constantes.ts
export const LOCALES = ["es", "en", "fr", "it", "pt", "ru"] as const;
export const PUNTOS_U = [0, 0.2, 0.3, 0.48, 0.6, 0.75, 0.9, 1] as const;
export const SATELITES = [
  { ruta: "/lineamientos", legado: "lineamientos.html", nombre: "lineamientos" },
  { ruta: "/quienes-somos", legado: "quienes-somos.html", nombre: "quienes-somos" },
  { ruta: "/equipo", legado: "equipo-ds.html", nombre: "equipo-ds" },
] as const;
export const nombreU = (u: number) => String(u).replace(".", "_");
```

- [ ] **Step 4: Write the capture spec**

The landing page is a scroll animation, so a single screenshot proves nothing. `window.__qa.runTo(u, seconds)` (`index.html:2370-2385`) sets the engine to a deterministic state at scroll fraction `u` by stepping a fixed number of frames — no real scrolling, no timing flake. The chosen `u` values sit at the centre of each phase from `PH` (`index.html:1072-1082`).

```ts
// web/tests/visual/capturar-baseline.spec.ts
import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { LOCALES, PUNTOS_U, SATELITES, nombreU } from "./constantes";

const RAIZ = path.resolve(__dirname, "../../..");
const PUERTO = 4321;
const BASE = `http://127.0.0.1:${PUERTO}`;

let servidor: ChildProcess;

test.beforeAll(async () => {
  servidor = spawn("python3", ["-m", "http.server", String(PUERTO), "--bind", "127.0.0.1", "--directory", RAIZ], { stdio: "ignore" });
  // poll until it answers rather than sleeping a fixed amount
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/index.html`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("legacy server did not start");
});

test.afterAll(() => servidor?.kill());

for (const locale of LOCALES) {
  test(`baseline landing ${locale}`, async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    await page.evaluate((l) => localStorage.setItem("vertices_lang", l), locale);
    await page.reload();
    await page.waitForFunction(() => typeof (window as any).__qa?.runTo === "function");
    await page.evaluate(() => document.fonts.ready);

    for (const u of PUNTOS_U) {
      await page.evaluate((uu) => (window as any).__qa.runTo(uu, 3), u);
      await expect(page.locator("body")).toHaveScreenshot(
        `landing-${locale}-${nombreU(u)}.png`,
        { maxDiffPixelRatio: 0 },
      );
    }
  });
}

for (const locale of LOCALES) {
  for (const { legado, nombre } of SATELITES) {
    test(`baseline ${nombre} ${locale}`, async ({ page }) => {
      await page.goto(`${BASE}/${legado}`);
      await page.evaluate((l) => localStorage.setItem("vertices_lang", l), locale);
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      // reveal-on-scroll: force every element visible so the shot is stable
      await page.evaluate(() => document.querySelectorAll(".rev").forEach((e) => e.classList.add("rev-on")));
      await expect(page).toHaveScreenshot(`${nombre}-${locale}.png`, { fullPage: true, maxDiffPixelRatio: 0 });
    });
  }
}
```

- [ ] **Step 5: Generate the baselines**

Run: `cd web && npx playwright test capturar-baseline --update-snapshots`
Expected: PASS, writing 48 landing images (6 locales × 8 `u` points) and 18 satellite images.

- [ ] **Step 6: Verify the baselines are stable, not flaky**

Run: `cd web && npx playwright test capturar-baseline`
Expected: PASS with zero diffs — the same run against the images it just wrote.

If it fails, the capture is non-deterministic and **must be fixed before proceeding**, or every later comparison is worthless. Likely culprits: fonts not settled (extend the `document.fonts.ready` wait), or a phase whose `u` sits on a boundary where `secLabelTimer`-driven typewriter text is mid-character — nudge that `u` value away from the boundary.

- [ ] **Step 7: Commit**

```bash
git add web/playwright.config.ts web/tests/visual web/package.json
git commit -m "test(web): capture golden visual baselines from the legacy site"
```

---

## Task 3: Text helpers

**Files:**
- Create: `web/src/lib/texto.ts`
- Test: `web/tests/unit/texto.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `slug(txt: string): string`, `norm(s: string): string`, `clamp(v: number, a: number, b: number): number`

Ported from `index.html:1065-1069` (`slug`, `clamp`) and `index.html:1933` (`norm`).

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/unit/texto.test.ts
import { describe, it, expect } from "vitest";
import { slug, norm, clamp } from "@/lib/texto";

describe("slug", () => {
  it("strips accents and lowercases", () => {
    expect(slug("Macroeconomía")).toBe("macroeconomia");
  });
  it("collapses non-alphanumerics to single hyphens", () => {
    expect(slug("IA y Economía")).toBe("ia-y-economia");
  });
  it("trims leading and trailing hyphens", () => {
    expect(slug("¿Sabías Qué?")).toBe("sabias-que");
  });
  it("handles a real article title", () => {
    expect(slug("Nearshoring: ¿la oportunidad que México sí puede capturar?"))
      .toBe("nearshoring-la-oportunidad-que-mexico-si-puede-capturar");
  });
});

describe("norm", () => {
  it("lowercases and strips accents for search", () => {
    expect(norm("Política Monetaria")).toBe("politica monetaria");
  });
});

describe("clamp", () => {
  it("bounds below, above, and passes through", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/texto.test.ts`
Expected: FAIL — `Cannot find module '@/lib/texto'`

- [ ] **Step 3: Implement**

```ts
// web/src/lib/texto.ts
export function slug(txt: string): string {
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const norm = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const clamp = (v: number, a: number, b: number): number =>
  Math.min(b, Math.max(a, v));
```

The original writes the combining-mark range as literal characters inside the source file (`index.html:1066`). Use the escaped `̀-ͯ` form here: it is the identical range, and it survives copy-paste and editor encoding, which the literal form does not.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/texto.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/texto.ts web/tests/unit/texto.test.ts
git commit -m "feat(web): port text helpers with tests"
```

---

## Task 4: Content data modules

**Files:**
- Create: `web/src/lib/datos/temas.ts`, `web/src/lib/datos/secciones.ts`, `web/src/lib/datos/articulos.ts`
- Test: `web/tests/unit/datos.test.ts`

**Interfaces:**
- Consumes: `slug` from Task 3
- Produces:
  - `TOPICS: readonly string[]` (27)
  - `Seccion = { label: string; x: number; y: number; z: number; imp: number; side?: "above" | "below"; desc: string }`
  - `SECTIONS: readonly Seccion[]` (8), `SEC_EDGES: readonly [number, number][]` (12)
  - `Articulo = { t: string; a: string; s: string; tm: string[]; min: number; dest?: boolean }`
  - `ARTICULOS: readonly Articulo[]` (26)

- [ ] **Step 1: Write the failing test**

These are integrity tests, not tautologies — they catch transcription errors during the port and data drift afterwards.

```ts
// web/tests/unit/datos.test.ts
import { describe, it, expect } from "vitest";
import { slug } from "@/lib/texto";
import { TOPICS } from "@/lib/datos/temas";
import { SECTIONS, SEC_EDGES } from "@/lib/datos/secciones";
import { ARTICULOS } from "@/lib/datos/articulos";

describe("temas", () => {
  it("has the 27 topics the site advertises", () => {
    expect(TOPICS).toHaveLength(27);          // index.html:702 renders "27"
    expect(new Set(TOPICS).size).toBe(27);
  });
});

describe("secciones", () => {
  it("has the 8 sections the site advertises", () => {
    expect(SECTIONS).toHaveLength(8);         // index.html:703 renders "8"
  });
  it("gives every section a non-empty description for the hover card", () => {
    for (const s of SECTIONS) expect(s.desc.length).toBeGreaterThan(0);
  });
  it("references only real section indices in its edges", () => {
    for (const [i, j] of SEC_EDGES) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThan(SECTIONS.length);
      expect(i).not.toBe(j);
    }
  });
  it("marks Miradas Económicas as the dominant node", () => {
    const imps = SECTIONS.map((s) => s.imp);
    const miradas = SECTIONS.find((s) => s.label === "Miradas Económicas")!;
    expect(miradas.imp).toBe(Math.max(...imps));
  });
});

describe("articulos", () => {
  it("has 26 articles, 9 of them featured", () => {
    expect(ARTICULOS).toHaveLength(26);
    expect(ARTICULOS.filter((a) => a.dest)).toHaveLength(9);
  });
  it("produces a distinct slug per article — the panel and carousel link by slug", () => {
    const slugs = ARTICULOS.map((a) => slug(a.t));
    expect(new Set(slugs).size).toBe(ARTICULOS.length);
  });
  it("assigns every article to a real section", () => {
    const etiquetas = new Set(SECTIONS.map((s) => s.label));
    for (const a of ARTICULOS) expect(etiquetas).toContain(a.s);
  });
  it("tags every article with real topics only", () => {
    const temas = new Set(TOPICS);
    for (const a of ARTICULOS) for (const t of a.tm) expect(temas).toContain(t);
  });
  it("gives every article a positive read time", () => {
    for (const a of ARTICULOS) expect(a.min).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/datos.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Port the data**

Copy verbatim, adding only TypeScript types and `export`:

- `web/src/lib/datos/temas.ts` ← `index.html:996-1007` (the `TOPICS` array)
- `web/src/lib/datos/secciones.ts` ← `index.html:1010-1033` (`SECTIONS` and `SEC_EDGES`)
- `web/src/lib/datos/articulos.ts` ← `index.html:1036-1063` (`ARTICULOS`)

```ts
// web/src/lib/datos/secciones.ts — shape reference; copy the 8 real entries
export type Seccion = {
  label: string; x: number; y: number; z: number; imp: number;
  side?: "above" | "below"; desc: string;
};

export const SECTIONS: readonly Seccion[] = [
  { label: "Apertura Editorial", x: -1.48, y: 0.06, z: 0.12, imp: 1.35,
    desc: "La carta que abre cada número: qué encontrarás, por qué existe la revista y el estándar de rigor que la sostiene." },
  // ... the remaining 7, copied exactly from index.html:1013-1026
];

export const SEC_EDGES: readonly [number, number][] = [
  [0, 1], [0, 2], [1, 2],
  [1, 3], [2, 3],
  [3, 4], [3, 5], [4, 5],
  [4, 6], [5, 7], [6, 7], [4, 7],
];
```

Keep the source comment from `index.html:1035` on `ARTICULOS` — it records that this corpus is placeholder data, which spec §5.5 relies on.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run`
Expected: PASS — including the cross-module slug-uniqueness test from Task 3

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/datos web/tests/unit/datos.test.ts
git commit -m "feat(web): port content data with integrity tests"
```

---

## Task 5: Phase math

**Files:**
- Create: `web/src/lib/motor/fases.ts`
- Test: `web/tests/unit/fases.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `PH` (the nine phase boundaries), `ss(a: number, b: number, x: number): number`, `type Fase`, `phaseParams(u: number): Fase`

`Fase` fields, all `number` except `snap: boolean`: `jitter`, `burst`, `flow`, `attractWord`, `attractNet`, `attractSec`, `netAmp`, `secAmp`, `fieldAmp`, `snap`, `textAlpha`.

Ported from `index.html:1072-1082` (`PH`), `1454-1457` (`ss`), `1459-1495` (`phaseParams`).

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/unit/fases.test.ts
import { describe, it, expect } from "vitest";
import { PH, ss, phaseParams } from "@/lib/motor/fases";

describe("ss (smoothstep)", () => {
  it("clamps outside the range and eases inside it", () => {
    expect(ss(0, 1, -1)).toBe(0);
    expect(ss(0, 1, 2)).toBe(1);
    expect(ss(0, 1, 0.5)).toBe(0.5);
    expect(ss(0, 1, 0.25)).toBeCloseTo(0.15625, 5);
  });
});

describe("phaseParams", () => {
  it("snaps the wordmark at the very start and the very end", () => {
    for (const u of [0, 1]) {
      const p = phaseParams(u);
      expect(p.snap).toBe(true);
      expect(p.attractWord).toBe(1);
      expect(p.textAlpha).toBe(1);
    }
  });
  it("shows the topic network in the net phase and nothing else", () => {
    const p = phaseParams((PH.toNetEnd + PH.netEnd) / 2);
    expect(p.netAmp).toBe(1);
    expect(p.attractNet).toBe(1);
    expect(p.secAmp).toBe(0);
  });
  it("shows the section map in the sec phase and nothing else", () => {
    const p = phaseParams((PH.toSecEnd + PH.secEnd) / 2);
    expect(p.secAmp).toBe(1);
    expect(p.attractSec).toBe(1);
    expect(p.netAmp).toBe(0);
  });
  it("crossfades net into sec without ever showing both at full strength", () => {
    for (let u = PH.netEnd; u <= PH.toSecEnd; u += 0.005) {
      const p = phaseParams(u);
      expect(p.netAmp + p.secAmp).toBeLessThanOrEqual(1.0001);
    }
  });
  it("keeps every amplitude within [0,1] across the whole journey", () => {
    for (let u = 0; u <= 1; u += 0.002) {
      const p = phaseParams(u);
      for (const k of ["jitter","burst","flow","attractWord","attractNet","attractSec","netAmp","secAmp","fieldAmp","textAlpha"] as const) {
        expect(p[k], `${k} at u=${u.toFixed(3)}`).toBeGreaterThanOrEqual(0);
        expect(p[k], `${k} at u=${u.toFixed(3)}`).toBeLessThanOrEqual(1);
      }
    }
  });
  it("dissolves the wordmark text before the network appears", () => {
    expect(phaseParams(PH.dissolveEnd).textAlpha).toBe(0);
    expect(phaseParams(PH.fieldEnd).textAlpha).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/fases.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Copy `PH`, `ss`, and `phaseParams` verbatim from the line ranges above. Add the `Fase` type and `export` keywords. Change nothing about the arithmetic or the branch order.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/fases.test.ts`
Expected: PASS

If the `[0,1]` bound test fails, do **not** clamp the value to make it pass — the port has a transcription error. Find it.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/motor/fases.ts web/tests/unit/fases.test.ts
git commit -m "feat(web): port scroll phase math with boundary tests"
```

---

## Task 6: 3D projection

**Files:**
- Create: `web/src/lib/motor/proyeccion.ts`
- Test: `web/tests/unit/proyeccion.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Punto3D = { x: number; y: number; z: number }`
  - `type Vista = { W: number; H: number; tcs: number; tsn: number }`
  - `TILT = 0.38`
  - `project(pt: Punto3D, ang: number, vista: Vista, xs?: number, yOff?: number, esc?: number, xOff?: number): { x: number; y: number; s: number }`
  - `targetPoint3D`, `edgeCtrl3D`, `edgePoint3D`

Ported from `index.html:1318-1364`. The original reads module-level `W`, `H`, `tcs`, `tsn` as globals; here they are passed in as a `Vista` so the function is pure and testable. That is the only change.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/unit/proyeccion.test.ts
import { describe, it, expect } from "vitest";
import { project, edgePoint3D, TILT, type Vista } from "@/lib/motor/proyeccion";

const vista: Vista = { W: 1440, H: 900, tcs: Math.cos(TILT), tsn: Math.sin(TILT) };

describe("project", () => {
  it("puts the origin at the viewport centre", () => {
    const q = project({ x: 0, y: 0, z: 0 }, 0, vista);
    expect(q.x).toBeCloseTo(720, 6);
    expect(q.y).toBeCloseTo(450, 6);
    expect(q.s).toBeCloseTo(1, 6);
  });
  it("shrinks points that are further away", () => {
    const cerca = project({ x: 0, y: 0, z: -0.5 }, 0, vista);
    const lejos = project({ x: 0, y: 0, z: 0.5 }, 0, vista);
    expect(cerca.s).toBeGreaterThan(lejos.s);
  });
  it("returns to the same screen point after a full rotation", () => {
    const p = { x: 0.8, y: -0.3, z: 0.4 };
    const a = project(p, 0.7, vista);
    const b = project(p, 0.7 + Math.PI * 2, vista);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });
  it("applies xOff and yOff as literal pixel offsets", () => {
    const base = project({ x: 0, y: 0, z: 0 }, 0, vista);
    const movido = project({ x: 0, y: 0, z: 0 }, 0, vista, 1, 40, 1, 60);
    expect(movido.x - base.x).toBeCloseTo(60, 6);
    expect(movido.y - base.y).toBeCloseTo(40, 6);
  });
  it("compresses horizontally when xs < 1", () => {
    const ancho = project({ x: 1, y: 0, z: 0 }, 0, vista, 1);
    const angosto = project({ x: 1, y: 0, z: 0 }, 0, vista, 0.5);
    expect(Math.abs(angosto.x - 720)).toBeLessThan(Math.abs(ancho.x - 720));
  });
});

describe("edgePoint3D", () => {
  const g = { nodes: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] };
  const e = { i: 0, j: 1, px: 0, py: 1, pz: 0, bow: 0, ph: 0 };

  it("starts at node i and ends at node j", () => {
    expect(edgePoint3D(g, e, 0, 0).x).toBeCloseTo(0, 6);
    expect(edgePoint3D(g, e, 1, 0).x).toBeCloseTo(1, 6);
  });
  it("passes through the midpoint when the bow is zero", () => {
    const m = edgePoint3D(g, e, 0.5, 0);
    expect(m.x).toBeCloseTo(0.5, 6);
    expect(m.y).toBeCloseTo(0, 6);
  });
  it("bulges along the perpendicular when the bow is non-zero", () => {
    const m = edgePoint3D(g, { ...e, bow: 0.2 }, 0.5, 0);
    expect(m.y).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/proyeccion.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Copy `targetPoint3D`, `edgeCtrl3D`, `edgePoint3D`, `TILT`, and `project` from `index.html:1318-1364`. In `project`, replace the four globals with `vista.W`, `vista.H`, `vista.tcs`, `vista.tsn`. Keep the perspective constant `2.3` and the radius factor `0.38` exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/proyeccion.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/motor/proyeccion.ts web/tests/unit/proyeccion.test.ts
git commit -m "feat(web): port 3D projection as a pure function with tests"
```

---

## Task 7: Graph construction

**Files:**
- Create: `web/src/lib/motor/grafo.ts`
- Test: `web/tests/unit/grafo.test.ts`

**Interfaces:**
- Consumes: `TOPICS`, `SECTIONS`, `SEC_EDGES` (Task 4)
- Produces:
  - `type Nodo = Punto3D & { imp: number; colIdx: number; label: string; label0: string; desc?: string; desc0?: string; side?: "above" | "below" }`
  - `type Arista = { i: number; j: number; px: number; py: number; pz: number; bow: number; ph: number; beads: { t: number; r: number }[]; pulse: boolean; pulseOff: number; pulseSpeed: number; pulseTinte: number }`
  - `type Grafo = { nodes: Nodo[]; edges: Arista[] }`
  - `buildNetwork(): Grafo`, `buildSections(): Grafo`, `edgeExtras`, `makeBeads`, `gauss`
  - `PALETA_NODOS`, `PALETA_CSS`, `TINTES`, `TINTE_CSS`, `pickTinte`

Ported from `index.html:1116-1136` (palettes), `1233-1250` (`makeBeads`, `edgeExtras`), `1252-1316` (`buildNetwork`, `buildSections`), `1437-1439` (`gauss`).

These use `Math.random()`, so tests assert **invariants**, not fixed values.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/unit/grafo.test.ts
import { describe, it, expect } from "vitest";
import { buildNetwork, buildSections, PALETA_NODOS, PALETA_CSS } from "@/lib/motor/grafo";
import { TOPICS } from "@/lib/datos/temas";
import { SECTIONS, SEC_EDGES } from "@/lib/datos/secciones";

describe("buildNetwork", () => {
  it("creates exactly one node per topic", () => {
    expect(buildNetwork().nodes).toHaveLength(TOPICS.length);
  });
  it("labels nodes with the topic names in order", () => {
    const g = buildNetwork();
    expect(g.nodes.map((n) => n.label0)).toEqual([...TOPICS]);
  });
  it("keeps nodes apart — the placement loop enforces a minimum separation", () => {
    const { nodes } = buildNetwork();
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const d2 = (nodes[i].x - nodes[j].x) ** 2 + (nodes[i].y - nodes[j].y) ** 2 + (nodes[i].z - nodes[j].z) ** 2;
        expect(d2).toBeGreaterThanOrEqual(0.24);
      }
  });
  it("leaves no node isolated", () => {
    const g = buildNetwork();
    const grado = new Array(g.nodes.length).fill(0);
    for (const e of g.edges) { grado[e.i]++; grado[e.j]++; }
    for (let i = 0; i < grado.length; i++) expect(grado[i], `nodo ${i}`).toBeGreaterThan(0);
  });
  it("emits no self-edges and no duplicate edges", () => {
    const g = buildNetwork();
    const vistas = new Set<string>();
    for (const e of g.edges) {
      expect(e.i).not.toBe(e.j);
      const k = [e.i, e.j].sort((a, b) => a - b).join(",");
      expect(vistas.has(k)).toBe(false);
      vistas.add(k);
    }
  });
  it("gives every node a colour index inside the palette", () => {
    for (const n of buildNetwork().nodes) {
      expect(n.colIdx).toBeGreaterThanOrEqual(0);
      expect(n.colIdx).toBeLessThan(PALETA_NODOS.length);
    }
  });
  it("puts at least one bead on every edge", () => {
    for (const e of buildNetwork().edges) expect(e.beads.length).toBeGreaterThan(0);
  });
});

describe("buildSections", () => {
  it("creates one node per section and keeps the hand-placed edges", () => {
    const g = buildSections();
    expect(g.nodes).toHaveLength(SECTIONS.length);
    expect(g.edges).toHaveLength(SEC_EDGES.length);
  });
  it("flattens the map vertically to read as a panoramic strip", () => {
    const g = buildSections();
    g.nodes.forEach((n, i) => expect(n.y).toBeCloseTo(SECTIONS[i].y * 0.62, 6));
  });
  it("carries the description through for the hover card", () => {
    for (const n of buildSections().nodes) expect(n.desc0!.length).toBeGreaterThan(0);
  });
  it("pulses every section edge", () => {
    for (const e of buildSections().edges) expect(e.pulse).toBe(true);
  });
});

describe("palettes", () => {
  it("keeps the rgb and css palettes in step", () => {
    expect(PALETA_CSS).toHaveLength(PALETA_NODOS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/grafo.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Copy the listed ranges verbatim. Replace the `TR(...)` calls in `buildNetwork` and `buildSections` (`index.html:1261`, `1302`) with the identity — there is no translation layer in this stage, and `label`/`desc` simply equal `label0`/`desc0`. Leave the `label0`/`desc0` fields in place; Stage 2 needs them.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/grafo.test.ts`
Expected: PASS. Run it three times — these are randomised builders and a flaky invariant is a real bug.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/motor/grafo.ts web/tests/unit/grafo.test.ts
git commit -m "feat(web): port graph construction with invariant tests"
```

---

## Task 8: The particle engine

**Files:**
- Create: `web/src/lib/motor/motor.ts`

**Interfaces:**
- Consumes: `fases`, `proyeccion`, `grafo`, `datos`, `texto`
- Produces:

```ts
export type MotorOpciones = {
  canvas: HTMLCanvasElement;
  recorrido: HTMLElement;           // the 680vh spacer
  capas: { hero: HTMLElement; temas: HTMLElement; secciones: HTMLElement; cierre: HTMLElement };
  velo: HTMLElement;
  ficha: { raiz: HTMLElement; nombre: HTMLElement; desc: HTMLElement };
  rielBotones: HTMLElement[];
  alAbrirPanel: (tipo: "tema" | "seccion", label: string) => void;
};
export type Motor = { destruir: () => void };
export function crearMotor(o: MotorOpciones): Motor;
```

This is the verbatim port. Everything from `index.html:1084-1921` and `2352-2386` moves here, wrapped in `crearMotor`.

- [ ] **Step 1: Port the module body**

Copy these ranges into the body of `crearMotor`, in this order:

| From `index.html` | What |
|---|---|
| 1084-1114 | engine state (`W`, `H`, `word`, `field`, `sprites`, `bg`, `layout`, `net`, `sec`, `uSmooth`, `mx`, `my`, `yaw`, `hover`, drag state, `angNet`, `angSec`) |
| 1138-1187 | `makeSprites`, `makeBg` |
| 1189-1231 | `sampleTextPoints`, `flowAngle` |
| 1366-1382 | `netEsc`, `netXOff`, `netYOff`, `secXS`, `secYOff`, `ROT_SPEED`, `secAng`, `buckets` |
| 1384-1452 | `buildParticles`, `resize` |
| 1497-1594 | `update` |
| 1596-1803 | `drawNet`, `render` |
| 1805-1860 | scroll sync: `limiteRecorrido`, `scrollU`, `veloT`, `setCapa`, `syncUI` |
| 1862-1878 | `frame` |
| 1880-1921 | `pickAt` and the pointer/click listeners |
| 2352-2357 | `__alCambiarIdioma` hook — keep it; Stage 2 needs it |
| 2359-2386 | startup and the `__qa` hook |

Required changes, and no others:

1. **Element access.** Replace every `document.getElementById(...)` with the corresponding field from `o`. The originals are at `1085` (canvas), `1807-1816` (`recorrido`, `velo`, the four `capa`s, `ficha`, `fsNombre`, `fsDesc`, `rielBotones`).
2. **Imports.** `phaseParams`, `ss`, `PH` from `./fases`; `project`, `edgeCtrl3D`, `edgePoint3D`, `targetPoint3D`, `TILT` from `./proyeccion`; `buildNetwork`, `buildSections`, `gauss`, `pickTinte`, `TINTE_CSS`, `PALETA_CSS`, `PALETA_NODOS` from `./grafo`; `clamp` from `../texto`; `SECTIONS` from `../datos/secciones`.
3. **`project` calls take `vista`.** Every call site passes `{ W, H, tcs, tsn }` as the third argument. There are call sites at `1537`, `1544`, `1603-1606`, `1626`, `1634`, `1643`, `1889`.
4. **`TR` becomes the identity.** No translation in this stage.
5. **`abrirPanel(h.tipo, h.label)` at `1920` becomes `o.alAbrirPanel(h.tipo, h.label)`.**
6. **Add teardown.** Collect every `addEventListener` and the `requestAnimationFrame` handle; `destruir()` removes all listeners and cancels the frame. The original never unmounts — React does. Capture the RAF id:

```ts
let rafId = 0;
function frame(now: number) {
  /* ...body copied verbatim... */
  rafId = requestAnimationFrame(frame);
}
```

7. **Guard `window`/`document` access.** The module must not touch either at import time; everything lives inside `crearMotor`.

- [ ] **Step 2: Verify it type-checks**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

Fix type errors by adding annotations only. If a fix requires changing runtime behaviour, the port is wrong — re-read the original.

- [ ] **Step 3: Verify no test regressed**

Run: `cd web && npm test`
Expected: PASS — Tasks 3–7 unaffected.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/motor/motor.ts
git commit -m "feat(web): port the canvas particle engine verbatim into a mountable module"
```

---

## Task 9: Canvas host and scroll layers

**Files:**
- Create: `web/src/components/landing/Lienzo.tsx`, `Capas.tsx`, `Riel.tsx`, `FichaSeccion.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: `crearMotor` (Task 8)
- Produces: `<Lienzo onAbrirPanel={(tipo, label) => void} />` — renders the canvas, the four `.capa` layers, the vignette, the veil, the grain, the `#recorrido` spacer, the rail, and the section card, and owns the engine lifecycle

- [ ] **Step 1: Write the component**

```tsx
// web/src/components/landing/Lienzo.tsx
"use client";
import { useEffect, useRef } from "react";
import { crearMotor, type Motor } from "@/lib/motor/motor";

export default function Lienzo({
  onAbrirPanel,
}: { onAbrirPanel: (tipo: "tema" | "seccion", label: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const recorrido = useRef<HTMLDivElement>(null);
  const velo = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const temas = useRef<HTMLDivElement>(null);
  const secciones = useRef<HTMLDivElement>(null);
  const cierre = useRef<HTMLDivElement>(null);
  const ficha = useRef<HTMLDivElement>(null);
  const fsNombre = useRef<HTMLHeadingElement>(null);
  const fsDesc = useRef<HTMLParagraphElement>(null);
  const riel = useRef<HTMLElement>(null);
  const abrir = useRef(onAbrirPanel);
  abrir.current = onAbrirPanel;

  useEffect(() => {
    let motor: Motor | undefined;
    // fonts drive sampleTextPoints; mounting before they load samples the fallback face
    document.fonts.ready.then(() => {
      if (!canvas.current) return;
      motor = crearMotor({
        canvas: canvas.current,
        recorrido: recorrido.current!,
        capas: { hero: hero.current!, temas: temas.current!, secciones: secciones.current!, cierre: cierre.current! },
        velo: velo.current!,
        ficha: { raiz: ficha.current!, nombre: fsNombre.current!, desc: fsDesc.current! },
        rielBotones: Array.from(riel.current!.querySelectorAll("button")),
        alAbrirPanel: (t, l) => abrir.current(t, l),
      });
    });
    return () => motor?.destruir();
  }, []);

  return (/* markup below */);
}
```

The returned markup is `index.html:592-594` (canvas, vineta, velo), `622-692` (riel, the four `.capa` blocks, `#fichaSeccion`, `#recorrido`), and the `.grano` div, copied verbatim with `class` → `className` and the refs attached. Keep every `id`, since `globals.css` selects on `#velo`, `#recorrido`, `#fichaSeccion`, and `#c`.

**`document.fonts.ready` before mounting is not optional.** `sampleTextPoints` rasterises "Vértices" to derive every particle position (`index.html:1189-1223`); sampling before Neue Montreal loads produces a wordmark built from the fallback face. The original works around this at `index.html:2365-2367` by rebuilding after fonts settle; mounting late is cleaner and gives the same result.

- [ ] **Step 2: Compose the page**

`web/src/app/page.tsx` renders `<Marco />`, `<Lienzo />`, `<main id="portal">`, `<Pie />`, and the panel. For this task, stub the portal and panel with empty elements; Tasks 10–13 fill them.

- [ ] **Step 3: Verify the engine runs and cleans up**

Run: `cd web && npm run dev`, open `http://localhost:3000`, and in the console:

```js
window.__qa.runTo(0, 3)      // wordmark formed, subtitle right-aligned under it
window.__qa.runTo(0.48, 3)   // topic constellation, 27 labelled nodes
window.__qa.runTo(0.75, 3)   // section map, 8 labels typing in
window.__qa.runTo(1, 3)      // wordmark reformed
```

Then confirm teardown: navigate to `/lineamientos` and back, run `window.__qa.runTo(0.48, 3)` again. Expected: still one animation loop, no duplicated listeners, no console errors. A doubled or accelerating animation means `destruir()` is incomplete.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/landing web/src/app/page.tsx
git commit -m "feat(web): mount the particle engine in a client component with teardown"
```

---

## Task 10: Header, navigation, and footer

**Files:**
- Create: `web/src/components/layout/Marco.tsx`, `web/src/components/layout/Pie.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `<Marco />`, `<Pie />`

- [ ] **Step 1: Port the header**

Markup from `index.html:597-620`. The hamburger behaviour is `index.html:2389-2400` — a `"use client"` component holding one `abierto` boolean that toggles the `abierto` class on `<nav>`, closes on outside click, and closes when a panel link is clicked. Keep `aria-expanded` in sync.

Links point at App Router paths: `quienes-somos.html` → `/quienes-somos`, `equipo-ds.html` → `/equipo`, `lineamientos.html` → `/lineamientos`. In-page anchors (`#temas`, `#secciones`, `#convocatoria`, `#estado`) and the `data-u` / `data-ir` attributes stay exactly as they are — the engine's delegated click handler (`index.html:2014-2021`) reads them.

- [ ] **Step 2: Port the footer**

Markup from `index.html:914-959`, including the newsletter form. Behaviour from `index.html:2269-2274`: on submit, validate the email against `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` and replace the form with `<p style="color:var(--crema)">Listo, recibirás la próxima edición en tu correo.</p>`. It sends nothing — that is the current behaviour and this stage preserves it.

- [ ] **Step 3: Verify against the original**

With both servers running, compare the header and footer at 1440px and at 640px. Check specifically that `Acerca de` and `Conoce al equipo` move from the bar into the hamburger panel below 940px (`globals.css`, the `.solo-angosto` rules from `index.html:579-585`), and that `.marca span` disappears below 560px.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/layout
git commit -m "feat(web): port fixed header, hamburger nav and footer"
```

---

## Task 11: Convocatoria, carousel, and discovery panel

**Files:**
- Create: `web/src/components/landing/Convocatoria.tsx`, `Carrusel.tsx`, `PanelArticulos.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: `ARTICULOS`, `TOPICS`, `SECTIONS`, `slug`, `norm`
- Produces: `<Convocatoria />`, `<Carrusel />`, `<PanelArticulos abierto tipo valor desdeIndice onCerrar onNavegar />`

- [ ] **Step 1: Port Convocatoria**

Static markup from `index.html:697-712` — the `27 / 8 / 4` figures and the four `.pasos` steps. Server component; no client JS.

- [ ] **Step 2: Port the carousel**

Markup `index.html:662-671`, behaviour `index.html:2025-2035`. Renders `ARTICULOS.filter(a => a.dest)` (9 cards) as `.tarjeta` anchors to `#articulo-${slug(a.t)}`. Arrows call `scrollBy({ left: ±320, behavior: "smooth" })`.

Those anchors resolve to nothing. That is correct for this stage — it matches the original exactly (`index.html:2027`), and spec §5.5 handles real article pages in Stage 6.

- [ ] **Step 3: Port the discovery panel**

Markup `index.html:965-981`, behaviour `index.html:1935-2004`. Three modes: `tema`, `seccion`, `indice`.

Convert to React state rather than `innerHTML`. The behaviour to preserve exactly:

- `articulosDe(tipo, valor)` filters by `a.tm.includes(valor)` for topics and `a.s === valor` for sections
- the search box filters on `norm(a.t + " " + a.a).includes(norm(filtro))`
- the meta line reads `"1 artículo"` or `"{n} artículos"`; in index mode, `"{n} de {m} temas"`
- index mode lists all 27 topics with per-topic counts, each row `"1 artículo"` or `"N artículos"`
- clicking an index row opens that topic with `desdeIndice = true`, which shows `← Regresar al índice`
- the empty state is the two-paragraph block from `index.html:1966-1969`, interpolating the topic or section name
- Escape and the backdrop close it; opening focuses the search box with `preventScroll: true`
- opening toggles `panel-abierto` on `document.body` — `globals.css` drives the slide-in from that class

- [ ] **Step 4: Verify against the original**

Side by side, confirm: `Ver índice completo` lists 27 topics; `Teoría de Juegos` shows 1 article; `Miradas Económicas` shows 11; typing `mexico` matches `México` in titles; a topic with no articles shows the empty state; `Excelencia en Acción` shows 1.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/landing web/src/app/page.tsx
git commit -m "feat(web): port convocatoria, featured carousel and discovery panel"
```

---

## Task 12: Submission wizard (UI only)

**Files:**
- Create: `web/src/components/landing/FormularioEnvio.tsx`
- Test: `web/tests/unit/validacion.test.ts`
- Create: `web/src/lib/validacion.ts`

**Interfaces:**
- Consumes: `SECTIONS`, `TOPICS`
- Produces: `validarPaso(paso: number, datos: DatosEnvio, archivos: File[]): string | null`, `<FormularioEnvio />`

Validation is extracted into a pure module because Stage 4 reuses it server-side. Extraction is the only change; the rules are identical.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/unit/validacion.test.ts
import { describe, it, expect } from "vitest";
import { validarPaso, vacio, type DatosEnvio } from "@/lib/validacion";

const palabras = (n: number) => Array(n).fill("palabra").join(" ");
const paso0: DatosEnvio = { ...vacio, nombre: "Ana Herrera", correo: "a@b.mx", perfil: "Científico(a) de datos", afiliacion: "Tec CCM" };

describe("paso 0 — autoría", () => {
  it("requires a name", () => expect(validarPaso(0, { ...paso0, nombre: "" }, [])).toBe("Escribe tu nombre completo."));
  it("rejects a malformed email", () => expect(validarPaso(0, { ...paso0, correo: "no-es-correo" }, [])).toBe("Escribe un correo de contacto válido."));
  it("requires a profile", () => expect(validarPaso(0, { ...paso0, perfil: "" }, [])).toBe("Elige tu perfil de autor."));
  it("requires an affiliation", () => expect(validarPaso(0, { ...paso0, afiliacion: "" }, [])).toBe("Indica tu institución o afiliación."));
  it("passes when complete", () => expect(validarPaso(0, paso0, [])).toBeNull();
});

const paso1: DatosEnvio = { ...paso0, titulo: "T", formato: "Cápsula breve", seccion: "Datanomics", tema: "Fintech", resumen: palabras(150), claves: "a, b, c" };

describe("paso 1 — manuscrito", () => {
  it("rejects a summary under 100 words, reporting the count", () =>
    expect(validarPaso(1, { ...paso1, resumen: palabras(99) }, [])).toBe("El resumen lleva 99 palabras; se piden al menos 100."));
  it("accepts exactly 100 words", () => expect(validarPaso(1, { ...paso1, resumen: palabras(100) }, [])).toBeNull());
  it("accepts exactly 300 words", () => expect(validarPaso(1, { ...paso1, resumen: palabras(300) }, [])).toBeNull());
  it("rejects 301 words", () =>
    expect(validarPaso(1, { ...paso1, resumen: palabras(301) }, [])).toBe("El resumen lleva 301 palabras; el máximo es 300."));
  it("rejects fewer than 3 keywords", () =>
    expect(validarPaso(1, { ...paso1, claves: "a, b" }, [])).toBe("Escribe de 3 a 5 palabras clave separadas por comas."));
  it("rejects more than 5 keywords", () =>
    expect(validarPaso(1, { ...paso1, claves: "a,b,c,d,e,f" }, [])).toBe("Escribe de 3 a 5 palabras clave separadas por comas."));
  it("ignores trailing separators when counting keywords", () =>
    expect(validarPaso(1, { ...paso1, claves: "a, b, c," }, [])).toBeNull());
});

describe("paso 2 — archivos", () => {
  it("requires at least one file", () => expect(validarPaso(2, paso1, [])).toBe("Adjunta tu manuscrito en .docx o .pdf."));
  it("passes with one", () => expect(validarPaso(2, paso1, [new File([""], "m.pdf")])).toBeNull());
});

describe("paso 3 — declaración", () => {
  const listo: DatosEnvio = { ...paso1, usoIA: "No", d1: true, d2: true, d3: true, d4: true };
  it("requires the AI declaration", () =>
    expect(validarPaso(3, { ...listo, usoIA: "" }, [])).toBe("Indica si usaste herramientas de inteligencia artificial."));
  it("requires all four checkboxes", () =>
    expect(validarPaso(3, { ...listo, d3: false }, [])).toBe("Confirma las cuatro declaraciones para poder enviar."));
  it("passes when all four are checked", () => expect(validarPaso(3, listo, [])).toBeNull());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/validacion.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the validator**

Port `validarPaso` from `index.html:2070-2097`, reading from a `DatosEnvio` object instead of `document.getElementById`. Keep every message string character-for-character, including the `{n}` interpolation pattern. Export `vacio` as an all-empty `DatosEnvio`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/validacion.test.ts`
Expected: PASS

- [ ] **Step 5: Build the wizard component**

Markup from `index.html:717-863`. Behaviour from `index.html:2037-2265`, minus the network call:

- four `fieldset.paso`, one active at a time; `.wiz-pasos` shows `activo` and `hecho`
- a completed step in the stepper is clickable
- `Continuar` becomes `Enviar manuscrito` on step 4
- `Regresar` disabled on step 1
- the sección select is populated from `SECTIONS` plus `"Aún no lo decido"`; tema from `TOPICS` plus `"Otro tema"` (`index.html:2050-2055`)
- live word counter: `"{n} palabra · se piden entre 100 y 300"` singular, `"{n} palabras · …"` plural
- drag-and-drop: accept `.pdf/.doc/.docx` only, reject >20 MB with `"«{a}» pesa más de 20 MB."`, dedupe on name+size, removable rows showing `KB`/`MB` via the `pesoTexto` rule at `index.html:2228-2230`
- on submit, show the `#confirmacion` block with `folio` set to the literal `VTX-2026-000`, and a visible note that submission is not yet wired up

**Do not port the fallback that fabricates a folio** (`index.html:2172-2175`). It is spec §1.1 defect 3 and it is being deleted, not carried over.

- [ ] **Step 6: Verify against the original**

Walk both wizards side by side through every validation message. Confirm the counter updates per keystroke and that the file list renders identically.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/validacion.ts web/tests/unit/validacion.test.ts web/src/components/landing/FormularioEnvio.tsx
git commit -m "feat(web): port submission wizard with extracted, tested validation"
```

---

## Task 13: Sidebar, status block, and portal assembly

**Files:**
- Create: `web/src/components/landing/EstadoEnvio.tsx`, `web/src/components/landing/Lateral.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `<EstadoEnvio />`, `<Lateral />`; a complete landing page

- [ ] **Step 1: Port the sidebar**

`index.html:866-898` — the six author guidelines and the four FAQ `<details>`. Static; server component.

- [ ] **Step 2: Port the status block**

Markup `index.html:900-909`. Validation only, from `index.html:2298-2313`:

- folio must match `/^VTX-\d{4}-\d{1,4}$/`, else `"Escribe tu folio completo, por ejemplo VTX-2026-001."`
- email must match the standard regex, else `"Escribe el correo con el que registraste tu pieza."`
- when both are valid, show `"Consultando…"` and stop

No lookup — Stage 4 wires it. Note for the Stage 4 implementer: the folio regex is correct and the *workbook* is what disagrees (spec §1.1 defect 1); do not relax it here.

- [ ] **Step 3: Assemble the portal**

`page.tsx` composes: `<Marco />`, `<Lienzo />`, then `<main id="portal">` containing `<Convocatoria />` and the `#envio` section with the `.tablero` grid (`<FormularioEnvio />`, `<Lateral />`, `<EstadoEnvio />`), then `<Pie />`, then `<PanelArticulos />` and its backdrop. Add the `<noscript>` block from `index.html:983` and the `sr-solo` `<h1>` from `index.html:590`.

- [ ] **Step 4: Verify the full page**

Scroll both sites end to end at 1440px. Check the portal enters under the blur veil at the same point and that the `.tablero` grid collapses to one column below 980px.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/landing web/src/app/page.tsx
git commit -m "feat(web): complete the landing portal with sidebar and status block"
```

---

## Task 14: Satellite pages

**Files:**
- Create: `web/src/app/lineamientos/page.tsx` + `lineamientos.css`
- Create: `web/src/app/quienes-somos/page.tsx` + `quienes-somos.css`
- Create: `web/src/app/equipo/page.tsx`
- Create: `web/src/components/satelite/FondoFlujo.tsx`, `Revelar.tsx`

**Interfaces:**
- Consumes: `<Marco />`, `<Pie />`
- Produces: three routes

- [ ] **Step 1: Port the page content**

`lineamientos/page.tsx` ← `lineamientos.html:242-700`: the seven general rules, the three dictamen levels, and the eight `<details>` section accordions. Long but purely static. Its page-scoped CSS (`lineamientos.html:10-239`) goes in `lineamientos.css`, imported by the page.

`quienes-somos/page.tsx` ← `quienes-somos.html`: misión, visión, the five valores, integridad. Keep the `#mision` and `#vision` ids — the redirects in Task 15 target them.

`equipo/page.tsx` ← `equipo-ds.html:31-39`, the placeholder naming the seven teams. Its `← Regresar` link uses `history.back()` when there is history (`equipo-ds.html:38`); reproduce with `router.back()` behind the same length check.

- [ ] **Step 2: Port the flow-field background — with a stacking context**

`fondo-flujo.js` prepends a canvas to `<body>` and then walks `document.body.children`, assigning inline `position: relative; z-index: 1` to every sibling (`fondo-flujo.js:9-20`). Under Next.js that set includes framework-injected nodes, and React will fight the inline styles on hydration.

Port the animation loop verbatim — `flowAngle`, the palette constants (`VELO`, `OP_TINTA`, `OP_LIDER`, `OP_ACENTO`, `PROB_LIDER`, `PROB_ACENTO`, `VIDA_MIN`, `VIDA_MAX`), and the drawing — but replace the sibling walk. `FondoFlujo` renders its own `position: fixed; inset: 0; z-index: 0` canvas and the page wraps its content in a `position: relative; z-index: 1` container. Same visual result, no mutation of nodes React owns.

Honour `prefers-reduced-motion` as the original does.

- [ ] **Step 3: Port the scroll reveal**

`revelar.js` ports cleanly. Move the 17 selectors (`revelar.js:9-18`) into an exported `OBJETIVOS` constant so the coupling is visible — they fail silently if a class is renamed. Keep the deliberate choice of scroll position over `IntersectionObserver` and the `prefers-reduced-motion` bail-out, both documented in the file header.

- [ ] **Step 4: Verify**

Load all three pages against the originals. Confirm the flow-field trails accumulate identically, the accordions open and reveal correctly, and content sits above the canvas.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/lineamientos web/src/app/quienes-somos web/src/app/equipo web/src/components/satelite
git commit -m "feat(web): port satellite pages with flow-field background and scroll reveal"
```

---

## Task 15: Redirect map

**Files:**
- Modify: `web/next.config.ts`

**Interfaces:**
- Consumes: the routes from Task 14
- Produces: permanent redirects from every legacy path

Every URL changes, and `mision-ds.html` / `vision-ds.html` are currently live meta-refresh stubs (spec §14).

- [ ] **Step 1: Add the redirects**

```ts
// web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/lineamientos.html", destination: "/lineamientos", permanent: true },
      { source: "/quienes-somos.html", destination: "/quienes-somos", permanent: true },
      { source: "/equipo-ds.html", destination: "/equipo", permanent: true },
      { source: "/mision-ds.html", destination: "/quienes-somos#mision", permanent: true },
      { source: "/vision-ds.html", destination: "/quienes-somos#vision", permanent: true },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify every redirect**

```bash
cd web && npm run build && npm start
for p in index.html lineamientos.html quienes-somos.html equipo-ds.html mision-ds.html vision-ds.html; do
  printf '%-22s -> ' "$p"
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "http://localhost:3000/$p"
done
```

Expected: `308` for all six, each with the destination above.

- [ ] **Step 3: Commit**

```bash
git add web/next.config.ts
git commit -m "feat(web): redirect legacy .html paths to App Router routes"
```

---

## Task 16: Visual parity gate

**Files:**
- Create: `web/tests/visual/paridad.spec.ts`

**Interfaces:**
- Consumes: the baselines from Task 2, the finished app from Tasks 9–15
- Produces: the pass/fail gate for the whole stage

Only Spanish is asserted here. The other five locales are asserted in Stage 2, against these same baselines.

- [ ] **Step 1: Write the parity spec**

```ts
// web/tests/visual/paridad.spec.ts
import { test, expect } from "@playwright/test";
import { PUNTOS_U, SATELITES, nombreU } from "./constantes";

const BASE = "http://localhost:3000";
const TOL = { maxDiffPixelRatio: 0.001 };   // ~1300px of 1440x900; see Step 3

test("landing es matches the legacy baseline at every phase", async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => typeof (window as any).__qa?.runTo === "function");
  await page.evaluate(() => document.fonts.ready);
  for (const u of PUNTOS_U) {
    await page.evaluate((uu) => (window as any).__qa.runTo(uu, 3), u);
    await expect(page.locator("body")).toHaveScreenshot(`landing-es-${nombreU(u)}.png`, TOL);
  }
});

for (const { ruta, nombre } of SATELITES) {
  test(`${nombre} es matches the legacy baseline`, async ({ page }) => {
    await page.goto(BASE + ruta);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.querySelectorAll(".rev").forEach((e) => e.classList.add("rev-on")));
    await expect(page).toHaveScreenshot(`${nombre}-es.png`, { fullPage: true, ...TOL });
  });
}
```

`snapshotPathTemplate` was already set in Task 2, so these resolve to the same
`tests/visual/baseline/` directory as the legacy captures.

- [ ] **Step 2: Run the gate**

```bash
cd web && npm run build && npm start &
npx playwright test paridad
```

- [ ] **Step 3: Triage every diff**

Open `playwright-report/` and inspect each failure. The tolerance exists for sub-pixel antialiasing, **not** for real differences. Diffs are almost always one of:

| Symptom | Cause |
|---|---|
| Text shifted by a pixel or two | font-face descriptors altered during the CSS copy — re-diff `globals.css` against `index.html:16-585` |
| Particles in the wrong places | `sampleTextPoints` ran before fonts settled — check the `document.fonts.ready` gate in Task 9 |
| A whole block missing | a section not yet ported, or an `id` dropped that `globals.css` selects on |
| Colours slightly off | a `--negro`/`--crema` swap, or an alpha value mistyped |
| Random per-run noise | a randomised builder leaking into the render — `__qa.runTo` should make each frame deterministic given the same graph |

Fix the cause. Do not raise the tolerance and do not re-baseline against the new app — that would make the gate self-approving and defeat the entire stage.

- [ ] **Step 4: Confirm it is a real gate**

Temporarily change one colour in `globals.css` (e.g. `--naranja` to `#ff0000`), re-run, and confirm the suite **fails**. Revert.

A gate never observed failing is not known to work.

- [ ] **Step 5: Commit**

```bash
git add web/tests/visual/paridad.spec.ts web/playwright.config.ts
git commit -m "test(web): gate stage 1 on visual parity with the legacy site"
```

---

## Definition of done

- [ ] `npm test` passes — texto, datos, fases, proyeccion, grafo, validacion
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run build` succeeds
- [ ] `npx playwright test paridad` passes, and has been observed failing on a deliberate change
- [ ] All six redirects return 308
- [ ] The wizard walks all four steps and produces every validation message
- [ ] The discovery panel filters by topic, by section, and by search
- [ ] `window.__qa.runTo` works in the built app
- [ ] Navigating away and back leaves exactly one animation loop
- [ ] The legacy site at the repo root is untouched and still serves

## Deliberately out of scope

Stage 2 and later, per spec §16: i18n (the app is Spanish-only and `idiomas.js` is **not** ported — Task 8 keeps the `__alCambiarIdioma` and `label0`/`desc0` hooks for it), all Supabase work, the admin panel, real submissions, article pages, ediciones, and the Excel export. The form, status lookup, and newsletter stay UI-only.
