import { describe, it, expect } from "vitest";
import {
  project,
  edgePoint3D,
  edgeCtrl3D,
  targetPoint3D,
  TILT,
  type Vista,
} from "@/lib/motor/proyeccion";

const vista: Vista = {
  W: 1440,
  H: 900,
  tcs: Math.cos(TILT),
  tsn: Math.sin(TILT),
};

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

  it("scales the radius with the smaller viewport dimension", () => {
    const apaisado = project({ x: 1, y: 0, z: 0 }, 0, { ...vista, W: 1440, H: 900 });
    const alto = project({ x: 1, y: 0, z: 0 }, 0, { ...vista, W: 900, H: 1440 });
    // min(W,H) es 900 en ambos, así que el desplazamiento desde el centro coincide
    expect(apaisado.x - 720).toBeCloseTo(alto.x - 450, 6);
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

  it("puts the apex at mid + perpendicular * bow", () => {
    // el punto de control es mid + perp * 2*bow, así que la curva cuadrática
    // pasa por mid + perp * bow en t=0.5 (index.html:1327-1328)
    const bow = 0.2;
    const m = edgePoint3D(g, { ...e, bow }, 0.5, 0);
    expect(m.y).toBeCloseTo(bow, 6);
  });
});

describe("edgeCtrl3D", () => {
  it("breathes with time via the phase offset", () => {
    const g = { nodes: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] };
    const e = { i: 0, j: 1, px: 0, py: 1, pz: 0, bow: 0.2, ph: 0 };
    expect(edgeCtrl3D(g, e, 0).y).not.toBeCloseTo(edgeCtrl3D(g, e, 3).y, 6);
  });
});

describe("targetPoint3D", () => {
  it("scatters a particle around its node by the spread", () => {
    const g = { nodes: [{ x: 1, y: 2, z: 3 }] };
    const p = { no1: 1, no2: -1, no3: 0.5 };
    const t = targetPoint3D(g, 0, p, 0.01);
    expect(t.x).toBeCloseTo(1.01, 6);
    expect(t.y).toBeCloseTo(1.99, 6);
    expect(t.z).toBeCloseTo(3.005, 6);
  });
});
