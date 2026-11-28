import { describe, expect, it } from "vitest";

import { cutOf, distanceTo, edgeAt, extentAlong, fieldAt, fillHoles, hullOf, signedField } from "./field.ts";

/** A disc of `radius` pixels at the middle of a `size` square, as alpha. */
function disc(size: number, radius: number, cx = size / 2, cy = size / 2) {
  const alpha = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= radius) alpha[y * size + x] = 255;
  return alpha;
}

describe("distanceTo", () => {
  it("measures the straight distance to the nearest pixel of the set", () => {
    const set = new Uint8Array(9 * 9);
    set[4 * 9 + 4] = 1;
    const distance = distanceTo(set, 9, 9);
    expect(distance[4 * 9 + 4]).toBe(0);
    expect(distance[4 * 9 + 7]).toBeCloseTo(3);
    expect(distance[0]).toBeCloseTo(Math.hypot(4, 4));
  });

  it("works on a picture wider than it's tall", () => {
    const set = new Uint8Array(20 * 3);
    set[1 * 20 + 19] = 1;
    expect(distanceTo(set, 20, 3)[1 * 20]).toBeCloseTo(19);
  });
});

describe("signedField", () => {
  it("is negative inside, positive outside and ±0.5 either side of the edge", () => {
    const inside = new Uint8Array(10);
    inside.fill(1, 0, 5);
    const field = signedField(inside, 10, 1);
    expect(field[4]).toBeCloseTo(-0.5);
    expect(field[5]).toBeCloseTo(0.5);
    expect(field[0]).toBeCloseTo(-4.5);
    expect(field[9]).toBeCloseTo(4.5);
  });
});

describe("fillHoles", () => {
  it("fills what can't be reached from the edge and leaves the rest", () => {
    // A ring: its middle is a hole, its outside isn't.
    const size = 9;
    const shape = new Uint8Array(size * size);
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) shape[y * size + x] = x === 4 && y === 4 ? 0 : 1;
    fillHoles(shape, size, size);
    expect(shape[4 * size + 4]).toBe(1);
    expect(shape[0]).toBe(0);
  });
});

describe("cutOf", () => {
  it("measures an anti-aliased edge to a fraction of a pixel", () => {
    // A half-plane whose edge falls 0.3 of the way into column 20.
    const alpha = new Uint8Array(40 * 8);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 40; x++) alpha[y * 40 + x] = x < 20 ? 255 : x === 20 ? Math.round(0.3 * 255) : 0;
    const cut = cutOf(alpha, 40, 8, 0, 0);
    expect(fieldAt(cut, 20.3, 4)).toBeCloseTo(0, 1);
    // Further off, the fraction counts for less (distances add in quadrature): within a quarter pixel.
    expect(Math.abs(fieldAt(cut, 22.3, 4) - 2)).toBeLessThan(0.25);
  });

  it("grows the art by its outline", () => {
    const cut = cutOf(disc(64, 12), 64, 64, 6, 0);
    // The disc's edge was 12 from the middle; the cut's is 18.
    // The disc's whole pixels end half a pixel in from its radius: the cut's edge is 17.5 out.
    expect(Math.abs(fieldAt(cut, 32 + 17.5, 32))).toBeLessThan(0.25);
    expect(fieldAt(cut, 32 + 16.5, 32)).toBeCloseTo(-1, 0);
    expect(fieldAt(cut, 32 + 18.5, 32)).toBeCloseTo(1, 0);
    // Deep inside, it only has to be inside.
    expect(fieldAt(cut, 32, 32)).toBeLessThan(-12);
    expect(cut.empty).toBe(false);
  });

  it("closes a gap narrower than its smoothing and fills the hole in a ring", () => {
    const size = 80;
    const alpha = new Uint8Array(size * size);
    // Two blocks 6 pixels apart, outlined by 2: a 2 pixel gap, closed by smoothing 6.
    for (let y = 30; y < 50; y++) for (let x = 10; x < 37; x++) alpha[y * size + x] = 255;
    for (let y = 30; y < 50; y++) for (let x = 43; x < 70; x++) alpha[y * size + x] = 255;
    expect(fieldAt(cutOf(alpha, size, size, 2, 0), 40, 40)).toBeGreaterThan(0);
    expect(fieldAt(cutOf(alpha, size, size, 2, 6), 40, 40)).toBeLessThan(0);
    const ring = disc(80, 30);
    const hole = disc(80, 20);
    for (let i = 0; i < ring.length; i++) if (hole[i]) ring[i] = 0;
    expect(fieldAt(cutOf(ring, 80, 80, 2, 2), 40, 40)).toBeLessThan(0);
  });

  it("measures how deep each point is from the outer edge, a filled hole as deep as its ring", () => {
    const solid = cutOf(disc(80, 30), 80, 80, 0, 0);
    const at = (cut: ReturnType<typeof cutOf>, x: number, y: number) => cut.depth[y * 80 + x];
    // As deep as the field says, where nothing's been filled: deeper toward the middle, 0 outside.
    for (const x of [40, 55, 65, 69]) expect(at(solid, x, 40)).toBeCloseTo(-solid.field[40 * 80 + x], 5);
    expect(at(solid, 40, 40)).toBeGreaterThan(27);
    expect(at(solid, 70, 40)).toBe(0);
    expect(at(solid, 2, 2)).toBe(0);
    // A ring whose hole is filled is as deep as a disc there, to a pixel, where the field is shallow.
    const ring = disc(80, 30);
    const hole = disc(80, 12);
    for (let i = 0; i < ring.length; i++) if (hole[i]) ring[i] = 0;
    const filled = cutOf(ring, 80, 80, 0, 0);
    for (const x of [40, 48, 53, 60]) expect(Math.abs(at(filled, x, 40) - at(solid, x, 40))).toBeLessThan(1.6);
    expect(-filled.field[40 * 80 + 40]).toBeLessThan(1);
  });

  it("says when there's nothing to cut round", () => {
    const cut = cutOf(new Uint8Array(16), 4, 4, 2);
    expect(cut.empty).toBe(true);
    expect(fieldAt(cut, 2, 2)).toBeGreaterThan(0);
  });
});

describe("edgeAt", () => {
  it("finds the nearest edge and the way out", () => {
    const cut = cutOf(disc(64, 20), 64, 64, 0, 0);
    const edge = edgeAt(cut, 32 + 15, 32);
    expect(edge.distance).toBeCloseTo(-5, 0);
    expect(edge.normal.x).toBeCloseTo(1, 1);
    expect(edge.normal.y).toBeCloseTo(0, 1);
    expect(edge.nearest.x).toBeCloseTo(52, 0);
  });
});

describe("hullOf and extentAlong", () => {
  it("reach as far as the shape does, each way", () => {
    const cut = cutOf(disc(64, 20), 64, 64, 0, 0);
    const hull = hullOf(cut);
    const across = extentAlong(hull, { x: 1, y: 0 });
    expect(across.least).toBeCloseTo(12, 0);
    expect(across.most).toBeCloseTo(52, 0);
    const diagonal = extentAlong(hull, { x: Math.SQRT1_2, y: Math.SQRT1_2 });
    expect(diagonal.most - diagonal.least).toBeCloseTo(40, -0.5);
  });
});
