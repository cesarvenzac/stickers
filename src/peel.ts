/**
 * The geometry of a peel. A sticker lifted from an edge rolls up round a cylinder lying on it: on
 * one side of the fold line it's still stuck down; past it, the sheet wraps half way round the
 * cylinder (its art facing in, then its back facing up) and the rest lies flat on top, back up,
 * turned over the line. Everything is in the sticker's own flat coordinates (pixels of its box,
 * y down); the shader works out the same layers for every pixel, and these are the same sums, so a
 * press can be tested against what's drawn. Pure: no DOM.
 */

import type { Point } from "./field.ts";

export type { Point };

/**
 * Where the sticker is folded: a point on the fold line (`x`, `y`), the direction across it toward
 * the lifted side (`nx`, `ny`, a unit vector) and the cylinder's radius. The line lies on the
 * sticker; everything at a distance `a` past it, measured flat, is lifted. A sheet pulled at a point
 * doesn't fold along a straight line, though: it lifts like a tent, most where it's held. So the
 * fold bends (`bendFor`): its front bows back toward the edge as it goes along the line from the
 * point held (`bow`, a pixel back for each pixel along, squared), and its curl tightens there as
 * a cone's does toward its tip (`cone`: the radius over 1 + cone · the pixels along), where less
 * is lifted. The line through the grabbed point is folded exactly as a straight fold would.
 */
export type Fold = { x: number; y: number; nx: number; ny: number; radius: number; bow?: number; cone?: number };

/** How tented a fold is, for the threshold: the larger, the flatter its front. */
export const BOW = 3;
/** How much tighter its curl grows along the line, over the depth lifted: half as wide, a depth along. */
export const CONE = 1;

/**
 * How a fold `depth` pixels deep at the point held (the curl `radius` round) bends: the front comes
 * back to the edge about √BOW times the depth along the line on either side, so a small lift is a
 * small tent and a deep one a broad curve, and the curl tightens by CONE over the depth.
 */
export function bendFor(depth: number, radius: number): { bow: number; cone: number } {
  const span = Math.max(depth + radius, 1e-3);
  return { bow: 1 / (BOW * span), cone: CONE / span };
}

/**
 * Where a flat point stands against a fold, bent: how far past its front it is (`s`, negative on the
 * stuck side) and the curl's radius there (`r`). Along the line through the point held, as straight.
 */
export function foldAt(fold: Fold, point: Point): { s: number; r: number } {
  const dx = point.x - fold.x;
  const dy = point.y - fold.y;
  const t = -dx * fold.ny + dy * fold.nx;
  return { s: dx * fold.nx + dy * fold.ny - (fold.bow ?? 0) * t * t, r: fold.radius / (1 + (fold.cone ?? 0) * Math.abs(t)) };
}

/** A fold that lifts nothing: the line far off, past every sticker. */
export const FLAT: Fold = { x: -1e6, y: -1e6, nx: -1, ny: 0, radius: 1 };

/** How high the sheet stands at a flat distance `a` past the fold, and how far past the fold it's seen from above (negative: folded back over it). */
export function rolled(a: number, radius: number): { along: number; height: number } {
  if (a <= 0) return { along: a, height: 0 };
  const half = Math.PI * radius;
  if (a >= half) return { along: half - a, height: 2 * radius };
  const angle = a / radius;
  return { along: radius * Math.sin(angle), height: radius * (1 - Math.cos(angle)) };
}

/** How far a point `a` past the fold is drawn back from where it lies flat: `a` minus where it's seen. Grows from 0, strictly. */
export function travel(a: number, radius: number) {
  return a - rolled(a, radius).along;
}

/** The distance past the fold of the point that has travelled `d` back toward it: `travel`'s inverse. */
export function reachFor(d: number, radius: number) {
  if (d <= 0) return 0;
  const half = Math.PI * radius;
  if (d >= half) return (d + half) / 2;
  // On the cylinder, d = r (θ − sin θ): Newton's method from a start that's never past the root.
  const target = d / radius;
  let angle = Math.cbrt(6 * target);
  for (let i = 0; i < 12; i++) {
    const error = angle - Math.sin(angle) - target;
    const slope = 1 - Math.cos(angle);
    if (Math.abs(error) < 1e-10 || slope < 1e-12) break;
    angle = Math.min(Math.max(angle - error / slope, 0), Math.PI);
  }
  return angle * radius;
}

/**
 * The fold made by holding the sticker at `grab` (a point of it, flat) and drawing it to `pointer`,
 * the edge there facing `outward` (a unit vector). The grabbed point is carried over the pointer:
 * pulled straight back across the sticker, it lies exactly under it. A pull away from the sticker
 * can't fold it; only its part along the edge counts, and a small pull lifts the edge square to it,
 * turning toward the pull as it grows.
 */
