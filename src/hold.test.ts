import { describe, expect, it } from "vitest";

import { heldLongEnough, HOLD_MS, movedTo, pressed, SLOP } from "./hold.ts";

describe("a finger held on a sticker", () => {
  const down = pressed(1, { x: 100, y: 100 }, 1000);

  it("waits while it's held still, and is the sticker's once it's been held long enough", () => {
    const still = movedTo(down, { x: 103, y: 98 });
    expect(still).not.toBe("swipe");
    expect(heldLongEnough(down, 1000 + HOLD_MS - 1)).toBe(false);
    expect(heldLongEnough(down, 1000 + HOLD_MS)).toBe(true);
  });

  it("is a swipe, the page's, once it moves more than a little", () => {
    expect(movedTo(down, { x: 100, y: 100 + SLOP + 1 })).toBe("swipe");
    // Measured from where it went down, so creeping doesn't add up to a swipe unnoticed.
    const crept = movedTo(down, { x: 100 + SLOP, y: 100 });
    expect(crept).not.toBe("swipe");
    expect(movedTo(crept as Exclude<typeof crept, "swipe">, { x: 100 + SLOP + 0.5, y: 103 })).toBe("swipe");
  });
});
