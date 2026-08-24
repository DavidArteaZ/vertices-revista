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
    expect(slug("Nearshoring: ¿la oportunidad que México sí puede capturar?")).toBe(
      "nearshoring-la-oportunidad-que-mexico-si-puede-capturar",
    );
  });
  it("handles the ñ and the ü", () => {
    expect(slug("Diseño y Pingüino")).toBe("diseno-y-pinguino");
  });
});

describe("norm", () => {
  it("lowercases and strips accents for search", () => {
    expect(norm("Política Monetaria")).toBe("politica monetaria");
  });
  it("leaves spacing alone so multi-word search still matches", () => {
    expect(norm("Banca Central")).toBe("banca central");
  });
});

describe("clamp", () => {
  it("bounds below, above, and passes through", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});
