/**
 * A sticker on an element. The element is the sticker's box: its art is fitted inside, a die-cut
 * border is grown round it, and a canvas a little bigger than the box draws it in its finish, lit
 * by the pointer, with its shadow. Pressed by an edge it peels, and let go it lies back down; past
 * half way it comes off, into the hand when it can be moved (then it's dropped where it's let go)
 * and away when it can't. Held anywhere else, a sticker that can be moved lifts and follows,
 * turning about the point it's held by. With `tear`, yanked, it rips instead, and the part lifted
 * comes away in the hand as a piece of its own, the rest staying stuck.
 */

import { announce, keepRegion } from "./announce.ts";
import { drawFlat, keyOf, load, type Prepared, prepare, type Source } from "./art.ts";
import { domeOf, puffinessOf } from "./dome.ts";
import { edgeAt, extentAlong, hullOf, type Point } from "./field.ts";
import { drawInto, fieldTexture, freeTexture, imageTexture, type Stage, stageNow, type Texture, watchStage } from "./gl.ts";
import { heldLongEnough, HOLD_MS, movedTo, pressed, type Waiting } from "./hold.ts";
import { keyAction, nameOf, shortcutsOf, type StickerWords, WORDS } from "./keys.ts";
import { atRest, type Body, follow, HANDLING, settle, type Spring, sprung, type Sprung, stepSpring, still, toLocal, wrapAngle } from "./motion.ts";
import { animate, colourOf, given, onPointer, onScheme, pageIsDark, pointerNow, stopAnimating, wantsLessMotion } from "./page.ts";
import { type Fold, foldFor, liftedShare, pullToLift, type Reach, reachOf } from "./peel.ts";
import { chargeAfter, glowOf } from "./phosphor.ts";
import { FINISHES, PATTERNS } from "./shaders.ts";
import { areaOf, keptSamples, LEAST_PIECE, type Sample, type Sheet, speedOf, tearSheet, tearSpeedOf, whole } from "./tear.ts";

export type Finish = (typeof FINISHES)[number];
/** How a holographic foil's grooves are laid: one `smooth` wavering sheet (the default), or `lines`, `squares`, `dots` or `shards`, each grooved its own way. */
export type Pattern = (typeof PATTERNS)[number];

/** Where a sticker sits: moved `x` and `y` pixels from where the page laid it out, turned `angle` radians clockwise. */
export type Place = { x: number; y: number; angle: number };

export type { StickerWords };

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
  /** Whether it tears when it's yanked: peeled faster than `tear` pixels a second (1200 for `true`), it rips along the fold, the part lifted coming away in the hand and the rest staying stuck, a torn edge showing on both. Peeled slowly, it comes off whole. Off unless said. */
  tear?: boolean | number;
  /** Whether its face is domed, as a sticker under clear epoxy or padded with foam is, in any finish. `true`, or how high (2 twice as high). Flat unless said. */
  puffy?: boolean | number;
  /** How a finger takes it. `hold` (the default): a swipe over it scrolls the page, and held still a moment it's peeled or picked up. `press`: a finger takes it at once, and a swipe that starts on it doesn't scroll. */
  touch?: "hold" | "press";
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
  /** Whether what the keys do to it is said aloud, to assistive tech: picked up, set down, put back, peeled off. On unless said. */
  announce?: boolean;
  /** The words said, and what its keys do, for another language: each one given replaces English's. */
  words?: Partial<StickerWords>;
  /** Called as it comes off: into the hand when it can be moved, or once it's peeled all the way off and gone when it can't (or by `peelOff()`). */
  onPeel?: () => void;
  /** Called as it tears, a piece of it coming away. */
  onTear?: () => void;
  /** Called as it's picked up. */
  onPick?: () => void;
  /** Called once it's set down, with where it now sits. */
  onDrop?: (place: Place) => void;
};

/** Where a sticker stands: its art still `loading`, `resting`, `peeling`, `held`, or `off` (peeled away). */
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
  /** Put a sticker that came off back where it was, or one torn whole again, pressed down as it was at first. */
  restore(): void;
  /** Lift it off the page for good: its canvas, listeners and textures, and what it set on its element. */
  destroy(): void;
};

/** What's left, where it is in the room, of the picture's clip. */
type Clip = { left: number; top: number; right: number; bottom: number };

/**
 * A piece torn off a sticker: drawn on a canvas of its own over the sticker's, from its own sheet,
 * as the fold had it when it tore, opening out from the point held as the hand moves it, then
 * carried off once it's let go. It moves in the sticker's own frame: from the box's middle, turned
 * as the sticker is.
 */
type Piece = {
  canvas: HTMLCanvasElement;
  /** The room its canvas has round the box. */
  frame: Reach;
  sheet: Sheet;
  /** The sticker's reach when it tore, so its fold goes on as the sticker's was. */
  hull: Point[];
  texture: Texture | null;
  grab: Point;
  outward: Point;
  pullX: Sprung;
  pullY: Sprung;
  unrolling: boolean;
  body: Body;
  grip: Point;
  hand: Point;
  samples: Sample[];
  lift: Sprung;
  tiltX: Sprung;
  tiltY: Sprung;
  opacity: Sprung;
  carried: { dir: Point; speed: number; time: number; clip: Clip } | null;
};

