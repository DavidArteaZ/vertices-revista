/**
 * Motor de partículas de la landing. Portado LITERAL de index.html:1084-1921
 * y :2352-2386, envuelto en crearMotor() para poder montarlo y desmontarlo.
 *
 * Se copió el código tal cual: no se refactorizó a idiomas de React, no se
 * convirtieron bucles, no se renombraron variables. React no aporta nada a un
 * bucle imperativo de lienzo a 60 fps, y cualquier reescritura arriesga
 * cambiar el movimiento, que es justo lo que esta etapa debe preservar.
 *
 * Cambios respecto al original, y ninguno más:
 *  - Los document.getElementById se sustituyen por los elementos que entran
 *    en MotorOpciones.
 *  - project() recibe la vista como tercer argumento; para no tocar los ocho
 *    sitios de llamada se define un envoltorio local proyecta() con la firma
 *    original.
 *  - TR() es la identidad: no hay traducción hasta la etapa 2.
 *  - abrirPanel() pasa a ser el callback alAbrirPanel.
 *  - Se añade destruir(): el original nunca se desmonta, React sí.
 */

import { clamp } from "../texto";
import { SECTIONS } from "../datos/secciones";
import { PH, ss, phaseParams } from "./fases";
import {
  project,
  edgeCtrl3D,
  edgePoint3D,
  targetPoint3D,
  TILT,
  type Punto3D,
  type Vista,
} from "./proyeccion";
import {
  buildNetwork,
  buildSections,
  gauss,
  pickTinte,
  TINTE_CSS,
  PALETA_CSS,
  PALETA_NODOS,
  type Grafo,
  type Nodo,
  type Arista,
} from "./grafo";

export type TipoNodo = "tema" | "seccion";

export type MotorOpciones = {
  canvas: HTMLCanvasElement;
  /** el espaciador de 680vh que gobierna el recorrido */
  recorrido: HTMLElement;
  capas: {
    hero: HTMLElement;
    temas: HTMLElement;
    secciones: HTMLElement;
    cierre: HTMLElement;
  };
  velo: HTMLElement;
  ficha: { raiz: HTMLElement; nombre: HTMLElement; desc: HTMLElement };
  rielBotones: HTMLElement[];
  alAbrirPanel: (tipo: TipoNodo, label: string) => void;
  alCerrarPanel: () => void;
};

export type Motor = { destruir: () => void };

type Particula = {
  x: number; y: number; vx: number; vy: number;
  hx: number; hy: number;
  burstAng: number; seed: number; speed: number; bright: number;
  tinte: number; netNode: number; secNode: number;
  no1: number; no2: number; no3: number;
  tScale: number;
};

type Campo = {
  x: number; y: number; px: number; py: number;
  speed: number; gray: number; seed: number;
};

type Hover = { tipo: TipoNodo; label: string } | null;

