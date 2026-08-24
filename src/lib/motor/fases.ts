/**
 * Matemática de fases del recorrido. Portado literal de index.html:
 * PH en :1071-1082, ss en :1454-1457, phaseParams en :1459-1495.
 */

import { clamp } from "../texto";

export type Fase = {
  jitter: number;
  burst: number;
  flow: number;
  attractWord: number;
  attractNet: number;
  attractSec: number;
  netAmp: number;
  secAmp: number;
  fieldAmp: number;
  snap: boolean;
  textAlpha: number;
};

// fases del recorrido como fracciones del scroll del espaciador (u en [0,1])
export const PH = {
  formedEnd:   0.09,
  jitterEnd:   0.14,
  dissolveEnd: 0.26,
  fieldEnd:    0.33,
  toNetEnd:    0.40,
  netEnd:      0.56,
  toSecEnd:    0.64,
  secEnd:      0.86,
  regroupEnd:  0.965,
};

export function ss(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function phaseParams(u: number): Fase {
  const P: Fase = { jitter: 0, burst: 0, flow: 0, attractWord: 0, attractNet: 0,
              attractSec: 0, netAmp: 0, secAmp: 0, fieldAmp: 0,
              snap: false, textAlpha: 0 };
  if (u < PH.formedEnd) {
    P.snap = true; P.attractWord = 1; P.textAlpha = 1; P.fieldAmp = 0.12;
  } else if (u < PH.jitterEnd) {
    const t = ss(PH.formedEnd, PH.jitterEnd, u);
    P.attractWord = 1; P.jitter = t; P.textAlpha = 1 - t; P.fieldAmp = 0.2;
  } else if (u < PH.dissolveEnd) {
    const t = ss(PH.jitterEnd, PH.dissolveEnd, u);
    P.jitter = 1 - t; P.burst = t; P.flow = t; P.fieldAmp = 0.3 + 0.7 * t;
  } else if (u < PH.fieldEnd) {
    P.burst = 0.08; P.flow = 1; P.fieldAmp = 1;
  } else if (u < PH.toNetEnd) {
    const t = ss(PH.fieldEnd, PH.toNetEnd, u);
    P.flow = 1 - t; P.attractNet = 0.25 + 0.75 * t; P.netAmp = t;
    P.fieldAmp = 1 - 0.92 * t;
  } else if (u < PH.netEnd) {
    P.attractNet = 1; P.netAmp = 1; P.fieldAmp = 0.2;
  } else if (u < PH.toSecEnd) {
    const t = ss(PH.netEnd, PH.toSecEnd, u);
    P.attractNet = 1 - t; P.netAmp = 1 - t;
    P.attractSec = t; P.secAmp = t;
    P.fieldAmp = 0.2;
  } else if (u < PH.secEnd) {
    P.attractSec = 1; P.secAmp = 1; P.fieldAmp = 0.2;
  } else if (u < PH.regroupEnd) {
    const t = ss(PH.secEnd, PH.regroupEnd, u);
    P.attractWord = t; P.attractSec = 1 - t; P.secAmp = 1 - t;
    P.fieldAmp = 0.16;
    P.textAlpha = ss(0.78, 1, t);
  } else {
    P.snap = true; P.attractWord = 1; P.textAlpha = 1; P.fieldAmp = 0.12;
  }
  return P;
}
