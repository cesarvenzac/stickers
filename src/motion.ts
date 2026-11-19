/**
 * What moves a sticker, frame by frame on any clock: springs for what settles (a lift, a peel let
 * go, a sticker pressed down), and a body for one held in the hand, which follows the point it's
 * held by and turns about it as a card dragged across a table does. Pure: no DOM.
 */

import type { Point } from "./field.ts";

export type Spring = {
  /** Seconds, near enough: its period, as SwiftUI's and Motion's springs say it. */
  duration: number;
  /** 0 to 1: how far past it goes and comes back. 0 stops dead on. */
  bounce: number;
};

/** Where a spring is and how fast it's going, `t` seconds after leaving `from` at `velocity` for `to`. Exact: stepping it in frames of any length lands where one long step does. */
export function springAt({ duration, bounce }: Spring, from: number, to: number, velocity: number, t: number): { value: number; velocity: number } {
  if (t <= 0) return { value: from, velocity };
  const omega = (2 * Math.PI) / Math.max(duration, 0.01);
  const zeta = 1 - Math.min(Math.max(bounce, 0), 0.95);
  const d0 = from - to;
  if (zeta > 0.999) {
    const e = Math.exp(-omega * t);
    const b = velocity + omega * d0;
    return { value: to + e * (d0 + b * t), velocity: e * (velocity - omega * t * b) };
  }
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  const e = Math.exp(-zeta * omega * t);
  const b = (velocity + zeta * omega * d0) / damped;
  const cos = Math.cos(damped * t);
  const sin = Math.sin(damped * t);
  return {
    value: to + e * (d0 * cos + b * sin),
    velocity: e * (-zeta * omega * (d0 * cos + b * sin) + damped * (b * cos - d0 * sin)),
  };
}

/** A value on its way somewhere on a spring. */
export type Sprung = { value: number; velocity: number; target: number };

export const sprung = (value: number): Sprung => ({ value, velocity: 0, target: value });

/** `sprung` moved on by `dt` seconds. */
export function stepSpring(spring: Spring, state: Sprung, dt: number): Sprung {
  const next = springAt(spring, state.value, state.target, state.velocity, dt);
  return { value: next.value, velocity: next.velocity, target: state.target };
}

/** Whether a spring has come to rest within `within` of its target (and is moving slower than that a frame). */
export const atRest = (state: Sprung, within: number) => Math.abs(state.value - state.target) < within && Math.abs(state.velocity) < within * 60;

/**
 * A sticker held in the hand, flat on the page: its middle (`x`, `y`, pixels from where it was laid
 * out), how far it's turned (`angle`, radians, clockwise on the page) and how fast each is changing.
 */
export type Body = { x: number; y: number; angle: number; vx: number; vy: number; spin: number };

export const still = (x = 0, y = 0, angle = 0): Body => ({ x, y, angle, vx: 0, vy: 0, spin: 0 });

/** How a held sticker follows: how stiffly the point held follows the hand, how quickly the sticker slows and stops turning, and how far it may turn. */
export type Handling = {
  /** Seconds: how long the held point takes to come to the hand, near enough. */
  follow: number;
  /** How much the air (or the table) drags at its middle, a second: what swings it round behind the hand. */
  drag: number;
  /** How quickly a turn dies away, a second. */
  settle: number;
  /** 0 to 1: how much it turns at all (0 keeps it square, as under reduced motion). */
  turn: number;
  /** The fastest it may turn, radians a second. */
  most: number;
};

export const HANDLING: Handling = { follow: 0.09, drag: 7, settle: 7, turn: 0.45, most: 6 };

const STEP = 1 / 240;

/**
 * The body moved on by `dt` seconds, held at `grip` (a point of the sticker, from its middle, as
 * laid out: unturned) by a hand at `hand`. A spring and its damper join the grip to the hand; drag
 * at the middle swings it round behind, so a sticker held by a corner trails from it and one held
 * by its middle only slides. `size` is the sticker's box, for how hard it is to turn.
 */
export function follow(body: Body, grip: Point, hand: Point, size: { width: number; height: number }, dt: number, handling: Handling = HANDLING): Body {
  const omega = (2 * Math.PI) / Math.max(handling.follow, 0.01);
  const stiffness = omega * omega;
  const damping = 2 * 0.8 * omega;
  // The moment of inertia of a flat plate turning about its middle, a unit of mass.
  const inertia = (size.width * size.width + size.height * size.height) / 12;
  let { x, y, angle, vx, vy, spin } = body;
  for (let left = Math.min(dt, 0.25); left > 1e-9; left -= STEP) {
    const h = Math.min(STEP, left);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = grip.x * cos - grip.y * sin;
    const ry = grip.x * sin + grip.y * cos;
    // The grip's own speed: the middle's, and the turn's at its distance.
    const gvx = vx - spin * ry;
    const gvy = vy + spin * rx;
    const fx = stiffness * (hand.x - (x + rx)) - damping * gvx;
    const fy = stiffness * (hand.y - (y + ry)) - damping * gvy;
    vx += (fx - handling.drag * vx) * h;
    vy += (fy - handling.drag * vy) * h;
    spin += ((handling.turn * (rx * fy - ry * fx)) / inertia - handling.settle * spin) * h;
    spin = Math.min(Math.max(spin, -handling.most), handling.most);
    x += vx * h;
    y += vy * h;
    angle += spin * h;
  }
  return { x, y, angle, vx, vy, spin };
}

/** The body let go: it slows to a stop over `dt` seconds, as a sticker pressed down does, turning no further. */
export function settle(body: Body, dt: number, rate = 30): Body {
  const keep = Math.exp(-rate * dt);
  const travelled = (1 - keep) / rate;
  return { x: body.x + body.vx * travelled, y: body.y + body.vy * travelled, angle: body.angle + body.spin * travelled, vx: body.vx * keep, vy: body.vy * keep, spin: body.spin * keep };
}

/** Where the grip is on the page: the body's middle plus the grip turned with it. */
export function gripAt(body: Body, grip: Point): Point {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  return { x: body.x + grip.x * cos - grip.y * sin, y: body.y + grip.x * sin + grip.y * cos };
}

/** A page point in the sticker's own frame (from its middle, unturned), given where its middle is and how it's turned. */
export function toLocal(point: Point, middle: Point, angle: number): Point {
  const dx = point.x - middle.x;
  const dy = point.y - middle.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

/** An angle brought within half a turn of 0. */
export const wrapAngle = (angle: number) => angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
