/**
 * A sticker on an element. The element is the sticker's box: its art is fitted inside, a die-cut
 * border is grown round it, and a canvas a little bigger than the box draws it in its finish, lit
 * by the pointer, with its shadow. Pressed by an edge it peels, and let go it lies back down; past
 * half way it comes off, into the hand when it can be moved (then it's dropped where it's let go)
 * and away when it can't. Held anywhere else, a sticker that can be moved lifts and follows,
 * turning about the point it's held by.
 */

import { drawFlat, load, type Prepared, prepare, type Source } from "./art.ts";
import { edgeAt, extentAlong, type Point } from "./field.ts";
import { drawInto, fieldTexture, freeTexture, imageTexture, type Stage, stageNow, type Texture, watchStage } from "./gl.ts";
import { atRest, type Body, follow, HANDLING, settle, type Spring, sprung, type Sprung, stepSpring, still, toLocal } from "./motion.ts";
import { animate, colourOf, given, onPointer, onScheme, pageIsDark, pointerNow, stopAnimating, wantsLessMotion } from "./page.ts";
import { type Fold, foldFor, liftedShare, pullToLift } from "./peel.ts";
import { chargeAfter, glowOf } from "./phosphor.ts";
import { FINISHES, PATTERNS } from "./shaders.ts";

export type Finish = (typeof FINISHES)[number];
/** How a holographic foil's grooves are laid: one `smooth` wavering sheet (the default), or `lines`, `squares`, `dots` or `shards`, each grooved its own way. */
export type Pattern = (typeof PATTERNS)[number];

/** Where a sticker sits: moved `x` and `y` pixels from where the page laid it out, turned `angle` radians clockwise. */
export type Place = { x: number; y: number; angle: number };

export type StickerOptions = {
  /** How it takes the light: `paper`, `gloss` (the default), `holo` (holographic foil), `glitter` or `glow` (glow in the dark). */
  finish?: Finish;
  /** A holographic foil's pattern: `smooth` (the default), `lines`, `squares`, `dots` or `shards`. */
  pattern?: Pattern;
  /** What it shows, in words, for assistive tech. */
  label?: string;
  /** How wide the border round the art is, in pixels. A sixteenth of the box's shorter side unless said; 0 cuts close to the art. */
  outline?: number;
  /** Gaps in the art narrower than this, in pixels, are closed by the border, and its inside corners rounded as much. Twice the outline unless said. */
  smooth?: number;
  /** The border's colour. White unless said. */
  border?: string;
  /** The back's colour, seen as it peels. */
  back?: string;
  /** Words printed across the back, as a sticker's backing has them. */
  print?: string;
  /** Whether it can be peeled from an edge. On unless said. */
  peel?: boolean;
  /** Whether it can be picked up and moved. Off unless said. */
  drag?: boolean;
  /** Where a moved sticker's middle may go: an element's box (its parent's unless said), or nowhere in particular (`null`). */
  bounds?: Element | null;
  /** Whether the lights are off: on a dark page, a glowing sticker glows and the rest are dimmer. `auto` (the default) follows the page. */
  dark?: boolean | "auto";
  /** The colour a glowing sticker glows. */
  glow?: string;
  /** How tightly it curls as it peels: the curl's radius, in pixels. */
  curl?: number;
  /** The share of it lifted (0 to 1) at which it comes off rather than lying back down. Half unless said. */
  comesOff?: number;
  /** Whether the pointer lights it. On unless said. */
  shine?: boolean;
  /** Where it sits, moved and turned from where the page laid it out. */
  place?: Place;
  /** Varies its glints: two stickers in the same finish and pattern with different seeds glint differently. */
  seed?: number;
  /** Whether to move less: no swing, no bounce. Follows the visitor's setting unless said. */
  reducedMotion?: boolean;
  /** Called once it's been peeled all the way off (one that can't be moved, which then goes). */
  onPeel?: () => void;
  /** Called as it's picked up. */
  onPick?: () => void;
  /** Called once it's set down, with where it now sits. */
  onDrop?: (place: Place) => void;
};

