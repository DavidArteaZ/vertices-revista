import { describe, it, expect } from "vitest";
import { PH, ss, phaseParams } from "@/lib/motor/fases";

const AMPLITUDES = [
  "jitter",
  "burst",
  "flow",
  "attractWord",
  "attractNet",
  "attractSec",
  "netAmp",
  "secAmp",
  "fieldAmp",
  "textAlpha",
] as const;

describe("ss (smoothstep)", () => {
  it("clamps outside the range and eases inside it", () => {
    expect(ss(0, 1, -1)).toBe(0);
    expect(ss(0, 1, 2)).toBe(1);
    expect(ss(0, 1, 0.5)).toBe(0.5);
    expect(ss(0, 1, 0.25)).toBeCloseTo(0.15625, 5);
  });
});

describe("phaseParams", () => {
  it("snaps the wordmark at the very start and the very end", () => {
    for (const u of [0, 1]) {
      const p = phaseParams(u);
      expect(p.snap).toBe(true);
      expect(p.attractWord).toBe(1);
      expect(p.textAlpha).toBe(1);
    }
  });

  it("shows the topic network in the net phase and nothing else", () => {
    const p = phaseParams((PH.toNetEnd + PH.netEnd) / 2);
    expect(p.netAmp).toBe(1);
    expect(p.attractNet).toBe(1);
    expect(p.secAmp).toBe(0);
  });

  it("shows the section map in the sec phase and nothing else", () => {
    const p = phaseParams((PH.toSecEnd + PH.secEnd) / 2);
    expect(p.secAmp).toBe(1);
    expect(p.attractSec).toBe(1);
    expect(p.netAmp).toBe(0);
  });

  it("crossfades net into sec without ever showing both at full strength", () => {
    for (let u = PH.netEnd; u <= PH.toSecEnd; u += 0.005) {
      const p = phaseParams(u);
      expect(p.netAmp + p.secAmp).toBeLessThanOrEqual(1.0001);
    }
  });

  it("keeps every amplitude within [0,1] across the whole journey", () => {
    for (let u = 0; u <= 1; u += 0.002) {
      const p = phaseParams(u);
      for (const k of AMPLITUDES) {
        expect(p[k], `${k} at u=${u.toFixed(3)}`).toBeGreaterThanOrEqual(0);
        expect(p[k], `${k} at u=${u.toFixed(3)}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("dissolves the wordmark text before the network appears", () => {
    expect(phaseParams(PH.dissolveEnd).textAlpha).toBe(0);
    expect(phaseParams(PH.fieldEnd).textAlpha).toBe(0);
  });

  it("only snaps at the two ends, never mid-journey", () => {
    for (let u = PH.formedEnd; u < PH.regroupEnd; u += 0.005) {
      expect(phaseParams(u).snap, `snap at u=${u.toFixed(3)}`).toBe(false);
    }
  });

  it("keeps the particle field alive through every phase", () => {
    for (let u = 0; u <= 1; u += 0.002) {
      expect(phaseParams(u).fieldAmp, `fieldAmp at u=${u.toFixed(3)}`).toBeGreaterThan(0);
    }
  });
});
