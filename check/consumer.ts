// The package as someone installing it uses it: typechecked against its published types (as
// NodeNext and as a bundler resolves them) and run, by check/run.sh. `sticker` needs a page, so here
// it's typechecked only; the React component renders on a server, and the element's entry, the
// Svelte action and the Vue directive import with no DOM.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  type Finish,
  FINISHES,
  type Pattern,
  PATTERNS,
  type Place,
  type Source,
  sticker,
  type Sticker,
  type StickerOptions,
  type StickerState,
  type StickerWords,
} from "@cesarvenzac/stickers";
import { optionsOf, StickerImage } from "@cesarvenzac/stickers/element";
import { Sticker as StickerComponent, type StickerProps } from "@cesarvenzac/stickers/react";
import { sticker as stickerAction, type StickerParams } from "@cesarvenzac/stickers/svelte";
import { type StickerBinding, vSticker } from "@cesarvenzac/stickers/vue";

const finish: Finish = "holo";
const pattern: Pattern = "dots";
const place: Place = { x: 12, y: -4, angle: 0.2 };
const words: Partial<StickerWords> = { picked: (label) => `${label} pris`, keys: ({ move }) => (move ? "Espace le prend." : "") };
const options: StickerOptions = {
  finish,
  pattern,
  label: "A heart",
  outline: 8,
  smooth: 16,
  border: "white",
  back: "#ddd",
  print: "Hello",
  peel: true,
  drag: true,
  tear: 900,
  puffy: true,
  touch: "hold",
  bounds: null,
  dark: "auto",
  glow: "#9f9",
  curl: 10,
  comesOff: 0.6,
  shine: true,
  place,
  seed: 2,
  reducedMotion: false,
  announce: true,
  words,
  onPeel: () => {},
  onTear: () => {},
  onPick: () => {},
  onDrop: (where: Place) => void where,
};
export const start = (element: HTMLElement, src: Source): Sticker => {
  const made = sticker(element, src, options);
  made.set({ finish: "glow", src: "<svg viewBox='0 0 1 1'></svg>" });
  const state: StickerState = made.state;
  if (state === "peeling") made.restore();
  return made;
};
if (typeof sticker !== "function") throw new Error("sticker isn't a function");
if (FINISHES.length !== 5 || PATTERNS.length !== 5) throw new Error("five finishes, five patterns");

// The adapters, typechecked as Svelte and Vue would call them, and the element read as a page would.
const params: StickerParams = { src: "/heart.svg", finish: "holo", drag: true };
export const svelte = (node: HTMLElement) => stickerAction(node, params);
const binding: StickerBinding = { src: "/heart.svg", puffy: 1.5 };
export const vue = (element: HTMLElement) => vSticker.mounted(element, { value: binding });
export const element = (made: StickerImage): Place => {
  made.addEventListener("sticker-drop", (event) => void event.detail.angle);
  made.addEventListener("sticker-tear", () => made.restore());
  return made.place;
};
if (typeof StickerImage !== "function" || typeof vSticker.mounted !== "function") throw new Error("the adapters aren't there");
const read = optionsOf({ getAttribute: (name) => ({ finish: "glitter", puffy: "" })[name] ?? null, hasAttribute: (name) => name === "finish" || name === "puffy" });
if (read.finish !== "glitter" || read.puffy !== true) throw new Error("the element didn't read its attributes");

const props: StickerProps = { src: "<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='red'/></svg>", finish: "holo", pattern: "squares", puffy: true, label: "A dot", className: "dot" };
const markup = renderToStaticMarkup(createElement(StickerComponent, props));
if (!markup.includes(`class="dot"`) || !markup.includes("<circle") || !markup.includes(`aria-label="A dot"`)) throw new Error("Sticker didn't draw its art for the server");

console.log(`${FINISHES.join(", ")}; foils ${PATTERNS.join(", ")}; ${markup.length} characters drawn on a server`);