export function crearMotor(o: MotorOpciones): Motor {
  const WORD = "Vértices";

  /* ------- estado del motor ------- */
  const canvas = o.canvas;
  const ctx = canvas.getContext("2d")!;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const REDUCIDO = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0;
  let word: Particula[] = [];
  let field: Campo[] = [];
  let sprites: HTMLCanvasElement[] | null = null;
  let bg: HTMLCanvasElement | null = null, bgH = 0;
  const layout = { fontPx: 100 };
  let net: Grafo | null = null;
  let sec: Grafo | null = null;
  let uSmooth = 0;
  let mx = -1e4, my = -1e4;
  let yaw = 0;
  let secLabelTimer = 0;
  let hover: Hover = null;
  let autoAng = 0;
  let rotIdle = 10;
  let dragging = false;
  let dragYaw = 0, dragPitch = 0, dragMoved = 0;
  let lastMX = 0, lastMY = 0;
  let tcs = Math.cos(0.38), tsn = Math.sin(0.38);
  let angNet = 0, angSec = 0; // angulos del cuadro actual, para hit-test

  // en esta etapa no hay diccionario: TR es la identidad
  const TR = (s: string): string => s;
  let SUBTITULO = "El punto donde las ideas se conectan";

  // La vista viaja a project() como tercer argumento. El envoltorio conserva
  // la firma original para no tocar ningún sitio de llamada.
  const vista = (): Vista => ({ W, H, tcs, tsn });
  const proyecta = (
    pt: Punto3D,
    ang: number,
    xs = 1,
    yOff = 0,
    esc = 1,
    xOff = 0,
  ) => project(pt, ang, vista(), xs, yOff, esc, xOff);

  /* ------- elementos del DOM (en el original, document.getElementById) ------- */
  const recorrido = o.recorrido;
  const velo = o.velo;
  const capaHero = o.capas.hero;
  const capaTemas = o.capas.temas;
  const capaSecciones = o.capas.secciones;
  const capaCierre = o.capas.cierre;
  const ficha = o.ficha.raiz;
  const fsNombre = o.ficha.nombre;
  const fsDesc = o.ficha.desc;
  const rielBotones = o.rielBotones;

  let rafId = 0;

function makeSprites() {
  return PALETA_NODOS.map(([r, g, b]) => {
    const s = document.createElement("canvas");
    s.width = s.height = 64;
    const c = s.getContext("2d")!;
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
    return s;
  });
}

/* fondo perlado: negro profundo, velos de nebulosa y polvo de estrellas.
   se dibuja cada cuadro con alpha igual al desvanecimiento de estelas,
   de modo que el estado estable del lienzo converge exactamente a el */
function makeBg() {
  bgH = Math.ceil(H * 1.3);
  const b = document.createElement("canvas");
  b.width = W; b.height = bgH;
  const g = b.getContext("2d")!;
  g.fillStyle = "#E7DECB";
  g.fillRect(0, 0, W, bgH);
  const neb = (x: number, y: number, r: number, rgb: string, a: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, bgH);
  };
  neb(W * 0.74, bgH * 0.30, Math.max(W, bgH) * 0.55, "74,74,232", 0.045);
  neb(W * 0.16, bgH * 0.74, Math.max(W, bgH) * 0.45, "122,126,200", 0.040);
  neb(W * 0.44, bgH * 0.10, Math.max(W, bgH) * 0.38, "231,104,76", 0.035);
  neb(W * 0.88, bgH * 0.82, Math.max(W, bgH) * 0.30, "222,155,62", 0.035);
  const n = Math.round((W * bgH) / 9000);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * W, y = Math.random() * bgH;
    const r = Math.random() < 0.94 ? 0.4 + Math.random() * 0.9 : 1.2 + Math.random() * 0.9;
    const cr = Math.random();
    const col = cr < 0.72 ? "36,31,46" : cr < 0.86 ? "61,61,85"
              : cr < 0.95 ? "74,74,232" : "231,104,76";
    g.fillStyle = `rgba(${col},${0.05 + Math.random() * 0.18})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  bg = b;
}

function sampleTextPoints(text: string, targetW: number, targetH: number) {
  const off = document.createElement("canvas");
  off.width = targetW;
  off.height = targetH;
  const octx = off.getContext("2d")!;

  let fontSize = Math.floor(targetH * 0.78);
  const setFont = () => {
    octx.font = `700 ${fontSize}px "Neue Montreal", Arial, "Helvetica Neue", sans-serif`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
  };
  setFont();
  while (octx.measureText(text).width > targetW * 0.9 && fontSize > 10) {
    fontSize -= 4;
    setFont();
  }
  layout.fontPx = fontSize;

  octx.clearRect(0, 0, targetW, targetH);
  octx.fillStyle = "#fff";
  octx.fillText(text, targetW / 2, targetH / 2 + fontSize * 0.03);

  const img = octx.getImageData(0, 0, targetW, targetH).data;
  const step = 3.1;
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < targetH; y += step) {
    for (let x = 0; x < targetW; x += step) {
      const xi = Math.round(x), yi = Math.round(y);
      const a = img[(yi * targetW + xi) * 4 + 3];
      if (a > 80) pts.push({ x: xi, y: yi });
    }
  }
  return pts;
}

function flowAngle(x: number, y: number, t: number) {
  return (
    Math.sin(x * 0.0048 + t * 0.14) * 1.9 +
    Math.cos(y * 0.006 - t * 0.11) * 1.7 +
    Math.sin((x * 0.002 - y * 0.0033) * 3.0 + t * 0.05) * 1.6
  );
}

// la constelacion de temas se encoge y se corre a la derecha para no
// pisar el bloque de texto del margen izquierdo
const netEsc = () => 0.85;
const netXOff = () => W * 0.05;
const netYOff = () => H * 0.05;

// compresion horizontal del mapa de secciones: mas ancho que alto,
// para librar el titulo arriba y el carrusel abajo
function secXS() {
  return Math.min(1.15, (W * 0.32) / (Math.min(W, H) * 0.38));
}
const secYOff = () => H * 0.01;

const ROT_SPEED = 0.22;
const secAng = (t: number) => 0.16 * Math.sin(t * 0.33);

let buckets: number[][] = [[], [], [], []]; // indices de particulas por tinte

function buildParticles() {
  const boxW = Math.min(W * 0.84, 1500);
  const boxH = Math.max(120, boxW * 0.30);
  const ox = (W - boxW) / 2;
  const oy = (H - boxH) / 2;
  const cx = W / 2, cy = H / 2;

  net = buildNetwork();
  sec = buildSections();
  const wts = sec.nodes.map((n) => n.imp * n.imp);
  const wsum = wts.reduce((a, b) => a + b, 0);
  const pickSec = () => {
    let r = Math.random() * wsum;
    for (let k = 0; k < wts.length; k++) { r -= wts[k]; if (r <= 0) return k; }
    return wts.length - 1;
  };

  const pts = sampleTextPoints(WORD, Math.floor(boxW), Math.floor(boxH));
  buckets = [[], [], [], []];
  word = pts.map((p, i) => {
    const hx = ox + p.x, hy = oy + p.y;
    let ang = Math.atan2(hy - cy, hx - cx);
    if (!isFinite(ang)) ang = Math.random() * Math.PI * 2;
    ang += (Math.random() - 0.5) * 1.1;
    const tinte = pickTinte();
    buckets[tinte].push(i);
    return {
      x: hx, y: hy, vx: 0, vy: 0,
      hx, hy,
      burstAng: ang,
      seed: Math.random() * 100,
      speed: 0.7 + Math.random() * 0.9,
      bright: 0.7 + Math.random() * 0.3,
      tinte,
      netNode: Math.floor(Math.random() * net!.nodes.length),
      secNode: pickSec(),
      no1: gauss(), no2: gauss(), no3: gauss(),
      tScale: 1,
    };
  });

  const nField = Math.floor((W * H) / 140);
  field = Array.from({ length: nField }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    px: 0, py: 0,
    speed: 60 + Math.random() * 130,
    gray: 100 + Math.random() * 90,
    seed: Math.random() * 100,
  }));
  field.forEach((f) => { f.px = f.x; f.py = f.y; });
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  sprites = sprites || makeSprites();
  makeBg();
  buildParticles();
  ctx.fillStyle = "#E7DECB";
  ctx.fillRect(0, 0, W, H);
}

function update(dt: number, tSec: number, u: number) {
  const P = phaseParams(u);
  const maxV = 620;

  const yawTarget = mx > -1e3 && !dragging ? (mx / W - 0.5) * 0.35 : yaw;
  yaw += (yawTarget - yaw) * Math.min(1, 3 * dt);

  const tilt = clamp(TILT + dragPitch, -0.6, 0.95);
  tcs = Math.cos(tilt); tsn = Math.sin(tilt);

  rotIdle += dt;
  const autoEase = (dragging || REDUCIDO) ? 0 : clamp((rotIdle - 3) / 2, 0, 1);
  autoAng += ROT_SPEED * autoEase * dt;

  angNet = autoAng + yaw + dragYaw;
  angSec = secAng(tSec) + yaw + dragYaw;

  if (P.secAmp > 0.9) secLabelTimer += dt;
  else if (P.secAmp < 0.5) secLabelTimer = 0;

  for (let i = 0; i < word.length; i++) {
    const p = word[i];

    if (P.snap) {
      p.x += (p.hx - p.x) * Math.min(1, 12 * dt);
      p.y += (p.hy - p.y) * Math.min(1, 12 * dt);
      if (Math.abs(p.x - p.hx) < 0.4 && Math.abs(p.y - p.hy) < 0.4) {
        p.x = p.hx; p.y = p.hy;
      }
      p.vx = 0; p.vy = 0;
      p.tScale = 1;
      continue;
    }

    if (P.attractWord > 0) {
      const k = 26 * P.attractWord;
      p.vx += (p.hx - p.x) * k * dt;
      p.vy += (p.hy - p.y) * k * dt;
    }
    if (P.attractNet > 0) {
      const T = proyecta(targetPoint3D(net!, p.netNode, p, 0.010), angNet, 1, netYOff(), netEsc(), netXOff());
      const k = 32 * P.attractNet;
      p.vx += (T.x - p.x) * k * dt;
      p.vy += (T.y - p.y) * k * dt;
      p.tScale = T.s;
    }
    if (P.attractSec > 0) {
      const T = proyecta(targetPoint3D(sec!, p.secNode, p, 0.014), angSec, secXS(), secYOff());
      const k = 32 * P.attractSec;
      p.vx += (T.x - p.x) * k * dt;
      p.vy += (T.y - p.y) * k * dt;
      p.tScale = T.s;
    }
    if (P.burst > 0) {
      const acc = 520 * P.burst * p.speed;
      p.vx += Math.cos(p.burstAng) * acc * dt;
      p.vy += Math.sin(p.burstAng) * acc * dt;
    }
    if (P.flow > 0) {
      const th = flowAngle(p.x, p.y, tSec + p.seed);
      const acc = 420 * P.flow * p.speed;
      p.vx += Math.cos(th) * acc * dt;
      p.vy += Math.sin(th) * acc * dt;
    }
    if (P.jitter > 0) {
      p.vx += Math.sin(tSec * 9 + p.seed * 7) * 810 * P.jitter * dt;
      p.vy += Math.cos(tSec * 8 + p.seed * 5) * 810 * P.jitter * dt;
    }

    const attracted = P.attractWord > 0 || P.attractNet > 0 || P.attractSec > 0;
    const f = Math.exp(-(attracted ? 5.5 : 1.4) * dt);
    p.vx *= f; p.vy *= f;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > maxV) { p.vx *= maxV / sp; p.vy *= maxV / sp; }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (P.flow > 0.6 && P.attractWord === 0 && P.attractNet < 0.3 && P.attractSec < 0.3) {
      if (p.x < -30) p.x = W + 30; else if (p.x > W + 30) p.x = -30;
      if (p.y < -30) p.y = H + 30; else if (p.y > H + 30) p.y = -30;
    }
  }

  for (let i = 0; i < field.length; i++) {
    const f = field[i];
    f.px = f.x; f.py = f.y;
    const th = flowAngle(f.x, f.y, tSec * 0.9 + f.seed);
    f.x += Math.cos(th) * f.speed * dt;
    f.y += Math.sin(th) * f.speed * dt;
    let wrapped = false;
    if (f.x < -20) { f.x = W + 20; wrapped = true; }
    else if (f.x > W + 20) { f.x = -20; wrapped = true; }
    if (f.y < -20) { f.y = H + 20; wrapped = true; }
    else if (f.y > H + 20) { f.y = -20; wrapped = true; }
    if (wrapped) { f.px = f.x; f.py = f.y; }
  }
}

// dibuja una red; los nodos etiquetados reaccionan al cursor y son botones
function drawNet(g: Grafo, amp: number, ang: number, tSec: number, isSections: boolean, xs = 1, yOff = 0, esc = 1, xOff = 0) {
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let k = 0; k < g.edges.length; k++) {
    const e = g.edges[k];
    const q0 = proyecta(g.nodes[e.i], ang, xs, yOff, esc, xOff);
    const q1 = proyecta(g.nodes[e.j], ang, xs, yOff, esc, xOff);
    const qc = proyecta(edgeCtrl3D(g, e, tSec), ang, xs, yOff, esc, xOff);
    const qm = proyecta(edgePoint3D(g, e, 0.5, tSec), ang, xs, yOff, esc, xOff);
    const depth = ss(0.62, 1.1, qm.s);
    const base = amp * (0.12 + 0.88 * depth);
    ctx.beginPath();
    ctx.moveTo(q0.x, q0.y);
    ctx.quadraticCurveTo(qc.x, qc.y, q1.x, q1.y);
    ctx.strokeStyle = "rgba(63,61,90,1)";
    ctx.lineWidth = 5 * qm.s;
    ctx.globalAlpha = base * 0.035;
    ctx.stroke();
    ctx.lineWidth = 1.8 * qm.s;
    ctx.globalAlpha = base * 0.08;
    ctx.stroke();
    ctx.strokeStyle = "rgba(45,35,46,1)";
    ctx.lineWidth = Math.max(0.4, 0.65 * qm.s);
    ctx.globalAlpha = base * 0.42;
    ctx.stroke();
    ctx.fillStyle = "#3f3d5a";
    for (let b = 0; b < e.beads.length; b++) {
      const bd = e.beads[b];
      const q = proyecta(edgePoint3D(g, e, bd.t, tSec), ang, xs, yOff, esc, xOff);
      ctx.globalAlpha = base * 0.75;
      ctx.beginPath();
      ctx.arc(q.x, q.y, bd.r * q.s, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.pulse) {
      const tp = (tSec * e.pulseSpeed + e.pulseOff) % 1;
      const q = proyecta(edgePoint3D(g, e, tp, tSec), ang, xs, yOff, esc, xOff);
      const pr = 7 * q.s;
      ctx.globalAlpha = base * 0.9;
      ctx.drawImage(sprites![e.pulseTinte], q.x - pr, q.y - pr, pr * 2, pr * 2);
    }
  }
  ctx.globalCompositeOperation = "source-over";

  const proj = g.nodes.map((n, idx) => {
    const q = proyecta(n, ang, xs, yOff, esc, xOff);
    return { n, q, idx, depth: ss(0.68, 1.12, q.s) };
  }).sort((A, B) => B.depth - A.depth);
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (let k = 0; k < proj.length; k++) {
    const { n, q, idx, depth } = proj[k];
    const a = amp * (0.15 + 0.85 * depth);
    let r = 8.5 * q.s * n.imp;

    const isHover = !hover && amp > 0.5 &&
      (mx - q.x) ** 2 + (my - q.y) ** 2 < (r + 12) ** 2;
    if (isHover) {
      hover = { tipo: isSections ? "seccion" : "tema", label: n.label };
      r *= 1.45;
    }

    const ci = n.colIdx !== undefined ? n.colIdx : 5;
    ctx.globalAlpha = Math.min(1, a * (isHover ? 0.55 : 0.3));
    ctx.drawImage(sprites![ci], q.x - r, q.y - r, r * 2, r * 2);
    ctx.globalAlpha = Math.min(1, a * 1.1);
    ctx.fillStyle = PALETA_CSS[ci];
    ctx.beginPath();
    ctx.arc(q.x, q.y, Math.max(1.4, 2.6 * q.s * n.imp) * (isHover ? 1.3 : 1), 0, Math.PI * 2);
    ctx.fill();
    if (isHover) {
      // anillo continuo de resalte (nunca punteado)
      ctx.globalAlpha = a * 0.6;
      ctx.strokeStyle = "rgba(45,35,46,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }

    // en el mapa de secciones la tipografia va unificada: mismo tamano
    // para las ocho etiquetas, sin variar con la profundidad
    const scale = isSections ? 1.75 : 1;
    const fpx = isSections
      ? Math.max(9, 12.4 * Math.min(1.35, W / 1200 + 0.55)) * scale
      : Math.max(9, (8.5 + 5.5 * depth) * Math.min(1.35, W / 1200 + 0.55)) * scale;
    ctx.fillStyle = isHover ? "#19131a" : "#3c323f";
    ctx.font = isSections
      ? `400 ${fpx.toFixed(1)}px Arial, "Helvetica Neue", sans-serif`
      : `${n.imp > 1.3 || isHover ? "600 " : "400 "}${fpx.toFixed(1)}px "Space Grotesk", Arial, sans-serif`;
    ctx.textBaseline = "middle";

    if (isSections) {
      const writeT = secLabelTimer - (0.5 + idx * 0.32);
      if (writeT <= 0) continue;
      const chars = Math.min(n.label.length, Math.floor(writeT / 0.05));
      if (chars <= 0) continue;
      const writing = chars < n.label.length;
      const caret = writing && (tSec * 2) % 1 < 0.65 ? "|" : "";
      const shown = n.label.slice(0, chars) + caret;
      ctx.globalAlpha = amp * 0.95;
      const above = n.side ? n.side === "above" : n.y > 0;
      const tw2 = ctx.measureText(n.label).width;
      const ly = q.y + (above ? -(r + fpx * 0.85) : r + fpx * 0.85);
      const lx = Math.min(W - 8 - tw2, Math.max(8, q.x - tw2 / 2));
      ctx.textAlign = "left";
      ctx.fillText(shown, lx, Math.min(H - fpx, Math.max(fpx, ly)));
      continue;
    }

    if (depth < 0.22 && !isHover) continue;
    if (q.x < 10 || q.x > W - 10 || q.y < 14 || q.y > H - 14) continue;
    ctx.globalAlpha = a * (isHover ? 1 : 0.3 + 0.7 * depth);
    const tw2 = ctx.measureText(n.label).width;
    const right = q.x + r + 5 + tw2 > W - 8;
    const lx = right ? q.x - r - 5 - tw2 : q.x + r + 5;
    const ly = q.y - r * 0.4;
    const box = { x0: lx - 4, x1: lx + tw2 + 4, y0: ly - fpx * 0.8, y1: ly + fpx * 0.8 };
    if (!isHover && placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
    placed.push(box);
    ctx.textAlign = "left";
    ctx.fillText(n.label, lx, ly);
  }
  ctx.globalAlpha = 1;
}

function render(tSec: number, u: number) {
  const P = phaseParams(u);
  const netsAmp = Math.max(P.netAmp, P.secAmp);
  hover = null;

  const trail = P.snap ? 0.5
    : netsAmp > 0 ? 0.16 + 0.24 * netsAmp
    : Math.min(0.4, 0.19 - 0.13 * P.fieldAmp + 0.25 * P.attractWord);

  // el fondo perlado es el destino del desvanecimiento de estelas
  ctx.globalAlpha = Math.min(1, trail);
  ctx.drawImage(bg!, 0, -(bgH - H) * u);
  ctx.globalAlpha = 1;

  if (P.fieldAmp > 0.02) {
    ctx.lineWidth = 1;
    for (let i = 0; i < field.length; i++) {
      const f = field[i];
      ctx.strokeStyle = `rgba(${(f.gray*0.28)|0},${(f.gray*0.26)|0},${(f.gray*0.38)|0},${0.22 * P.fieldAmp})`;
      ctx.beginPath();
      ctx.moveTo(f.px, f.py);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
    }
  }

  const dotsAlpha = 1 - ss(0.55, 0.95, P.textAlpha);
  if (dotsAlpha > 0.01) {
    ctx.globalCompositeOperation = "source-over";
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = TINTE_CSS[b];
      const idxs = buckets[b];
      for (let k = 0; k < idxs.length; k++) {
        const p = word[idxs[k]];
        const tw = 0.82 + 0.18 * Math.sin(tSec * 2.2 + p.seed * 3);
        let a = p.bright * tw * 0.62 * dotsAlpha;
        let d = 1.15 * (0.85 + 0.3 * p.speed);
        if (netsAmp > 0.3) {
          d = Math.min(2.0, 1.1 * p.tScale * p.tScale);
          a = p.bright * dotsAlpha * (0.04 + 0.12 * ss(0.72, 1.15, p.tScale));
        }
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillRect(p.x - d / 2, p.y - d / 2, d, d);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  if (P.netAmp > 0.03) drawNet(net!, P.netAmp, angNet, tSec, false, 1, netYOff(), netEsc(), netXOff());
  if (P.secAmp > 0.03) drawNet(sec!, P.secAmp, angSec, tSec, true, secXS(), secYOff());

  if (P.textAlpha > 0.01) {
    ctx.globalAlpha = P.textAlpha;
    ctx.fillStyle = "#2d232e";
    ctx.shadowColor = "rgba(45,35,46,0.28)";
    ctx.shadowBlur = 26 * P.textAlpha;
    ctx.font = `700 ${layout.fontPx}px "Neue Montreal", Arial, "Helvetica Neue", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(WORD, W / 2, H / 2 + layout.fontPx * 0.03);
    ctx.shadowBlur = 0;
    // subtitulo en Garet, alineado a la derecha del wordmark (Manual de Identidad)
    const subPx = Math.max(13, layout.fontPx * 0.105);
    const wordW = ctx.measureText(WORD).width;
    ctx.font = `500 ${subPx.toFixed(1)}px "Garet", Arial, sans-serif`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${(subPx * 0.14).toFixed(1)}px`;
    ctx.fillStyle = "#5e5dc7";
    ctx.globalAlpha = P.textAlpha * 0.85;
    ctx.textAlign = "right";
    ctx.fillText(SUBTITULO, W / 2 + wordW / 2, H / 2 + layout.fontPx * 0.62);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.textAlign = "center";
    ctx.globalAlpha = 1;
  }

  canvas.style.cursor = hover ? "pointer"
    : dragging ? "grabbing"
    : netsAmp > 0.5 ? "grab"
    : "default";
}

function limiteRecorrido() {
  return Math.max(1, recorrido.offsetHeight - window.innerHeight);
}
function scrollU() {
  return clamp(window.scrollY / limiteRecorrido(), 0, 1);
}
function veloT() {
  return clamp((window.scrollY - limiteRecorrido()) / (window.innerHeight * 0.75), 0, 1);
}

function setCapa(el: HTMLElement, op: number) {
  el.style.opacity = op.toFixed(3);
  el.style.visibility = op < 0.02 ? "hidden" : "visible";
  el.style.transform = `translateY(${((1 - op) * 14).toFixed(1)}px)`;
}

let fichaTimer = 0;
function syncUI(u: number, tSec: number) {
  const vt = veloT();
  setCapa(capaHero, (1 - ss(0.05, 0.115, u)) * (1 - vt));
  setCapa(capaTemas, ss(0.40, 0.46, u) * (1 - ss(0.545, 0.60, u)));
  setCapa(capaSecciones, ss(0.645, 0.70, u) * (1 - ss(0.845, 0.885, u)));
  setCapa(capaCierre, ss(0.955, 0.99, u) * (1 - vt));
  velo.style.opacity = vt.toFixed(3);
  document.body.classList.toggle("en-portal", vt > 0.5);

  // ficha de la seccion bajo el cursor (con una breve persistencia)
  const h = hover;
  if (h && h.tipo === "seccion") {
    const s = SECTIONS.find((x) => x.label === h.label);
    if (s && fsNombre.textContent !== s.label) {
      fsNombre.textContent = s.label;
      fsDesc.textContent = s.desc;
    }
    ficha.classList.add("visible");
    fichaTimer = tSec;
  } else if (tSec - fichaTimer > 0.35) {
    ficha.classList.remove("visible");
  }

  // riel de progreso
  const activo = vt > 0.4 ? 3 : u < 0.28 ? 0 : u < 0.62 ? 1 : u < 0.93 ? 2 : 3;
  rielBotones.forEach((b, i) => b.classList.toggle("activo", i === activo));
}

let lastT = 0;
let qaPaused = false;
let qaU: number | null = null;
function frame(now: number) {
  const dt = Math.min(0.033, (now - lastT) / 1000 || 0.016);
  lastT = now;
  if (!qaPaused) {
    const target = qaU !== null ? qaU : scrollU();
    uSmooth += (target - uSmooth) * Math.min(1, 3.5 * dt);
    update(dt, now * 0.001, uSmooth);
    render(now * 0.001, uSmooth);
    syncUI(uSmooth, now * 0.001);
  }
  // el id se guarda para poder cancelarlo en destruir()
  rafId = requestAnimationFrame(frame);
}

function pickAt(x: number, y: number): Hover {
  const P = phaseParams(uSmooth);
  const capas: { g: Grafo; ang: number; xs: number; yOff: number; esc: number; xOff: number; tipo: TipoNodo }[] = [];
  if (P.secAmp > 0.4) capas.push({ g: sec!, ang: angSec, xs: secXS(), yOff: secYOff(), esc: 1, xOff: 0, tipo: "seccion" });
  if (P.netAmp > 0.4) capas.push({ g: net!, ang: angNet, xs: 1, yOff: netYOff(), esc: netEsc(), xOff: netXOff(), tipo: "tema" });
  for (const c of capas) {
    for (const n of c.g.nodes) {
      const q = proyecta(n, c.ang, c.xs, c.yOff, c.esc, c.xOff);
      const r = 8.5 * q.s * n.imp + 14;
      if ((x - q.x) ** 2 + (y - q.y) ** 2 < r * r) return { tipo: c.tipo, label: n.label };
    }
  }
  return null;
}

  /* ------- interaccion con el lienzo ------- */

  // Los oyentes se registran en una lista para poder retirarlos: el sitio
  // original nunca se desmonta, un componente de React sí.
  type Oyente = { destino: EventTarget; tipo: string; fn: EventListener };
  const oyentes: Oyente[] = [];
  const escuchar = (destino: EventTarget, tipo: string, fn: EventListener) => {
    destino.addEventListener(tipo, fn);
    oyentes.push({ destino, tipo, fn });
  };

  escuchar(window, "resize", () => resize());
  escuchar(window, "pointermove", ((ev: PointerEvent) => {
    if (dragging) {
      dragYaw += (ev.clientX - lastMX) * 0.005;
      dragPitch += (ev.clientY - lastMY) * 0.004;
      dragMoved += Math.abs(ev.clientX - lastMX) + Math.abs(ev.clientY - lastMY);
      rotIdle = 0;
    }
    lastMX = ev.clientX; lastMY = ev.clientY;
    mx = ev.clientX; my = ev.clientY;
  }) as EventListener);
  escuchar(window, "pointerout", ((ev: PointerEvent) => {
    if (!ev.relatedTarget) { mx = -1e4; my = -1e4; }
  }) as EventListener);
  escuchar(canvas, "pointerdown", ((ev: PointerEvent) => {
    if (ev.pointerType !== "mouse") return; // en tactil, el gesto es scroll
    dragging = true; dragMoved = 0;
    lastMX = ev.clientX; lastMY = ev.clientY;
  }) as EventListener);
  escuchar(window, "pointerup", () => { dragging = false; });
  escuchar(canvas, "click", ((ev: MouseEvent) => {
    if (dragMoved > 6) { dragMoved = 0; return; }
    const h = hover || pickAt(ev.clientX, ev.clientY);
    if (h) o.alAbrirPanel(h.tipo, h.label);
  }) as EventListener);

  /* ------- navegacion por scroll (marco, riel, botones) ------- */
  // index.html:2006-2021. Vive aquí porque necesita limiteRecorrido().

  function irAU(u: number) {
    window.scrollTo({ top: u * limiteRecorrido(), behavior: REDUCIDO ? "auto" : "smooth" });
  }
  function irA(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: REDUCIDO ? "auto" : "smooth" });
  }
  escuchar(document, "click", ((ev: MouseEvent) => {
    const b = (ev.target as HTMLElement | null)?.closest<HTMLElement>("[data-u], [data-ir]");
    if (!b) return;
    ev.preventDefault();
    o.alCerrarPanel();
    if (b.dataset.u !== undefined) irAU(parseFloat(b.dataset.u));
    else irA(b.dataset.ir!);
  }) as EventListener);

  /* ------- gancho de idioma: etiquetas del canvas y subtitulo ------- */
  const alCambiarIdioma = () => {
    SUBTITULO = TR("El punto donde las ideas se conectan");
    if (net) net.nodes.forEach((n) => { if (n.label0) n.label = TR(n.label0); });
    if (sec) sec.nodes.forEach((n) => {
      if (n.label0) { n.label = TR(n.label0); n.desc = TR(n.desc0!); }
    });
  };
  (window as unknown as { __alCambiarIdioma?: () => void }).__alCambiarIdioma =
    alCambiarIdioma;

  /* ------- arranque ------- */

  resize();
  uSmooth = scrollU(); // si la pagina carga a mitad del recorrido, sin carreras
  rafId = requestAnimationFrame(frame);
  // re-muestrear la palabra cuando las tipografias web ya cargaron
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => buildParticles());
  }

  // hook de QA para verificacion sin scroll real: fija el estado en u (0 a 1)
  const qa = {
    /**
     * Devuelve el motor a su estado recién arrancado y lo congela.
     *
     * Se llama UNA vez antes de la primera captura. El motor auto-rota tras
     * 3 s de inactividad acumulando autoAng en cada cuadro real
     * (index.html:1507-1511), así que sin esto el ángulo de la red dependería
     * de cuánto tardó la página en cargar. El sitio original evita ese
     * problema en las pruebas anulando requestAnimationFrame; aquí no se
     * puede, porque React 19 programa su render sobre rAF y sin él el
     * componente del lienzo nunca monta.
     *
     * Deliberadamente NO va dentro de runTo: en el original autoAng sí se
     * acumula entre llamadas sucesivas a runTo (cada una simula 3 s), y hay
     * que reproducir esa acumulación para que las capturas coincidan.
     */
    reset() {
      qaPaused = true;
      autoAng = 0;
      rotIdle = 10;
      yaw = 0;
      dragYaw = 0;
      dragPitch = 0;
      secLabelTimer = 0;
      mx = -1e4;
      my = -1e4;
    },
    runTo(u: number, seconds = 3) {
      qaPaused = true;
      resize();
      uSmooth = u;
      const steps = Math.floor(seconds * 60);
      const dt = 1 / 60;
      let t = -seconds;
      for (let i = 0; i < steps; i++) {
        t += dt;
        update(dt, t, u);
        render(t, u);
      }
      syncUI(u, 0);
    },
    resume(u: number | null = null) { qaU = u; qaPaused = false; },
  };
  (window as unknown as { __qa?: typeof qa }).__qa = qa;

  function destruir() {
    cancelAnimationFrame(rafId);
    for (const { destino, tipo, fn } of oyentes) {
      destino.removeEventListener(tipo, fn);
    }
    oyentes.length = 0;
    const w = window as unknown as {
      __qa?: unknown;
      __alCambiarIdioma?: unknown;
    };
    if (w.__qa === qa) delete w.__qa;
    if (w.__alCambiarIdioma === alCambiarIdioma) delete w.__alCambiarIdioma;
  }

  return { destruir };
}
