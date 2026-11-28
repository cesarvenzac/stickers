/**
 * `<sticker-image>`: a sticker as an element, for any page or framework. Importing this entry
 * defines it:
 *
 *   import "@cesarvenzac/stickers/element";
 *
 *   <sticker-image src="/heart.svg" finish="holo" pattern="dots" drag label="A heart"></sticker-image>
 *
 * Its options are attributes (`finish`, `pattern`, `label`, `outline`, `smooth`, `border`, `back`,
 * `print`, `peel="false"`, `drag`, `tear`, `puffy`, `touch`, `bounds`, `dark`, `glow`, `curl`,
 * `comes-off`, `shine="false"`, `seed`, `reduced-motion`, `announce="false"`); `src` is an
 * attribute or a property (anything a canvas draws, as a property), `place` and `options` are
 * properties (`options` for what an attribute can't say, as `words`). It tells the page as it comes
 * off, tears, is picked up and is set down with `sticker-peel`, `sticker-tear`, `sticker-pick` and
 * `sticker-drop` events, the last with where it sits as its `detail`. Give it a size, as any sticker: it's an inline block
 * unless said. What's inside it marked `data-sticker-stand-in` (an `<img>`, say) shows until the
 * sticker's drawn.
 */

import type { Source } from "./art.ts";
import { type Place, sticker, type Sticker, type StickerOptions, type StickerState } from "./sticker.ts";

/** The attributes it reads. */
const ATTRIBUTES = [
  "src",
  "finish",
  "pattern",
  "label",
  "outline",
  "smooth",
  "border",
  "back",
  "print",
  "peel",
  "drag",
  "tear",
  "puffy",
  "touch",
  "bounds",
  "dark",
  "glow",
  "curl",
  "comes-off",
  "shine",
  "seed",
  "reduced-motion",
  "announce",
];

/** What an element needs to be read: its attributes, and (for `bounds`) where it is. */
type Readable = Pick<Element, "getAttribute" | "hasAttribute"> & { closest?: Element["closest"]; ownerDocument?: Document | null };

const numberOf = (text: string | null) => (text === null || text.trim() === "" || Number.isNaN(Number(text)) ? undefined : Number(text));
/** A switch: there and not "false", or not there (undefined, its default). */
const switchOf = (element: Readable, name: string) => (element.hasAttribute(name) ? element.getAttribute(name) !== "false" : undefined);
/** A switch or a number: `puffy`, `puffy="2"`, `puffy="false"`. */
const amountOf = (element: Readable, name: string) => numberOf(element.getAttribute(name)) ?? switchOf(element, name);

/** What its attributes say, as options. */
export function optionsOf(element: Readable): StickerOptions {
  const read = (name: string) => element.getAttribute(name) ?? undefined;
  const dark = read("dark");
  const bounds = read("bounds");
  const touch = read("touch");
  return {
    finish: read("finish") as StickerOptions["finish"],
    pattern: read("pattern") as StickerOptions["pattern"],
    label: read("label"),
    outline: numberOf(element.getAttribute("outline")),
    smooth: numberOf(element.getAttribute("smooth")),
    border: read("border"),
    back: read("back"),
    print: read("print"),
    peel: switchOf(element, "peel"),
    drag: switchOf(element, "drag"),
    tear: amountOf(element, "tear"),
    puffy: amountOf(element, "puffy"),
    touch: touch === "press" || touch === "hold" ? touch : undefined,
    // `none` lets it go anywhere; a selector names the element it stays inside, the nearest round it first.
    bounds: bounds === undefined ? undefined : bounds === "none" ? null : (element.closest?.(bounds) ?? element.ownerDocument?.querySelector(bounds) ?? undefined),
    dark: dark === undefined ? undefined : dark === "auto" ? "auto" : dark !== "false",
    glow: read("glow"),
    curl: numberOf(element.getAttribute("curl")),
    comesOff: numberOf(element.getAttribute("comes-off")),
    shine: switchOf(element, "shine"),
    seed: numberOf(element.getAttribute("seed")),
    reducedMotion: switchOf(element, "reduced-motion"),
    announce: switchOf(element, "announce"),
  };
}

