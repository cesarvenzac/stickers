import { describe, expect, it } from "vitest";

import { chargeAfter, FILL, glowOf, HALF } from "./phosphor.ts";

describe("chargeAfter", () => {
  it("fades a full charge to half in HALF seconds in the dark, and a quarter in three times that", () => {
    expect(chargeAfter(1, 0, HALF)).toBeCloseTo(0.5, 9);
    expect(chargeAfter(1, 0, 3 * HALF)).toBeCloseTo(0.25, 9);
  });

  it("charges quickly in the light", () => {
    expect(chargeAfter(0, 1, FILL)).toBeCloseTo(1 - Math.exp(-1), 9);
    expect(chargeAfter(0.2, 1, 10)).toBeCloseTo(1, 4);
  });

  it("lands where one step does, in steps of any length", () => {
    for (const light of [0, 0.3, 1]) {
      let charge = light ? 0 : 1;
      for (let i = 0; i < 40; i++) charge = chargeAfter(charge, light, 0.05);
      expect(charge).toBeCloseTo(chargeAfter(light ? 0 : 1, light, 2), 9);
    }
  });

  it("holds at what a little light keeps it at, fading down to it or charging up to it", () => {
    expect(chargeAfter(1, 0.3, 600)).toBeCloseTo(0.3, 1);
    expect(chargeAfter(0, 0.3, 600)).toBeCloseTo(0.3, 6);
  });
});

describe("glowOf", () => {
  it("never quite goes out", () => {
    expect(glowOf(0)).toBeGreaterThan(0);
    expect(glowOf(1)).toBe(1);
  });
});
