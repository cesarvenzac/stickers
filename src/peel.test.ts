import { describe, expect, it } from "vitest";

import { cornerNear, FLAT, foldFor, layersAt, liftedShare, pastFold, placeOf, pullToLift, reachFor, rolled, travel } from "./peel.ts";

const RADIUS = 10;

describe("rolled", () => {
  it("rolls the sheet half way round the cylinder, then lays it flat on top", () => {
    expect(rolled(0, RADIUS)).toEqual({ along: 0, height: 0 });
    const quarter = rolled((Math.PI / 2) * RADIUS, RADIUS);
    expect(quarter.along).toBeCloseTo(RADIUS);
    expect(quarter.height).toBeCloseTo(RADIUS);
    const half = rolled(Math.PI * RADIUS, RADIUS);
    expect(half.along).toBeCloseTo(0);
    expect(half.height).toBeCloseTo(2 * RADIUS);
    expect(rolled(Math.PI * RADIUS + 30, RADIUS).along).toBeCloseTo(-30);
  });
});

describe("reachFor", () => {
  it("undoes travel, on the cylinder and past it", () => {
    for (const a of [0.5, 3, 12, 31, 40, 100]) expect(reachFor(travel(a, RADIUS), RADIUS)).toBeCloseTo(a, 6);
  });

  it("is 0 for no pull", () => {
    expect(reachFor(0, RADIUS)).toBe(0);
  });
});

describe("foldFor", () => {
  const outward = { x: 1, y: 0 };
  const grab = { x: 100, y: 50 };

  it("carries the grabbed point under the pointer when pulled straight back", () => {
    for (const pull of [2, 20, 60, 150]) {
      const pointer = { x: grab.x - pull, y: grab.y };
      const fold = foldFor(grab, pointer, outward, RADIUS);
      const seen = placeOf(fold, grab);
      expect(seen.x).toBeCloseTo(pointer.x, 6);
      expect(seen.y).toBeCloseTo(pointer.y, 6);
    }
  });

  it("lifts square to the edge, then turns toward the pull", () => {
    const small = foldFor(grab, { x: grab.x - 1, y: grab.y - 1 }, outward, RADIUS);
    const large = foldFor(grab, { x: grab.x - 100, y: grab.y - 100 }, outward, RADIUS);
    expect(small.nx).toBeGreaterThan(0.9);
    expect(large.nx).toBeCloseTo(large.ny, 1);
  });

  it("can't fold the sticker away from itself", () => {
    const fold = foldFor(grab, { x: grab.x + 80, y: grab.y }, outward, RADIUS);
    expect(fold.nx).toBeCloseTo(1);
    expect(pastFold(fold, grab)).toBeCloseTo(0);
  });
});

describe("layersAt", () => {
  const fold = foldFor({ x: 100, y: 50 }, { x: 20, y: 50 }, { x: 1, y: 0 }, RADIUS);

  it("finds every layer that's seen where it's drawn", () => {
    for (const x of [0, 30, 55, 61, 64, 69, 75, 80]) {
      for (const layer of layersAt(fold, { x, y: 40 })) {
        const seen = placeOf(fold, layer);
        expect(seen.x).toBeCloseTo(x, 6);
        expect(seen.height).toBeCloseTo(layer.height, 6);
      }
    }
  });

  it("puts the folded part on top and the stuck part last", () => {
    const layers = layersAt(fold, { x: 40, y: 50 });
    expect(layers.map((layer) => layer.face)).toEqual(["back", "front"]);
    expect(layers[0].height).toBeCloseTo(2 * RADIUS);
  });

  it("leaves a flat sticker as it is: anything folded would come from far off it", () => {
    const layers = layersAt(FLAT, { x: 5, y: 5 });
    expect(layers.at(-1)).toEqual({ x: 5, y: 5, face: "front", height: 0 });
    for (const layer of layers.slice(0, -1)) expect(Math.abs(layer.x)).toBeGreaterThan(1e5);
  });
});

describe("liftedShare and pullToLift", () => {
  const extent = { least: 0, most: 100 };

  it("measures how much is past the fold", () => {
    expect(liftedShare({ x: 75, y: 0, nx: 1, ny: 0, radius: RADIUS }, extent)).toBeCloseTo(0.25);
    expect(liftedShare(FLAT, { least: 0, most: 100 })).toBe(0);
  });

  it("knows how far to pull for the whole sticker to lie folded", () => {
    const grab = { x: 100, y: 50 };
    const pull = pullToLift(100, extent, RADIUS);
    const fold = foldFor(grab, { x: grab.x - pull, y: grab.y }, { x: 1, y: 0 }, RADIUS);
    expect(liftedShare(fold, extent)).toBe(1);
    expect(pastFold(fold, { x: 0, y: 50 })).toBeCloseTo(Math.PI * RADIUS, 6);
  });
});

describe("cornerNear", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it("finds the nearest corner and the way out of it, its bisector", () => {
    const near = cornerNear(square, { x: 90, y: 8 })!;
    expect(near.corner).toEqual({ x: 100, y: 0 });
    expect(near.outward.x).toBeCloseTo(Math.SQRT1_2);
    expect(near.outward.y).toBeCloseTo(-Math.SQRT1_2);
    expect(near.distance).toBeCloseTo(Math.hypot(10, 8));
  });

  it("lifts only the corner: nothing else of the shape is past a fold near it", () => {
    const near = cornerNear(square, { x: 4, y: 96 })!;
    const fold = foldFor({ x: near.corner.x - near.outward.x, y: near.corner.y - near.outward.y }, { x: near.corner.x - 8 * near.outward.x, y: near.corner.y - 8 * near.outward.y }, near.outward, RADIUS);
    const lifted = square.filter((corner) => pastFold(fold, corner) > 0);
    expect(lifted).toEqual([{ x: 0, y: 100 }]);
  });
});
