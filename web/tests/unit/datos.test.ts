import { describe, it, expect } from "vitest";
import { slug } from "@/lib/texto";
import { TOPICS } from "@/lib/datos/temas";
import { SECTIONS, SEC_EDGES } from "@/lib/datos/secciones";
import { ARTICULOS } from "@/lib/datos/articulos";

describe("temas", () => {
  it("has the 27 topics the site advertises", () => {
    expect(TOPICS).toHaveLength(27); // index.html:702 renders "27"
    expect(new Set(TOPICS).size).toBe(27);
  });
});

describe("secciones", () => {
  it("has the 8 sections the site advertises", () => {
    expect(SECTIONS).toHaveLength(8); // index.html:703 renders "8"
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
    const miradas = SECTIONS.find((s) => s.label === "Miradas Económicas");
    expect(miradas).toBeDefined();
    expect(miradas!.imp).toBe(Math.max(...imps));
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
    const temas = new Set<string>(TOPICS);
    for (const a of ARTICULOS) for (const t of a.tm) expect(temas).toContain(t);
  });
  it("gives every article a positive read time", () => {
    for (const a of ARTICULOS) expect(a.min).toBeGreaterThan(0);
  });
});
