import { describe, expect, it } from "vitest";

import { domeOf, heightAt, puffinessOf, slopeAt } from "./dome.ts";

describe("puffinessOf", () => {
  it("is 0 unless puffy, 1 for true, and the number given", () => {
    expect(puffinessOf(undefined)).toBe(0);
    expect(puffinessOf(false)).toBe(0);
    expect(puffinessOf(true)).toBe(1);
    expect(puffinessOf(0.5)).toBe(0.5);
    expect(puffinessOf(-2)).toBe(0);
  });
});

describe("the dome", () => {
  const dome = domeOf(1, { width: 200, height: 120 });

  it("is sized by the box's shorter side, and flat when it isn't puffy", () => {
    expect(dome.rim).toBe(24);
    expect(dome.height).toBeCloseTo(10.8);
    expect(domeOf(0, { width: 200, height: 120 }).height).toBe(0);
    expect(domeOf(2, { width: 200, height: 120 }).height).toBeCloseTo(21.6);
  });

  it("rises from the edge to its height over the rim, and lies flat beyond", () => {
    expect(heightAt(0, dome)).toBe(0);
    expect(heightAt(dome.rim, dome)).toBeCloseTo(dome.height);
    expect(heightAt(dome.rim * 3, dome)).toBeCloseTo(dome.height);
    let last = -1;
    for (let depth = 0; depth <= dome.rim; depth += 1) {
      const height = heightAt(depth, dome);
      expect(height).toBeGreaterThan(last);
      last = height;
    }
  });

  it("is steepest at the edge, never upright, and level from the rim in", () => {
    const edge = slopeAt(0, dome);
    expect(edge).toBeCloseTo((3 * dome.height) / dome.rim);
    expect(Math.atan(edge)).toBeLessThan((60 * Math.PI) / 180);
    expect(slopeAt(dome.rim / 2, dome)).toBeLessThan(edge);
    expect(slopeAt(dome.rim, dome)).toBe(0);
  });

  it("has a slope that is its height's", () => {
    for (const depth of [1, 5, 12, 20]) {
      const step = 1e-4;
      expect(slopeAt(depth, dome)).toBeCloseTo((heightAt(depth + step, dome) - heightAt(depth - step, dome)) / (2 * step), 4);
    }
  });
});
