/**
 * Construcción de los dos grafos y paletas del motor.
 * Portado literal de index.html: paletas :1115-1136, makeBeads y edgeExtras
 * :1233-1250, buildNetwork y buildSections :1252-1316, gauss :1437-1439.
 *
 * Cambios respecto al original, y ninguno más:
 *  - TR() desaparece: en esta etapa no hay capa de traducción, así que label
 *    y desc valen lo mismo que label0 y desc0. Los campos 0 se conservan
 *    porque la etapa 2 los necesita.
 *  - TOPICS y SECTIONS llegan por import en vez de ser globales.
 */

import { TOPICS } from "../datos/temas";
import { SECTIONS, SEC_EDGES } from "../datos/secciones";
import type { Punto3D } from "./proyeccion";

export type Bead = { t: number; r: number };

export type Nodo = Punto3D & {
  imp: number;
  colIdx: number;
  label: string;
  label0: string;
  desc?: string;
  desc0?: string;
  side?: "above" | "below";
};

export type Arista = {
  i: number;
  j: number;
  px: number;
  py: number;
  pz: number;
  bow: number;
  ph: number;
  beads: Bead[];
  pulse: boolean;
  pulseOff: number;
  pulseSpeed: number;
  pulseTinte: number;
};

export type Grafo = { nodes: Nodo[]; edges: Arista[] };

// paleta perlada: blanco dominante, crema, indigo claro y naranja quemado
export const TINTES: readonly (readonly [number, number, number])[] = [
  [45, 35, 46],
  [77, 77, 250],
  [253, 99, 67],
  [192, 117, 21],
];
export const TINTE_CSS: readonly string[] = ["#2d232e", "#4d4dfa", "#fd6343", "#c07515"];
export function pickTinte(): number {
  const r = Math.random();
  return r < 0.72 ? 0 : r < 0.82 ? 1 : r < 0.91 ? 2 : 3;
}
// un color distinto por nodo, ciclando la paleta del sistema
export const PALETA_NODOS: readonly (readonly [number, number, number])[] = [
  [77, 77, 250],
  [119, 118, 207],
  [63, 61, 90],
  [253, 99, 67],
  [237, 145, 38],
  [45, 35, 46],
];
export const PALETA_CSS: readonly string[] = ["#4d4dfa", "#7776cf", "#3f3d5a", "#fd6343", "#ed9126", "#2d232e"];

export function makeBeads(len: number): Bead[] {
  const nb = Math.max(1, Math.round(len * (2 + Math.random() * 3)));
  return Array.from({ length: nb }, () => ({
    t: 0.12 + Math.random() * 0.76,
    r: 0.8 + Math.random() * 1.6,
  }));
}

// curvatura de cada filamento: vector perpendicular a la arista en 3D
export function edgeExtras(a: Punto3D, b: Punto3D, esc: number) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const rx = Math.random() * 2 - 1, ry = Math.random() * 2 - 1, rz = Math.random() * 2 - 1;
  let px = dy * rz - dz * ry, py = dz * rx - dx * rz, pz = dx * ry - dy * rx;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl; py /= pl; pz /= pl;
  return { px, py, pz, bow: len * esc * (0.7 + Math.random() * 0.9), ph: Math.random() * Math.PI * 2 };
}

export function buildNetwork(esMovil = false): Grafo {
  const N = TOPICS.length;
  const nodes: Nodo[] = [];
  let guard = 0;
  while (nodes.length < N && guard++ < 40000) {
    // en teléfono la nube se pone de pie: más angosta y más alta, que es la
    // forma de la pantalla. Con el reparto de escritorio, media constelación
    // caería fuera de cuadro y sus etiquetas se descartarían por solaparse.
    const x = (Math.random() * 2 - 1) * (esMovil ? 0.92 : 1.25);
    const y = (Math.random() * 2 - 1) * (esMovil ? 1.18 : 0.85);
    const z = (Math.random() * 2 - 1);
    if (nodes.some((n) => (n.x - x) ** 2 + (n.y - y) ** 2 + (n.z - z) ** 2 < 0.24)) continue;
    nodes.push({ x, y, z, imp: 0.65 + Math.random() * 1.05, colIdx: nodes.length % PALETA_NODOS.length, label: TOPICS[nodes.length], label0: TOPICS[nodes.length] });
  }

  const E = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const d = nodes.map((n, j) => i === j ? 1e9 :
      (n.x - nodes[i].x) ** 2 + (n.y - nodes[i].y) ** 2 + (n.z - nodes[i].z) ** 2);
    const order = d.map((v, j) => [v, j]).sort((a, b) => a[0] - b[0]);
    E.add([i, order[0][1]].sort((a, b) => a - b).join(","));
    if (Math.random() < 0.6) E.add([i, order[1][1]].sort((a, b) => a - b).join(","));
  }
  const cand: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dd = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y, nodes[i].z - nodes[j].z);
      if (dd > 1.3 && dd < 2.3 && !E.has(i + "," + j)) cand.push([i, j]);
    }
  }
  for (let k = 0; k < 9 && cand.length; k++) {
    const [i, j] = cand.splice(Math.floor(Math.random() * cand.length), 1)[0];
    E.add(i + "," + j);
  }

  const edges = [...E].map((s) => {
    const [i, j] = s.split(",").map(Number);
    const len = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y, nodes[i].z - nodes[j].z);
    return {
      i, j,
      ...edgeExtras(nodes[i], nodes[j], 0.12),
      beads: makeBeads(len),
      pulse: Math.random() < 0.35,
      pulseOff: Math.random(),
      pulseSpeed: 0.08 + Math.random() * 0.08,
      pulseTinte: Math.floor(Math.random() * PALETA_NODOS.length),
    };
  });
  return { nodes, edges };
}

export function buildSections(esMovil = false): Grafo {
  // el mapa se aplana en vertical para leerse como una franja panoramica.
  // En teléfono no se aplana, se estira: las ocho etiquetas necesitan
  // renglones propios o se montan unas sobre otras.
  const nodes = SECTIONS.map((s, i) => ({ ...s, y: s.y * (esMovil ? 1.05 : 0.62), colIdx: i % PALETA_NODOS.length, label: s.label, desc: s.desc, label0: s.label, desc0: s.desc }));
  const edges = SEC_EDGES.map(([i, j]) => {
    const len = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y, nodes[i].z - nodes[j].z);
    return {
      i, j,
      ...edgeExtras(nodes[i], nodes[j], 0.08),
      beads: makeBeads(len),
      pulse: true,
      pulseOff: Math.random() * 0.5,
      pulseSpeed: 0.10 + Math.random() * 0.05,
      pulseTinte: Math.floor(Math.random() * PALETA_NODOS.length),
    };
  });
  return { nodes, edges };
}

export function gauss(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 1.2;
}
