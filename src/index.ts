/**
 * Stickers for the web. Any picture, die-cut with a border; peeled from any edge on a curl and
 * laid back down, or peeled off and stuck down elsewhere; picked up and moved; and lit by the
 * pointer in its finish: paper, gloss, holographic foil, glitter, brushed steel, or phosphor that
 * glows when the page goes dark. And scratch cards, coated in the same finishes.
 *
 *   import { sticker } from "@cesarvenzac/stickers";
 *
 *   sticker(document.querySelector(".heart"), "/heart.svg", { finish: "holo" });
 *
 * The React components are `@cesarvenzac/stickers/react`.
 */

export type { Source } from "./art.ts";
export { scratch, type ScratchCard, type ScratchOptions } from "./scratch.ts";
export { type Finish, type Place, sticker, type Sticker, type StickerOptions, type StickerState } from "./sticker.ts";
export { FINISHES } from "./shaders.ts";
