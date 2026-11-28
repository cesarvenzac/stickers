# Changelog

## 1.0.0

Stickers' options, its handle and its states are stable from here: a change that breaks them waits for 2.0. A sticker can tear when it's yanked, and be domed; a peel lifts as paper does and comes off without a jump; its keys are drag and drop's, said aloud; a swipe over it on a phone scrolls the page; and it comes as an element, a Svelte action and a Vue directive.

- **Torn.** `tear` makes a sticker tear when it's yanked. Peeled slowly it comes off whole; pulled faster than `tear` pixels a second (1200 for `true`), once a little of it is up, it rips along the fold's front instead of lifting more. The part lifted comes away in the hand as a piece of its own, drawn just as it was, opening out from the point held and following the hand, then carried off out of sight once it's let go; the rest stays stuck. Both have a ragged edge of white paper along the tear, its fibres here and there. What's left can be peeled, or torn, again. `onTear` is called each time (the element's `sticker-tear`), and `restore()` makes it whole. Tearing is the pointer's: the keys and `peelOff()` take a sticker off whole.
- **Puffy.** `puffy` domes a sticker's face, as clear epoxy or foam does, in any finish: it rises steeply from the cut's edge and lies level in the middle, so the light runs round its curve; its back stays flat and it casts a deeper shadow. A number says how high. The dome follows the cut, so a hole the cut fills is as high as what's round it.
- **Keys, as drag and drop has them.** Space or Enter picks up a sticker that can be moved, the arrow keys move it, Space or Enter sets it down, and Escape puts it back where it was picked up (Escape also puts back one the pointer holds, and lays back a peel). Delete or Backspace peels a sticker off, so one that can be moved can be peeled from the keys too. The arrow keys still move one that's lying down, as before. This replaces 0.x's keys, where Enter and Space only peeled off a sticker that couldn't be moved.
- **Said aloud.** What the keys do to a sticker is said through a polite live region (picked up, set down, moved, put back, peeled off), and what its keys are is read with it (`aria-description`, `aria-keyshortcuts`). `announce: false` keeps it quiet; `words` says it in another language.
- **A phone can scroll.** A swipe that starts on a sticker scrolls the page; a finger held still on it a moment (`touch: "hold"`, the default) peels it or picks it up, and the page holds still while it does. `touch: "press"` takes the finger at once, as 0.x did, and a swipe over it doesn't scroll.
- **A peel that lifts as paper does.** Pulled at a point, a sheet doesn't fold along a straight line: it lifts like a tent. The fold's front now bows back to the edge on either side of the point held, a small lift a small tent and a deep one a broad curve, and its curl is tightest where least is lifted, as a cone's toward its tip. It straightens as the last of it comes up. In 0.x a peel was a straight fold across the sticker, whatever its shape.
- **Carried off, not faded.** A sticker peeled away is carried off by the corner it was peeled from, opening out and swinging as it goes the way it was pulled, faster and faster, until it's out of what it's seen in (the nearest box round it that clips what overflows it, or the window); then it's off. In 0.x it faded where it lay. Under reduced motion it still fades.
- **Coming off into the hand doesn't jump.** A sticker with `drag` peeled past half way is held by the corner it was peeled from, where the fold had carried it, under the pointer, and opens out from there. In 0.x it jumped to put the point held back under the pointer and unrolled on a bounce as it was dragged, most of all from a round edge.
- **`onPeel` is called whenever it comes off**: into the hand for a sticker that can be moved, as well as once it's gone for one that can't. In 0.x a sticker with `drag` never called it.
- **Everywhere.** `@cesarvenzac/stickers/element` defines `<sticker-image>`, its options attributes, telling the page with `sticker-peel`, `sticker-tear`, `sticker-pick` and `sticker-drop` events; `@cesarvenzac/stickers/svelte` is an action and `@cesarvenzac/stickers/vue` a directive. None imports anything from its framework.
- SVG art painted in the page's tokens follows them as the page turns dark or light; in 0.x only the border, back and glow colours did.
- `set({ seed })` changes the glints; in 0.x the seed was kept from when the sticker was made.
- Fixed: with the lights off, a glowing sticker peeled part way left the page glowing where it had lain; the page now glows only round what's still on it.
- Fixed: a sticker peeled past half way, its sheet thrown past its far edge, was cut off square there, at the edge of the canvas it's drawn on; that canvas now grows while a peel needs it to, so the sheet is drawn whole wherever it's thrown.
- Fixed: a sticker could stop being drawn, left showing whatever it last was (in 0.x, faded half way or peeled): one scrolled into view as the page loaded, or carried out of sight and put back between two frames, heard "off screen" and "on screen" at once from the browser and took the first. It now takes the last.
- A sticker being peeled is drawn over its neighbours, its sheet folding over them, and goes back among them once it lies flat.
- Pulled all the way up, a sticker comes off there and then, the way it was pulled, rather than trailing after the pointer however far it goes; and a sticker let go of mid-throw goes by how far the hand had pulled it, not only by how far the drawing had caught up.
- `destroy()` gives back what it set on its element: its `position` and the `z-index` a pick-up raised it to.
- A box that changes size every frame is cut again once a frame, one cut at a time, and art already loaded isn't loaded again.
- The README opens on a new loop: the bolt peeled in a curl, the puffy heart picked up and swung round.

## 0.2.2

- The README names everything the package exports: `FINISHES`, `PATTERNS`, the `Source`, `Finish`, `Pattern` and `StickerState` types, React's `StickerProps` (every option, `src` and `handle`, and the `<div>`'s own props but children), and the defaults of `finish` (`"gloss"`) and `pattern` (`"smooth"`).
- `seed` is described as what it does: it varies a sticker's glints, so two in the same finish don't glint alike. It never chose the pattern, which is `pattern`'s since 0.2.0.

