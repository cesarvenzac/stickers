/**
 * A sticker by the keyboard, as drag and drop is everywhere: Space or Enter picks one that can be
 * moved up, the arrow keys move it (Shift for further), Space or Enter sets it down and Escape puts
 * it back where it was picked up. The arrow keys also move one that's lying down, which lifts it
 * and sets it down a moment after the last. Delete or Backspace peels one off, and Enter or Space
 * peels off one that can't be moved. And what's said as it happens, for whoever can't see it. Pure.
 */

import type { Point } from "./field.ts";

/** What a key does to a sticker. */
export type KeyAction = { do: "pick" } | { do: "set" } | { do: "move"; by: Point } | { do: "back" } | { do: "lay" } | { do: "peel" };

/** Where the sticker stands as the key is pressed. */
export type Situation = {
  drag: boolean;
  peel: boolean;
  /** What's holding it: the keys (picked up by Space or Enter), the pointer, or nothing. */
  holding: "keys" | "pointer" | null;
  /** Whether it's being peeled by the pointer. */
  pulling: boolean;
};

/** Pixels an arrow key moves a sticker, and with Shift. */
export const STEP = 8;
export const SHIFT_STEP = 32;

const ARROWS: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };

/** What `key` does, or null for a key it leaves to the page. */
export function keyAction(key: string, shift: boolean, s: Situation): KeyAction | null {
  if (key === "Escape") {
    if (s.pulling) return { do: "lay" };
    if (s.holding) return { do: "back" };
    return null;
  }
  if (s.holding === "pointer" || s.pulling) return null;
  const arrow = ARROWS[key];
  if (arrow) {
    if (!s.drag) return null;
    const step = shift ? SHIFT_STEP : STEP;
    return { do: "move", by: { x: arrow.x * step, y: arrow.y * step } };
  }
  if (key === " " || key === "Enter") {
    if (s.drag) return s.holding === "keys" ? { do: "set" } : { do: "pick" };
    return s.peel ? { do: "peel" } : null;
  }
  if ((key === "Delete" || key === "Backspace") && s.peel) return { do: "peel" };
  return null;
}

/** The keys a sticker answers, as `aria-keyshortcuts` lists them. */
export function shortcutsOf(drag: boolean, peel: boolean): string {
  const keys: string[] = [];
  if (drag) keys.push("Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape");
  else if (peel) keys.push("Enter", "Space");
  if (peel) keys.push("Delete");
  return keys.join(" ");
}

/** What's said as a sticker is handled from the keyboard, and what its keys do: in English unless said, for `words`. */
export type StickerWords = {
  /** Said as it's picked up with Space or Enter. */
  picked: (label: string) => string;
  /** Said as it's set down with Space or Enter. */
  dropped: (label: string) => string;
  /** Said once it's set down after the arrow keys moved it. */
  moved: (label: string) => string;
  /** Said as Escape puts it back where it was picked up. */
  returned: (label: string) => string;
  /** Said as it's peeled off. */
  peeled: (label: string) => string;
  /** What its keys do, read with it when it's focused (its `aria-description`). */
  keys: (can: { move: boolean; peel: boolean }) => string;
};

export const WORDS: StickerWords = {
  picked: (label) => `${label}, picked up. The arrow keys move it, Space sets it down and Escape puts it back.`,
  dropped: (label) => `${label}, set down.`,
  moved: (label) => `${label}, moved.`,
  returned: (label) => `${label}, put back.`,
  peeled: (label) => `${label}, peeled off.`,
  keys: ({ move, peel }) => (move && peel ? "Space picks it up, Delete peels it off." : move ? "Space picks it up." : peel ? "Enter peels it off." : ""),
};

/** What a sticker is called when it's said aloud: its label, or "Sticker". */
export const nameOf = (label: string | undefined) => label?.trim() || "Sticker";
