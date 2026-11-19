import { describe, expect, it } from "vitest";

import { follow, gripAt, HANDLING, settle, springAt, sprung, stepSpring, still, toLocal, wrapAngle } from "./motion.ts";

const SIZE = { width: 160, height: 120 };

describe("springAt", () => {
  it("lands where one long step does, in frames of any length", () => {
    const spring = { duration: 0.4, bounce: 0.2 };
    let state = { ...sprung(0), target: 100 };
    for (let i = 0; i < 30; i++) state = stepSpring(spring, state, 1 / 60);
    const once = springAt(spring, 0, 100, 0, 0.5);
    expect(state.value).toBeCloseTo(once.value, 6);
    expect(state.velocity).toBeCloseTo(once.velocity, 6);
  });

  it("comes to rest on its target", () => {
    expect(springAt({ duration: 0.3, bounce: 0 }, 0, 1, 0, 3).value).toBeCloseTo(1, 6);
  });
});

describe("follow", () => {
  const run = (grip: { x: number; y: number }, hand: (t: number) => { x: number; y: number }, seconds: number, dt = 1 / 60) => {
    let body = still();
    for (let t = 0; t < seconds; t += dt) body = follow(body, grip, hand(t), SIZE, dt);
    return body;
  };

  it("brings the point held to the hand, and stops there", () => {
    const grip = { x: 30, y: -20 };
    const body = run(grip, () => ({ x: 200, y: 80 }), 3);
    const at = gripAt(body, grip);
    expect(at.x).toBeCloseTo(200, 1);
    expect(at.y).toBeCloseTo(80, 1);
    expect(Math.hypot(body.vx, body.vy)).toBeLessThan(1);
  });

  it("slides a sticker held by its middle without turning it", () => {
    expect(run({ x: 0, y: 0 }, (t) => ({ x: 300 * t, y: 50 * t }), 1).angle).toBeCloseTo(0, 6);
  });

  it("swings a sticker held by a corner round behind the hand", () => {
    // Held by its top left corner and pulled to the right, its middle trails: it turns clockwise... then back, toward the left.
    const body = run({ x: -60, y: -40 }, (t) => ({ x: -60 + 400 * t, y: -40 }), 0.8);
    const middle = { x: body.x, y: body.y };
    const held = gripAt(body, { x: -60, y: -40 });
    expect(middle.x).toBeLessThan(held.x);
  });

  it("stays steady on a slow clock", () => {
    const body = run({ x: 70, y: 50 }, () => ({ x: 100, y: 100 }), 2, 0.2);
    expect(Number.isFinite(body.x) && Number.isFinite(body.angle)).toBe(true);
    expect(gripAt(body, { x: 70, y: 50 }).x).toBeCloseTo(100, 0);
  });

  it("keeps square when it may not turn", () => {
    let body = still();
    for (let t = 0; t < 1; t += 1 / 60) body = follow(body, { x: -60, y: -40 }, { x: 300 * t, y: 0 }, SIZE, 1 / 60, { ...HANDLING, turn: 0 });
    expect(body.angle).toBe(0);
  });
});

describe("settle", () => {
  it("brings a body let go to a stop not far on", () => {
    let body = { ...still(), vx: 600, spin: 2 };
    for (let i = 0; i < 60; i++) body = settle(body, 1 / 60);
    expect(body.x).toBeCloseTo(20, 0);
    expect(Math.abs(body.vx)).toBeLessThan(0.01);
  });
});

describe("toLocal", () => {
  it("undoes the turn and the move", () => {
    const body = { ...still(40, 10, 0.6) };
    const grip = { x: 25, y: -12 };
    const local = toLocal(gripAt(body, grip), { x: body.x, y: body.y }, body.angle);
    expect(local.x).toBeCloseTo(grip.x, 9);
    expect(local.y).toBeCloseTo(grip.y, 9);
  });

  it("wraps angles within half a turn", () => {
    expect(Math.abs(wrapAngle(3 * Math.PI))).toBeCloseTo(Math.PI);
    expect(wrapAngle(2 * Math.PI + 0.25)).toBeCloseTo(0.25);
    expect(wrapAngle(-0.5)).toBe(-0.5);
  });
});
