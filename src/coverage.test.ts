import { describe, expect, it } from "vitest";

import { coverageOf, raggedOf, scratchedShare, scratchStroke } from "./coverage.ts";

describe("scratchStroke", () => {
  it("counts the cells a stroke passes over, once each", () => {
    const coverage = coverageOf(80, 40, 8);
    expect(coverage.columns).toBe(10);
    expect(coverage.rows).toBe(5);
    const fresh = scratchStroke(coverage, { x: 0, y: 20 }, { x: 80, y: 20 }, 5);
    // The middle row's ten cells; the rows beside it are 8 pixels off, past the 5.
    expect(fresh).toBe(10);
    expect(scratchStroke(coverage, { x: 0, y: 20 }, { x: 80, y: 20 }, 5)).toBe(0);
    expect(scratchedShare(coverage)).toBeCloseTo(10 / 50);
  });

  it("scratches round a single press", () => {
    const coverage = coverageOf(64, 64, 8);
    expect(scratchStroke(coverage, { x: 32, y: 32 }, { x: 32, y: 32 }, 6)).toBe(4);
  });

  it("scratches it all with strokes enough", () => {
    const coverage = coverageOf(100, 60, 10);
    for (let y = 0; y <= 60; y += 10) scratchStroke(coverage, { x: 0, y }, { x: 100, y }, 8);
    expect(scratchedShare(coverage)).toBe(1);
  });
});

describe("raggedOf", () => {
  it("draws the same stroke for the same seed, and a different one for another", () => {
    expect(raggedOf(20, 7)).toEqual(raggedOf(20, 7));
    expect(raggedOf(20, 7)).not.toEqual(raggedOf(20, 8));
    for (const [offset, width] of raggedOf(20, 3)) {
      expect(Math.abs(offset)).toBeLessThanOrEqual(4.2);
      expect(width).toBeGreaterThan(0);
    }
  });
});
