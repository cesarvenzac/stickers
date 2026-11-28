/**
 * A sticker that tears. Peeled slowly it comes up whole; yanked, faster than it can take, it rips
 * along the fold's front instead, the part lifted coming away in the hand with a ragged edge, the
 * rest staying stuck with one of its own, the paper inside showing white along both. The sheet is
 * kept as fields (the cut, its depth, and how far each point is from a torn edge), and a tear cuts
 * them in two. Pure: no DOM.
 */

import type { Point } from "./field.ts";
import { type Fold, foldAt } from "./peel.ts";

/** How fast a peel has to be pulled to tear it, at `tear: true`: pixels a second. */
export const TEAR_SPEED = 1200;
/** How long the pointer's speed is measured over, in milliseconds. */
export const SPEED_WINDOW = 50;
/** How far from a torn edge a point is that isn't near one: no edge at all. */
export const NO_TEAR = 1e4;
/** The least of a sticker a tear takes, or leaves: less, and it peels on rather than tearing. */
export const LEAST_PIECE = 0.03;

/** The speed a peel tears at from `tear`: never when it's off, TEAR_SPEED for `true`, otherwise the speed given. */
export function tearSpeedOf(tear: boolean | number | undefined): number {
  if (tear === true) return TEAR_SPEED;
  if (typeof tear === "number" && Number.isFinite(tear) && tear > 0) return tear;
  return Infinity;
}

/** Where the pointer was, and when (milliseconds). */
export type Sample = { x: number; y: number; time: number };

/** The samples worth keeping at `now`: those within the window, and the one just before it. */
export function keptSamples(samples: readonly Sample[], now: number, window = SPEED_WINDOW): Sample[] {
  let first = samples.length - 1;
  while (first > 0 && now - samples[first - 1].time <= window) first--;
  return samples.slice(Math.max(0, first - 1));
}

/** How fast the pointer has been going, pixels a second, over the last `window` milliseconds of its moves. */
export function speedOf(samples: readonly Sample[], now: number, window = SPEED_WINDOW): number {
  const kept = keptSamples(samples, now, window);
  if (kept.length < 2) return 0;
  const first = kept[0];
  const last = kept[kept.length - 1];
  // Over less than a frame, two events say nothing of a speed.
  const span = Math.max(last.time - first.time, 8);
  return (Math.hypot(last.x - first.x, last.y - first.y) * 1000) / span;
}

const hash = (n: number, seed: number) => {
  const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Smooth value noise along a line, -1 to 1. */
const noise1 = (x: number, seed: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i, seed) * (1 - u) + hash(i + 1, seed) * u) * 2 - 1;
};

/**
 * How far the torn edge wanders from the fold's front, `t` pixels along it, for a sticker `size`
 * pixels across: rough at three scales, from `seed`, never more than `jagMost(size)` either way.
 */
export function jagAt(t: number, seed: number, size: number): number {
  const most = jagMost(size);
  return most * (0.55 * noise1(t / 9, seed) + 0.3 * noise1(t / 3.4, seed + 7) + 0.15 * noise1(t / 1.3, seed + 13));
}

/** The most a torn edge wanders, for a sticker `size` pixels across. */
export const jagMost = (size: number) => Math.min(Math.max(size * 0.014, 1.2), 4);

/** Where a point stands against a tear along `fold`: past it (positive) it comes away. */
export function pastTear(fold: Fold, point: Point, seed: number, size: number): number {
  const t = -(point.x - fold.x) * fold.ny + (point.y - fold.y) * fold.nx;
  return foldAt(fold, point).s - jagAt(t, seed, size);
}

/** A sticker's sheet as fields, a pixel of the field each: the cut (negative inside), how deep each point is, and how far from a torn edge. */
export type Sheet = { field: Float32Array; depth: Float32Array; torn: Float32Array; width: number; height: number };

/** A sheet with no tear in it yet. */
export const whole = (field: Float32Array, depth: Float32Array, width: number, height: number): Sheet => ({ field, depth, torn: new Float32Array(field.length).fill(NO_TEAR), width, height });

/** The share of a sheet that's sheet: its pixels inside the cut. */
export const areaOf = (sheet: Sheet) => sheet.field.reduce((sum, value) => sum + (value < 0 ? 1 : 0), 0);

/**
 * A sheet torn along a fold (in box pixels, the field `fieldScale` box pixels a pixel): what stays
 * stuck (`kept`) and what comes away (`piece`), each the sheet with the other side cut off along the
 * ragged edge, and that edge's distance kept in `torn`. A dome over it falls to the torn edge too.
 */
export function tearSheet(sheet: Sheet, fold: Fold, fieldScale: number, seed: number, size: number): { kept: Sheet; piece: Sheet } {
  const { width, height } = sheet;
  const kept: Sheet = { field: new Float32Array(sheet.field.length), depth: new Float32Array(sheet.field.length), torn: new Float32Array(sheet.field.length), width, height };
  const piece: Sheet = { field: new Float32Array(sheet.field.length), depth: new Float32Array(sheet.field.length), torn: new Float32Array(sheet.field.length), width, height };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const past = pastTear(fold, { x: (x + 0.5) * fieldScale, y: (y + 0.5) * fieldScale }, seed, size) / fieldScale;
      kept.field[i] = Math.max(sheet.field[i], past);
      piece.field[i] = Math.max(sheet.field[i], -past);
      kept.depth[i] = Math.min(sheet.depth[i], Math.max(0, -past));
      piece.depth[i] = Math.min(sheet.depth[i], Math.max(0, past));
      kept.torn[i] = Math.min(sheet.torn[i], Math.abs(past));
      piece.torn[i] = Math.min(sheet.torn[i], Math.abs(past));
    }
  }
  return { kept, piece };
}
