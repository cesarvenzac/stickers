/**
 * One WebGL 2 context for the page, however many stickers it has: each is drawn into it in turn and
 * copied onto its own canvas, so a page full of them never runs out of contexts (browsers allow
 * about sixteen). The shaders are compiled without holding up the page: with
 * `KHR_parallel_shader_compile` the page asks each frame whether they're done, which never waits;
 * without it, they're compiled once the page is idle, behind a fence. Until then, and where there's
 * no WebGL 2, the stickers are drawn flat.
 */

import { SCRATCH_FRAGMENT, STICKER_FRAGMENT, VERTEX } from "./shaders.ts";

/** The most device pixels across the shared canvas: a drawing bigger than this is drawn smaller and copied up. */
export const MOST = 2048;

type Program = { program: WebGLProgram; at: Map<string, WebGLUniformLocation | null> };

export type Stage = {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  sticker: Program;
  scratch: Program;
  /** Counts the contexts made: textures made for an earlier one are gone. */
  generation: number;
  blank: WebGLTexture;
};

export type Readiness = "waiting" | "ready" | "unavailable";

let stage: Stage | null = null;
let readiness: Readiness = "waiting";
let started = false;
let generation = 0;
const watchers = new Set<() => void>();

function tell(next: Readiness) {
  readiness = next;
  queueMicrotask(() => {
    for (const watcher of watchers) watcher();
  });
}

const later = (step: () => void, idle: boolean) => {
  if (!idle) requestAnimationFrame(step);
  else if (typeof requestIdleCallback === "function") requestIdleCallback(step, { timeout: 800 });
  else setTimeout(step, 60);
};

function compile(gl: WebGL2RenderingContext, fragment: string) {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) return null;
  gl.shaderSource(vertexShader, VERTEX);
  gl.compileShader(vertexShader);
  gl.shaderSource(fragmentShader, fragment);
  gl.compileShader(fragmentShader);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  return { program, shaders: [vertexShader, fragmentShader] };
}

function linked(gl: WebGL2RenderingContext, made: NonNullable<ReturnType<typeof compile>>): Program | null {
  if (!gl.getProgramParameter(made.program, gl.LINK_STATUS)) {
    for (const shader of made.shaders) if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
    console.error(gl.getProgramInfoLog(made.program));
    return null;
  }
  const at = new Map<string, WebGLUniformLocation | null>();
  const count = gl.getProgramParameter(made.program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(made.program, i);
    if (info) at.set(info.name.replace(/\[0\]$/, ""), gl.getUniformLocation(made.program, info.name));
  }
  return { program: made.program, at };
}

function prepare(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
  const mine = ++generation;
  stage = null;
  const parallel = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;
  const begin = () => {
    if (mine !== generation || gl.isContextLost()) return;
    const sticker = compile(gl, STICKER_FRAGMENT);
    const scratch = compile(gl, SCRATCH_FRAGMENT);
    if (!sticker || !scratch) return tell("unavailable");
    gl.flush();
    const sync = parallel ? null : gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    const done = () => {
      if (parallel) return [sticker, scratch].every((made) => gl.getProgramParameter(made.program, parallel.COMPLETION_STATUS_KHR));
      return !sync || gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED;
    };
    const wait = () => {
      if (mine !== generation || gl.isContextLost()) return;
      if (!done()) return later(wait, false);
      if (sync) gl.deleteSync(sync);
      const stickerProgram = linked(gl, sticker);
      const scratchProgram = linked(gl, scratch);
      if (!stickerProgram || !scratchProgram) return tell("unavailable");
      const blank = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, blank);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      stage = { gl, canvas, sticker: stickerProgram, scratch: scratchProgram, generation: mine, blank };
      tell("ready");
    };
    later(wait, false);
  };
  // Compiled straight away where the driver does it on the side; otherwise once the page is idle.
  if (parallel) begin();
  else later(begin, true);
}

function start() {
  if (started) return;
  started = true;
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  const gl = canvas?.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!canvas || !gl) return tell("unavailable");
  canvas.width = canvas.height = 256;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    generation++;
    stage = null;
    tell("waiting");
  });
  canvas.addEventListener("webglcontextrestored", () => prepare(gl, canvas));
  prepare(gl, canvas);
}

