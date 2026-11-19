// The package as someone installing it uses it: typechecked against its published types (as
// NodeNext and as a bundler resolves them) and run, by check/run.sh. `sticker` and `scratch` need
// a page, so here they're typechecked only; the React component renders on a server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { type Finish, FINISHES, type Place, scratch, type ScratchCard, type ScratchOptions, type Source, sticker, type Sticker, type StickerOptions, type StickerState } from "@cesarvenzac/stickers";
import { Scratch, Sticker as StickerComponent, type ScratchProps, type StickerProps } from "@cesarvenzac/stickers/react";

const finish: Finish = "holo";
const place: Place = { x: 12, y: -4, angle: 0.2 };
const options: StickerOptions = { finish, label: "A heart", outline: 8, smooth: 16, border: "white", back: "#ddd", print: "Hello", peel: true, drag: true, bounds: null, dark: "auto", glow: "#9f9", curl: 10, comesOff: 0.6, shine: true, place, seed: 2, reducedMotion: false, onPeel: () => {}, onPick: () => {}, onDrop: (where: Place) => void where };
const cardOptions: ScratchOptions = { finish: "steel", coat: "silver", print: "Scratch", brush: 20, revealAt: 0.5, radius: 12, label: "Scratch to reveal", dark: false, shine: true, seed: 1, reducedMotion: false, onScratch: (share: number) => void share, onReveal: () => {} };
export const start = (element: HTMLElement, src: Source): [Sticker, ScratchCard] => {
  const made = sticker(element, src, options);
  made.set({ finish: "glow", src: "<svg viewBox='0 0 1 1'></svg>" });
  const state: StickerState = made.state;
  void state;
  return [made, scratch(element, cardOptions)];
};
if (typeof sticker !== "function" || typeof scratch !== "function") throw new Error("a function is missing");
if (FINISHES.length !== 6) throw new Error("six finishes");

const props: StickerProps = { src: "<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='red'/></svg>", finish: "glitter", label: "A dot", className: "dot" };
const markup = renderToStaticMarkup(createElement(StickerComponent, props));
if (!markup.includes(`class="dot"`) || !markup.includes("<circle") || !markup.includes(`aria-label="A dot"`)) throw new Error("Sticker didn't draw its art for the server");
const cardProps: ScratchProps = { print: "Scratch", children: "You won" };
const card = renderToStaticMarkup(createElement(Scratch, cardProps));
if (!card.includes("You won")) throw new Error("Scratch didn't draw what it holds");

console.log(`${FINISHES.join(", ")}; ${markup.length + card.length} characters drawn on a server`);
