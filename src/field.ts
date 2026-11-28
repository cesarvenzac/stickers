/**
 * A sticker's shape, as a die-cutter makes it: the art's own outline grown by a border, its narrow
 * gaps closed and its holes filled, the way a kiss-cut follows a drawing with one smooth contour.
 * Kept as a signed distance field (negative inside, in pixels of the field): the shader draws the
 * edge sharp at any size from it, softens shadows by it and finds the cut's slope in it, and a
 * press finds the nearest edge and which way is out. Pure: no DOM.
 */

const FAR = 1e20;

/**
 * Squared distances along one row or column, in place, by Felzenszwalb and Huttenlocher's lower
 * envelope of parabolas: linear in its length. `f`, `v` and `z` are scratch arrays as long as it.
 */
function line(grid: Float64Array, offset: number, stride: number, length: number, f: Float64Array, v: Int32Array, z: Float64Array) {
  v[0] = 0;
  z[0] = -FAR;
  z[1] = FAR;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      // Two far cells cancel before their squares are added: 1e20 holds no square's worth of precision.
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = FAR;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}

/** Each pixel's distance to the nearest pixel that's in `set` (0 for those that are), in pixels. */
export function distanceTo(set: Uint8Array, width: number, height: number): Float32Array {
  const grid = new Float64Array(width * height);
  for (let i = 0; i < grid.length; i++) grid[i] = set[i] ? 0 : FAR;
  const most = Math.max(width, height);
  const f = new Float64Array(most);
  const v = new Int32Array(most);
  const z = new Float64Array(most + 1);
  for (let x = 0; x < width; x++) line(grid, x, width, height, f, v, z);
  for (let y = 0; y < height; y++) line(grid, y * width, 1, width, f, v, z);
  const out = new Float32Array(grid.length);
  for (let i = 0; i < grid.length; i++) out[i] = Math.sqrt(grid[i]);
  return out;
}

/**
 * The signed distance to the edge of `inside`: negative inside, positive outside, the edge itself
 * half way between a pixel in and a pixel out (so either side of it is ±0.5).
 */
export function signedField(inside: Uint8Array, width: number, height: number): Float32Array {
  const outside = new Uint8Array(inside.length);
  for (let i = 0; i < inside.length; i++) outside[i] = inside[i] ? 0 : 1;
  const toInside = distanceTo(inside, width, height);
  const toOutside = distanceTo(outside, width, height);
  const field = new Float32Array(inside.length);
  for (let i = 0; i < inside.length; i++) field[i] = inside[i] ? 0.5 - toOutside[i] : toInside[i] - 0.5;
  return field;
}

/** `shape` with every hole in it filled: whatever isn't in it and can't be reached from the picture's edge. In place. */
export function fillHoles(shape: Uint8Array, width: number, height: number) {
  const reached = new Uint8Array(shape.length);
  const stack: number[] = [];
  const visit = (i: number) => {
    if (shape[i] || reached[i]) return;
    reached[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) visit(i - 1);
    if (x < width - 1) visit(i + 1);
    if (i >= width) visit(i - width);
    if (i < shape.length - width) visit(i + width);
  }
  for (let i = 0; i < shape.length; i++) if (!reached[i]) shape[i] = 1;
}

export type Cut = {
  /** The signed distance to the cut's edge, a pixel of the field each, row by row from the top. */
  field: Float32Array;
  /** How far in from the cut's outer edge each pixel is (0 outside): a filled hole is as deep as what's round it, so a dome over it doesn't dip. */
  depth: Float32Array;
  width: number;
  height: number;
  /** Whether the art had anything in it to cut round. */
  empty: boolean;
};

/**
 * Squared distances, the EDT's way, from seeds whose own distances are given: `seed[i]` is how far
 * pixel i is from the set (0 in it, a fraction of a pixel at its anti-aliased edge, FAR well
 * outside). Seeding the edge with fractions is what keeps the distances true to a fraction of a
 * pixel, where a set of whole pixels is out by half of one.
 */
function distanceFrom(seed: Float64Array, width: number, height: number): Float32Array {
  const grid = Float64Array.from(seed, (value) => (value >= FAR ? FAR : value * value));
  const most = Math.max(width, height);
  const f = new Float64Array(most);
  const v = new Int32Array(most);
  const z = new Float64Array(most + 1);
  for (let x = 0; x < width; x++) line(grid, x, width, height, f, v, z);
  for (let y = 0; y < height; y++) line(grid, y * width, 1, width, f, v, z);
  const out = new Float32Array(grid.length);
  for (let i = 0; i < grid.length; i++) out[i] = Math.sqrt(grid[i]);
  return out;
}

/**
 * The die-cut round a drawing, from its alpha (0 to 255, a pixel each): its outline (half opaque),
 * grown by `outline` pixels, its gaps narrower than `smooth` closed and its concave corners
 * rounded as much (a closing: grown by `smooth` more, then shrunk by it), and its holes filled.
 * Measured to a fraction of a pixel from the drawing's own anti-aliased edge.
 */
