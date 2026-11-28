# @cesarvenzac/stickers

Stickers for the web. Any picture, die-cut with a border round its outline; peeled from any edge
on a curl, its back showing, and laid back down, or peeled off and stuck down somewhere else, or
torn when it's yanked; picked up and moved, swinging from the point it's held by; flat or puffy; and lit by the pointer in its finish: paper, gloss, holographic foil in
five patterns, glitter, or phosphor that glows when the page goes dark.

[![Six stickers on a board, a puffy heart, a star in glitter, a holographic lightning bolt, a cloud, a badge in holographic dots and a moon: the foils flash as the pointer passes, the bolt is peeled from its tip, its printed back showing, and laid back down, and the puffy heart is picked up a little off its middle, swung round and set home](https://cesarvenzac.com/media/a74f098a-c7f7-4467-9d50-cdc2b5c1191f.webp)](https://cesarvenzac.com/stickers)

The docs, with live examples, are at [cesarvenzac.com/stickers](https://cesarvenzac.com/stickers).

```sh
npm install @cesarvenzac/stickers
```

## Use

```ts
import { sticker } from "@cesarvenzac/stickers";

const heart = sticker(document.querySelector(".heart")!, "/heart.svg", { finish: "holo", drag: true });
```

In React:

```tsx
import { Sticker } from "@cesarvenzac/stickers/react";

<Sticker src="/heart.svg" finish="gloss" puffy drag label="A heart" className="size-40" />
```

As an element, for any page or framework:

```html
<script type="module">
  import "@cesarvenzac/stickers/element";
</script>

<sticker-image src="/heart.svg" finish="holo" pattern="dots" drag label="A heart"></sticker-image>
```

In Svelte, `use:sticker={{ src, finish: "holo" }}` with `sticker` from
`@cesarvenzac/stickers/svelte`; in Vue, `v-sticker="{ src, finish: 'holo' }"` with `vSticker` from
`@cesarvenzac/stickers/vue`. Neither imports anything from its framework.

The element is the sticker's box: give it a size, and the picture is fitted inside, a border grown
round it. `src` is an image's address (its pixels are read to cut round it, so one from another
site needs CORS), SVG markup (whose `var(--…)` and `currentColor` are read on the sticker's
element, so it can be painted in your page's tokens, and again as the page turns dark or light),
or anything a canvas draws.

## What it does

- **A die-cut.** What's half opaque or more is the art; the border (`outline`) is grown round it,
  gaps narrower than `smooth` closed and holes filled, as a kiss-cut follows a drawing. Measured
  as a distance field from the art's own anti-aliased edge, so the cut is sharp at any size.
- **A peel.** Pressed near an edge, the sheet curls up from that point, its back showing (`back`,
  with `print` across it), its shadow falling on what's still stuck, and the point held stays under
  the pointer. It lifts like a tent, most where it's held, its curl tightest where least is
  lifted. Pointed at, an edge offers a hand. While it's up it's drawn over its neighbours. Let go before half way (`comesOff`) and it lies back
  down on a spring; past it, or pulled all the way up, it comes off: carried away by its corner, opening out and swinging,
  until it's out of the box that clips it or the window (then `restore()`), or into your hand with
  `drag`, opening out from the point held. `onPeel` is called as it comes off, either way.
- **Torn.** With `tear`, a sticker peeled slowly comes off whole, but one yanked faster than `tear`
  pixels a second (1200 for `true`) rips along the fold instead: the part lifted comes away in your
  hand, a ragged edge of white paper along it, and is carried off once you let go; the rest stays
  stuck, torn too, to be peeled or torn again. `onTear` says so, and `restore()` makes it whole.
- **Picked up and stuck down.** With `drag`, a press on it lifts it toward you, its shadow growing,
  and it follows the point you hold it by, swinging round behind it as a card dragged across a
  table does, tilting as it goes; let go and it's pressed down there, or press Escape and it goes
  back where it was. `onDrop` says where (`place`, moved and turned from where the page laid it
  out), and `place` puts it back. It stays inside its parent unless `bounds` says otherwise, and
  moves with `translate` and `rotate`, so a `transform` of your own stays yours.
- **Puffy.** With `puffy`, its face is domed, as a sticker under a drop of clear epoxy or padded
  with foam is, in any finish: steep at the edge, level in the middle, the light running round its
  curve. `puffy: 2` is twice as high.
- **Five finishes.** `paper`; `gloss`, a laminate's highlight; `holo`, holographic foil, the
  spectrum running across it as the light moves; `glitter`, flakes catching the light one by one;
  `glow`, glow in the dark. The light is a point above the pointer, and each sticker's `seed`
  varies its glints, so two in the same finish don't glint alike.
- **Holographic patterns.** The foil is a diffraction grating, and `pattern` lays its grooves:
  `smooth` (broad wavering bands, the default), `lines`, `squares`, `dots` (each disc grooved in
  rings, a bright spoke turned to the light) or `shards` (broken glass). Each patch shines its
  colour as the light comes square to its grooves and is silver otherwise.
- **The lights off.** `dark` follows the page unless said: a `dark` or `light` class on the root,
  a `data-theme`, `data-mode` or `data-color-scheme`, a `color-scheme` of dark alone, and
  otherwise the system's setting. Every sticker dims and the pointer becomes a torch; a `glow`
  sticker gives back the light it took in, bright at first and fading as phosphor does, half in
  twelve seconds, and the torch charges it again.
- **For everyone.** A sticker is an image named by `label`. Its keys are drag and drop's: Space or
  Enter picks one up, the arrow keys move it (Shift for further), Space or Enter sets it down,
  Escape puts it back, and Delete peels it off (so do Enter and Space, on one that can't be
  moved). What its keys do is read with it, and what they do is said aloud as it happens
  (`announce`, in your own words with `words`). On a phone a swipe over a sticker still scrolls
  the page, and a finger held on it a moment takes it (`touch`). Under reduced motion nothing
  swings, tilts or bounces.
- **One shader.** Every sticker on a page is drawn by one WebGL 2 context and copied onto its own
  canvas, so a page full of them never runs out of contexts; the shader is compiled without
  holding up the page. Where there's no WebGL 2, a sticker is drawn flat; in React, a server draws
  the picture with a border of drop shadows until the canvas takes over.

## API

```ts
function sticker(element: HTMLElement, src: Source, options?: StickerOptions): Sticker;

// An image's address, SVG markup, or anything a canvas draws.
type Source = string | CanvasImageSource;

type Sticker = {
  readonly element: HTMLElement;
  readonly place: Place; // { x, y, angle }
  readonly state: StickerState; // "loading" | "resting" | "peeling" | "held" | "off"
  set(options: StickerOptions & { src?: Source }): void;
  peelOff(): void;
  restore(): void;
  destroy(): void;
};

const FINISHES = ["paper", "gloss", "holo", "glitter", "glow"]; // type Finish
const PATTERNS = ["smooth", "lines", "squares", "dots", "shards"]; // type Pattern
```

`StickerOptions`, each with its default where it has one: `finish` (`"gloss"`), `pattern`
(`"smooth"`), `label`, `outline`, `smooth`, `border`, `back`, `print`, `peel` (true), `drag`
(false), `tear` (false, or the speed it tears at), `puffy` (false, or how high), `touch` (`"hold"`, or
`"press"`), `bounds`, `dark` (`"auto"`), `glow`, `curl`, `comesOff` (0.5), `shine` (true), `place`,
`seed`, `reducedMotion`, `announce` (true), `words` (`StickerWords`: `picked`, `dropped`, `moved`,
`returned`, `peeled` and `keys`, each a function returning what's said), `onPeel`, `onTear`,
`onPick`, `onDrop`.

React's `Sticker` (`StickerProps`) takes every option as a prop, `src`, `handle` for the `Sticker`
made, and the rest as the `<div>`'s, but children.

`<sticker-image>` (`StickerImage`) takes every option as an attribute in kebab case (`comes-off`,
`reduced-motion`; a switch is off as `"false"`; `bounds` a selector or `none`), `src`, `place` and
`options` as properties, and has `peelOff()`, `restore()`, `state` and `sticker`. It fires
`sticker-peel`, `sticker-tear`, `sticker-pick` and `sticker-drop` (its `detail` the `Place`). Svelte's action takes
`StickerParams` and Vue's directive a `StickerBinding`: the options and `src`, or for Vue a `src`
alone.

Each option, with examples: [cesarvenzac.com/stickers/docs/api](https://cesarvenzac.com/stickers/docs/api).

## Licence

MIT
