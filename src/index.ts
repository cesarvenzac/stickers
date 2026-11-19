/**
 * Stickers for the web. Any picture, die-cut with a border; peeled from any edge on a curl and
 * laid back down, or peeled off and stuck down elsewhere; picked up and moved; and lit by the
 * pointer in its finish: paper, gloss, holographic foil in five patterns, glitter, or phosphor that
 * glows when the page goes dark.
 *
 *   import { sticker } from "@cesarvenzac/stickers";
 *
 *   sticker(document.querySelector(".heart"), "/heart.svg", { finish: "holo" });
 *
 * The React component is `@cesarvenzac/stickers/react`.
 */

export type { Source } from "./art.ts";
export { FINISHES, PATTERNS } from "./shaders.ts";
export { type Finish, type Pattern, type Place, sticker, type Sticker, type StickerOptions, type StickerState } from "./sticker.ts";
