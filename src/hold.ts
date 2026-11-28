/**
 * A finger on a sticker, under `touch: "hold"`: the page scrolls as it always does, and a sticker
 * takes the finger only once it's been held still a moment. A press waits; moving more than a
 * little before then lets it go to the page (a swipe); held still long enough, it's the sticker's.
 * Pure: the clock and the moves are given.
 */

import type { Point } from "./field.ts";

/** How long a finger is held still before the sticker takes it, in milliseconds. */
export const HOLD_MS = 280;
/** How far a finger may wander while it's held, in pixels, before it's a swipe. */
export const SLOP = 8;

/** A finger pressed and waiting: where it went down, when, and where it is now. */
export type Waiting = { id: number; from: Point; at: Point; since: number };

export const pressed = (id: number, at: Point, now: number): Waiting => ({ id, from: at, at, since: now });

/** What a waiting finger does as it moves to `at`: still waiting, or a swipe the page takes. */
export function movedTo(waiting: Waiting, at: Point): Waiting | "swipe" {
  if (Math.hypot(at.x - waiting.from.x, at.y - waiting.from.y) > SLOP) return "swipe";
  return { ...waiting, at };
}

/** Whether a waiting finger has been held long enough for the sticker to take it. */
export const heldLongEnough = (waiting: Waiting, now: number, hold = HOLD_MS) => now - waiting.since >= hold;
