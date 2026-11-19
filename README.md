# @cesarvenzac/stickers

Stickers for the web. Any picture, die-cut with a border round its outline; peeled from any edge
on a curl, its back showing, and laid back down, or peeled off and stuck down somewhere else;
picked up and moved, swinging from the point it's held by; and lit by the pointer in its finish:
paper, gloss, holographic foil in five patterns, glitter, or phosphor that glows when the page goes
dark.

[![Six stickers on a board, a heart, a star in glitter, a holographic lightning bolt, a cloud, a badge in holographic dots and a moon: the foils flash as the pointer passes, the bolt is peeled from its tip, its printed back showing, and laid back down, and the heart is picked up by its middle, swung round and put back](https://cesarvenzac.com/media/1278ce53-8c82-439a-b65a-d37c828234d1.webp)](https://cesarvenzac.com/stickers)

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

<Sticker src="/heart.svg" finish="holo" pattern="dots" drag label="A heart" className="size-40" />
```

The element is the sticker's box: give it a size, and the picture is fitted inside, a border grown
round it. `src` is an image's address (its pixels are read to cut round it, so one from another
site needs CORS), SVG markup (whose `var(--…)` and `currentColor` are read on the sticker's
element, so it can be painted in your page's tokens), or anything a canvas draws.

## What it does

- **A die-cut.** What's half opaque or more is the art; the border (`outline`) is grown round it,
  gaps narrower than `smooth` closed and holes filled, as a kiss-cut follows a drawing. Measured
  as a distance field from the art's own anti-aliased edge, so the cut is sharp at any size.
- **A peel.** Pressed near an edge, the sheet rolls up round a cylinder from that point, its back
  showing (`back`, with `print` across it), its shadow falling on what's still stuck, and the
  point held stays under the pointer. Pointed at, an edge offers a hand. Let go before half way
  (`comesOff`) and it lies back down on a spring; past it, it comes off: away (`onPeel`, then
  `restore()`), or into your hand with `drag`.
- **Picked up and stuck down.** With `drag`, a press on it lifts it toward you, its shadow growing,
  and it follows the point you hold it by, swinging round behind it as a card dragged across a
  table does, tilting as it goes; let go and it's pressed down there. `onDrop` says where (`place`,
  moved and turned from where the page laid it out), and `place` puts it back. It stays inside its
  parent unless `bounds` says otherwise, and moves with `translate` and `rotate`, so a `transform`
  of your own stays yours.
- **Five finishes.** `paper`; `gloss`, a laminate's highlight; `holo`, holographic foil, the
  spectrum running across it as the light moves; `glitter`, flakes catching the light one by one;
  `glow`, glow in the dark. The light is a point above the pointer, and each sticker's `seed`
  picks its own pattern.
- **Holographic patterns.** The foil is a diffraction grating, and `pattern` lays its grooves:
  `smooth` (broad wavering bands, the default), `lines`, `squares`, `dots` (each disc grooved in
  rings, a bright spoke turned to the light) or `shards` (broken glass). Each patch shines its
  colour as the light comes square to its grooves and is silver otherwise.
- **The lights off.** `dark` follows the page unless said: a `dark` or `light` class on the root,
  a `data-theme`, `data-mode` or `data-color-scheme`, a `color-scheme` of dark alone, and
  otherwise the system's setting. Every sticker dims and the pointer becomes a torch; a `glow`
  sticker gives back the light it took in, bright at first and fading as phosphor does, half in
  twelve seconds, and the torch charges it again.
- **For everyone.** A sticker is an image named by `label`; the arrow keys move one that can be
  moved and Enter peels off one that can't. Under reduced motion nothing swings, tilts or bounces.
- **One shader.** Every sticker on a page is drawn by one WebGL 2 context and copied onto its own
  canvas, so a page full of them never runs out of contexts; the shader is compiled without
  holding up the page. Where there's no WebGL 2, a sticker is drawn flat; in React, a server draws
  the picture with a border of drop shadows until the canvas takes over.

## API

```ts
function sticker(element: HTMLElement, src: Source, options?: StickerOptions): Sticker;

type Sticker = {
  readonly element: HTMLElement;
  readonly place: Place; // { x, y, angle }
  readonly state: "loading" | "resting" | "peeling" | "held" | "off";
  set(options: StickerOptions & { src?: Source }): void;
  peelOff(): void;
  restore(): void;
  destroy(): void;
};

```

`StickerOptions`: `finish`, `pattern`, `label`, `outline`, `smooth`, `border`, `back`, `print`, `peel`
(true), `drag` (false), `bounds`, `dark` (`"auto"`), `glow`, `curl`, `comesOff` (0.5), `shine`
(true), `place`, `seed`, `reducedMotion`, `onPeel`, `onPick`, `onDrop`.

React's `Sticker` takes every option as a prop, `handle` for the `Sticker` made, and the rest as
the `<div>`'s.

Each option, with examples: [cesarvenzac.com/stickers/docs/api](https://cesarvenzac.com/stickers/docs/api).

## Licence

MIT
