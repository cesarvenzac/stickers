# Changelog

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
