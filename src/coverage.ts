/**
 * How much of a scratch card has been scratched off, counted on a coarse grid of cells as the
 * pointer goes: a cell is scratched once a stroke passes over its middle. What's drawn is finer (the
 * strokes themselves, their edges ragged); this is only what's counted, cheaply, with each stroke.
 * Pure: no DOM.
 */

import type { Point } from "./field.ts";

export type Coverage = {
  columns: number;
  rows: number;
  /** Pixels a cell is across. */
  cell: number;
  scratched: Uint8Array;
  count: number;
};

/** A card `width` by `height` pixels, none of it scratched, counted in cells `cell` pixels across. */
export function coverageOf(width: number, height: number, cell = 8): Coverage {
  const columns = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  return { columns, rows, cell, scratched: new Uint8Array(columns * rows), count: 0 };
}

/** Scratches the cells whose middles lie within `radius` of the stroke from `from` to `to`, in place. Returns how many were new. */
export function scratchStroke(coverage: Coverage, from: Point, to: Point, radius: number): number {
  const { columns, rows, cell, scratched } = coverage;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length2 = dx * dx + dy * dy;
  const left = Math.max(0, Math.floor((Math.min(from.x, to.x) - radius) / cell));
  const right = Math.min(columns - 1, Math.floor((Math.max(from.x, to.x) + radius) / cell));
  const top = Math.max(0, Math.floor((Math.min(from.y, to.y) - radius) / cell));
  const bottom = Math.min(rows - 1, Math.floor((Math.max(from.y, to.y) + radius) / cell));
  let fresh = 0;
  for (let row = top; row <= bottom; row++) {
    for (let column = left; column <= right; column++) {
      const index = row * columns + column;
      if (scratched[index]) continue;
      const cx = (column + 0.5) * cell;
      const cy = (row + 0.5) * cell;
      const t = length2 > 0 ? Math.min(Math.max(((cx - from.x) * dx + (cy - from.y) * dy) / length2, 0), 1) : 0;
      const ex = from.x + t * dx - cx;
      const ey = from.y + t * dy - cy;
      if (ex * ex + ey * ey <= radius * radius) {
        scratched[index] = 1;
        fresh++;
      }
    }
  }
  coverage.count += fresh;
  return fresh;
}

/** The share of the card scratched, 0 to 1. */
export const scratchedShare = (coverage: Coverage) => coverage.count / coverage.scratched.length;

/**
 * A stroke's ragged edge, as a coin's makes it: the stroke drawn as a few thinner strokes beside one
 * another, each a little off the line and a little narrower or wider, decided by `seed` alone so a
 * stroke is drawn the same every time. Each is `[offset across the stroke, width]`, in pixels.
 */
export function raggedOf(width: number, seed: number): [number, number][] {
  let state = seed >>> 0 || 1;
  const next = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const strands: [number, number][] = [[0, width * 0.78]];
  for (let i = 0; i < 4; i++) strands.push([(next() - 0.5) * width * 0.42, width * (0.32 + next() * 0.28)]);
  return strands;
}
