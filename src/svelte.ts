/**
 * Stickers in Svelte, as an action: no component to compile, nothing from Svelte imported.
 *
 *   <script>
 *     import { sticker } from "@cesarvenzac/stickers/svelte";
 *   </script>
 *
 *   <div class="heart" use:sticker={{ src: "/heart.svg", finish: "holo", drag: true }}></div>
 *
 * Give the element a size: the picture is fitted inside. A change to what's passed is passed on.
 */

import type { Source } from "./art.ts";
import { sticker as stickerCore, type StickerOptions } from "./sticker.ts";

/** What the action takes: the picture, and any of the sticker's options. */
export type StickerParams = StickerOptions & { src: Source };

export function sticker(node: HTMLElement, params: StickerParams) {
  const { src, ...options } = params;
  const made = stickerCore(node, src, options);
  return {
    update(next: StickerParams) {
      made.set(next);
    },
    destroy() {
      made.destroy();
    },
  };
}