## 0.2.1

- The README's loop is sharper: moving shapes no longer leave pixels behind them.

## 0.2.0

- Holographic patterns. `pattern` lays a holographic foil's grooves: `smooth` (the foil as it was, the default), `lines`, `squares`, `dots` or `shards`. The foil is drawn as a diffraction grating: each line, tile, dot or shard flashes its colour as the light comes square to its grooves and is silver otherwise; a dot, grooved in rings, draws a bright spoke turned to the light. `PATTERNS` lists them.
- Nothing lifts on hover any more. A straight fold across a round edge never matched the shape it lifted; the pointer still shows a hand where a sticker can be peeled.
- Scratch cards are gone (`scratch`, React's `Scratch`): scratching a sticker that's stuck fast is to come back in its place, as part of peeling.
- The `steel` finish is gone, until it looks as it should.
- The README opens on the board from its docs: the foils catching the light, the bolt peeled and laid back down, the heart picked up and put back.

## 0.1.0

The first version.

- `sticker(element, src)` and React's `<Sticker src>`: any picture (an image, SVG markup painted in the page's own tokens, anything a canvas draws), die-cut with a border round its outline, its gaps closed and its holes filled, measured from the art's anti-aliased edge.
- A peel from any edge, on a curl: the back showing, printed if you like, the shadow falling on what's still stuck, the point held under the pointer; an edge pointed at lifts a little. Let go before half way and it lies back down; past it, it comes off, away (`onPeel`, `restore()`) or into the hand.
- Picked up and stuck down (`drag`): lifted with its shadow growing, following the point held and swinging round behind it, tilting as it goes, pressed down where it's let go; `place` and `onDrop` to keep where.
- Six finishes, lit by a light above the pointer: paper, gloss, holographic foil, glitter, brushed steel and glow in the dark.
- The lights off, following the page's own dark mode: every sticker dims, the pointer becomes a torch, and a glowing sticker gives back the light it took in, fading as phosphor does.
- Scratch cards (`scratch(element)`, React's `<Scratch>`): a coating in any finish, scratched off with a ragged edge, flakes falling, crumbling away past a share.
- Arrow keys and Enter, reduced motion, one WebGL 2 context for the page, a flat drawing where there's none, and a server-drawn stand-in in React.
