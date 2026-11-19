# Changelog

## 0.1.0

The first version.

- `sticker(element, src)` and React's `<Sticker src>`: any picture (an image, SVG markup painted in the page's own tokens, anything a canvas draws), die-cut with a border round its outline, its gaps closed and its holes filled, measured from the art's anti-aliased edge.
- A peel from any edge, on a curl: the back showing, printed if you like, the shadow falling on what's still stuck, the point held under the pointer; an edge pointed at lifts a little. Let go before half way and it lies back down; past it, it comes off, away (`onPeel`, `restore()`) or into the hand.
- Picked up and stuck down (`drag`): lifted with its shadow growing, following the point held and swinging round behind it, tilting as it goes, pressed down where it's let go; `place` and `onDrop` to keep where.
- Six finishes, lit by a light above the pointer: paper, gloss, holographic foil, glitter, brushed steel and glow in the dark.
- The lights off, following the page's own dark mode: every sticker dims, the pointer becomes a torch, and a glowing sticker gives back the light it took in, fading as phosphor does.
- Scratch cards (`scratch(element)`, React's `<Scratch>`): a coating in any finish, scratched off with a ragged edge, flakes falling, crumbling away past a share.
- Arrow keys and Enter, reduced motion, one WebGL 2 context for the page, a flat drawing where there's none, and a server-drawn stand-in in React.
