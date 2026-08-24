/**
 * Proyección 3D del motor. Portado literal de index.html:1318-1364.
 *
 * Único cambio: el original lee W, H, tcs y tsn como variables globales del
 * módulo. Aquí llegan en un objeto Vista, lo que vuelve project() pura y
 * comprobable sin lienzo ni DOM. La aritmética no se toca.
 */

export type Punto3D = { x: number; y: number; z: number };

export type Vista = {
  W: number;
  H: number;
  /** cos del tilt vigente (TILT + dragPitch) */
  tcs: number;
  /** sen del tilt vigente */
  tsn: number;
};

export type NodoLike = Punto3D;

export type AristaLike = {
  i: number;
  j: number;
  px: number;
  py: number;
  pz: number;
  bow: number;
  ph: number;
};

export type GrafoLike = { nodes: NodoLike[] };

export type Disperso = { no1: number; no2: number; no3: number };

export function targetPoint3D(
  g: GrafoLike,
  idx: number,
  p: Disperso,
  spread: number,
): Punto3D {
  const n = g.nodes[idx];
  return {
    x: n.x + p.no1 * spread,
    y: n.y + p.no2 * spread,
    z: n.z + p.no3 * spread,
  };
}

// punto de control de la curva: mid + perpendicular * 2*bow (la curva pasa
// por el apice mid + perpendicular * bow)
export function edgeCtrl3D(g: GrafoLike, e: AristaLike, tSec: number): Punto3D {
  const a = g.nodes[e.i], b = g.nodes[e.j];
  const br = e.bow * (1 + 0.18 * Math.sin(tSec * 0.5 + e.ph)) * 2;
  return {
    x: (a.x + b.x) / 2 + e.px * br,
    y: (a.y + b.y) / 2 + e.py * br,
    z: (a.z + b.z) / 2 + e.pz * br,
  };
}

export function edgePoint3D(
  g: GrafoLike,
  e: AristaLike,
  t: number,
  tSec: number,
): Punto3D {
  const a = g.nodes[e.i], b = g.nodes[e.j];
  const c = edgeCtrl3D(g, e, tSec);
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    z: u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  };
}

export const TILT = 0.38;

export function project(
  pt: Punto3D,
  ang: number,
  vista: Vista,
  xs = 1,
  yOff = 0,
  esc = 1,
  xOff = 0,
): { x: number; y: number; s: number } {
  const { W, H, tcs, tsn } = vista;
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const xr = pt.x * cs + pt.z * sn;
  const zr0 = -pt.x * sn + pt.z * cs;
  const yr = pt.y * tcs - zr0 * tsn;
  const zr = pt.y * tsn + zr0 * tcs;
  const R = Math.min(W, H) * 0.38 * esc;
  const s = 2.3 / (2.3 + zr);
  return {
    x: W / 2 + xOff + xr * R * s * xs,
    y: H / 2 + yOff + yr * R * s,
    s,
  };
}
