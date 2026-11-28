import { describe, expect, it } from "vitest";

import { cutOf } from "./field.ts";
import { foldFor } from "./peel.ts";
import { areaOf, jagAt, jagMost, keptSamples, NO_TEAR, pastTear, speedOf, TEAR_SPEED, tearSheet, tearSpeedOf, whole } from "./tear.ts";

describe("tearSpeedOf", () => {
  it("never tears unless asked, at TEAR_SPEED for true, and at the speed given", () => {
    expect(tearSpeedOf(undefined)).toBe(Infinity);
    expect(tearSpeedOf(false)).toBe(Infinity);
    expect(tearSpeedOf(true)).toBe(TEAR_SPEED);
    expect(tearSpeedOf(600)).toBe(600);
    expect(tearSpeedOf(-3)).toBe(Infinity);
  });
});

describe("speedOf", () => {
  it("measures the pointer's speed over the last few moves", () => {
    const samples = [0, 16, 32, 48, 64].map((time) => ({ x: time * 0.5, y: 0, time }));
    expect(speedOf(samples, 64)).toBeCloseTo(500);
  });

  it("forgets moves from before the window, keeping one to measure from", () => {
    const samples = [
      { x: 0, y: 0, time: 0 },
      { x: 300, y: 0, time: 10 },
      { x: 300, y: 0, time: 200 },
      { x: 310, y: 0, time: 300 },
    ];
    expect(keptSamples(samples, 300)).toEqual(samples.slice(2));
    expect(speedOf(samples, 300)).toBeCloseTo(100);
  });

  it("doesn't take two moves a hair apart for a yank", () => {
    expect(speedOf([{ x: 0, y: 0, time: 100 }, { x: 4, y: 0, time: 100.5 }], 100.5)).toBeCloseTo(500);
    expect(speedOf([{ x: 0, y: 0, time: 0 }], 0)).toBe(0);
  });
});

describe("the torn edge", () => {
  it("wanders a little either side of the fold's front, the same way each time for a seed", () => {
    const size = 200;
    const most = jagMost(size);
    let wanders = 0;
    for (let t = -100; t <= 100; t += 0.7) {
      const jag = jagAt(t, 3, size);
      expect(Math.abs(jag)).toBeLessThanOrEqual(most);
      expect(jagAt(t, 3, size)).toBe(jag);
      wanders = Math.max(wanders, Math.abs(jag));
    }
    expect(wanders).toBeGreaterThan(most * 0.3);
    expect(jagAt(17, 3, size)).not.toBe(jagAt(17, 4, size));
  });
});

describe("tearSheet", () => {
  // A disc of radius 30 in a 64-pixel field, peeled from its right-hand edge.
  const size = 64;
  const alpha = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.hypot(x + 0.5 - 32, y + 0.5 - 32) <= 30) alpha[y * size + x] = 255;
  const cut = cutOf(alpha, size, size, 0, 0);
  const sheet = whole(cut.field, cut.depth, size, size);
  const fold = foldFor({ x: 61, y: 32 }, { x: 41, y: 32 }, { x: 1, y: 0 }, 4);
  const { kept, piece } = tearSheet(sheet, fold, 1, 5, size);

  it("parts the sheet in two: every bit of it is in one or the other, never both", () => {
    for (let i = 0; i < sheet.field.length; i++) {
      const inKept = kept.field[i] < 0;
      const inPiece = piece.field[i] < 0;
      if (sheet.field[i] < 0) expect(inKept !== inPiece || Math.abs(kept.field[i]) < 1).toBe(true);
      else expect(inKept || inPiece).toBe(false);
    }
    expect(areaOf(kept) + areaOf(piece)).toBeGreaterThan(areaOf(sheet) * 0.97);
    expect(areaOf(piece)).toBeLessThan(areaOf(kept));
  });

  it("takes the part lifted, past the fold's front", () => {
    const at = (s: typeof sheet, x: number, y: number) => s.field[y * size + x];
    expect(at(piece, 58, 32)).toBeLessThan(0);
    expect(at(kept, 58, 32)).toBeGreaterThan(0);
    expect(at(kept, 20, 32)).toBeLessThan(0);
    expect(pastTear(fold, { x: 20, y: 32 }, 5, size)).toBeLessThan(0);
  });

  it("keeps how far each point is from the torn edge, on both sides, and none for a sheet not torn", () => {
    expect(sheet.torn[32 * size + 20]).toBe(NO_TEAR);
    const edge = Math.round(fold.x);
    expect(kept.torn[32 * size + edge - 1]).toBeLessThan(jagMost(size) + 2);
    expect(kept.torn[32 * size + 10]).toBeGreaterThan(20);
  });

  it("brings a dome down to the torn edge", () => {
    const edge = Math.round(fold.x - jagMost(size) - 2);
    expect(kept.depth[32 * size + edge]).toBeLessThan(sheet.depth[32 * size + edge]);
  });
});
