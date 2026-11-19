// The package as someone installing it uses it: typechecked against its published types (as
// NodeNext and as a bundler resolves them) and run, by check/run.sh. `sticker` needs a page, so here
// it's typechecked only; the React component renders on a server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { type Finish, FINISHES, type Pattern, PATTERNS, type Place, type Source, sticker, type Sticker, type StickerOptions, type StickerState } from "@cesarvenzac/stickers";
import { Sticker as StickerComponent, type StickerProps } from "@cesarvenzac/stickers/react";

const finish: Finish = "holo";
const pattern: Pattern = "dots";
const place: Place = { x: 12, y: -4, angle: 0.2 };
const options: StickerOptions = { finish, pattern, label: "A heart", outline: 8, smooth: 16, border: "white", back: "#ddd", print: "Hello", peel: true, drag: true, bounds: null, dark: "auto", glow: "#9f9", curl: 10, comesOff: 0.6, shine: true, place, seed: 2, reducedMotion: false, onPeel: () => {}, onPick: () => {}, onDrop: (where: Place) => void where };
export const start = (element: HTMLElement, src: Source): Sticker => {
  const made = sticker(element, src, options);
  made.set({ finish: "glow", src: "<svg viewBox='0 0 1 1'></svg>" });
  const state: StickerState = made.state;
  void state;
  return made;
};
if (typeof sticker !== "function") throw new Error("sticker isn't a function");
if (FINISHES.length !== 5 || PATTERNS.length !== 5) throw new Error("five finishes, five patterns");

const props: StickerProps = { src: "<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='red'/></svg>", finish: "holo", pattern: "squares", label: "A dot", className: "dot" };
const markup = renderToStaticMarkup(createElement(StickerComponent, props));
if (!markup.includes(`class="dot"`) || !markup.includes("<circle") || !markup.includes(`aria-label="A dot"`)) throw new Error("Sticker didn't draw its art for the server");

console.log(`${FINISHES.join(", ")}; foils ${PATTERNS.join(", ")}; ${markup.length} characters drawn on a server`);
