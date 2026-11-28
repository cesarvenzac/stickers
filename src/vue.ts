/**
 * Stickers in Vue, as a directive: nothing from Vue imported.
 *
 *   <script setup>
 *     import { vSticker } from "@cesarvenzac/stickers/vue";
 *   </script>
 *
 *   <div class="heart" v-sticker="'/heart.svg'"></div>
 *   <div class="heart" v-sticker="{ src: heart, finish: 'holo', drag: true, onDrop: save }"></div>
 *
 * Give the element a size, with nothing inside it for Vue to keep: the sticker draws in it.
 */

import type { Source } from "./art.ts";
import { type Sticker, sticker, type StickerOptions } from "./sticker.ts";

/** What the directive takes: a picture, or the picture and any of the sticker's options. */
export type StickerBinding = Source | (StickerOptions & { src: Source });

const made = new WeakMap<HTMLElement, Sticker>();

/** A plain object is the picture and options; anything else (a string, an image, a canvas) is the picture. */
const read = (binding: StickerBinding): { src: Source; options: StickerOptions } => {
  const prototype = typeof binding === "object" && binding !== null ? Object.getPrototypeOf(binding) : undefined;
  if (prototype === Object.prototype || prototype === null) {
    const { src, ...options } = binding as StickerOptions & { src: Source };
    return { src, options };
  }
  return { src: binding as Source, options: {} };
};

export const vSticker = {
  mounted(element: HTMLElement, binding: { value: StickerBinding }) {
    const { src, options } = read(binding.value);
    made.set(element, sticker(element, src, options));
  },
  updated(element: HTMLElement, binding: { value: StickerBinding }) {
    const { src, options } = read(binding.value);
    made.get(element)?.set({ ...options, src });
  },
  beforeUnmount(element: HTMLElement) {
    made.get(element)?.destroy();
    made.delete(element);
  },
};