export type StickerState = "loading" | "resting" | "peeling" | "held" | "off";

export type Sticker = {
  readonly element: HTMLElement;
  /** Where it sits now. */
  readonly place: Place;
  readonly state: StickerState;
  /** Change what it's made of or how it behaves; what's not given stays as it was. */
  set(options: StickerOptions & { src?: Source }): void;
  /** Peel it all the way off, from a corner, as a hand would. */
  peelOff(): void;
  /** Put a sticker that came off back where it was. */
  restore(): void;
  /** Lift it off the page for good: its canvas, listeners and textures. */
  destroy(): void;
};

const PRESS: Spring = { duration: 0.42, bounce: 0.32 };
const LAY_BACK: Spring = { duration: 0.5, bounce: 0.28 };
const LIFT: Spring = { duration: 0.28, bounce: 0 };
const TILT: Spring = { duration: 0.22, bounce: 0.1 };
const GLIDE: Spring = { duration: 0.25, bounce: 0 };
const LEAVE: Spring = { duration: 0.55, bounce: 0 };
const QUICK: Spring = { duration: 0.12, bounce: 0 };
/** How the peel follows the hand: all but at once, smoothing a press on an edge already lifting toward it. */
const FOLLOW: Spring = { duration: 0.09, bounce: 0 };

/** The light from the room, toward it: from above, a little behind and to the left, so shadows fall down the page. */
const KEY = (() => {
  const v = [-0.12, -0.42, 1];
  const length = Math.hypot(...v);
  return v.map((each) => each / length);
})();

const WHITE: [number, number, number] = [1, 1, 1];
const BACK: [number, number, number] = [0.86, 0.86, 0.87];
/** Phosphor's own green, the colour a glow-in-the-dark star glows. */
const PHOSPHOR: [number, number, number] = [0.62, 1, 0.55];

const DEFAULTS = { finish: "gloss" as Finish, peel: true, drag: false, dark: "auto" as const, comesOff: 0.5, shine: true };

let seeds = 0;

/**
 * Makes `element` a sticker of `src`: an image's address, SVG markup or anything a canvas draws.
 * The element keeps its size and place in the layout; give it a width and a height.
 */
