/**
 * A scratch card: a coating over whatever an element holds, in any of the stickers' finishes
 * (silvery steel unless said), scratched off where the pointer goes with a coin's ragged edge,
 * flakes falling as it goes. Past a share scratched, the rest crumbles away and what was under it
 * is left. Enter or Space does the same, all at once.
 */

import { coverageOf, raggedOf, scratchedShare, scratchStroke } from "./coverage.ts";
import type { Point } from "./field.ts";
import { drawInto, imageTexture, freeTexture, type Stage, stageNow, type Texture, watchStage } from "./gl.ts";
import { atRest, type Spring, sprung, stepSpring } from "./motion.ts";
import { animate, colourOf, given, onPointer, onScheme, pageIsDark, pointerNow, stopAnimating, wantsLessMotion } from "./page.ts";
import { FINISHES } from "./shaders.ts";
import type { Finish } from "./sticker.ts";

export type ScratchOptions = {
  /** The coating's finish: `steel` (a scratch card's silver) unless said. */
  finish?: Finish;
  /** The coating's colour. A light silver unless said. */
  coat?: string;
  /** Words printed on the coating, in the element's font. */
  print?: string;
  /** How wide a stroke scratches, in pixels: a ninth of the card's shorter side unless said. */
  brush?: number;
  /** The share scratched (0 to 1) past which the rest crumbles away. Half unless said; 1 never does. */
  revealAt?: number;
  /** The coating's corners, in pixels: the element's own `border-radius` unless said. */
  radius?: number;
  /** What the coating says to assistive tech, as a button that reveals what's under it. */
  label?: string;
  /** Whether the lights are off. `auto` (the default) follows the page. */
  dark?: boolean | "auto";
  /** Whether the pointer lights it. On unless said. */
  shine?: boolean;
  seed?: number;
  /** Whether to move less: no flakes, and it's revealed at once. Follows the visitor's setting unless said. */
  reducedMotion?: boolean;
  /** Called as it's scratched, with the share scratched so far. */
  onScratch?: (share: number) => void;
  /** Called once it's all gone. */
  onReveal?: () => void;
};

export type ScratchCard = {
  readonly element: HTMLElement;
  /** The share scratched off, 0 to 1. */
  readonly share: number;
  readonly revealed: boolean;
  /** Crumble the rest away now. */
  reveal(): void;
  /** Coat it again, as new. */
  reset(): void;
  set(options: ScratchOptions): void;
  destroy(): void;
};

const CRUMBLE: Spring = { duration: 1.1, bounce: 0 };
const GLIDE: Spring = { duration: 0.25, bounce: 0 };
const KEY = (() => {
  const v = [-0.12, -0.42, 1];
  const length = Math.hypot(...v);
  return v.map((each) => each / length);
})();
const SILVER: [number, number, number] = [0.78, 0.79, 0.8];

type Flake = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; shade: number; turn: number };

let seeds = 0;