/** Where the page's shaders stand. */
export const readinessNow = () => readiness;

/** Calls `change` whenever the shaders' readiness changes, starting to make them ready if nothing has yet. Returns a function to stop. */
export function watchStage(change: () => void) {
  watchers.add(change);
  start();
  return () => {
    watchers.delete(change);
  };
}

/** The stage, once it's ready and its context is alive. */
export function stageNow(): Stage | null {
  if (!stage || readiness !== "ready") return null;
  if (stage.gl.isContextLost()) {
    generation++;
    stage = null;
    tell("waiting");
    return null;
  }
  return stage;
}

export type Texture = { texture: WebGLTexture; generation: number; width: number; height: number };

/** A picture (premultiplied, top row first) as a texture, or `into` refilled with it. */
export function imageTexture(s: Stage, source: TexImageSource, into?: Texture | null): Texture {
  const { gl } = s;
  const texture = into && into.generation === s.generation ? into.texture : gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const size = source as { width: number; height: number };
  return { texture, generation: s.generation, width: size.width, height: size.height };
}

/** A field of numbers (one a pixel, top row first) as a half-float texture, read between pixels. */
export function fieldTexture(s: Stage, field: Float32Array, width: number, height: number, into?: Texture | null): Texture {
  const { gl } = s;
  const texture = into && into.generation === s.generation ? into.texture : gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, width, height, 0, gl.RED, gl.FLOAT, field);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { texture, generation: s.generation, width, height };
}

export function freeTexture(s: Stage | null, texture: Texture | null | undefined) {
  if (s && texture && texture.generation === s.generation) s.gl.deleteTexture(texture.texture);
}

export type Uniform = number | boolean | readonly number[] | Float32Array;

const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D | null>();

/**
 * Draws with `which` program into `target` (its own canvas, in device pixels): the uniforms set by
 * name (numbers, vectors, a 3×3 matrix as nine numbers), the textures bound in order to units 0 up.
 * The drawing is made at the shared canvas's bottom left and copied before the browser clears it.
 * Returns false when it couldn't be drawn.
 */
export function drawInto(s: Stage, which: "sticker" | "scratch", target: HTMLCanvasElement, uniforms: Record<string, Uniform>, textures: Record<string, WebGLTexture | null>): boolean {
  const { gl, canvas } = s;
  let context = contexts.get(target);
  if (context === undefined) {
    context = target.getContext("2d");
    contexts.set(target, context);
  }
  if (!context) return false;
  const scale = Math.min(1, MOST / Math.max(target.width, target.height));
  const width = Math.max(1, Math.round(target.width * scale));
  const height = Math.max(1, Math.round(target.height * scale));
  if (canvas.width < width || canvas.height < height) {
    canvas.width = Math.min(MOST, Math.max(canvas.width, width));
    canvas.height = Math.min(MOST, Math.max(canvas.height, height));
  }
  const program = s[which];
  gl.useProgram(program.program);
  gl.viewport(0, 0, width, height);
  gl.disable(gl.BLEND);
  const set = (name: string, value: Uniform) => {
    const at = program.at.get(name);
    if (at === undefined || at === null) return;
    if (typeof value === "boolean") gl.uniform1f(at, value ? 1 : 0);
    else if (typeof value === "number") {
      if (name === "uFinish") gl.uniform1i(at, value);
      else gl.uniform1f(at, value);
    } else if (value.length === 2) gl.uniform2fv(at, value as number[]);
    else if (value.length === 3) gl.uniform3fv(at, value as number[]);
    else if (value.length === 4) gl.uniform4fv(at, value as number[]);
    else if (value.length === 9) gl.uniformMatrix3fv(at, false, value as number[]);
  };
  set("uSize", [width, height]);
  for (const [name, value] of Object.entries(uniforms)) set(name, name === "uScale" ? (value as number) * scale : value);
  let unit = 0;
  for (const [name, texture] of Object.entries(textures)) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture ?? s.blank);
    const at = program.at.get(name);
    if (at) gl.uniform1i(at, unit);
    unit++;
  }
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  context.clearRect(0, 0, target.width, target.height);
  context.drawImage(canvas, 0, canvas.height - height, width, height, 0, 0, target.width, target.height);
  return true;
}
