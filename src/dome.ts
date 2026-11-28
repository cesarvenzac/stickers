/**
 * A puffy sticker: domed, as a sticker under a drop of clear epoxy or one padded with foam is. Its
 * face rises from the cut's edge over a rim and lies flat beyond it, steep at the edge but never
 * upright, so the light runs round its curve. The height is a function of how far in from the edge
 * a point is (the cut's depth, a distance field of its own); the shader works out the same curve
 * and its slope, so these are the sums it does. Pure: no DOM.
 */

/** How a sticker is domed: how high it stands in the middle and how far in from its edge it takes to get there, in box pixels. */
export type Dome = { height: number; rim: number };

/** The rim as a share of the box's shorter side, and the dome's height as a share of its rim. */
const RIM = 0.2;
const RISE = 0.45;

/** How puffy a sticker is from its `puffy` option: 0 flat, 1 for `true`, otherwise the number given (2 twice as high). */
export function puffinessOf(puffy: boolean | number | undefined): number {
  if (puffy === true) return 1;
  if (typeof puffy === "number" && Number.isFinite(puffy) && puffy > 0) return puffy;
  return 0;
}

/** The dome a sticker in a box `box` big has at `puffiness`: flat at 0. */
export function domeOf(puffiness: number, box: { width: number; height: number }): Dome {
  const rim = Math.max(4, Math.min(box.width, box.height) * RIM);
  return { height: rim * RISE * Math.max(0, puffiness), rim };
}

/** How high the face stands `depth` pixels in from the cut's edge. */
export function heightAt(depth: number, dome: Dome) {
  const u = Math.min(Math.max(depth / dome.rim, 0), 1);
  return dome.height * (1 - (1 - u) ** 3);
}

/** How steeply the face rises `depth` pixels in from the edge: height a pixel in. */
export function slopeAt(depth: number, dome: Dome) {
  const u = Math.min(Math.max(depth / dome.rim, 0), 1);
  return ((3 * dome.height) / dome.rim) * (1 - u) ** 2;
}