/** Coats `element` (which holds what's to be revealed) for scratching off. */
export function scratch(element: HTMLElement, options: ScratchOptions = {}): ScratchCard {
  let settings = { finish: "steel" as Finish, revealAt: 0.5, shine: true, dark: "auto" as boolean | "auto", label: "Scratch to reveal", ...given(options) };
  const seed = settings.seed ?? (++seeds * 5.17) % 89;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", display: "block", zIndex: "1" });
  if (getComputedStyle(element).position === "static") element.style.position = "relative";
  element.appendChild(canvas);

  const mask = document.createElement("canvas");
  const maskContext = mask.getContext("2d")!;
  let maskTexture: Texture | null = null;
  let printTexture: Texture | null = null;
  let maskChanged = true;
  let box = { width: 0, height: 0 };
  let scale = 1;
  let coverage = coverageOf(1, 1);
  let revealed = false;
  let told = false;
  let crumble = sprung(0);
  let shine = sprung(0);
  let dark = sprung(isDark() ? 1 : 0);
  let light: Point = { x: 0, y: 0 };
  let last: Point | null = null;
  let strokes = 0;
  let flakes: Flake[] = [];
  let visible = false;
  let dirty = true;
  let destroyed = false;
  let coat = SILVER;
  let print: HTMLCanvasElement | null = null;

  const lessMotion = () => settings.reducedMotion ?? wantsLessMotion();
  function isDark() {
    return settings.dark === "auto" ? pageIsDark() : Boolean(settings.dark);
  }

  function describe() {
    if (revealed) {
      for (const name of ["role", "aria-label", "tabindex"]) element.removeAttribute(name);
      element.style.touchAction = "";
      element.style.cursor = "";
    } else {
      // A button's contents are its own: what's under the coating isn't read until it's revealed.
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", settings.label);
      element.tabIndex = 0;
      element.style.touchAction = "none";
    }
    element.dataset.scratch = revealed ? "revealed" : "coated";
  }

  function readColours() {
    coat = settings.coat ? colourOf(settings.coat, element, SILVER) : SILVER;
  }

  function measure() {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (!width || !height) return;
    const changed = width !== box.width || height !== box.height;
    box = { width, height };
    scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    if (changed) {
      // What's been scratched is kept, stretched to the new size.
      const before = mask.width > 1 ? copyOf(mask) : null;
      mask.width = Math.round(width);
      mask.height = Math.round(height);
      maskContext.fillStyle = "#000";
      maskContext.fillRect(0, 0, mask.width, mask.height);
      if (before) maskContext.drawImage(before, 0, 0, mask.width, mask.height);
      const counted = coverage;
      coverage = coverageOf(width, height, Math.max(6, Math.round(Math.min(width, height) / 24)));
      if (counted.count && before) recount();
      maskChanged = true;
      print = settings.print ? printOf(settings.print) : null;
      printTexture = null;
    }
    redraw();
  }

  function copyOf(source: HTMLCanvasElement) {
    const copy = document.createElement("canvas");
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext("2d")!.drawImage(source, 0, 0);
    return copy;
  }

  /** Counts the cells scratched again from the mask itself, after it was stretched. */
  function recount() {
    const pixels = maskContext.getImageData(0, 0, mask.width, mask.height).data;
    const { columns, rows, cell, scratched } = coverage;
    coverage.count = 0;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = Math.min(mask.width - 1, Math.round((column + 0.5) * cell));
        const y = Math.min(mask.height - 1, Math.round((row + 0.5) * cell));
        scratched[row * columns + column] = pixels[(y * mask.width + x) * 4] > 127 ? 1 : 0;
        coverage.count += scratched[row * columns + column];
      }
    }
  }

  function printOf(words: string) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(box.width * scale);
    canvas.height = Math.round(box.height * scale);
    const context = canvas.getContext("2d")!;
    const style = getComputedStyle(element);
    const size = Math.min(box.height * 0.16, (box.width * 0.8) / Math.max(words.length * 0.55, 1)) * scale;
    context.font = `${size}px ${style.fontFamily || "sans-serif"}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(0, 0, 0, 0.32)";
    context.fillText(words, canvas.width / 2, canvas.height / 2);
    return canvas;
  }

  function radius() {
    if (settings.radius !== undefined) return settings.radius;
    return parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
  }

  function redraw() {
    dirty = true;
    animate(animated);
  }

  function localOf(event: { clientX: number; clientY: number }): Point {
    const rect = element.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * box.width, y: ((event.clientY - rect.top) / rect.height) * box.height };
  }

  const brush = () => settings.brush ?? Math.min(Math.max(Math.min(box.width, box.height) / 9, 14), 40);

  function stroke(from: Point, to: Point) {
    const width = brush();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const across = length > 0 ? { x: -dy / length, y: dx / length } : { x: 0, y: 1 };
    maskContext.strokeStyle = "#fff";
    maskContext.fillStyle = "#fff";
    maskContext.lineCap = "round";
    for (const [offset, strand] of raggedOf(width, ++strokes)) {
      maskContext.lineWidth = strand;
      maskContext.beginPath();
      maskContext.moveTo(from.x + across.x * offset, from.y + across.y * offset);
      maskContext.lineTo(to.x + across.x * offset + 0.01, to.y + across.y * offset);
      maskContext.stroke();
    }
    maskChanged = true;
    // Counted as wide as it's drawn: its strands reach about half its width either side.
    const fresh = scratchStroke(coverage, from, to, width * 0.5);
    if (!lessMotion()) shed(from, to, fresh);
    const share = scratchedShare(coverage);
    settings.onScratch?.(share);
    if (share >= settings.revealAt && !revealed) reveal();
    redraw();
  }

  /** Flakes of coating, shed along a stroke as much as it scratched off: they tumble down and fade. */
  function shed(from: Point, to: Point, fresh: number) {
    const count = Math.min(10, Math.round(fresh * 1.5 + Math.random() * 2));
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    for (let i = 0; i < count && flakes.length < 90; i++) {
      const t = Math.random();
      flakes.push({
        x: from.x + dx * t + (Math.random() - 0.5) * brush() * 0.6,
        y: from.y + dy * t + (Math.random() - 0.5) * brush() * 0.6,
        vx: dx * 4 + (Math.random() - 0.5) * 120,
        vy: dy * 4 - 40 - Math.random() * 90,
        age: 0,
        life: 0.5 + Math.random() * 0.5,
        size: 1 + Math.random() * 2.2,
        shade: 0.75 + Math.random() * 0.4,
        turn: Math.random() * Math.PI,
      });
    }
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    crumble = lessMotion() ? sprung(1) : { ...crumble, target: 1 };
    describe();
    redraw();
  }

  function reset() {
    revealed = false;
    told = false;
    crumble = sprung(0);
    maskContext.fillStyle = "#000";
    maskContext.fillRect(0, 0, mask.width, mask.height);
    coverage = coverageOf(box.width || 1, box.height || 1, coverage.cell);
    maskChanged = true;
    flakes = [];
    canvas.style.visibility = "";
    describe();
    redraw();
  }

  const down = (event: PointerEvent) => {
    if (event.button !== 0 || revealed) return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    last = localOf(event);
    stroke(last, last);
  };
  const move = (event: PointerEvent) => {
    if (!last || revealed) return;
    const at = localOf(event);
    if (Math.hypot(at.x - last.x, at.y - last.y) < 1.5) return;
    stroke(last, at);
    last = at;
  };
  const up = (event: PointerEvent) => {
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    last = null;
  };
  const key = (event: KeyboardEvent) => {
    if (revealed || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    reveal();
  };

  const animated = {
    frame(dt: number): boolean {
      if (destroyed) return false;
      let moving = false;
      const step = (spring: Spring, value: ReturnType<typeof sprung>) => {
        const next = lessMotion() ? { value: value.target, velocity: 0, target: value.target } : stepSpring(spring, value, dt);
        if (!atRest(next, 0.002)) moving = true;
        else next.value = next.target;
        return next;
      };
      crumble = step(CRUMBLE, crumble);
      const pointer = pointerNow();
      let near = 0;
      if (settings.shine && pointer.present) {
        light = localOf({ clientX: pointer.x, clientY: pointer.y });
        const away = Math.hypot(light.x - box.width / 2, light.y - box.height / 2) / Math.max(box.width, box.height, 1);
        near = Math.max(0, Math.min(1, 1 - (away - 0.6) / 0.8));
      }
      shine = step(GLIDE, { ...shine, target: near });
      dark = step({ duration: 0.7, bounce: 0 }, { ...dark, target: isDark() ? 1 : 0 });
      if (flakes.length) {
        moving = true;
        for (const flake of flakes) {
          flake.age += dt;
          flake.vy += 900 * dt;
          flake.vx *= Math.exp(-3 * dt);
          flake.x += flake.vx * dt;
          flake.y += flake.vy * dt;
          flake.turn += dt * 9;
        }
        flakes = flakes.filter((flake) => flake.age < flake.life);
      }
      if (revealed && crumble.value > 0.999 && !flakes.length) {
        canvas.style.visibility = "hidden";
        if (!told) {
          told = true;
          settings.onReveal?.();
        }
        return false;
      }
      if (moving) dirty = true;
      if (dirty && visible) draw();
      return moving;
    },
  };

  function upload(s: Stage) {
    if (maskChanged || !maskTexture || maskTexture.generation !== s.generation) {
      maskTexture = imageTexture(s, mask, maskTexture);
      maskChanged = false;
    }
    if (print && (!printTexture || printTexture.generation !== s.generation)) printTexture = imageTexture(s, print, printTexture);
  }

  function draw() {
    dirty = false;
    if (!canvas.width) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const s = stageNow();
    if (s) {
      upload(s);
      drawInto(
        s,
        "scratch",
        canvas,
        {
          uScale: scale,
          uMargin: [0, 0],
          uBox: [box.width, box.height],
          uLight: [light.x, light.y, Math.max(box.width, box.height) * 0.8, settings.shine ? shine.value : 0],
          uKey: KEY,
          uDark: dark.value,
          uFinish: Math.max(0, FINISHES.indexOf(settings.finish)),
          uSeed: seed,
          uCharge: 1,
          uGlow: [0.62, 1, 0.55],
          uCoat: coat,
          uPrinted: print ? 1 : 0,
          uReveal: Math.min(crumble.value, 1),
          uRadius: radius(),
        },
        { uMask: maskTexture?.texture ?? null, uPrint: printTexture?.texture ?? null },
      );
    } else {
      // Flat, where there's no WebGL 2: the coating's colour, less what's been scratched.
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = 1 - Math.min(crumble.value, 1);
      context.fillStyle = `rgb(${coat.map((c) => Math.round(c * 255)).join(" ")})`;
      context.beginPath();
      context.roundRect(0, 0, canvas.width, canvas.height, radius() * scale);
      context.fill();
      if (print) context.drawImage(print, 0, 0);
      context.globalCompositeOperation = "destination-out";
      context.drawImage(mask, 0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
    }
    if (flakes.length) {
      for (const flake of flakes) {
        const fade = 1 - flake.age / flake.life;
        const shade = coat.map((c) => Math.round(Math.min(1, c * flake.shade) * 255));
        context.globalAlpha = Math.max(0, fade);
        context.fillStyle = `rgb(${shade.join(" ")})`;
        const w = flake.size * scale;
        const h = w * (0.4 + 0.6 * Math.abs(Math.cos(flake.turn)));
        context.fillRect(flake.x * scale - w / 2, flake.y * scale - h / 2, w, h);
      }
      context.globalAlpha = 1;
    }
  }

  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && dirty) redraw();
  });
  visibility.observe(element);
  const resize = new ResizeObserver(() => measure());
  resize.observe(element);
  const stopStage = watchStage(() => {
    maskTexture = null;
    printTexture = null;
    redraw();
  });
  const stopPointer = onPointer(() => {
    if (visible && settings.shine && !revealed) redraw();
  });
  const stopScheme = onScheme(() => {
    readColours();
    redraw();
  });
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", up);
  element.addEventListener("keydown", key);
  readColours();
  describe();
  measure();

  return {
    element,
    get share() {
      return scratchedShare(coverage);
    },
    get revealed() {
      return revealed;
    },
    reveal,
    reset,
    set(next) {
      const printBefore = settings.print;
      settings = { ...settings, ...given(next) };
      readColours();
      if (settings.print !== printBefore) {
        print = settings.print && box.width ? printOf(settings.print) : null;
        printTexture = null;
      }
      describe();
      redraw();
    },
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
      element.removeEventListener("keydown", key);
      const s = stageNow();
      freeTexture(s, maskTexture);
      freeTexture(s, printTexture);
      canvas.remove();
      for (const name of ["role", "aria-label", "tabindex", "data-scratch"]) element.removeAttribute(name);
      element.style.touchAction = "";
    },
  };
}
