/**
 * What every sticker on a page shares: one frame loop, the pointer (the light they catch), whether
 * the page is dark, and whether its visitor wants less motion. Each is set up the first time
 * something asks for it.
 */

/** Something drawn on the page's frame loop: given the seconds since its last frame, it says whether it wants another. */
export type Animated = { frame(dt: number, now: number): boolean };

const running = new Set<Animated>();
let looping = false;
let last = 0;

function loop(now: number) {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
  last = now;
  for (const item of [...running]) {
    let more = false;
    try {
      more = item.frame(dt, now);
    } catch (error) {
      console.error(error);
    }
    if (!more) running.delete(item);
  }
  if (running.size) requestAnimationFrame(loop);
  else {
    looping = false;
    last = 0;
  }
}

/** Puts `item` on the frame loop until it says it's done. */
export function animate(item: Animated) {
  running.add(item);
  if (looping) return;
  looping = true;
  requestAnimationFrame(loop);
}

export const stopAnimating = (item: Animated) => running.delete(item);

/** Where the pointer last was, in the window, and whether it's a pointer that hovers (a mouse or a pen) or a finger, or gone. */
export type PointerNow = { x: number; y: number; hovers: boolean; present: boolean };

const pointer: PointerNow = { x: 0, y: 0, hovers: false, present: false };
const pointerWatchers = new Set<() => void>();
let watchingPointer = false;

function watchPointer() {
  if (watchingPointer || typeof window === "undefined") return;
  watchingPointer = true;
  const moved = (event: PointerEvent) => {
    // A finger lights a sticker only while it's down.
    if (event.pointerType === "touch" && !event.buttons && event.type !== "pointerdown") {
      pointer.present = false;
    } else {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.hovers = event.pointerType !== "touch";
      pointer.present = true;
    }
    for (const watcher of pointerWatchers) watcher();
  };
  const gone = () => {
    pointer.present = false;
    for (const watcher of pointerWatchers) watcher();
  };
  window.addEventListener("pointermove", moved, { passive: true });
  window.addEventListener("pointerdown", moved, { passive: true });
  window.addEventListener("pointerup", (event) => (event.pointerType === "touch" ? gone() : moved(event)), { passive: true });
  document.documentElement.addEventListener("pointerleave", gone);
  window.addEventListener("blur", gone);
}

export const pointerNow = (): Readonly<PointerNow> => pointer;

/** Calls `change` whenever the pointer moves, comes or goes. Returns a function to stop. */
export function onPointer(change: () => void) {
  watchPointer();
  pointerWatchers.add(change);
  return () => {
    pointerWatchers.delete(change);
  };
}

/**
 * Whether the page is dark, as most sites say it: a `dark` (or `light`) class on the root, a
 * `data-theme`, `data-mode` or `data-color-scheme` of `dark` (or `light`), a `color-scheme` set to
 * dark alone, and otherwise the system's own setting.
 */
export function pageIsDark(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  if (root.classList.contains("dark")) return true;
  if (root.classList.contains("light")) return false;
  for (const name of ["theme", "mode", "colorScheme"]) {
    const value = root.dataset[name];
    if (value === "dark") return true;
    if (value === "light") return false;
  }
  const scheme = getComputedStyle(root).colorScheme;
  if (scheme === "dark" || scheme === "only dark") return true;
  if (scheme === "light" || scheme === "only light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

const schemeWatchers = new Set<() => void>();
let watchingScheme = false;

function watchScheme() {
  if (watchingScheme || typeof document === "undefined") return;
  watchingScheme = true;
  const tell = () => {
    for (const watcher of schemeWatchers) watcher();
  };
  new MutationObserver(tell).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-mode", "data-color-scheme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", tell);
}

/** Calls `change` whenever the page may have turned dark or light. Returns a function to stop. */
export function onScheme(change: () => void) {
  watchScheme();
  schemeWatchers.add(change);
  return () => {
    schemeWatchers.delete(change);
  };
}

/** Options with what's undefined left out, so an option not given (React passes every prop, given or not) keeps its default. */
export function given<T extends object>(options: T): Partial<T> {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** Whether the visitor has asked for less motion. */
export const wantsLessMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A CSS colour (any the browser reads, and `var(--…)` read on `element`) as red, green and blue, 0 to 1. */
export function colourOf(css: string, element: Element, fallback: [number, number, number]): [number, number, number] {
  if (typeof document === "undefined") return fallback;
  let value = css.trim();
  const variable = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value);
  if (variable) value = getComputedStyle(element).getPropertyValue(variable[1]).trim() || variable[2]?.trim() || "";
  if (/^currentcolor$/i.test(value)) value = getComputedStyle(element).color;
  if (!value) return fallback;
  const canvas = colourCanvas();
  if (!canvas) return fallback;
  canvas.clearRect(0, 0, 1, 1);
  canvas.fillStyle = "#000";
  canvas.fillStyle = value;
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
  if (!a) return fallback;
  return [r / 255, g / 255, b / 255];
}

let colourContext: CanvasRenderingContext2D | null | undefined;
function colourCanvas() {
  if (colourContext === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    colourContext = canvas.getContext("2d", { willReadFrequently: true });
  }
  return colourContext;
}
