"use client";

/**
 * Stickers in React:
 *
 *   import { Sticker } from "@cesarvenzac/stickers/react";
 *
 *   <Sticker src="/heart.svg" finish="holo" label="A heart" style={{ width: 160, height: 160 }} />
 *
 * A server draws a sticker's art as it is, with a border made of drop shadows, which the drawing
 * takes over once the browser has it. Give a sticker a size: its art is fitted inside.
 */

import { type CSSProperties, type HTMLAttributes, useEffect, useLayoutEffect, useRef } from "react";

import type { Source } from "./art.ts";
import { sticker, type Sticker as Handle, type StickerOptions } from "./sticker.ts";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const isMarkup = (source: string) => /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(source);

/** A border of `width` pixels round the art, in `colour`, made of drop shadows: how the server draws it until the canvas does. */
const outlineOf = (width: number, colour: string) => {
  const step = Math.max(0.5, width / 2);
  const shadows = [`drop-shadow(${step}px 0 0 ${colour})`, `drop-shadow(-${step}px 0 0 ${colour})`, `drop-shadow(0 ${step}px 0 ${colour})`, `drop-shadow(0 -${step}px 0 ${colour})`];
  return `${shadows.join(" ")} drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.2))`;
};

export type StickerProps = StickerOptions &
  Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    /** An image's address, SVG markup, or (in the browser alone) anything a canvas draws. */
    src: Source;
    /** Called with the sticker once it's made, and with null once it's gone: for `peelOff()` and `restore()`. */
    handle?: (sticker: Handle | null) => void;
  };

/** A `<div>` that's a sticker of `src`. */
export function Sticker({
  src,
  handle,
  finish,
  pattern,
  label,
  outline,
  smooth,
  border,
  back,
  print,
  peel,
  drag,
  bounds,
  dark,
  glow,
  curl,
  comesOff,
  shine,
  place,
  seed,
  reducedMotion,
  onPeel,
  onPick,
  onDrop,
  style,
  ...rest
}: StickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const made = useRef<Handle | null>(null);
  const options: StickerOptions = { finish, pattern, label, outline, smooth, border, back, print, peel, drag, bounds, dark, glow, curl, comesOff, shine, seed, reducedMotion };
  const calls = useRef({ onPeel, onPick, onDrop, handle });
  const latest = useRef({ src, options });
  // Before the effects below read them: the callbacks and options of this render.
  useIsomorphicLayoutEffect(() => {
    calls.current = { onPeel, onPick, onDrop, handle };
    latest.current = { src, options };
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const made_ = sticker(element, latest.current.src, {
      ...latest.current.options,
      place,
      onPeel: () => calls.current.onPeel?.(),
      onPick: () => calls.current.onPick?.(),
      onDrop: (where) => calls.current.onDrop?.(where),
    });
    made.current = made_;
    calls.current.handle?.(made_);
    return () => {
      calls.current.handle?.(null);
      made_.destroy();
      made.current = null;
    };
    // Made once; what changes is passed on below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = JSON.stringify({ ...options, bounds: undefined });
  useEffect(() => {
    made.current?.set({ ...latest.current.options, src: latest.current.src });
  }, [key, src, bounds]);
  const placeKey = place ? `${place.x},${place.y},${place.angle}` : "";
  useEffect(() => {
    if (place) made.current?.set({ place });
    // Only when the place given changes, not each time it's drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey]);

  const width = outline ?? 6;
  // In the flow, filling the box (so the element needn't be positioned yet), the art inside its border.
  const standIn: CSSProperties = { display: "block", width: "100%", height: "100%", boxSizing: "border-box", padding: width + 1.5, filter: outlineOf(width, border ?? "white"), pointerEvents: "none" };
  const placed: CSSProperties = place ? { translate: `${place.x}px ${place.y}px`, rotate: `${place.angle}rad` } : {};
  return (
    <div ref={ref} role="img" aria-roledescription="sticker" aria-label={label} {...rest} style={{ ...placed, ...style }}>
      {typeof src === "string" ? (
        isMarkup(src) ? (
          <span data-sticker-stand-in="" aria-hidden="true" style={standIn} dangerouslySetInnerHTML={{ __html: src.replace(/<svg/i, `<svg style="width:100%;height:100%;display:block"`) }} />
        ) : (
          <span data-sticker-stand-in="" aria-hidden="true" style={standIn}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </span>
        )
      ) : null}
    </div>
  );
}