const PRESS: Spring = { duration: 0.42, bounce: 0.32 };
const LAY_BACK: Spring = { duration: 0.5, bounce: 0.28 };
const LIFT: Spring = { duration: 0.28, bounce: 0 };
const TILT: Spring = { duration: 0.22, bounce: 0.1 };
const GLIDE: Spring = { duration: 0.25, bounce: 0 };
const LEAVE: Spring = { duration: 0.55, bounce: 0 };
const QUICK: Spring = { duration: 0.12, bounce: 0 };
/** How a sticker put back with Escape goes home. */
const HOME: Spring = { duration: 0.4, bounce: 0.12 };
/** How the peel follows the hand: all but at once, smoothing a press on an edge already lifting toward it. */
const FOLLOW: Spring = { duration: 0.09, bounce: 0 };
/** How a sticker that came off into the hand opens out, hanging from the point held. */
const UNROLL: Spring = { duration: 0.34, bounce: 0 };
/** How long a sticker moved by the arrow keys stays up after the last, in milliseconds. */
const NUDGE_MS = 450;
/** Peeled away, how much of it is up before it's carried off by the corner, and how it goes: pixels a second, gaining speed. */
const CARRY_AT = 0.55;
const CARRY_SPEED = 600;
const CARRY_GAIN = 2400;
/** The longest it's carried before it's off, wherever it is, in seconds. */
const CARRY_MOST = 2.5;
/** How much of it a peel has to have lifted before a yank tears it rather than lifts it more. */
const TEAR_FROM = 0.08;

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
  let seed = settings.seed ?? (++seeds * 7.31) % 97;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", pointerEvents: "none", display: "block", maxWidth: "none" });
  // What it sets on its element, kept to give back.
  const positioned = getComputedStyle(element).position === "static";
  if (positioned) element.style.position = "relative";
  const zIndexBefore = element.style.zIndex;
  let raised = false;
  /** Raised for a peel alone, and the z-index it goes back to once it lies flat again. */
  let peelRaised = false;
  let peelZ = "";
  element.appendChild(canvas);
  const letGoOfRegion = keepRegion();

  let state: StickerState = "loading";
  let box = { width: 0, height: 0 };
  let scale = 1;
  /** The room round the box the canvas has for curls, shadows and lifts, box pixels a side, unless a peel needs more. */
  let margin = 0;
  /** The room the canvas has round the box now: the margin, or as far as a peel throws the sheet. */
  let frame: Reach = { left: 0, top: 0, right: 0, bottom: 0 };
  let prepared: Prepared | null = null;
  let loaded: CanvasImageSource | null = null;
  let loadedKey: Source | null = null;
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
  /** Come off into the hand and still opening out from the point held. */
  let unrolling = false;
  /** Peeled away and carried off by the corner: which way, how fast, for how long, from where it lay, and out of what it goes. */
  let carried: { dir: Point; speed: number; time: number; from: Place; clip: Clip } | null = null;
  // Torn: the sheet as it is now (its cut, depth and torn edges), the sheet as it was cut, the tears
  // made (kept as shares of the box, to make again on a new cut), the pieces torn off, the one in
  // the hand, and where the pointer has been as it pulls, for how fast.
  let sheet: Sheet | null = null;
  let uncut: Sheet | null = null;
  let tears: { fold: Fold; seed: number }[] = [];
  let pieces: Piece[] = [];
  let inHand: Piece | null = null;
  let samples: Sample[] = [];
  /** Yanked: it tears as soon as enough of it is drawn lifted (the peel follows the hand on a spring). */
  let tearArmed = false;
  // Held: the body, the point held (from its middle), where the hand is (pixels from where it was laid out).
  let body: Body = still(settings.place?.x ?? 0, settings.place?.y ?? 0, settings.place?.angle ?? 0);
  let grip: Point = { x: 0, y: 0 };
  let hand: Point = { x: 0, y: 0 };
  /** What holds it: the pointer, the keys (picked up with Space or Enter), or nothing. */
  let holder: "pointer" | "keys" | null = null;
  let settling = false;
  /** Where it was picked up from, for Escape. */
  let pickedFrom: Place | null = null;
  /** On its way back there. */
  let homing: { from: Body; to: Place; t: Sprung } | null = null;
  let lift = sprung(0);
  let tiltX = sprung(0);
  let tiltY = sprung(0);
  let opacity = sprung(1);
  let bounds: { left: number; right: number; top: number; bottom: number } | null = null;
  let keyMoved = 0;
  // The finger: waiting to be taken (`touch: "hold"`), and the one the sticker has taken.
  let waiting: Waiting | null = null;
  let waitTimer = 0;
  let fingerTaken = false;
  let captured: number | null = null;
  // The light, and the lights.
  let light: Point = { x: 0, y: 0 };
  let shine = sprung(0);
  let dark = sprung(isDark() ? 1 : 0);
  let charge = isDark() ? 0.25 : 1;
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
  const words = () => ({ ...WORDS, ...given(settings.words ?? {}) }) as StickerWords;
  function say(what: Exclude<keyof StickerWords, "keys">) {
    if (settings.announce === false) return;
    announce(words()[what](nameOf(settings.label)));
  }

  function applyPlace() {
    element.style.translate = body.x || body.y ? `${body.x}px ${body.y}px` : "";
    element.style.rotate = body.angle ? `${body.angle}rad` : "";
  }
  applyPlace();
  const placeNow = (): Place => ({ x: body.x, y: body.y, angle: body.angle });

  function describe() {
    element.setAttribute("role", "img");
    element.setAttribute("aria-roledescription", "sticker");
    if (settings.label) element.setAttribute("aria-label", settings.label);
    else element.removeAttribute("aria-label");
    const interactive = Boolean(settings.peel || settings.drag);
    const usable = interactive && state !== "off";
    if (usable) element.tabIndex = 0;
    else element.removeAttribute("tabindex");
    const shortcuts = usable ? shortcutsOf(settings.drag, settings.peel) : "";
    const hint = usable ? words().keys({ move: settings.drag, peel: settings.peel }) : "";
    if (shortcuts) element.setAttribute("aria-keyshortcuts", shortcuts);
    else element.removeAttribute("aria-keyshortcuts");
    if (hint) element.setAttribute("aria-description", hint);
    else element.removeAttribute("aria-description");
    element.style.touchAction = interactive ? (settings.touch === "press" ? "none" : "manipulation") : "";
    // A finger held on it peels or picks it up, rather than selecting it or opening a menu.
    element.style.userSelect = interactive ? "none" : "";
    element.style.setProperty("-webkit-user-select", interactive ? "none" : "");
    element.style.setProperty("-webkit-touch-callout", interactive ? "none" : "");
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
    if (!width || !height || destroyed) return;
    const changed = width !== box.width || height !== box.height;
    box = { width, height };
    scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    margin = Math.ceil(Math.max(width, height) * 0.45);
    const pixels = Math.round((Math.max(width, height) + 2 * margin) * scale);
    // Very large stickers are drawn at a lower resolution, as the shared canvas allows.
    if (pixels > 2048) scale *= 2048 / pixels;
    frame = evenFrame();
    lay(canvas, frame);
    for (const piece of pieces) piece.frame = lay(piece.canvas, evenFrame());
    if (changed || !prepared) await build();
    else redraw();
  }

  /** The margin all round. */
  const evenFrame = (): Reach => ({ left: margin, top: margin, right: margin, bottom: margin });

  /** Lays a canvas out round the box with `room` a side, and sizes it: which clears it. */
  function lay(target: HTMLCanvasElement, room: Reach): Reach {
    const width = box.width + room.left + room.right;
    const height = box.height + room.top + room.bottom;
    Object.assign(target.style, { left: `${-room.left}px`, top: `${-room.top}px`, width: `${width}px`, height: `${height}px` });
    target.width = Math.round(width * scale);
    target.height = Math.round(height * scale);
    return room;
  }

  /**
   * The room a canvas laid out with `had` needs for a sheet folded as `fold`: as it is while that's
   * enough, grown in steps to as far as the fold throws the sheet (`reachOf`, with room for its
   * shadow and its lift) when it isn't, and the margin again once it's flat. Laid out anew only as
   * that changes, since that clears it.
   */
  function fitted(target: HTMLCanvasElement, had: Reach, fold: Fold | null, hull: Point[]): Reach {
    const even = evenFrame();
    const same = (a: Reach, b: Reach) => a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
    if (!fold) return same(had, even) ? had : lay(target, even);
    const reach = reachOf(fold, hull);
    const pad = Math.max(box.width, box.height) * 0.25;
    const need: Reach = {
      left: Math.max(margin, pad - reach.left),
      top: Math.max(margin, pad - reach.top),
      right: Math.max(margin, reach.right - box.width + pad),
      bottom: Math.max(margin, reach.bottom - box.height + pad),
    };
    // Never more than twice its size past a side: a sheet thrown further comes off first.
    const most = Math.max(box.width, box.height) * 2;
    for (const side of ["left", "top", "right", "bottom"] as const) need[side] = Math.min(need[side], most);
    if (need.left <= had.left && need.top <= had.top && need.right <= had.right && need.bottom <= had.bottom) return had;
    // A little more than it needs, so a peel going on doesn't lay it out again every frame.
    const step = (n: number, h: number) => (n <= h ? h : Math.ceil((n + pad * 0.5) / 16) * 16);
    return lay(target, { left: step(need.left, had.left), top: step(need.top, had.top), right: step(need.right, had.right), bottom: step(need.bottom, had.bottom) });
  }

  // A box that changes size every frame is measured once a frame.
  let measureQueued = false;
  function remeasure() {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(() => {
      measureQueued = false;
      void measure();
    });
  }

  // One build at a time: asked for again while one runs, it runs once more after, with what's then true.
  let building: Promise<void> | null = null;
  let buildAgain = false;
  function build(): Promise<void> {
    if (building) {
      buildAgain = true;
      return building;
    }
    building = (async () => {
      do {
        buildAgain = false;
        await buildOnce();
      } while (buildAgain && !destroyed);
      building = null;
    })();
    return building;
  }

  async function buildOnce() {
    const mine = source;
    const key = keyOf(source, element);
    if (!loaded || key !== loadedKey) {
      try {
        loaded = await load(source, element);
        loadedKey = key;
      } catch (error) {
        console.error("A sticker's art couldn't be loaded", error);
        return;
      }
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
    uncut = whole(prepared.cut.field, prepared.cut.depth, prepared.cut.width, prepared.cut.height);
    sheet = uncut;
    // Torn before, it's torn again in the same places on the new cut.
    for (const made of tears) sheet = tearSheet(sheet, unshared(made.fold), prepared.fieldScale, made.seed, Math.max(box.width, box.height)).kept;
    if (tears.length) {
      takeSheet(sheet);
      element.dataset.torn = "";
    }
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
    if (!prepared || !sheet) return;
    textures = {
      art: imageTexture(s, prepared.art, textures?.art),
      field: fieldTexture(s, [sheet.field, sheet.depth, sheet.torn], sheet.width, sheet.height, textures?.field),
      print: print ? imageTexture(s, print, textures?.print) : null,
    };
  }

  /** The sheet as it now is: what a press finds, what's drawn, and how far it reaches each way. */
  function takeSheet(next: Sheet) {
    if (!prepared) return;
    sheet = next;
    prepared.cut = { ...prepared.cut, field: next.field, depth: next.depth };
    prepared.hull = hullIn(next);
    const s = stageNow();
    if (s && textures) textures.field = fieldTexture(s, [next.field, next.depth, next.torn], next.width, next.height, textures.field);
  }

  /** A sheet's convex hull, in box pixels. */
  function hullIn(of: Sheet): Point[] {
    const sx = box.width / of.width;
    const sy = box.height / of.height;
    return hullOf(of).map((point) => ({ x: point.x * sx, y: point.y * sy }));
  }

  // A fold kept as shares of the box, so it can be made again on a cut of another size.
  const side = () => Math.max(box.width, box.height);
  const shared = (fold: Fold): Fold => ({ x: fold.x / box.width, y: fold.y / box.height, nx: fold.nx, ny: fold.ny, radius: fold.radius / side(), bow: (fold.bow ?? 0) * side(), cone: (fold.cone ?? 0) * side() });
  const unshared = (fold: Fold): Fold => ({ x: fold.x * box.width, y: fold.y * box.height, nx: fold.nx, ny: fold.ny, radius: fold.radius * side(), bow: (fold.bow ?? 0) / side(), cone: (fold.cone ?? 0) / side() });

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
  type Edge = NonNullable<ReturnType<typeof edgeNear>>;

  const curl = () => settings.curl ?? Math.min(Math.max(Math.min(box.width, box.height) * 0.075, 5), 40);
  /** How close to the edge a press peels it, in pixels. */
  const band = () => Math.min(Math.max(Math.min(box.width, box.height) * 0.16, 12), 34);

  /** The curl's radius for a pull: tight as the sheet first lifts, a small lip, opening to the full curl as it's drawn further. */
  const curlFor = (pull: number) => curl() * Math.min(1, 0.4 + pull / (2 * curl()));

  /** The fold a sheet held at `at`, its edge facing `out` there, makes drawn `x`, `y` across: its front straightening as the last of it, by `hull`, comes up, so it all comes off. */
  function foldWith(at: Point, out: Point, x: number, y: number, hull: Point[]): Fold | null {
    const pull = Math.hypot(x, y);
    if (pull < 0.05) return null;
    const fold = foldFor(at, { x: at.x + x, y: at.y + y }, out, curlFor(pull));
    const share = liftedShare(fold, extentAlong(hull, { x: fold.nx, y: fold.ny }));
    const tented = Math.min(1, Math.max(0, (1 - share) / 0.4));
    return { ...fold, bow: (fold.bow ?? 0) * tented, cone: (fold.cone ?? 0) * tented };
  }

  function foldNow(): Fold | null {
    return prepared ? foldWith(grab, outward, pullX.value, pullY.value, prepared.hull) : null;
  }

  function shareNow() {
    return shareAt(pullX.value, pullY.value);
  }

  /** How much of it a pull of `x`, `y` lifts. */
  function shareAt(x: number, y: number) {
    const fold = prepared ? foldWith(grab, outward, x, y, prepared.hull) : null;
    if (!fold || !prepared) return 0;
    return liftedShare(fold, extentAlong(prepared.hull, { x: fold.nx, y: fold.ny }));
  }

  /** Holds it at a point just inside the edge, so the point held is the sheet's. */
  function grabAt(nearest: Point, normal: Point) {
    outward = normal;
    const inset = Math.min(1.5, band() / 6);
    grab = { x: nearest.x - outward.x * inset, y: nearest.y - outward.y * inset };
  }

  /** What a press at `at` would do: peel, pick it up, or nothing. */
  function planFor(at: Point): { kind: "peel" | "hold"; edge: Edge } | null {
    const edge = edgeNear(at);
    if (!edge) return null;
    const nearEdge = edge.distance > -band() && edge.distance < band() * 0.35;
    const inside = edge.distance < 0.5;
    if (settings.peel && nearEdge) return { kind: "peel", edge };
    if (settings.drag && inside) return { kind: "hold", edge };
    return null;
  }

  function begin(plan: NonNullable<ReturnType<typeof planFor>>, at: Point, client: Point) {
    if (holder === "keys") holder = null;
    if (state === "held" && settling) settling = false;
    homing = null;
    keyMoved = 0;
    if (plan.kind === "peel") startPeel(at, plan.edge);
    else hold({ x: at.x - box.width / 2, y: at.y - box.height / 2 }, client);
  }

  function startPeel(at: Point, edge: Edge) {
    grabAt(edge.nearest, edge.normal);
    samples = [];
    tearArmed = false;
    pulling = true;
    // Peeled, its sheet folds over whatever lies beside it, so it's drawn over its neighbours.
    if (!peelRaised) peelZ = element.style.zIndex;
    raise();
    peelRaised = true;
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

  /** How far a pull the way `dx`, `dy` goes (a unit) lifts it all, the curl open all the way. */
  function fullPull(dx: number, dy: number, folded: Fold | null = null) {
    if (!prepared) return Infinity;
    const fold = folded ?? foldFor(grab, { x: grab.x + dx, y: grab.y + dy }, outward, curl());
    const extent = extentAlong(prepared.hull, { x: fold.nx, y: fold.ny });
    const along = grab.x * fold.nx + grab.y * fold.ny;
    return Math.max(pullToLift(along, extent, curl()) + 4, curl() * 1.2);
  }

  /** Peels on the way it's going until it's mostly up, then it's carried off (`carryOff`); under reduced motion it fades where it is. */
  function leave() {
    if (!prepared) return;
    pulling = false;
    settling = false;
    leaving = true;
    const length = Math.hypot(pullX.value, pullY.value) || 1;
    const dx = pullX.value / length || -outward.x;
    const dy = pullY.value / length || -outward.y;
    const full = fullPull(dx, dy, foldNow());
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

  /**
   * It came off in the hand: held by the point it was peeled from, which is where the fold carried it,
   * under the pointer, so nothing jumps; it opens out from there as it lifts, and follows the hand.
   */
  function pickUp(client: Point) {
    pulling = false;
    unrolling = true;
    pullX = { ...pullX, target: 0 };
    pullY = { ...pullY, target: 0 };
    settings.onPeel?.();
    hold(heldPoint(), client);
  }

  /**
   * Carried off by the corner it was peeled from: held there as the hand held it, opening out and
   * swinging round behind as it goes the way it was pulled, faster and faster, lifted toward you,
   * until it's out of what it's seen in (the nearest box that clips it, and the window).
   */
  function carryOff() {
    const rect = element.getBoundingClientRect();
    const middle = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const held = heldPoint();
    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);
    const at = { x: middle.x + held.x * cos - held.y * sin, y: middle.y + held.x * sin + held.y * cos };
    const origin = laidOut();
    let dx = pullX.value * cos - pullY.value * sin;
    let dy = pullX.value * sin + pullY.value * cos;
    const length = Math.hypot(dx, dy);
    if (length < 1e-3) [dx, dy] = [-outward.x * cos + outward.y * sin, -outward.x * sin - outward.y * cos];
    else [dx, dy] = [dx / length, dy / length];
    carried = { dir: { x: dx, y: dy }, speed: CARRY_SPEED, time: 0, from: placeNow(), clip: clipOf() };
    unrolling = true;
    pullX = { ...pullX, target: 0 };
    pullY = { ...pullY, target: 0 };
    grip = held;
    hand = { x: at.x - origin.x, y: at.y - origin.y };
    lift = { ...lift, target: 1 };
    raise();
  }

  /** What it's seen in: the nearest box round it that clips what overflows it, within the window. */
  function clipOf(): Clip {
    let clip: Clip = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.overflowX === "visible" && style.overflowY === "visible") continue;
      const box = parent.getBoundingClientRect();
      clip = { left: Math.max(clip.left, box.left), top: Math.max(clip.top, box.top), right: Math.min(clip.right, box.right), bottom: Math.min(clip.bottom, box.bottom) };
      break;
    }
    return clip;
  }

  /** Whether it's gone from sight: its box, and the room its curl and shadow take round it, all outside what it's seen in. */
  function outOfSight() {
    if (!carried) return false;
    const rect = element.getBoundingClientRect();
    const room = Math.max(rect.width, rect.height) * 0.25;
    const { clip } = carried;
    return rect.right + room < clip.left || rect.left - room > clip.right || rect.bottom + room < clip.top || rect.top - room > clip.bottom;
  }

  /** It's off: hidden, told, and put back where it lay for when it's restored. */
  function gone() {
    leaving = false;
    const from = carried?.from;
    carried = null;
    unrolling = false;
    if (from) {
      body = still(from.x, from.y, from.angle);
      applyPlace();
      lift = sprung(0);
      tiltX = sprung(0);
      tiltY = sprung(0);
    }
    setState("off");
    canvas.style.visibility = "hidden";
    describe();
    settings.onPeel?.();
  }

  /** The point held as it opens out, from its middle: the grabbed point, carried as far over the fold as it still is. */
  const heldPoint = (): Point => ({ x: grab.x + pullX.value - box.width / 2, y: grab.y + pullY.value - box.height / 2 });

  function hold(gripAt: Point, client: Point) {
    grip = gripAt;
    const origin = laidOut();
    hand = { x: client.x - origin.x, y: client.y - origin.y };
    measureBounds(origin);
    settling = false;
    holder = "pointer";
    pickedFrom = placeNow();
    lift = { ...lift, target: 1 };
    setState("held");
    raise();
    peelRaised = false;
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
    raised = true;
  }

  /** Let go: it's pressed down where it is. */
  function drop() {
    holder = null;
    settling = true;
    lift = { ...lift, target: 0 };
    setState("resting");
    redraw();
  }

  // From the keys.
  function pickByKeys() {
    measureBounds(laidOut());
    pickedFrom = state === "held" ? (pickedFrom ?? placeNow()) : placeNow();
    if (state !== "held") {
      raise();
      settings.onPick?.();
    }
    holder = "keys";
    settling = true;
    keyMoved = 0;
    lift = { ...lift, target: 1 };
    setState("held");
    say("picked");
    redraw();
  }

  function setDownByKeys() {
    drop();
    say("dropped");
  }

  function nudge(by: Point) {
    measureBounds(laidOut());
    if (state !== "held") {
      pickedFrom = placeNow();
      raise();
      settings.onPick?.();
    }
    body = { ...body, x: clampX(body.x + by.x), y: clampY(body.y + by.y), vx: 0, vy: 0 };
    applyPlace();
    lift = { ...lift, target: 1 };
    // Moved while lying down, it's set down a moment after the last key; picked up, it stays up.
    if (holder !== "keys") keyMoved = performance.now();
    setState("held");
    settling = true;
    redraw();
  }

  /** Escape: back where it was picked up, and pressed down there. */
  function putBack() {
    if (!pickedFrom) return;
    if (captured !== null && element.hasPointerCapture(captured)) element.releasePointerCapture(captured);
    captured = null;
    const to = pickedFrom;
    if (lessMotion()) body = still(to.x, to.y, to.angle);
    else homing = { from: body, to, t: { value: 0, velocity: 0, target: 1 } };
    applyPlace();
    keyMoved = 0;
    drop();
    say("returned");
  }

  // The press.
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !prepared || state === "off" || leaving) return;
    const at = localOf(event.clientX, event.clientY);
    const plan = planFor(at);
    if (!plan) return;
    if (event.pointerType === "touch" && settings.touch !== "press") {
      // A finger is the page's until it's been held still a moment: a swipe scrolls.
      clearTimeout(waitTimer);
      waiting = pressed(event.pointerId, { x: event.clientX, y: event.clientY }, performance.now());
      waitTimer = window.setTimeout(takeFinger, HOLD_MS);
      return;
    }
    event.preventDefault();
    begin(plan, at, { x: event.clientX, y: event.clientY });
    capture(event.pointerId);
  };

  function capture(id: number) {
    try {
      element.setPointerCapture(id);
      captured = id;
    } catch {
      // Gone already: it was let go in the meantime.
    }
    // A press doesn't focus it (its default is held back, and focusing it would show a ring after a
    // click): while the pointer has it, Escape is heard from the whole page.
    document.addEventListener("keydown", escapeFromPage, true);
  }

  function escapeFromPage(event: KeyboardEvent) {
    if (event.key !== "Escape" || (!pulling && holder !== "pointer")) return;
    if (event.target === element) return;
    key(event);
  }

  function takeFinger() {
    const finger = waiting;
    waiting = null;
    if (!finger || destroyed || state === "off" || leaving || !heldLongEnough(finger, performance.now(), HOLD_MS - 20)) return;
    const at = localOf(finger.at.x, finger.at.y);
    const plan = planFor(at);
    if (!plan) return;
    fingerTaken = true;
    begin(plan, at, finger.at);
    capture(finger.id);
  }

  function letWaitingGo() {
    clearTimeout(waitTimer);
    waiting = null;
  }

  const move = (event: PointerEvent) => {
    if (waiting && event.pointerId === waiting.id) {
      const next = movedTo(waiting, { x: event.clientX, y: event.clientY });
      if (next === "swipe") letWaitingGo();
      else waiting = next;
      return;
    }
    if (inHand && event.pointerId === captured) {
      // A piece torn off follows the hand that tore it.
      handTo(inHand, { x: event.clientX, y: event.clientY });
      redraw();
      return;
    }
    if (!prepared || state === "off" || leaving) return;
    if (pulling) {
      const now = performance.now();
      samples = keptSamples([...samples, { x: event.clientX, y: event.clientY, time: now }], now);
      pullTo(localOf(event.clientX, event.clientY), true);
      // Yanked, it tears rather than lifting more (as soon as enough of it is drawn up, in the
      // frame); peeled slowly, it comes up whole.
      if (speedOf(samples, now) > tearSpeedOf(settings.tear) && shareAt(pullX.target, pullY.target) >= TEAR_FROM) tearArmed = true;
      if (!tearArmed && settings.drag && shareNow() >= settings.comesOff) pickUp({ x: event.clientX, y: event.clientY });
      else if (!tearArmed && !settings.drag) {
        // Pulled all the way up, nothing holds it down any more: it comes off, the way it was pulled,
        // rather than trailing after the pointer however far it goes.
        const length = Math.hypot(pullX.target, pullY.target);
        if (length > 0 && length >= fullPull(pullX.target / length, pullY.target / length)) leave();
      }
      return;
    }
    if (holder === "pointer" && !settling) {
      const origin = laidOut();
      hand = { x: event.clientX - origin.x, y: event.clientY - origin.y };
      redraw();
      return;
    }
    if (event.pointerType === "touch" || event.buttons) return;
    // Hovering: a hand where it can be peeled or picked up. Nothing lifts until it's
    // pressed: a straight fold across a round edge never matched the shape it lifted.
    element.style.cursor = planFor(localOf(event.clientX, event.clientY)) ? "grab" : "";
  };

  /** The pointer let go of it, or the browser took it (`cancelled`): nothing comes off for that. */
  const release = (event: PointerEvent, cancelled: boolean) => {
    document.removeEventListener("keydown", escapeFromPage, true);
    if (waiting && event.pointerId === waiting.id) letWaitingGo();
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    if (captured === event.pointerId) captured = null;
    fingerTaken = false;
    // Let go of mid-yank, it tears where it's got to, if that's enough to tear.
    if (pulling && tearArmed && !cancelled) tearNow();
    tearArmed = false;
    if (inHand) {
      letGoOf(inHand);
      inHand = null;
    } else if (pulling) {
      // How far the hand had pulled it counts, not only how far the drawing had caught up.
      if (!cancelled && !settings.drag && Math.max(shareNow(), shareAt(pullX.target, pullY.target)) >= settings.comesOff) leave();
      else layBack();
    } else if (holder === "pointer" && !settling) drop();
    element.style.cursor = "";
  };
  const up = (event: PointerEvent) => release(event, false);
  const cancel = (event: PointerEvent) => release(event, true);

  const leaveHover = () => {
    if (!pulling && holder !== "pointer") element.style.cursor = "";
  };

  // A finger the sticker has taken doesn't scroll the page, nor opens a menu as it's held.
  const touchMove = (event: TouchEvent) => {
    if (fingerTaken && event.cancelable) event.preventDefault();
  };
  const menu = (event: Event) => {
    if (fingerTaken || waiting) event.preventDefault();
  };

  const key = (event: KeyboardEvent) => {
    if (state === "off" || leaving || !prepared || event.altKey || event.ctrlKey || event.metaKey) return;
    const action = keyAction(event.key, event.shiftKey, {
      drag: settings.drag,
      peel: settings.peel,
      // Moved by the arrows a moment ago, it's still the keys': Escape puts it back, Space sets it down.
      holding: holder ?? (keyMoved ? "keys" : null),
      pulling,
    });
    if (!action) return;
    event.preventDefault();
    if (action.do === "lay") {
      layBack();
      if (captured !== null && element.hasPointerCapture(captured)) element.releasePointerCapture(captured);
      captured = null;
    } else if (action.do === "back") putBack();
    else if (action.do === "pick") pickByKeys();
    else if (action.do === "set") setDownByKeys();
    else if (action.do === "move") nudge(action.by);
    else if (action.do === "peel") {
      peelOff();
      say("peeled");
    }
  };

  const clampX = (x: number) => (bounds ? Math.min(Math.max(x, bounds.left), bounds.right) : x);
  const clampY = (y: number) => (bounds ? Math.min(Math.max(y, bounds.top), bounds.bottom) : y);

  function peelOff() {
    if (!prepared || state === "off" || leaving) return;
    if (holder) {
      holder = null;
      settling = true;
      keyMoved = 0;
      lift = { ...lift, target: 0 };
    }
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
    const torn = tears.length > 0;
    if (state !== "off" && !leaving && !torn) return;
    leaving = false;
    pulling = false;
    if (torn && uncut) {
      // Whole again, as it was cut.
      tears = [];
      takeSheet(uncut);
      delete element.dataset.torn;
    }
    pullX = sprung(0);
    pullY = sprung(0);
    opacity = lessMotion() ? sprung(1) : { value: 0, velocity: 0, target: 1 };
    lift = lessMotion() ? sprung(0) : { value: 1, velocity: 0, target: 0 };
    canvas.style.visibility = "";
    unrolling = false;
    setState("resting");
    describe();
    redraw();
  }


  // Torn.

  /**
   * Tears it along the fold as it is now: the part lifted comes away as a piece of its own in the
   * hand, drawn just as it was, and the rest stays stuck, its torn edge showing. Not when the tear
   * would take, or leave, next to nothing: then it peels on as it was.
   */
  function tearNow(): boolean {
    if (!prepared || !sheet) return false;
    const fold = foldNow();
    if (!fold) return false;
    const tearSeed = (seed * 13 + tears.length * 7.7) % 101;
    const { kept, piece } = tearSheet(sheet, fold, prepared.fieldScale, tearSeed, side());
    const area = areaOf(sheet);
    if (areaOf(piece) < area * LEAST_PIECE || areaOf(kept) < area * LEAST_PIECE) return false;
    tears.push({ fold: shared(fold), seed: tearSeed });
    element.dataset.torn = "";
    inHand = pieceOf(piece, prepared.hull);
    takeSheet(kept);
    // What's left lies flat: the part that was lifted has gone with the piece.
    pulling = false;
    pullX = sprung(0);
    pullY = sprung(0);
    setState("resting");
    raise();
    settings.onTear?.();
    redraw();
    return true;
  }

  /** The sticker's own frame: a point in the window from the box's middle, as the sticker is turned. */
  function frameOf(client: Point): Point {
    const rect = element.getBoundingClientRect();
    return toLocal(client, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, body.angle);
  }

  function pieceOf(torn: Sheet, hull: Point[]): Piece {
    const drawn = document.createElement("canvas");
    drawn.setAttribute("aria-hidden", "true");
    Object.assign(drawn.style, { position: "absolute", pointerEvents: "none", display: "block", maxWidth: "none" });
    const room = lay(drawn, frame);
    element.appendChild(drawn);
    const held = heldPoint();
    const pointer = pointerNow();
    const made: Piece = {
      canvas: drawn,
      frame: room,
      sheet: torn,
      hull,
      texture: null,
      grab: { ...grab },
      outward: { ...outward },
      pullX: { ...pullX, target: 0 },
      pullY: { ...pullY, target: 0 },
      unrolling: true,
      body: still(),
      grip: held,
      hand: pointer.present ? frameOf(pointer) : held,
      samples: [],
      lift: { ...lift, target: 1 },
      tiltX: sprung(0),
      tiltY: sprung(0),
      opacity: sprung(1),
      carried: null,
    };
    pieces.push(made);
    return made;
  }

  /** The hand holding a piece moved to `client`. */
  function handTo(piece: Piece, client: Point) {
    piece.hand = frameOf(client);
    const now = performance.now();
    piece.samples = keptSamples([...piece.samples, { ...piece.hand, time: now }], now);
  }

  /** Let go of, a piece is carried off the way the hand was going (or the way it was pulled), at least as fast, until it's out of sight. */
  function letGoOf(piece: Piece) {
    const now = performance.now();
    const kept = keptSamples(piece.samples, now);
    let dx = 0;
    let dy = 0;
    if (kept.length > 1) [dx, dy] = [kept[kept.length - 1].x - kept[0].x, kept[kept.length - 1].y - kept[0].y];
    if (Math.hypot(dx, dy) < 2) [dx, dy] = [piece.pullX.value || -piece.outward.x, piece.pullY.value || -piece.outward.y];
    const length = Math.hypot(dx, dy) || 1;
    piece.carried = { dir: { x: dx / length, y: dy / length }, speed: Math.max(CARRY_SPEED, speedOf(piece.samples, now)), time: 0, clip: clipOf() };
    redraw();
  }

  /** A piece moved on by `dt`: opening out, following the hand or carried off, lifted, leaning as it goes; gone once it's out of sight. */
  function stepPiece(piece: Piece, dt: number, step: (spring: Spring, value: Sprung) => Sprung) {
    const less = lessMotion();
    piece.pullX = step(UNROLL, piece.pullX);
    piece.pullY = step(UNROLL, piece.pullY);
    if (atRest(piece.pullX, 0.05) && atRest(piece.pullY, 0.05)) piece.unrolling = false;
    if (piece.unrolling) piece.grip = { x: piece.grab.x + piece.pullX.value - box.width / 2, y: piece.grab.y + piece.pullY.value - box.height / 2 };
    if (less) {
      // Under reduced motion a piece fades where it is.
      piece.opacity = step(QUICK, { ...piece.opacity, target: 0 });
      if (piece.opacity.value < 0.01) dropPiece(piece);
      return;
    }
    const carried = piece.carried;
    if (carried) {
      carried.time += dt;
      carried.speed += CARRY_GAIN * dt;
      piece.hand = { x: piece.hand.x + carried.dir.x * carried.speed * dt, y: piece.hand.y + carried.dir.y * carried.speed * dt };
    }
    piece.body = follow(piece.body, piece.grip, piece.hand, box, dt, HANDLING);
    piece.lift = step(LIFT, piece.lift);
    piece.tiltX = step(TILT, { ...piece.tiltX, target: Math.min(Math.max(-piece.body.vy / 2600, -0.3), 0.3) });
    piece.tiltY = step(TILT, { ...piece.tiltY, target: Math.min(Math.max(piece.body.vx / 2600, -0.3), 0.3) });
    piece.canvas.style.translate = `${piece.body.x}px ${piece.body.y}px`;
    piece.canvas.style.rotate = `${piece.body.angle}rad`;
    if (carried && (pieceOutOfSight(piece, carried.clip) || carried.time > CARRY_MOST)) dropPiece(piece);
  }

  /** Whether a piece and everything drawn round it, its shadow included, are out of what it's seen in. */
  function pieceOutOfSight(piece: Piece, clip: Clip) {
    const rect = piece.canvas.getBoundingClientRect();
    return rect.right < clip.left || rect.left > clip.right || rect.bottom < clip.top || rect.top > clip.bottom;
  }

  /** A piece gone for good: its canvas and its texture. */
  function dropPiece(piece: Piece) {
    pieces = pieces.filter((each) => each !== piece);
    if (inHand === piece) inHand = null;
    freeTexture(stageNow(), piece.texture);
    piece.canvas.remove();
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
        const spring = pulling ? FOLLOW : unrolling ? UNROLL : leaving ? LEAVE : LAY_BACK;
        pullX = step(spring, pullX);
        pullY = step(spring, pullY);
        if (!atRest(pullX, 0.05) || !atRest(pullY, 0.05)) moving = true;
        else unrolling = false;
        // Opening out in the hand, the point held moves back onto the sheet: the hand keeps it.
        if (unrolling) grip = heldPoint();
        // Yanked, it tears once enough of it is drawn lifted.
        if (tearArmed && pulling && shareNow() >= TEAR_FROM && tearNow()) tearArmed = false;
        // Lying flat again where it was, it goes back among its neighbours.
        if (peelRaised && !pulling && !leaving && !holder && state === "resting" && atRest(pullX, 0.05) && atRest(pullY, 0.05)) {
          element.style.zIndex = peelZ;
          peelRaised = false;
        }
      }
      if (leaving) {
        // Under reduced motion it fades where it is; otherwise, once it's mostly up, it's carried off.
        if (less) opacity = { ...opacity, target: 0 };
        else if (!carried && shareNow() >= CARRY_AT) carryOff();
        if (carried) {
          carried.time += dt;
          carried.speed += CARRY_GAIN * dt;
          hand = { x: hand.x + carried.dir.x * carried.speed * dt, y: hand.y + carried.dir.y * carried.speed * dt };
          if (outOfSight() || carried.time > CARRY_MOST) gone();
        } else if (opacity.target === 0 && opacity.value < 0.01) gone();
        moving = true;
      }
      opacity = step(leaving ? QUICK : GLIDE, opacity);
      // The pieces torn off, each in the hand or carried away.
      for (const piece of [...pieces]) {
        stepPiece(piece, dt, step);
        moving = true;
      }
      // Going home, held, or settling.
      if (homing) {
        homing = { ...homing, t: step(HOME, homing.t) };
        const t = homing.t.value;
        const { from, to } = homing;
        body = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, angle: from.angle + wrapAngle(to.angle - from.angle) * t, vx: 0, vy: 0, spin: 0 };
        applyPlace();
        if (atRest(homing.t, 0.001)) {
          body = still(to.x, to.y, to.angle);
          applyPlace();
          homing = null;
        }
        moving = true;
      } else if (carried || (holder === "pointer" && !settling)) {
        body = follow(body, grip, hand, box, dt, less ? { ...HANDLING, turn: 0 } : HANDLING);
        if (bounds && !carried) body = { ...body, x: clampX(body.x), y: clampY(body.y) };
        applyPlace();
        moving = true;
      } else if (settling) {
        body = settle(body, dt);
        if (bounds) body = { ...body, x: clampX(body.x), y: clampY(body.y) };
        applyPlace();
        // A sticker moved by the arrow keys lies down a moment after the last.
        if (keyMoved && performance.now() - keyMoved > NUDGE_MS) {
          keyMoved = 0;
          lift = { ...lift, target: 0 };
          setState("resting");
          say("moved");
        }
        const stopped = Math.hypot(body.vx, body.vy) < 1 && Math.abs(body.spin) < 0.01 && atRest(lift, 0.002);
        if (holder !== "keys" && !keyMoved && stopped) {
          settling = false;
          pickedFrom = null;
          body = { ...body, vx: 0, vy: 0, spin: 0 };
          settings.onDrop?.(placeNow());
        } else if (holder !== "keys" || !atRest(lift, 0.002)) moving = true;
      }
      lift = step(lift.target > lift.value ? LIFT : PRESS, lift);
      const lean = (Boolean(carried) || (holder === "pointer" && !settling)) && !less;
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
      return moving || fading || (holder === "pointer" && !settling) || pieces.length > 0;
    },
  };

  function draw() {
    dirty = false;
    if (!prepared || !canvas.width) return;
    const s = stageNow();
    if (!s) {
      if (!drawnWithStage) {
        frame = fitted(canvas, frame, null, prepared.hull);
        drawFlat(canvas, prepared, `rgb(${colours.border.map((c) => Math.round(c * 255)).join(" ")})`, margin, scale);
        hideStandIns();
      }
      return;
    }
    if (!textures || textures.art.generation !== s.generation) upload(s);
    if (!textures) return;
    const fold = foldNow();
    // Peeled far, the sheet is thrown past the canvas's margin: the canvas grows to take it.
    frame = fitted(canvas, frame, fold, prepared.hull);
    const ok = drawSheet(s, canvas, {
      fold,
      frame,
      lift: lift.value,
      tilt: [tiltX.value, tiltY.value],
      angle: body.angle,
      light,
      opacity: opacity.value,
      field: textures.field.texture,
    });
    for (const piece of pieces) {
      if (!piece.texture || piece.texture.generation !== s.generation) piece.texture = fieldTexture(s, [piece.sheet.field, piece.sheet.depth, piece.sheet.torn], piece.sheet.width, piece.sheet.height, piece.texture);
      // The light where the piece is: the sticker's, moved and turned to the piece's own frame.
      const cos = Math.cos(piece.body.angle);
      const sin = Math.sin(piece.body.angle);
      const dx = light.x - box.width / 2 - piece.body.x;
      const dy = light.y - box.height / 2 - piece.body.y;
      const pieceFold = foldWith(piece.grab, piece.outward, piece.pullX.value, piece.pullY.value, piece.hull);
      piece.frame = fitted(piece.canvas, piece.frame, pieceFold, piece.hull);
      drawSheet(s, piece.canvas, {
        fold: pieceFold,
        frame: piece.frame,
        lift: piece.lift.value,
        tilt: [piece.tiltX.value, piece.tiltY.value],
        angle: body.angle + piece.body.angle,
        light: { x: dx * cos + dy * sin + box.width / 2, y: -dx * sin + dy * cos + box.height / 2 },
        opacity: piece.opacity.value,
        field: piece.texture.texture,
      });
    }
    if (ok && !drawnWithStage) {
      drawnWithStage = true;
      element.dataset.drawn = "";
      hideStandIns();
    }
  }

  /**
   * Draws a sheet, the sticker's or a piece torn off it, into `target` (its own canvas): folded as
   * `fold` says, lifted, tilted, turned `angle` on the page, lit by the pointer at `light` (in its
   * box's pixels), its cut and torn edges from `field`.
   */
  function drawSheet(
    s: Stage,
    target: HTMLCanvasElement,
    look: { fold: Fold | null; frame: Reach; lift: number; tilt: [number, number]; angle: number; light: Point; opacity: number; field: WebGLTexture },
  ): boolean {
    if (!prepared || !textures) return false;
    const side = Math.max(box.width, box.height);
    const { fold } = look;
    const height = look.lift * side * 0.12;
    const dome = domeOf(puffinessOf(settings.puffy), box);
    // The sheet's turn: tilted about its y, then its x, by how it's moving.
    const [ax, ay] = look.tilt;
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    const turn = [cy, 0, -sy, sx * sy, cx, sx * cy, cx * sy, -sx, cx * cy];
    // The key light, turned into the sheet's own frame (it's turned on the page).
    const cos = Math.cos(look.angle);
    const sin = Math.sin(look.angle);
    const key = [KEY[0] * cos + KEY[1] * sin, -KEY[0] * sin + KEY[1] * cos, KEY[2]];
    const finish = FINISHES.indexOf(settings.finish);
    const pattern = PATTERNS.indexOf(settings.pattern ?? "smooth");
    return drawInto(
      s,
      target,
      {
        uScale: scale,
        uMargin: [look.frame.left, look.frame.top],
        uBox: [box.width, box.height],
        uLight: [look.light.x, look.light.y, side * 0.9, settings.shine ? shine.value : 0],
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
        uBend: fold ? [fold.bow ?? 0, fold.cone ?? 0] : [0, 0],
        uTurn: turn,
        uLift: [box.width / 2, box.height / 2, height],
        uEye: side * 2.6,
        // A domed sticker stands thicker, and casts a deeper shadow.
        uThick: 1.4 + dome.height * 0.5,
        uDome: [dome.height, dome.rim],
        uOpacity: look.opacity,
      },
      { uArt: textures.art.texture, uField: look.field, uPrint: textures.print?.texture ?? null },
    );
  }

  /** What a server drew in its place (React's stand-in), hidden once it's drawn itself. */
  function hideStandIns() {
    for (const stand of Array.from(element.querySelectorAll<HTMLElement>("[data-sticker-stand-in]"))) stand.style.visibility = "hidden";
  }

  // Watching.
  // Several changes can come at once (carried out of sight and put back between two frames): the last is how it is.
  const visibility = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible && dirty) redraw();
  });
  visibility.observe(element);
  const resize = new ResizeObserver(remeasure);
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
    // A page's tokens may change with its scheme: the colours given, and the art's own.
    readColours();
    if (prepared && keyOf(source, element) !== loadedKey) void build();
    else redraw();
  });
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", cancel);
  element.addEventListener("pointerleave", leaveHover);
  element.addEventListener("touchmove", touchMove, { passive: false });
  element.addEventListener("contextmenu", menu);
  element.addEventListener("keydown", key);
  describe();
  readColours();
  void measure();

  return {
    element,
    get place() {
      return placeNow();
    },
    get state() {
      return state;
    },
    set(next) {
      const { src: nextSource, ...rest } = given(next);
      const before = settings;
      settings = { ...settings, ...rest };
      if (rest.seed !== undefined) seed = rest.seed;
      if (rest.place && holder === null && !homing) {
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
      clearTimeout(waitTimer);
      visibility.disconnect();
      resize.disconnect();
      stopStage();
      stopPointer();
      stopScheme();
      letGoOfRegion();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", cancel);
      element.removeEventListener("pointerleave", leaveHover);
      element.removeEventListener("touchmove", touchMove);
      element.removeEventListener("contextmenu", menu);
      element.removeEventListener("keydown", key);
      document.removeEventListener("keydown", escapeFromPage, true);
      for (const piece of [...pieces]) dropPiece(piece);
      releaseTextures();
      canvas.remove();
      for (const name of ["role", "aria-roledescription", "aria-label", "aria-keyshortcuts", "aria-description", "tabindex", "data-sticker", "data-drawn", "data-torn"]) element.removeAttribute(name);
      element.style.translate = "";
      element.style.rotate = "";
      element.style.touchAction = "";
      element.style.cursor = "";
      element.style.userSelect = "";
      element.style.removeProperty("-webkit-user-select");
      element.style.removeProperty("-webkit-touch-callout");
      if (positioned) element.style.position = "";
      if (raised) element.style.zIndex = zIndexBefore;
    },
  };
}

const smoothstep = (from: number, to: number, x: number) => {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};