export function foldFor(grab: Point, pointer: Point, outward: Point, radius: number): Fold {
  let vx = grab.x - pointer.x;
  let vy = grab.y - pointer.y;
  const out = vx * outward.x + vy * outward.y;
  if (out < 0) {
    vx -= out * outward.x;
    vy -= out * outward.y;
  }
  const lean = radius * 0.5;
  let nx = vx + outward.x * lean;
  let ny = vy + outward.y * lean;
  const length = Math.hypot(nx, ny) || 1;
  nx /= length;
  ny /= length;
  const a = reachFor(Math.hypot(vx, vy), radius);
  return { x: grab.x - a * nx, y: grab.y - a * ny, nx, ny, radius, ...bendFor(a, radius) };
}

/** How far a point lies past the fold's front, flat (negative: on the stuck side). */
export const pastFold = (fold: Fold, point: Point) => foldAt(fold, point).s;

/** Where a flat point of the sticker is seen from above once folded, and how high it stands. */
export function placeOf(fold: Fold, point: Point): Point & { height: number } {
  const { s: a, r } = foldAt(fold, point);
  if (a <= 0) return { x: point.x, y: point.y, height: 0 };
  const { along, height } = rolled(a, r);
  return { x: point.x + (along - a) * fold.nx, y: point.y + (along - a) * fold.ny, height };
}

/** A box: its left, top, right and bottom. */
export type Reach = { left: number; top: number; right: number; bottom: number };

/**
 * Where a sheet folded as `fold` is drawn, seen from above, as a box in its own pixels: every point
 * of its `hull` where it lies once folded (a peel past half throws the sheet past the far edge), the
 * edges between them followed (a bent fold moves their middles further than their ends), and the
 * curl's crest a radius round.
 */
export function reachOf(fold: Fold, hull: readonly Point[]): Reach {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const take = (point: Point) => {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  };
  for (let i = 0; i < hull.length; i++) {
    const from = hull[i];
    const to = hull[(i + 1) % hull.length];
    take(from);
    for (let k = 0; k < 4; k++) take(placeOf(fold, { x: from.x + ((to.x - from.x) * k) / 4, y: from.y + ((to.y - from.y) * k) / 4 }));
  }
  return { left: left - fold.radius, top: top - fold.radius, right: right + fold.radius, bottom: bottom + fold.radius };
}

export type Layer = {
  /** The point of the sticker seen here, flat. */
  x: number;
  y: number;
  /** Which face is seen: the art, or the back. */
  face: "front" | "back";
  height: number;
};

/**
 * What could be seen at a point from above, top first: the part folded flat over the sticker, the
 * cylinder's far half (its back), its near half (the art, tilting away) and the part still stuck
 * down. Each is a point of the sticker; the first that's inside its shape is the one seen.
 */
export function layersAt(fold: Fold, point: Point): Layer[] {
  const { s, r } = foldAt(fold, point);
  const layers: Layer[] = [];
  const at = (a: number, face: Layer["face"], height: number) =>
    layers.push({ x: point.x + (a - s) * fold.nx, y: point.y + (a - s) * fold.ny, face, height });
  if (s <= 0) at(Math.PI * r - s, "back", 2 * r);
  if (s >= 0 && s <= r) {
    const angle = Math.asin(Math.min(s / r, 1));
    at(r * (Math.PI - angle), "back", r * (1 + Math.cos(angle)));
    at(r * angle, "front", r * (1 - Math.cos(angle)));
  }
  if (s <= 0) at(s, "front", 0);
  return layers;
}

/**
 * How much of the sticker is lifted, 0 to 1, along the fold's direction: the share of its reach
 * (`extent`, from `extentAlong` in the fold's direction) past the line.
 */
export function liftedShare(fold: Fold, extent: { least: number; most: number }) {
  const line = fold.x * fold.nx + fold.y * fold.ny;
  const span = extent.most - extent.least;
  if (span <= 0) return 0;
  return Math.min(Math.max((extent.most - line) / span, 0), 1);
}

/**
 * How far to pull a grabbed point (`grab`, `along` its own reach in the fold's direction) for the
 * whole sticker to be lifted and lying folded flat: the line a cylinder's half round past its far
 * side.
 */
export function pullToLift(grabAlong: number, extent: { least: number; most: number }, radius: number) {
  const a = grabAlong - extent.least + Math.PI * radius;
  return travel(a, radius);
}