/** What an option goes back to when its attribute is taken away. */
const RESET: Partial<Record<string, Partial<StickerOptions>>> = {
  finish: { finish: "gloss" },
  pattern: { pattern: "smooth" },
  label: { label: "" },
  border: { border: "" },
  back: { back: "" },
  print: { print: "" },
  glow: { glow: "" },
  peel: { peel: true },
  drag: { drag: false },
  tear: { tear: false },
  puffy: { puffy: false },
  touch: { touch: "hold" },
  bounds: { bounds: null },
  dark: { dark: "auto" },
  "comes-off": { comesOff: 0.5 },
  shine: { shine: true },
  announce: { announce: true },
};

// A class to extend where there's no DOM (a server importing it), so the entry imports anywhere.
const Base = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

export class StickerImage extends Base {
  static observedAttributes = ATTRIBUTES;
  private made: Sticker | null = null;
  private art: Source | null = null;
  private extra: StickerOptions = {};
  private where: Place | undefined;

  /** What it's a sticker of: the `src` attribute, or anything a canvas draws. */
  get src(): Source {
    return this.art ?? this.getAttribute("src") ?? "";
  }
  set src(src: Source) {
    this.art = src;
    this.made?.set({ src });
  }

  /** Where it sits: moved and turned from where the page laid it out. */
  get place(): Place {
    return this.made?.place ?? this.where ?? { x: 0, y: 0, angle: 0 };
  }
  set place(place: Place) {
    this.where = place;
    this.made?.set({ place });
  }

  /** Options an attribute can't say, as `words`. Attributes win where both say. */
  get options(): StickerOptions {
    return this.extra;
  }
  set options(options: StickerOptions) {
    this.extra = options;
    this.made?.set(this.settable());
  }

  /** Where it stands: `loading`, `resting`, `peeling`, `held` or `off`. */
  get state(): StickerState {
    return this.made?.state ?? "loading";
  }

  /** The sticker itself, once it's on the page. */
  get sticker(): Sticker | null {
    return this.made;
  }

  /** Peels it all the way off, as a hand would. */
  peelOff() {
    this.made?.peelOff();
  }

  /** Puts it back where it was, once it came off. */
  restore() {
    this.made?.restore();
  }

  private all(): StickerOptions {
    const said = Object.fromEntries(Object.entries(optionsOf(this)).filter(([, value]) => value !== undefined));
    return { ...this.extra, ...said };
  }

  /** Its options but the calls, which stay the element's own: they tell the page by events too. */
  private settable(): StickerOptions {
    const options = this.all();
    delete options.onPeel;
    delete options.onTear;
    delete options.onPick;
    delete options.onDrop;
    return options;
  }

  connectedCallback() {
    if (this.made) return;
    if (getComputedStyle(this).display === "inline") this.style.display = "inline-block";
    this.made = sticker(this, this.src, {
      ...this.all(),
      place: this.where,
      onPeel: () => {
        this.extra.onPeel?.();
        this.dispatchEvent(new CustomEvent("sticker-peel", { bubbles: true }));
      },
      onTear: () => {
        this.extra.onTear?.();
        this.dispatchEvent(new CustomEvent("sticker-tear", { bubbles: true }));
      },
      onPick: () => {
        this.extra.onPick?.();
        this.dispatchEvent(new CustomEvent("sticker-pick", { bubbles: true }));
      },
      onDrop: (place) => {
        this.extra.onDrop?.(place);
        this.dispatchEvent(new CustomEvent<Place>("sticker-drop", { bubbles: true, detail: place }));
      },
    });
  }

  disconnectedCallback() {
    this.made?.destroy();
    this.made = null;
  }

  attributeChangedCallback(name: string, _was: string | null, now: string | null) {
    if (!this.made) return;
    if (name === "src") this.art = null;
    // Taken away, an attribute's option goes back to its default (bounds to none: a selector named one).
    const reset = now === null ? (RESET[name] ?? {}) : {};
    this.made.set({ ...reset, ...this.settable(), src: this.src });
  }
}

if (typeof customElements !== "undefined" && !customElements.get("sticker-image")) customElements.define("sticker-image", StickerImage);

declare global {
  interface HTMLElementTagNameMap {
    "sticker-image": StickerImage;
  }
  interface HTMLElementEventMap {
    "sticker-peel": CustomEvent<void>;
    "sticker-tear": CustomEvent<void>;
    "sticker-pick": CustomEvent<void>;
    "sticker-drop": CustomEvent<Place>;
  }
}
