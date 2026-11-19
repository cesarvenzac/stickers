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
 * sticker; everything at a distance `a` past it, measured flat, is lifted.
 */
export type Fold = { x: number; y: number; nx: number; ny: number; radius: number };

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
  return { x: grab.x - a * nx, y: grab.y - a * ny, nx, ny, radius };
}

/** How far a point lies past the fold, flat (negative: on the stuck side). */
export const pastFold = (fold: Fold, point: Point) => (point.x - fold.x) * fold.nx + (point.y - fold.y) * fold.ny;

/** Where a flat point of the sticker is seen from above once folded, and how high it stands. */
export function placeOf(fold: Fold, point: Point): Point & { height: number } {
  const a = pastFold(fold, point);
  if (a <= 0) return { x: point.x, y: point.y, height: 0 };
  const { along, height } = rolled(a, fold.radius);
  return { x: point.x + (along - a) * fold.nx, y: point.y + (along - a) * fold.ny, height };
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
  const s = pastFold(fold, point);
  const r = fold.radius;
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

/**
 * The corner of a convex hull nearest a point, and the way out of it: the bisector of its two
 * sides' outward normals. A fold along it, near that corner, lifts only a small cap round it: the
 * corner is the furthest of the whole shape that way. What a pointer lifts as it comes near.
 */
export function cornerNear(hull: readonly Point[], point: Point): { corner: Point; outward: Point; distance: number } | null {
  if (hull.length < 3) return null;
  let middle = { x: 0, y: 0 };
  for (const vertex of hull) middle = { x: middle.x + vertex.x / hull.length, y: middle.y + vertex.y / hull.length };
  let best = 0;
  for (let i = 1; i < hull.length; i++) if (Math.hypot(hull[i].x - point.x, hull[i].y - point.y) < Math.hypot(hull[best].x - point.x, hull[best].y - point.y)) best = i;
  const at = hull[best];
  const before = hull[(best + hull.length - 1) % hull.length];
  const after = hull[(best + 1) % hull.length];
  // Each side's normal, turned to face away from the middle.
  const normal = (from: Point, to: Point) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    let nx = dy / length;
    let ny = -dx / length;
    if (nx * (from.x - middle.x) + ny * (from.y - middle.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: nx, y: ny };
  };
  const a = normal(before, at);
  const b = normal(at, after);
  const length = Math.hypot(a.x + b.x, a.y + b.y) || 1;
  return { corner: at, outward: { x: (a.x + b.x) / length, y: (a.y + b.y) / length }, distance: Math.hypot(at.x - point.x, at.y - point.y) };
}
