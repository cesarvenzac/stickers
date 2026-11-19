import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Sticker } from "./react.tsx";

const DOT = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="var(--paint-1)"/></svg>`;

describe("Sticker on a server", () => {
  it("draws its art inline, in the page's own colours, with a border of drop shadows", () => {
    const markup = renderToStaticMarkup(createElement(Sticker, { src: DOT, label: "A dot", outline: 8, className: "dot" }));
    expect(markup).toContain(`role="img"`);
    expect(markup).toContain(`aria-label="A dot"`);
    expect(markup).toContain(`class="dot"`);
    expect(markup).toContain(`fill="var(--paint-1)"`);
    expect(markup).toContain("drop-shadow(4px 0 0 white)");
    expect(markup).toContain("data-sticker-stand-in");
  });

  it("draws an image's address as an image, and where it's been placed", () => {
    const markup = renderToStaticMarkup(createElement(Sticker, { src: "/heart.png", place: { x: 10, y: -5, angle: 0.2 } }));
    expect(markup).toContain(`<img src="/heart.png" alt=""`);
    expect(markup).toContain("translate:10px -5px");
    expect(markup).toContain("rotate:0.2rad");
  });
});
