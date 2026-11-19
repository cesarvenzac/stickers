import { describe, expect, it } from "vitest";

import { given } from "./page.ts";

describe("given", () => {
  it("leaves out what's undefined, so a default stands", () => {
    const options = { peel: undefined, drag: true, finish: undefined, comesOff: 0 };
    expect({ peel: true, drag: false, comesOff: 0.5, ...given(options) }).toEqual({ peel: true, drag: true, comesOff: 0 });
  });
});
