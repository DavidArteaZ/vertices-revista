import { describe, it, expect } from "vitest";
import {
  buildNetwork,
  buildSections,
  PALETA_NODOS,
  PALETA_CSS,
  TINTES,
  TINTE_CSS,
  pickTinte,
} from "@/lib/motor/grafo";
import { TOPICS } from "@/lib/datos/temas";
import { SECTIONS, SEC_EDGES } from "@/lib/datos/secciones";

// Estos constructores usan Math.random, así que las pruebas afirman
// INVARIANTES, no valores fijos.

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
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d2 =
          (nodes[i].x - nodes[j].x) ** 2 +
          (nodes[i].y - nodes[j].y) ** 2 +
          (nodes[i].z - nodes[j].z) ** 2;
        expect(d2).toBeGreaterThanOrEqual(0.24);
      }
    }
  });

  it("leaves no node isolated", () => {
    const g = buildNetwork();
    const grado = new Array(g.nodes.length).fill(0);
    for (const e of g.edges) {
      grado[e.i]++;
      grado[e.j]++;
    }
    for (let i = 0; i < grado.length; i++) {
      expect(grado[i], `nodo ${i} (${g.nodes[i].label0})`).toBeGreaterThan(0);
    }
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

  it("keeps every node index inside the node array", () => {
    const g = buildNetwork();
    for (const e of g.edges) {
      expect(e.i).toBeGreaterThanOrEqual(0);
      expect(e.i).toBeLessThan(g.nodes.length);
      expect(e.j).toBeGreaterThanOrEqual(0);
      expect(e.j).toBeLessThan(g.nodes.length);
    }
  });

  it("gives every node a colour index inside the palette", () => {
    for (const n of buildNetwork().nodes) {
      expect(n.colIdx).toBeGreaterThanOrEqual(0);
      expect(n.colIdx).toBeLessThan(PALETA_NODOS.length);
    }
  });

  it("puts at least one bead on every edge, all within the segment", () => {
    for (const e of buildNetwork().edges) {
      expect(e.beads.length).toBeGreaterThan(0);
      for (const b of e.beads) {
        expect(b.t).toBeGreaterThan(0);
        expect(b.t).toBeLessThan(1);
        expect(b.r).toBeGreaterThan(0);
      }
    }
  });

  it("normalises the perpendicular used to bow each edge", () => {
    for (const e of buildNetwork().edges) {
      expect(Math.hypot(e.px, e.py, e.pz)).toBeCloseTo(1, 6);
    }
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

  it("preserves the hand-placed x and z untouched", () => {
    const g = buildSections();
    g.nodes.forEach((n, i) => {
      expect(n.x).toBe(SECTIONS[i].x);
      expect(n.z).toBe(SECTIONS[i].z);
    });
  });

  it("carries the description through for the hover card", () => {
    for (const n of buildSections().nodes) {
      expect(n.desc0).toBeDefined();
      expect(n.desc0!.length).toBeGreaterThan(0);
    }
  });

  it("pulses every section edge", () => {
    for (const e of buildSections().edges) expect(e.pulse).toBe(true);
  });
});

describe("palettes", () => {
  it("keeps the rgb and css node palettes in step", () => {
    expect(PALETA_CSS).toHaveLength(PALETA_NODOS.length);
  });
  it("keeps the rgb and css tint palettes in step", () => {
    expect(TINTE_CSS).toHaveLength(TINTES.length);
  });
  it("only ever picks a tint that exists", () => {
    for (let i = 0; i < 500; i++) {
      const t = pickTinte();
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(TINTES.length);
    }
  });
});
