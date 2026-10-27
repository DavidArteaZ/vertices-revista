import type { AreaId, Integrante } from "@/lib/datos/equipo";

/**
 * Dónde cae cada burbuja de la constelación del equipo.
 *
 * Es una función pura y con semilla fija, no Math.random: la página se pinta
 * en el servidor y se hidrata en el navegador, y las dos pasadas tienen que
 * dar las mismas coordenadas al píxel. Por lo mismo se redondea a décimas:
 * un seno calculado en otro motor puede diferir en el último decimal.
 *
 * Cada persona apunta a un sitio (junto a su área, del lado opuesto al centro,
 * o entre sus dos áreas si tiene dos) y luego unas cuantas pasadas de
 * repulsión separan lo que se encima. Los nodos de área y el centro no se
 * mueven: son el esqueleto que el comité reconoce.
 */

export type Punto = { x: number; y: number };
export type Lienzo = {
  ancho: number;
  alto: number;
  /** las personas no pasan de este ancho: a la derecha queda el asesor */
  campo: number;
  centro: Punto;
  areas: Record<AreaId, Punto>;
  asesor: Punto;
};
export type Burbuja = Punto & { r: number; persona: Integrante };

export const R_CENTRO = 54;
export const R_AREA = 48;
/** Dirección general va un poco mayor que las demás áreas, sin llegar al centro. */
export const R_DIRECCION = 52;
export const radioArea = (id: AreaId) => (id === "dir" ? R_DIRECCION : R_AREA);
export const R_ASESOR = 52;
const HOLGURA = 14;

export const ESCRITORIO: Lienzo = {
  ancho: 1140,
  alto: 720,
  campo: 990,
  centro: { x: 500, y: 380 },
  areas: {
    dir: { x: 500, y: 158 },
    con: { x: 160, y: 255 },
    ced: { x: 200, y: 535 },
    dis: { x: 810, y: 210 },
    cyd: { x: 800, y: 520 },
    fot: { x: 515, y: 615 },
  },
  asesor: { x: 1062, y: 370 },
};

/** En teléfono la misma red se acomoda a lo alto y el asesor baja al pie. */
export const MOVIL: Lienzo = {
  ancho: 600,
  alto: 1240,
  campo: 600,
  centro: { x: 300, y: 520 },
  areas: {
    dir: { x: 300, y: 150 },
    con: { x: 110, y: 330 },
    dis: { x: 490, y: 330 },
    ced: { x: 110, y: 720 },
    cyd: { x: 490, y: 720 },
    fot: { x: 300, y: 900 },
  },
  asesor: { x: 300, y: 1110 },
};

function semilla(s: number) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dec = (n: number) => Math.round(n * 10) / 10;

export function disponer(lienzo: Lienzo, personas: Integrante[]): Burbuja[] {
  const azar = semilla(11);
  const { centro, areas, campo, alto } = lienzo;

  const solos: Record<string, number> = {};
  for (const p of personas) if (p.areas.length === 1) solos[p.areas[0]] = (solos[p.areas[0]] ?? 0) + 1;

  // cuántas personas comparten cada par de áreas
  const pares: Record<string, number> = {};
  for (const p of personas) if (p.areas.length === 2) { const k = [...p.areas].sort().join(); pares[k] = (pares[k] ?? 0) + 1; }

  const vistos: Record<string, number> = {};
  const libres = personas.map((p) => {
    const r = 34 + azar() * 8;
    let destino: Punto;
    if (p.areas.length === 1) {
      const a = areas[p.areas[0]];
      const k = (vistos[p.areas[0]] = (vistos[p.areas[0]] ?? 0) + 1);
      const hacia = Math.atan2(a.y - centro.y, a.x - centro.x);
      const ang = hacia + (k - (solos[p.areas[0]] + 1) / 2) * 0.95 + (azar() - 0.5) * 0.2;
      const d = 120 + azar() * 20;
      destino = { x: a.x + Math.cos(ang) * d * 1.15, y: a.y + Math.sin(ang) * d };
    } else {
      // Entre sus dos áreas. Sola, se empuja hacia fuera para no tapar las
      // líneas que salen del centro; si varias comparten el par, se apilan
      // en diagonal sobre el punto medio, para que no se
      // amontonen contra uno de los dos nodos.
      const [a, b] = p.areas.map((id) => areas[id]);
      const par = [...p.areas].sort().join();
      const rep = (vistos[par] = (vistos[par] ?? -1) + 1);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pares[par] > 1) {
        // En diagonal a 45°, subiendo hacia la derecha: en vertical la de
        // abajo caía sobre las líneas que bajan hacia Vértices, y en
        // horizontal se encimaban con los nodos. Se sube 40 px por lo mismo.
        const paso = (rep - (pares[par] - 1) / 2) * 96 * Math.SQRT1_2;
        destino = { x: m.x + paso, y: m.y - 40 - paso };
      } else {
        const vx = m.x - centro.x, vy = m.y - centro.y, vl = Math.hypot(vx, vy) || 1;
        destino = { x: m.x + (vx / vl) * 40, y: m.y + (vy / vl) * 40 };
      }
    }
    return { ...destino, r, destino, fijo: false, persona: p };
  });

  const fijos = [
    { ...centro, r: R_CENTRO, fijo: true },
    ...(Object.entries(areas) as [AreaId, Punto][]).map(([id, a]) => ({ ...a, r: radioArea(id), fijo: true })),
    // el asesor y su nombre, que va debajo, son terreno vedado
    { ...lienzo.asesor, r: R_ASESOR + 40, fijo: true },
  ];
  const todos: { x: number; y: number; r: number; fijo: boolean }[] = [...fijos, ...libres];

  for (let vuelta = 0; vuelta < 600; vuelta++) {
    for (let i = 0; i < todos.length; i++) {
      for (let j = i + 1; j < todos.length; j++) {
        const a = todos[i], b = todos[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1, min = a.r + b.r + HOLGURA;
        if (d >= min) continue;
        const paso = (min - d) / 2;
        dx /= d; dy /= d;
        if (!a.fijo) { const f = b.fijo ? 2 : 1; a.x -= dx * paso * f; a.y -= dy * paso * f; }
        if (!b.fijo) { const f = a.fijo ? 2 : 1; b.x += dx * paso * f; b.y += dy * paso * f; }
      }
    }
    for (const p of libres) {
      p.x += (p.destino.x - p.x) * 0.03;
      p.y += (p.destino.y - p.y) * 0.03;
      p.x = Math.max(p.r + HOLGURA, Math.min(campo - p.r - HOLGURA, p.x));
      p.y = Math.max(p.r + HOLGURA, Math.min(alto - p.r - HOLGURA, p.y));
    }
  }

  return libres.map((p) => ({ x: dec(p.x), y: dec(p.y), r: dec(p.r), persona: p.persona }));
}

/** Arco suave entre dos puntos, como las líneas del recurso gráfico del manual. */
export function curva(a: Punto, b: Punto, k: number) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
  return `M${a.x},${a.y} Q${dec(mx - dy * k)},${dec(my + dx * k)} ${b.x},${b.y}`;
}