export function cutOf(alpha: ArrayLike<number>, width: number, height: number, outline: number, smooth = outline): Cut {
  const grow = Math.max(0, outline);
  const close = Math.max(0, smooth);
  // Worked out with room round the picture, so growing and closing aren't stopped by its edges.
  const pad = Math.ceil(grow + close) + 2;
  const w = width + 2 * pad;
  const h = height + 2 * pad;
  // Each pixel's distance to the art, and to what isn't art. A pixel half covered is on the
  // art's edge; more covered, a fraction inside it; less, a fraction outside.
  const toward = new Float64Array(w * h).fill(FAR);
  const away = new Float64Array(w * h).fill(0);
  let empty = true;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = alpha[y * width + x] / 255;
      if (a <= 0) continue;
      const i = (y + pad) * w + x + pad;
      toward[i] = Math.max(0, 0.5 - a);
      away[i] = a >= 1 ? FAR : Math.max(0, a - 0.5);
      if (a >= 0.5) empty = false;
    }
  }
  if (empty) return { field: new Float32Array(width * height).fill(Math.max(width, height)), depth: new Float32Array(width * height), width, height, empty };
  const toArt = distanceFrom(toward, w, h);
  const fromArt = distanceFrom(away, w, h);
  // The art's own signed distance, negative inside it.
  const art = new Float32Array(w * h);
  for (let i = 0; i < art.length; i++) art[i] = toArt[i] - fromArt[i];
  // How far each pixel is from leaving the art grown by the outline and the closing...
  const reach = grow + close;
  const leaving = new Float64Array(w * h).fill(FAR);
  for (let i = 0; i < leaving.length; i++) {
    const inside = reach - art[i];
    if (inside <= 0) leaving[i] = 0;
    else if (inside < 1.5) leaving[i] = inside;
  }
  const toLeave = distanceFrom(leaving, w, h);
  // ...shrunk back by the closing: inside the grown shape the cut's edge is `close` in from
  // where it's left; outside it, the outline's distance from the art goes on from there.
  const padded = new Float32Array(w * h);
  const shape = new Uint8Array(w * h);
  for (let i = 0; i < padded.length; i++) {
    padded[i] = toLeave[i] > 0 ? close - toLeave[i] : art[i] - grow;
    shape[i] = padded[i] < 0 ? 1 : 0;
  }
  // Holes are filled: what's outside the shape but can't be reached from the edge is in it.
  const before = shape.slice();
  fillHoles(shape, w, h);
  for (let i = 0; i < shape.length; i++) if (shape[i] && !before[i]) padded[i] = -0.5;
  // How deep each pixel is, from the outer edge alone: the cut's own distance where it agrees (to a
  // fraction of a pixel), and the whole-pixel distance where a filled hole's rim is nearer.
  const outside = new Uint8Array(shape.length);
  for (let i = 0; i < shape.length; i++) outside[i] = shape[i] ? 0 : 1;
  const toOutside = distanceTo(outside, w, h);
  const deep = new Float32Array(w * h);
  for (let i = 0; i < deep.length; i++) {
    if (!shape[i]) continue;
    const whole = Math.max(0, toOutside[i] - 0.5);
    deep[i] = Math.abs(-padded[i] - whole) <= 1 ? Math.max(0, -padded[i]) : whole;
  }
  const field = new Float32Array(width * height);
  const depth = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    field.set(padded.subarray((y + pad) * w + pad, (y + pad) * w + pad + width), y * width);
    depth.set(deep.subarray((y + pad) * w + pad, (y + pad) * w + pad + width), y * width);
  }
  return { field, depth, width, height, empty };
}

/** The field's value at a point (in pixels of the field, 0 to `width` across), read between pixels as a texture is, clamped at its edges. */
export function fieldAt(cut: Pick<Cut, "field" | "width" | "height">, x: number, y: number): number {
  const { field, width, height } = cut;
  const fx = Math.min(Math.max(x - 0.5, 0), width - 1);
  const fy = Math.min(Math.max(y - 0.5, 0), height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const top = field[y0 * width + x0] * (1 - tx) + field[y0 * width + x1] * tx;
  const bottom = field[y1 * width + x0] * (1 - tx) + field[y1 * width + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * Where a point stands against the cut's edge: how far from it (negative inside), which way is out
 * (the field's slope, a unit vector), and the nearest point on the edge.
 */
export function edgeAt(cut: Pick<Cut, "field" | "width" | "height">, x: number, y: number) {
  const distance = fieldAt(cut, x, y);
  const gx = fieldAt(cut, x + 1, y) - fieldAt(cut, x - 1, y);
  const gy = fieldAt(cut, x, y + 1) - fieldAt(cut, x, y - 1);
  const length = Math.hypot(gx, gy);
  const normal = length > 1e-6 ? { x: gx / length, y: gy / length } : { x: 0, y: -1 };
  return { distance, normal, nearest: { x: x - normal.x * distance, y: y - normal.y * distance } };
}

export type Point = { x: number; y: number };

/** The convex hull of what's inside the cut (the corners of its pixels), anticlockwise on the page: what the shape reaches toward any side. */
export function hullOf(cut: Pick<Cut, "field" | "width" | "height">): Point[] {
  const { field, width, height } = cut;
  const points: Point[] = [];
  for (let y = 0; y < height; y++) {
    // Each row's first and last pixel inside are all a hull can be made of.
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x++) {
      if (field[y * width + x] < 0) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first < 0) continue;
    points.push({ x: first, y }, { x: first, y: y + 1 }, { x: last + 1, y }, { x: last + 1, y: y + 1 });
  }
  if (points.length < 3) return points;
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const point of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Point[] = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** How far the hull reaches along a direction (a unit vector), each way: the least and the most of `point · direction`. */
export function extentAlong(hull: readonly Point[], direction: Point) {
  let least = Infinity;
  let most = -Infinity;
  for (const point of hull) {
    const along = point.x * direction.x + point.y * direction.y;
    if (along < least) least = along;
    if (along > most) most = along;
  }
  return { least, most };
}
