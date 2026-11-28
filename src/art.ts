/**
 * A sticker's art, made ready to draw: loaded from whatever it was given, fitted inside its box
 * within the border, drawn at the screen's resolution, and its die-cut worked out from its alpha.
 */

import { type Cut, cutOf, hullOf, type Point } from "./field.ts";

/**
 * What a sticker can be made from: an image's address, SVG markup (`<svg …>`, whose `var(--…)` and
 * `currentColor` are read from the sticker's element, so it can be painted in a page's tokens), or
 * anything a canvas can draw (an image, a canvas, an ImageBitmap, a video's frame).
 */
export type Source = string | CanvasImageSource;

const isMarkup = (source: string) => /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(source);

/** SVG markup with the page's custom properties and current colour written in, as read on `element`. */
export function resolveColours(markup: string, element: Element): string {
  const style = getComputedStyle(element);
  return markup
    .replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, name: string, fallback?: string) => style.getPropertyValue(name).trim() || fallback?.trim() || "black")
    .replace(/currentColor/gi, style.color);
}

/**
 * What a source draws as on `element`: SVG markup with its colours read there (so it changes when
 * the page's tokens do), and anything else as it is. Two sources with the same key draw the same.
 */
export const keyOf = (source: Source, element: Element): Source => (typeof source === "string" && isMarkup(source) ? resolveColours(source, element) : source);

/** The source as something to draw, once it's loaded. Rejects when it can't be. */
export async function load(source: Source, element: Element): Promise<CanvasImageSource> {
  if (typeof source !== "string") return source;
  const image = new Image();
  image.decoding = "async";
  if (isMarkup(source)) {
    let markup = resolveColours(source, element);
    // An SVG with no size of its own is given its viewBox's shape, large: some browsers draw an
    // SVG image at its own size and stretch that, blurring a small icon.
    if (!/<svg[^>]*\swidth=/i.test(markup)) {
      const box = /viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(markup);
      if (box) {
        const grow = 1024 / Math.max(Number(box[1]), Number(box[2]), 1);
        markup = markup.replace(/<svg/i, `<svg width="${Number(box[1]) * grow}" height="${Number(box[2]) * grow}"`);
      }
    }
    if (!/xmlns=/.test(markup)) markup = markup.replace(/<svg/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  } else {
    image.crossOrigin = "anonymous";
    image.src = source;
  }
  await image.decode();
  return image;
}

/** A source's own size, as it would be drawn. */
export function sizeOf(source: CanvasImageSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight };
  if (typeof SVGImageElement !== "undefined" && source instanceof SVGImageElement) return { width: source.width.baseVal.value, height: source.height.baseVal.value };
  const sized = source as { width: number; height: number };
  return { width: Number(sized.width) || 1, height: Number(sized.height) || 1 };
}

/** Where the art goes in a box: as large as it fits inside the border, in the middle, its own shape kept. */
export function fitIn(art: { width: number; height: number }, box: { width: number; height: number }, inset: number) {
  const room = { width: Math.max(1, box.width - 2 * inset), height: Math.max(1, box.height - 2 * inset) };
  const scale = Math.min(room.width / art.width, room.height / art.height);
  const width = art.width * scale;
  const height = art.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

export type Prepared = {
  /** The art as drawn over the box, at `scale` device pixels a box pixel. */
  art: HTMLCanvasElement;
  cut: Cut;
  /** Box pixels a pixel of the field. */
  fieldScale: number;
  /** The cut's convex hull, in box pixels. */
  hull: Point[];
};

/** The most pixels across the field the cut is measured on: it's smooth, and read between its pixels. */
const FIELD_MOST = 256;

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/**
 * The art drawn into a box `box` big (CSS pixels) at `scale` device pixels each, inside a border
 * `outline` wide, and the die-cut round it, its narrow gaps closed by `smooth`. The art's alpha
 * has to be readable: an image from elsewhere needs CORS.
 */
export function prepare(source: CanvasImageSource, box: { width: number; height: number }, outline: number, smooth: number, scale: number): Prepared {
  // Inside the border, and a pixel more, so the cut stays clear of the box's edge.
  const place = fitIn(sizeOf(source), box, outline + 1.5);
  const art = canvasOf(box.width * scale, box.height * scale);
  const context = art.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, place.x * scale, place.y * scale, place.width * scale, place.height * scale);
  const fieldScale = Math.max(box.width, box.height) / FIELD_MOST > 1 ? Math.max(box.width, box.height) / FIELD_MOST : 1;
  const fieldWidth = Math.max(4, Math.round(box.width / fieldScale));
  const fieldHeight = Math.max(4, Math.round(box.height / fieldScale));
  const small = canvasOf(fieldWidth, fieldHeight);
  const smallContext = small.getContext("2d", { willReadFrequently: true })!;
  smallContext.drawImage(art, 0, 0, fieldWidth, fieldHeight);
  const pixels = smallContext.getImageData(0, 0, fieldWidth, fieldHeight).data;
  const alpha = new Uint8Array(fieldWidth * fieldHeight);
  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3];
  const cut = cutOf(alpha, fieldWidth, fieldHeight, outline / fieldScale, smooth / fieldScale);
  const sx = box.width / fieldWidth;
  const sy = box.height / fieldHeight;
  const hull = hullOf(cut).map((point) => ({ x: point.x * sx, y: point.y * sy }));
  return { art, cut, fieldScale: (sx + sy) / 2, hull };
}

/**
 * The sticker drawn flat, as a printer would: its border and art, and a soft shadow under it. What
 * shows before the shader is ready, and where there's no WebGL 2. Drawn into `target` (device
 * pixels), the box `margin` CSS pixels in from its edges.
 */
export function drawFlat(target: HTMLCanvasElement, prepared: Prepared, border: string, margin: number, scale: number) {
  const context = target.getContext("2d");
  if (!context) return;
  const { cut } = prepared;
  const shape = canvasOf(cut.width, cut.height);
  const shapeContext = shape.getContext("2d")!;
  const image = shapeContext.createImageData(cut.width, cut.height);
  for (let i = 0; i < cut.field.length; i++) {
    const cover = Math.min(Math.max(0.5 - cut.field[i], 0), 1);
    image.data[i * 4 + 3] = Math.round(cover * 255);
  }
  shapeContext.putImageData(image, 0, 0);
  const width = prepared.art.width;
  const height = prepared.art.height;
  // The border: the shape filled in its colour.
  const sheet = canvasOf(width, height);
  const sheetContext = sheet.getContext("2d")!;
  sheetContext.imageSmoothingQuality = "high";
  sheetContext.drawImage(shape, 0, 0, width, height);
  sheetContext.globalCompositeOperation = "source-in";
  sheetContext.fillStyle = border;
  sheetContext.fillRect(0, 0, width, height);
  sheetContext.globalCompositeOperation = "source-over";
  sheetContext.drawImage(prepared.art, 0, 0);
  context.clearRect(0, 0, target.width, target.height);
  const left = margin * scale;
  context.save();
  context.filter = `blur(${1.5 * scale}px)`;
  context.globalAlpha = 0.22;
  context.drawImage(shape, left, left + 1.2 * scale, width, height);
  context.restore();
  context.drawImage(sheet, left, left);
}
