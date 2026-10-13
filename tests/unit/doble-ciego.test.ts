import { describe, it, expect } from "vitest";
import { pideDobleCiego } from "@/lib/dictamen/doble-ciego";

describe("pideDobleCiego", () => {
  it("lo pide en Miradas Económicas y Horizonte Global", () => {
    expect(pideDobleCiego("miradas-economicas")).toBe(true);
    expect(pideDobleCiego("horizonte-global")).toBe(true);
  });

  it("no lo pide en las demás secciones ni sin sección", () => {
    expect(pideDobleCiego("datanomics")).toBe(false);
    expect(pideDobleCiego(null)).toBe(false);
    expect(pideDobleCiego(undefined)).toBe(false);
  });
});