export function sticker(element: HTMLElement, src: Source, options: StickerOptions = {}): Sticker {
  let source = src;
  let settings = { ...DEFAULTS, ...given(options) };
  const seed = settings.seed ?? (++seeds * 7.31) % 97;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", pointerEvents: "none", display: "block", maxWidth: "none" });
  if (getComputedStyle(element).position === "static") element.style.position = "relative";
  element.appendChild(canvas);

  let state: StickerState = "loading";
  let box = { width: 0, height: 0 };
  let scale = 1;
  let margin = 0;
  let prepared: Prepared | null = null;
  let loaded: CanvasImageSource | null = null;
  let textures: { art: Texture; field: Texture; print: Texture | null } | null = null;
  let print: HTMLCanvasElement | null = null;
  let visible = false;
  let destroyed = false;
  let dirty = true;
  let drawnWithStage = false;

  // The peel: the point held, which way is out there, and how far it's been drawn (a vector, box pixels).
  let grab: Point = { x: 0, y: 0 };
  let outward: Point = { x: 1, y: 0 };
  let pullX = sprung(0);
  let pullY = sprung(0);
  let pulling = false;
  let leaving = false;
  // Held: the body, the point held (from its middle), where the hand is (pixels from where it was laid out).
  let body: Body = still(settings.place?.x ?? 0, settings.place?.y ?? 0, settings.place?.angle ?? 0);
  let grip: Point = { x: 0, y: 0 };
  let hand: Point = { x: 0, y: 0 };
  let settling = false;
  let lift = sprung(0);
  let tiltX = sprung(0);
  let tiltY = sprung(0);
  let opacity = sprung(1);
  let bounds: { left: number; right: number; top: number; bottom: number } | null = null;
  // The light, and the lights.
  let light: Point = { x: 0, y: 0 };
  let shine = sprung(0);
  let dark = sprung(isDark() ? 1 : 0);
  let charge = isDark() ? 0.25 : 1;
  let keyMoved = 0;
  let drawnAt = 0;
  let colours = { border: WHITE, back: BACK, glow: PHOSPHOR };
  const readColours = () => {
    colours = {
      border: settings.border ? colourOf(settings.border, element, WHITE) : WHITE,
      back: settings.back ? colourOf(settings.back, element, BACK) : BACK,
      glow: settings.glow ? colourOf(settings.glow, element, PHOSPHOR) : PHOSPHOR,
    };
  };

  const lessMotion = () => settings.reducedMotion ?? wantsLessMotion();
  function isDark() {
    return settings.dark === "auto" ? pageIsDark() : Boolean(settings.dark);
  }

  function applyPlace() {
    element.style.translate = body.x || body.y ? `${body.x}px ${body.y}px` : "";
    element.style.rotate = body.angle ? `${body.angle}rad` : "";
  }
  applyPlace();

  function describe() {
    element.setAttribute("role", "img");
    element.setAttribute("aria-roledescription", "sticker");
    if (settings.label) element.setAttribute("aria-label", settings.label);
    else element.removeAttribute("aria-label");
    const interactive = settings.peel || settings.drag;
    if (interactive && state !== "off") element.tabIndex = 0;
    else element.removeAttribute("tabindex");
    element.style.touchAction = interactive ? "none" : "";
    element.dataset.sticker = state;
  }

  function setState(next: StickerState) {
    state = next;
    element.dataset.sticker = next;
  }

  /** Lays the canvas out round the box and sizes it, and prepares the art again if the box changed. */
  async function measure() {
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (!width || !height) return;
    const changed = width !== box.width || height !== box.height;
    box = { width, height };
    scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    margin = Math.ceil(Math.max(width, height) * 0.45);
    Object.assign(canvas.style, { left: `${-margin}px`, top: `${-margin}px`, width: `${width + 2 * margin}px`, height: `${height + 2 * margin}px` });
    const pixels = Math.round((Math.max(width, height) + 2 * margin) * scale);
    // Very large stickers are drawn at a lower resolution, as the shared canvas allows.
    if (pixels > 2048) scale *= 2048 / pixels;
    canvas.width = Math.round((width + 2 * margin) * scale);
    canvas.height = Math.round((height + 2 * margin) * scale);
    if (changed || !prepared) await build();
    else redraw();
  }

  async function build() {
    const mine = source;
    try {
      loaded = await load(source, element);
    } catch (error) {
      console.error("A sticker's art couldn't be loaded", error);
      return;
    }
    if (destroyed || mine !== source || !box.width) return;
    const outline = settings.outline ?? Math.max(3, Math.round(Math.min(box.width, box.height) / 16));
    const smooth = settings.smooth ?? outline * 2;
    try {
      prepared = prepare(loaded, box, outline, smooth, Math.min(scale * 1.15, 2.5));
    } catch (error) {
      // An image from another site without CORS can be drawn but not read: there's no cut to make.
      console.error("A sticker's art couldn't be read: an image from another site needs CORS", error);
      return;
    }
    print = settings.print ? printOf(settings.print) : null;
    const s = stageNow();
    if (s) upload(s);
    else releaseTextures();
    if (state === "loading") setState("resting");
    describe();
    redraw();
  }

  function printOf(words: string) {
    const art = prepared!.art;
    const canvas = document.createElement("canvas");
    canvas.width = art.width;
    canvas.height = art.height;
    const context = canvas.getContext("2d")!;
    const size = Math.max(8, Math.min(box.width, box.height) * 0.09) * (art.width / box.width);
    context.font = `${size}px ${getComputedStyle(element).fontFamily || "sans-serif"}`;
    context.fillStyle = "rgba(0, 0, 0, 0.16)";
    context.textBaseline = "middle";
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(-Math.PI / 6);
    const step = context.measureText(`${words}   `).width;
    const diagonal = Math.hypot(canvas.width, canvas.height);
    for (let y = -diagonal / 2, row = 0; y < diagonal / 2; y += size * 2.4, row++) {
      for (let x = -diagonal / 2 - (row % 2) * step * 0.5; x < diagonal / 2; x += step) context.fillText(words, x, y);
    }
    return canvas;
  }

  function releaseTextures() {
    const s = stageNow();
    if (textures) for (const texture of Object.values(textures)) freeTexture(s, texture);
    textures = null;
  }

  function upload(s: Stage) {
    if (!prepared) return;
    textures = {
      art: imageTexture(s, prepared.art, textures?.art),
      field: fieldTexture(s, prepared.cut.field, prepared.cut.width, prepared.cut.height, textures?.field),
      print: print ? imageTexture(s, print, textures?.print) : null,
    };
  }

  function redraw() {
    dirty = true;
    animate(animated);
  }

  /** Where a point in the window lies on the sticker, in its box's pixels (flat, as it lies). */
  function localOf(clientX: number, clientY: number): Point {
    const rect = element.getBoundingClientRect();
    const middle = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const local = toLocal({ x: clientX, y: clientY }, middle, body.angle);
    return { x: local.x + box.width / 2, y: local.y + box.height / 2 };
  }

  /** Where the box's middle was laid out, in the window: where it is less where it's been moved. */
  function laidOut(): Point {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - body.x, y: rect.top + rect.height / 2 - body.y };
  }

  function edgeNear(point: Point) {
    if (!prepared) return null;
    const f = prepared.fieldScale;
    const edge = edgeAt(prepared.cut, point.x / f, point.y / f);
    return { distance: edge.distance * f, normal: edge.normal, nearest: { x: edge.nearest.x * f, y: edge.nearest.y * f } };
  }

  const curl = () => settings.curl ?? Math.min(Math.max(Math.min(box.width, box.height) * 0.075, 5), 40);
  /** How close to the edge a press peels it, in pixels. */
  const band = () => Math.min(Math.max(Math.min(box.width, box.height) * 0.16, 12), 34);

  /** The curl's radius for a pull: tight as the sheet first lifts, a small lip, opening to the full curl as it's drawn further. */
  const curlFor = (pull: number) => curl() * Math.min(1, 0.4 + pull / (2 * curl()));

  function foldNow(): Fold | null {
    const x = pullX.value;
    const y = pullY.value;
    const pull = Math.hypot(x, y);
    if (pull < 0.05) return null;
    return foldFor(grab, { x: grab.x + x, y: grab.y + y }, outward, curlFor(pull));
  }

  function shareNow() {
    const fold = foldNow();
    if (!fold || !prepared) return 0;
    return liftedShare(fold, extentAlong(prepared.hull, { x: fold.nx, y: fold.ny }));
  }

  function startPeel(at: Point, edge: { normal: Point; nearest: Point }) {
    outward = edge.normal;
    // Held just inside the edge, so the point held is the sheet's.
    const inset = Math.min(1.5, band() / 6);
    grab = { x: edge.nearest.x - outward.x * inset, y: edge.nearest.y - outward.y * inset };
    pulling = true;
    setState("peeling");
    pullTo(at, true);
  }

  function pullTo(at: Point, directly: boolean) {
    const x = at.x - grab.x;
    const y = at.y - grab.y;
    if (directly && lessMotion()) {
      pullX = { value: x, velocity: 0, target: x };
      pullY = { value: y, velocity: 0, target: y };
    } else {
      pullX = { ...pullX, target: x };
      pullY = { ...pullY, target: y };
    }
    redraw();
  }

  function layBack() {
    pulling = false;
    if (lessMotion()) {
      pullX = sprung(0);
      pullY = sprung(0);
    } else {
      pullX = { ...pullX, target: 0 };
      pullY = { ...pullY, target: 0 };
    }
    setState("resting");
    redraw();
  }

  /** Peels the rest of the way along the way it's going, then fades: it's gone. */
  function leave() {
    if (!prepared) return;
    pulling = false;
    leaving = true;
    const length = Math.hypot(pullX.value, pullY.value) || 1;
    const dx = pullX.value / length || -outward.x;
    const dy = pullY.value / length || -outward.y;
    const fold = foldNow() ?? foldFor(grab, { x: grab.x + dx, y: grab.y + dy }, outward, curl());
    const extent = extentAlong(prepared.hull, { x: fold.nx, y: fold.ny });
    const along = grab.x * fold.nx + grab.y * fold.ny;
    // That far, the curl is open all the way.
    const full = Math.max(pullToLift(along, extent, curl()) + 4, curl() * 1.2);
    pullX = { ...pullX, target: dx * full };
    pullY = { ...pullY, target: dy * full };
    if (lessMotion()) {
      pullX.value = pullX.target;
      pullY.value = pullY.target;
      opacity = { ...opacity, target: 0 };
    }
    setState("peeling");
    redraw();
  }

  /** It came off in the hand: it lies flat, lifts, and follows the hand by the point it was peeled from. */
  function pickUp(at: Point, client: Point) {
    pulling = false;
    pullX = { ...pullX, target: 0 };
    pullY = { ...pullY, target: 0 };
    hold({ x: grab.x - box.width / 2, y: grab.y - box.height / 2 }, client);
    void at;
  }

  function hold(gripAt: Point, client: Point) {
    grip = gripAt;
    const origin = laidOut();
    hand = { x: client.x - origin.x, y: client.y - origin.y };
    measureBounds(origin);
    settling = false;
    lift = { ...lift, target: 1 };
    setState("held");
    raise();
    settings.onPick?.();
    redraw();
  }

  function measureBounds(origin: Point) {
    const within = settings.bounds === undefined ? element.parentElement : settings.bounds;
    if (!within) {
      bounds = null;
      return;
    }
    const rect = within.getBoundingClientRect();
    bounds = { left: rect.left - origin.x, right: rect.right - origin.x, top: rect.top - origin.y, bottom: rect.bottom - origin.y };
  }

  function raise() {
    const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
    let top = 0;
    for (const sibling of siblings) if (sibling !== element) top = Math.max(top, Number(getComputedStyle(sibling).zIndex) || 0);
    element.style.zIndex = String(top + 1);
  }

  function drop() {
    settling = true;
    lift = { ...lift, target: 0 };
    setState("resting");
    redraw();
  }

  // The press.
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !prepared || state === "off" || leaving) return;
    if (state === "held" && settling) settling = false;
    const at = localOf(event.clientX, event.clientY);
    const edge = edgeNear(at);
    if (!edge) return;
    const nearEdge = edge.distance > -band() && edge.distance < band() * 0.35;
    const inside = edge.distance < 0.5;
    if (settings.peel && nearEdge) startPeel(at, edge);
    else if (settings.drag && inside) hold({ x: at.x - box.width / 2, y: at.y - box.height / 2 }, { x: event.clientX, y: event.clientY });
    else return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent) => {
    if (!prepared || state === "off" || leaving) return;
    if (pulling) {
      pullTo(localOf(event.clientX, event.clientY), true);
      if (settings.drag && shareNow() >= settings.comesOff) pickUp(localOf(event.clientX, event.clientY), { x: event.clientX, y: event.clientY });
      return;
    }
    if (state === "held" && !settling) {
      const origin = laidOut();
      hand = { x: event.clientX - origin.x, y: event.clientY - origin.y };
      redraw();
      return;
    }
    if (event.pointerType === "touch" || event.buttons) return;
    // Hovering: a hand where it can be peeled or picked up. Nothing lifts until it's pressed: a
    // straight fold across a round edge never matched the shape it lifted.
    const edge = edgeNear(localOf(event.clientX, event.clientY));
    if (!edge) return;
    const nearEdge = settings.peel && edge.distance > -band() && edge.distance < band() * 0.35;
    element.style.cursor = nearEdge || (settings.drag && edge.distance < 0.5) ? "grab" : "";
  };

  const up = (event: PointerEvent) => {
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    if (pulling) {
      if (!settings.drag && shareNow() >= settings.comesOff) leave();
      else layBack();
    } else if (state === "held" && !settling) drop();
    element.style.cursor = "";
  };

  const leaveHover = () => {
    if (!pulling && state !== "held") element.style.cursor = "";
  };

  const key = (event: KeyboardEvent) => {
    if (state === "off" || leaving) return;
    const step = event.shiftKey ? 32 : 8;
    const moves: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const by = moves[event.key];
    if (by && settings.drag) {
      event.preventDefault();
      const origin = laidOut();
      measureBounds(origin);
      body = { ...body, x: clampX(body.x + by.x), y: clampY(body.y + by.y), vx: 0, vy: 0 };
      applyPlace();
      lift = { ...lift, target: 1 };
      keyMoved = performance.now();
      if (state !== "held") {
        raise();
        settings.onPick?.();
      }
      setState("held");
      settling = true;
      redraw();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && settings.peel && !settings.drag) {
      event.preventDefault();
      peelOff();
    }
  };

  const clampX = (x: number) => (bounds ? Math.min(Math.max(x, bounds.left), bounds.right) : x);
  const clampY = (y: number) => (bounds ? Math.min(Math.max(y, bounds.top), bounds.bottom) : y);

  function peelOff() {
    if (!prepared || state === "off" || leaving) return;
    // From the corner furthest up and to the right, toward the opposite one.
    let corner = prepared.hull[0];
    for (const point of prepared.hull) if (point.x - point.y > corner.x - corner.y) corner = point;
    const edge = edgeNear({ x: corner.x - 2, y: corner.y + 2 });
    if (!edge) return;
    outward = edge.normal;
    grab = { x: edge.nearest.x - outward.x * 1.5, y: edge.nearest.y - outward.y * 1.5 };
    pullX = { ...pullX, target: 0 };
    pullY = { ...pullY, target: 0 };
    if (Math.hypot(pullX.value, pullY.value) < 0.05) {
      pullX = { value: -outward.x * 0.1, velocity: 0, target: 0 };
      pullY = { value: -outward.y * 0.1, velocity: 0, target: 0 };
    }
    leave();
  }

  function restore() {
    if (state !== "off" && !leaving) return;
    leaving = false;
    pulling = false;
    pullX = sprung(0);
    pullY = sprung(0);
    opacity = lessMotion() ? sprung(1) : { value: 0, velocity: 0, target: 1 };
    lift = lessMotion() ? sprung(0) : { value: 1, velocity: 0, target: 0 };
    canvas.style.visibility = "";
    setState("resting");
    describe();
    redraw();
  }

  // The frame.
  const animated = {
    frame(dt: number, now: number): boolean {
      if (destroyed) return false;
      const less = lessMotion();
      let moving = false;
      const step = (spring: Spring, value: Sprung) => {
        const next = less && spring !== LEAVE ? { value: value.target, velocity: 0, target: value.target } : stepSpring(spring, value, dt);
        if (!atRest(next, 0.002)) moving = true;
        else next.value = next.target;
        return next;
      };
      // The peel.
      {
        const spring = pulling ? FOLLOW : leaving ? LEAVE : LAY_BACK;
        pullX = step(spring, pullX);
        pullY = step(spring, pullY);
        if (!atRest(pullX, 0.05) || !atRest(pullY, 0.05)) moving = true;
      }
      if (leaving) {
        const share = shareNow();
        if (share > 0.82 || less) opacity = { ...opacity, target: 0 };
        if (opacity.target === 0 && opacity.value < 0.01) {
          leaving = false;
          setState("off");
          canvas.style.visibility = "hidden";
          describe();
          settings.onPeel?.();
        }
      }
      opacity = step(leaving ? QUICK : GLIDE, opacity);
      // Held, or settling.
      if (state === "held" && !settling) {
        body = follow(body, grip, hand, box, dt, less ? { ...HANDLING, turn: 0 } : HANDLING);
        if (bounds) body = { ...body, x: clampX(body.x), y: clampY(body.y) };
        applyPlace();
        moving = true;
      } else if (settling) {
        body = settle(body, dt);
        if (bounds) body = { ...body, x: clampX(body.x), y: clampY(body.y) };
        applyPlace();
        // A sticker moved by keys lies down a moment after the last.
        if (keyMoved && performance.now() - keyMoved > 450) {
          keyMoved = 0;
          lift = { ...lift, target: 0 };
          setState("resting");
        }
        if (Math.hypot(body.vx, body.vy) < 1 && Math.abs(body.spin) < 0.01 && atRest(lift, 0.002) && !keyMoved) {
          settling = false;
          body = { ...body, vx: 0, vy: 0, spin: 0 };
          settings.onDrop?.({ x: body.x, y: body.y, angle: body.angle });
        } else moving = true;
      }
      lift = step(lift.target > lift.value ? LIFT : PRESS, lift);
      const lean = state === "held" && !settling && !less;
      tiltX = step(TILT, { ...tiltX, target: lean ? Math.min(Math.max(-body.vy / 2600, -0.3), 0.3) : 0 });
      tiltY = step(TILT, { ...tiltY, target: lean ? Math.min(Math.max(body.vx / 2600, -0.3), 0.3) : 0 });
      // The light.
      const pointer = pointerNow();
      let near = 0;
      if (settings.shine && pointer.present) {
        light = localOf(pointer.x, pointer.y);
        const side = Math.max(box.width, box.height);
        const away = Math.hypot(light.x - box.width / 2, light.y - box.height / 2) / side;
        near = 1 - smoothstep(0.55, 1.4, away);
      }
      shine = step(GLIDE, { ...shine, target: near });
      dark = step({ duration: 0.7, bounce: 0 }, { ...dark, target: isDark() ? 1 : 0 });
      // The phosphor: charged by the room's light, and a little by the pointer's in the dark.
      let fading = false;
      if (settings.finish === "glow") {
        const lit = 1 - dark.value * (1 - 0.4 * shine.value);
        const before = charge;
        charge = chargeAfter(charge, lit, dt);
        fading = dark.value > 0.01 && Math.abs(charge - before) > 1e-6;
      }
      // A glow fading slowly in the dark is drawn ten times a second, not every frame.
      if (moving || (fading && now - drawnAt > 100)) dirty = true;
      if (dirty && visible) {
        draw();
        drawnAt = now;
      }
      return moving || fading || (state === "held" && !settling);
    },
  };

  function draw() {
    dirty = false;
    if (!prepared || !canvas.width) return;
    const s = stageNow();
    if (!s) {
      if (!drawnWithStage) {
        drawFlat(canvas, prepared, `rgb(${colours.border.map((c) => Math.round(c * 255)).join(" ")})`, margin, scale);
        hideStandIns();
      }
      return;
    }
    if (!textures || textures.art.generation !== s.generation) upload(s);
    if (!textures) return;
    const side = Math.max(box.width, box.height);
    const fold = foldNow();
    const height = lift.value * side * 0.12;
    // The sheet's turn: tilted about its y, then its x, by how it's moving.
    const [ax, ay] = [tiltX.value, tiltY.value];
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    const turn = [cy, 0, -sy, sx * sy, cx, sx * cy, cx * sy, -sx, cx * cy];
    // The key light and the pointer's, turned into the sticker's own frame (its element is turned on the page).
    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);
    const key = [KEY[0] * cos + KEY[1] * sin, -KEY[0] * sin + KEY[1] * cos, KEY[2]];
    const finish = FINISHES.indexOf(settings.finish);
    const pattern = PATTERNS.indexOf(settings.pattern ?? "smooth");
    const ok = drawInto(
      s,
      canvas,
      {
        uScale: scale,
        uMargin: [margin, margin],
        uBox: [box.width, box.height],
        uLight: [light.x, light.y, side * 0.9, settings.shine ? shine.value : 0],
        uKey: key,
        uDark: dark.value,
        uFinish: finish < 0 ? 1 : finish,
        uPattern: Math.max(0, pattern),
        uSeed: seed,
        uCharge: glowOf(charge),
        uGlow: colours.glow,
        uFieldScale: prepared.fieldScale,
        uFieldSize: [prepared.cut.width, prepared.cut.height],
        uBorder: colours.border,
        uBack: colours.back,
        uPrinted: textures.print ? 1 : 0,
        uFold: fold ? [fold.x, fold.y, fold.nx, fold.ny] : [0, 0, 0, 0],
        uRadius: fold ? fold.radius : 1,
        uTurn: turn,
        uLift: [box.width / 2, box.height / 2, height],
        uEye: side * 2.6,
        uThick: 1.4,
        uOpacity: opacity.value,
      },
      { uArt: textures.art.texture, uField: textures.field.texture, uPrint: textures.print?.texture ?? null },
    );
    if (ok && !drawnWithStage) {
      drawnWithStage = true;
      element.dataset.drawn = "";
      hideStandIns();
    }
  }

  /** What a server drew in its place (React's stand-in), hidden once it's drawn itself. */
  function hideStandIns() {
    for (const stand of Array.from(element.querySelectorAll<HTMLElement>("[data-sticker-stand-in]"))) stand.style.visibility = "hidden";
  }

  // Watching.
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && dirty) redraw();
  });
  visibility.observe(element);
  const resize = new ResizeObserver(() => void measure());
  resize.observe(element);
  const stopStage = watchStage(() => {
    drawnWithStage = false;
    releaseTextures();
    redraw();
  });
  const stopPointer = onPointer(() => {
    if (!visible || !settings.shine || !box.width) return;
    const pointer = pointerNow();
    const rect = element.getBoundingClientRect();
    const reach = Math.max(rect.width, rect.height) * 1.5;
    const near = pointer.present && pointer.x > rect.left - reach && pointer.x < rect.right + reach && pointer.y > rect.top - reach && pointer.y < rect.bottom + reach;
    if (near || shine.value > 0.001) redraw();
  });
  const stopScheme = onScheme(() => {
    // A page's tokens may change with its scheme.
    readColours();
    redraw();
  });
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", up);
  element.addEventListener("pointerleave", leaveHover);
  element.addEventListener("keydown", key);
  describe();
  readColours();
  void measure();

  return {
    element,
    get place() {
      return { x: body.x, y: body.y, angle: body.angle };
    },
    get state() {
      return state;
    },
    set(next) {
      const { src: nextSource, ...rest } = given(next);
      const before = settings;
      settings = { ...settings, ...rest };
      if (rest.place && state !== "held") {
        body = still(rest.place.x, rest.place.y, rest.place.angle);
        applyPlace();
      }
      describe();
      readColours();
      const rebuild = (nextSource !== undefined && nextSource !== source) || settings.outline !== before.outline || settings.smooth !== before.smooth || settings.print !== before.print;
      if (nextSource !== undefined) source = nextSource;
      if (rebuild) void build();
      else redraw();
    },
    peelOff,
    restore,
    destroy() {
      destroyed = true;
      stopAnimating(animated);
      visibility.disconnect();
      resize.disconnect();
      stopStage();
      stopPointer();
      stopScheme();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("pointerleave", leaveHover);
      element.removeEventListener("keydown", key);
      releaseTextures();
      canvas.remove();
      for (const name of ["role", "aria-roledescription", "aria-label", "tabindex", "data-sticker", "data-drawn"]) element.removeAttribute(name);
      element.style.translate = "";
      element.style.rotate = "";
      element.style.touchAction = "";
      element.style.cursor = "";
    },
  };
}

const smoothstep = (from: number, to: number, x: number) => {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};
