import { describe, expect, it } from "vitest";

import { keyAction, nameOf, SHIFT_STEP, shortcutsOf, type Situation, STEP, WORDS } from "./keys.ts";

const lying: Situation = { drag: true, peel: true, holding: null, pulling: false };

describe("keyAction", () => {
  it("picks up with Space or Enter, moves with the arrows, sets down with Space or Enter", () => {
    expect(keyAction(" ", false, lying)).toEqual({ do: "pick" });
    expect(keyAction("Enter", false, lying)).toEqual({ do: "pick" });
    const held: Situation = { ...lying, holding: "keys" };
    expect(keyAction("ArrowRight", false, held)).toEqual({ do: "move", by: { x: STEP, y: 0 } });
    expect(keyAction("ArrowUp", true, held)).toEqual({ do: "move", by: { x: 0, y: -SHIFT_STEP } });
    expect(keyAction(" ", false, held)).toEqual({ do: "set" });
    expect(keyAction("Enter", false, held)).toEqual({ do: "set" });
  });

  it("moves one that's lying down with the arrows too", () => {
    expect(keyAction("ArrowLeft", false, lying)).toEqual({ do: "move", by: { x: -STEP, y: 0 } });
  });

  it("puts back with Escape what the keys or the pointer hold, and lays back a peel", () => {
    expect(keyAction("Escape", false, { ...lying, holding: "keys" })).toEqual({ do: "back" });
    expect(keyAction("Escape", false, { ...lying, holding: "pointer" })).toEqual({ do: "back" });
    expect(keyAction("Escape", false, { ...lying, pulling: true })).toEqual({ do: "lay" });
    expect(keyAction("Escape", false, lying)).toBeNull();
  });

  it("peels off with Delete or Backspace, and with Enter or Space one that can't be moved", () => {
    expect(keyAction("Delete", false, lying)).toEqual({ do: "peel" });
    expect(keyAction("Backspace", false, { ...lying, holding: "keys" })).toEqual({ do: "peel" });
    const fixed: Situation = { ...lying, drag: false };
    expect(keyAction("Enter", false, fixed)).toEqual({ do: "peel" });
    expect(keyAction(" ", false, fixed)).toEqual({ do: "peel" });
    expect(keyAction("ArrowDown", false, fixed)).toBeNull();
    expect(keyAction("Delete", false, { ...lying, peel: false })).toBeNull();
  });

  it("leaves every key but Escape to the pointer while it holds the sticker", () => {
    const pointer: Situation = { ...lying, holding: "pointer" };
    for (const key of [" ", "Enter", "ArrowRight", "Delete"]) expect(keyAction(key, false, pointer)).toBeNull();
    expect(keyAction("Enter", false, { ...lying, pulling: true })).toBeNull();
  });

  it("leaves other keys to the page", () => {
    expect(keyAction("Tab", false, lying)).toBeNull();
    expect(keyAction("a", false, lying)).toBeNull();
  });
});

describe("what's said", () => {
  it("names the keys each sticker answers", () => {
    expect(shortcutsOf(true, true)).toBe("Space Enter ArrowUp ArrowDown ArrowLeft ArrowRight Escape Delete");
    expect(shortcutsOf(false, true)).toBe("Enter Space Delete");
    expect(shortcutsOf(true, false)).toBe("Space Enter ArrowUp ArrowDown ArrowLeft ArrowRight Escape");
    expect(shortcutsOf(false, false)).toBe("");
  });

  it("says what happened to it by name", () => {
    expect(WORDS.picked(nameOf("A heart"))).toMatch(/^A heart, picked up\. The arrow keys move it/);
    expect(WORDS.dropped(nameOf(undefined))).toBe("Sticker, set down.");
    expect(WORDS.keys({ move: false, peel: true })).toBe("Enter peels it off.");
    expect(WORDS.keys({ move: false, peel: false })).toBe("");
  });
});
