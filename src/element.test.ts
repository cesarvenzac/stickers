import { describe, expect, it } from "vitest";

import { optionsOf } from "./element.ts";

/** An element as far as its attributes go. */
const tag = (attributes: Record<string, string>, around: Record<string, Element> = {}) => ({
  getAttribute: (name: string) => attributes[name] ?? null,
  hasAttribute: (name: string) => name in attributes,
  closest: (selector: string) => around[selector] ?? null,
  ownerDocument: null,
});

describe("<sticker-image>'s attributes", () => {
  it("are its options, numbers as numbers and switches as switches", () => {
    const options = optionsOf(tag({ finish: "holo", pattern: "dots", label: "A heart", outline: "8", drag: "", peel: "false", "comes-off": "0.6", seed: "3", shine: "false", announce: "false" }));
    expect(options).toMatchObject({ finish: "holo", pattern: "dots", label: "A heart", outline: 8, drag: true, peel: false, comesOff: 0.6, seed: 3, shine: false, announce: false });
  });

  it("leave out what isn't said, so it keeps its default", () => {
    const said = Object.entries(optionsOf(tag({}))).filter(([, value]) => value !== undefined);
    expect(said).toEqual([]);
  });

  it("read tear and puffy as a switch or an amount", () => {
    expect(optionsOf(tag({ tear: "", puffy: "2" }))).toMatchObject({ tear: true, puffy: 2 });
    expect(optionsOf(tag({ tear: "900" })).tear).toBe(900);
    expect(optionsOf(tag({ tear: "false" })).tear).toBe(false);
  });

  it("read dark as auto, on or off, and touch as hold or press alone", () => {
    expect(optionsOf(tag({ dark: "" })).dark).toBe(true);
    expect(optionsOf(tag({ dark: "auto" })).dark).toBe("auto");
    expect(optionsOf(tag({ dark: "false" })).dark).toBe(false);
    expect(optionsOf(tag({ touch: "press" })).touch).toBe("press");
    expect(optionsOf(tag({ touch: "sometimes" })).touch).toBeUndefined();
  });

  it("find bounds by selector, the nearest round it, or none", () => {
    const board = {} as Element;
    expect(optionsOf(tag({ bounds: ".board" }, { ".board": board })).bounds).toBe(board);
    expect(optionsOf(tag({ bounds: "none" })).bounds).toBeNull();
  });
});
