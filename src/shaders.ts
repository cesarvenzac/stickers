/**
 * The shader. Every pixel is worked back to the point of the sheet seen there (through the sheet's
 * lift and tilt in perspective, then through the peel's curl, as `peel.ts` works it out), shaded in
 * its finish, edged by its die-cut, over the shadow it casts. The finishes are how paper, gloss,
 * holographic foil (in its patterns), glitter and glow-in-the-dark phosphor take the light.
 *
 * Coordinates are the box's own: pixels, x right and y down from its top left corner, z up toward
 * the viewer. The light is a point above the pointer; shadows fall from a fixed light above and a
 * little behind, as a page's shadows do.
 */

/** GLSL as it's sent: comments and runs of space taken out (they'd only be weight), the version on its own line. */
const compact = (source: string) => {
  const [version, ...rest] = source.split("\n");
  const body = rest
    .join("\n")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .replace(/ ?([{}();,=+\-*/<>?:!&|]) ?/g, "$1");
  return `${version}\n${body.trim()}`;
};

export const VERTEX = compact(`#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2. - 1., 0., 1.);
}`);

/** Every finish, as `finish` takes them (and, by its place here, as the shader numbers them). */
export const FINISHES = ["paper", "gloss", "holo", "glitter", "glow"] as const;

/** How a holographic foil's grooves are laid, as `pattern` takes them (numbered by their place here). */
export const PATTERNS = ["smooth", "lines", "squares", "dots", "shards"] as const;

/** What the finishes need: noise, colour, the lights. */
const SHARED = `
precision highp float;

const float PI = 3.14159265;
const vec3 VIEW = vec3(0., 0., 1.);

uniform vec2 uSize;     // the drawing, device pixels
uniform float uScale;   // device pixels a box pixel
uniform vec2 uMargin;   // box pixels round the box
uniform vec2 uBox;      // the box, its pixels
uniform vec4 uLight;    // the pointer's light: where (box pixels, its height) and how much of it reaches
uniform vec3 uKey;      // the room's light, a direction toward it
uniform float uDark;    // 0 in a lit room, 1 with the lights off
uniform int uFinish;
uniform int uPattern;   // a holographic foil's
uniform float uSeed;
uniform float uCharge;  // the phosphor's glow
uniform vec3 uGlow;     // and its colour

out vec4 outColor;

float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
vec3 rainbow(float x) { return .5 + .5 * cos(6.2831853 * (x + vec3(0., .33, .67))); }
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// The room's light on a face: soft, from above, dimmer with the lights off.
float room(vec3 n) {
  return mix(1., .5, uDark) * (.86 + .14 * max(dot(n, uKey), 0.));
}

// The pointer as a torch with the lights off: a pool of light round it.
float torch(vec3 p) {
  float reach = .55 * max(uBox.x, uBox.y);
  vec2 d = p.xy - uLight.xy;
  return uDark * uLight.w * exp(-dot(d, d) / (2. * reach * reach));
}

// How a finish takes the light. \`base\` is the art's colour on the white of the border, \`at\` the
// point of the sheet (box pixels, flat), \`n\` the face's normal, \`p\` where it is, \`ink\` how much
// of the art there is (0 on the border).
vec3 finish(vec3 base, vec2 at, vec3 n, vec3 p, float ink) {
  vec3 toLight = normalize(uLight.xyz - p);
  vec3 h = normalize(toLight + VIEW);
  float nh = max(dot(n, h), 0.);
  float near = uLight.w;
  float lit = room(n) + .9 * torch(p);
  float side = max(uBox.x, uBox.y);

  if (uFinish == 1) {
    // Gloss: a laminate's highlight under the light, and a broader sheen round it.
    vec3 hk = normalize(uKey + VIEW);
    float sheen = .05 * pow(max(dot(n, hk), 0.), 40.);
    return base * lit + near * (.5 * pow(nh, 110.) + .12 * pow(nh, 12.)) * mix(1., .6, uDark) + sheen;
  }

  if (uFinish == 2) {
    // Holographic foil: a diffraction grating. Its grooves send each colour of the light up at an
    // angle of its own, so the spectrum runs across it as the light and the sheet move, brightest
    // where the grooves lie square to the light and where the art is light. \`uPattern\` lays the
    // grooves: one smooth wavering sheet, or lines, squares, dots or shards, each grooved its own way.
    vec3 from = normalize(mix(uKey, toLight, near));
    // The light across the sheet, as the face sees it: tilted, it sees it from elsewhere.
    vec2 toward = from.xy + n.xy * 1.6;
    vec2 grooves = vec2(.55, .85);
    float shift = 0.;
    float seam = 0.;
    float between = 0.;
    if (uPattern == 1) {
      // Lines: fine stripes, each grooved its own way, so they flash one by one.
      float u = dot(at, vec2(.7071, -.7071)) / 2.6;
      float stripe = floor(u);
      float angle = .9 + (hash(vec2(stripe, uSeed)) - .5) * 1.5;
      grooves = vec2(cos(angle), sin(angle));
      shift = stripe * .012;
      seam = smoothstep(.4, .5, abs(fract(u) - .5));
    } else if (uPattern == 2) {
      // Squares: a mosaic of small tiles, each grooved one of six ways.
      vec2 q = at / 5.5 + uSeed;
      vec2 tile = floor(q);
      float angle = floor(hash(tile) * 6.) * PI / 6.;
      grooves = vec2(cos(angle), sin(angle));
      shift = hash(tile + 7.1) * .12;
      vec2 f = abs(fract(q) - .5);
      seam = smoothstep(.4, .5, max(f.x, f.y));
    } else if (uPattern == 3) {
      // Dots: small discs grooved in rings, so the light draws a bright spoke across each, every
      // one turned toward it; the smooth foil between them.
      vec2 q = at / 11.;
      q.x += mod(floor(q.y), 2.) * .5;
      vec2 f = fract(q) - .5;
      float r = length(f);
      grooves = r > 1e-4 ? f / r : vec2(1., 0.);
      shift = r * .9;
      between = smoothstep(.34, .4, r);
      seam = smoothstep(.3, .37, r) * (1. - between);
    } else if (uPattern == 4) {
      // Shards: broken glass, each piece grooved its own way, its edges catching the light.
      vec2 q = at / 14. + uSeed;
      vec2 cell = floor(q);
      vec2 f = fract(q);
      float first = 9.;
      float second = 9.;
      vec2 piece = cell;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 o = vec2(float(i), float(j));
          vec2 d = o + vec2(hash(cell + o), hash(cell + o + 19.1)) - f;
          float dd = dot(d, d);
          if (dd < first) {
            second = first;
            first = dd;
            piece = cell + o;
          } else if (dd < second) second = dd;
        }
      }
      float angle = hash(piece) * PI;
      grooves = vec2(cos(angle), sin(angle));
      shift = hash(piece + 4.3) * .3;
      seam = 1. - smoothstep(0., .05, sqrt(second) - sqrt(first));
    }
    // The smooth foil: the spectrum in broad bands, wavering across the sheet.
    float wave = dot(from.xy, vec2(.55, .85)) * 1.7 + dot(n.xy, vec2(.8, -.6)) * 2.2
      + (at.x + .6 * at.y) / side * 1.4 + noise(at / side * 3.5 + uSeed) * 1.1;
    vec3 foil = rainbow(wave);
    if (uPattern > 0) {
      // A patch of grating shines its colour only with its grooves square to the light; turned
      // away, it's silver. So the patches flash on and off as the light goes round.
      float across = abs(dot(normalize(toward + 1e-4), grooves));
      float phase = dot(toward, grooves) * 1.9 + shift + uSeed * .13;
      vec3 silver = vec3(.5 + .32 * nh);
      vec3 flash = mix(silver, rainbow(phase) * 1.06, smoothstep(.2, .9, across));
      foil = mix(flash, mix(silver, foil, .6), between);
    }
    float glance = .55 + .45 * pow(nh, 5.);
    float shows = mix(.45, 1., smoothstep(.1, .85, luma(base)));
    vec3 colour = mix(base * .92, base * .5 + foil * .62 * glance + .1, shows * .85) * lit;
    // Seams between tiles and stripes sit a little darker; a shard's edge and a dot's rim catch the light.
    if (uPattern == 1 || uPattern == 2) colour *= 1. - .1 * seam;
    else colour += seam * (.04 + .16 * near * glance);
    vec2 sparkle = at * .45 + uSeed;
    vec2 grain = floor(sparkle);
    float glint = step(.985, hash(grain)) * (1. - smoothstep(.15, .45, length(fract(sparkle) - .5))) * pow(nh, 3.) * (.4 + near);
    return colour + near * .35 * pow(nh, 70.) + glint * .7;
  }

  if (uFinish == 3) {
    // Glitter: flakes a few pixels across, each tilted its own way, flashing as it catches the
    // light; each its own shade of the colour under it, some a colour of their own.
    // Flakes on a grid turned off the page's axes, so it never reads as one.
    vec2 g = mat2(.866, .5, -.5, .866) * at / 2.4 + uSeed * 13.;
    vec2 cell = floor(g);
    vec2 within = fract(g) - .5;
    vec2 tilt = vec2(hash(cell), hash(cell + 17.3)) - .5;
    vec3 flake = normalize(n + vec3(tilt * 1.3, 0.));
    float catchLight = pow(max(dot(reflect(-toLight, flake), VIEW), 0.), 36.) * near;
    float catchRoom = pow(max(dot(reflect(-uKey, flake), VIEW), 0.), 70.);
    vec3 tint = mix(vec3(1.), rainbow(hash(cell + 5.1)), .6);
    // Glitter is the art's; the border has a little.
    float amount = mix(.12, 1., ink);
    float round_ = 1. - smoothstep(.32, .5, length(within));
    float shade = 1. + (hash(cell + 9.7) - .5) * .5 * amount;
    vec3 glints = tint * (catchLight * 1.7 + catchRoom * .6) * round_ * amount;
    return base * lit * shade + glints * mix(1., .7, uDark);
  }

  if (uFinish == 4) {
    // Glow in the dark: where it's light, phosphor. Pale in a lit room; with the lights off it
    // gives back the light it took in, bright, then dimmer as its charge runs down.
    float phosphor = smoothstep(.25, .9, luma(base));
    vec3 day = mix(base, base * vec3(.95, 1., .86), .6 * phosphor);
    float flicker = .9 + .1 * noise(at / side * 6. + uSeed);
    vec3 glow = uGlow * uCharge * phosphor * flicker * uDark;
    return day * lit * (1. - .55 * phosphor * uDark) + glow * 1.15 + near * .06 * pow(nh, 20.);
  }

  // Paper: matte, the light all but lost in it.
  return base * lit + near * .04 * pow(nh, 14.) * (1. - .5 * uDark);
}
`;

export const STICKER_FRAGMENT = compact(`#version 300 es
${SHARED}
uniform sampler2D uArt;     // the art, over the box, premultiplied
uniform sampler2D uField;   // the die-cut's signed distance
uniform float uFieldScale;  // box pixels a unit of the field
uniform vec2 uFieldSize;    // the field, its pixels
uniform vec3 uBorder;       // the border's colour
uniform vec3 uBack;         // the back's colour
uniform sampler2D uPrint;   // what's printed on the back, if anything
uniform float uPrinted;
uniform vec4 uFold;         // the peel's fold: a point on it and the direction across it, flat
uniform float uRadius;      // the curl's radius
uniform mat3 uTurn;         // how the sheet is turned: its x, y and up
uniform vec3 uLift;         // where its middle is (box pixels) and how high
uniform float uEye;         // how far above the eye is, box pixels: perspective
uniform float uThick;       // how thick the sheet is, for the shadow it casts lying down
uniform float uOpacity;

float cutAt(vec2 at) {
  // Outside the box, the field's edge plus how far out: the shape lies within the box.
  vec2 inside = clamp(at, vec2(0.), uBox);
  return texture(uField, inside / uBox).r * uFieldScale + length(at - inside);
}

vec2 cutSlope(vec2 at) {
  vec2 e = vec2(uBox.x / uFieldSize.x, 0.);
  vec2 f = vec2(0., uBox.y / uFieldSize.y);
  return vec2(cutAt(at + e) - cutAt(at - e), cutAt(at + f) - cutAt(at - f)) / (2. * vec2(e.x, f.y));
}

// The layers that can be seen at a flat point of the sheet, top first, at most two: the point of
// the sheet each is, which face, the face's normal on the sheet, its height above the sheet, and
// how much it's squeezed toward the viewer.
struct Layer { vec2 at; float back; vec3 normal; float height; float squeeze; };

int layersAt(vec2 spot, out Layer layers[2]) {
  vec2 n = uFold.zw;
  float s = dot(spot - uFold.xy, n);
  float r = uRadius;
  if (s <= 0.) {
    layers[0] = Layer(spot + (PI * r - 2. * s) * n, 1., vec3(0., 0., 1.), 2. * r, 1.);
    layers[1] = Layer(spot, 0., vec3(0., 0., 1.), 0., 1.);
    return 2;
  }
  if (s <= r) {
    float a = asin(clamp(s / r, 0., 1.));
    float far = PI - a;
    layers[0] = Layer(spot + (r * far - s) * n, 1., vec3(sin(far) * n, -cos(far)), r * (1. - cos(far)), max(-cos(far), .15));
    layers[1] = Layer(spot + (r * a - s) * n, 0., vec3(-sin(a) * n, cos(a)), r * (1. - cos(a)), max(cos(a), .15));
    return 2;
  }
  return 0;
}

// How much of the sheet's material is at a flat point, edged by the cut. \`soft\` widens the edge.
float materialAt(vec2 at, float soft) {
  return clamp(.5 - cutAt(at) / soft, 0., 1.);
}

// How much the curled and folded parts shade a flat point of the sheet lying under them, \`k\` the
// way toward the room's light across the sheet, a unit of height.
float curlShadow(vec2 spot, vec2 k) {
  vec2 n = uFold.zw;
  float r = uRadius;
  float shade = 0.;
  // The part folded flat, 2r up: its own shape, softened by its height.
  vec2 high = spot + k * 2. * r;
  float s = dot(high - uFold.xy, n);
  if (s <= 0.) shade = materialAt(high + (PI * r - 2. * s) * n, 1. + r * .9);
  // The curl: a soft band where it stands, cast away from the light, wherever the sheet goes on
  // past the line there.
  float s0 = dot(spot - uFold.xy, n);
  float toward = dot(k, n);
  float centre = r * .5 - toward * r;
  float width = r * (1. + abs(toward));
  float leaves = materialAt(spot + (1. - s0) * n, 1.);
  shade = max(shade, (1. - smoothstep(0., width, abs(s0 - centre))) * .75 * leaves);
  return shade;
}

bool folded() { return uFold.z != 0. || uFold.w != 0.; }

void main() {
  vec2 q = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uScale - uMargin;
  vec3 axisX = uTurn[0];
  vec3 axisY = uTurn[1];
  vec3 up = uTurn[2];
  vec3 middle = uLift;
  vec2 half_ = uBox * .5;
  // The way toward the room's light, across the sheet, a unit of height above it.
  vec2 k = vec2(dot(uKey, axisX), dot(uKey, axisY)) / max(dot(uKey, up), .2);

  // The ray from the eye through this pixel, to the sheet's plane.
  vec3 ray = uEye > 0. ? vec3(q, 0.) - vec3(middle.xy, uEye) : vec3(0., 0., -1.);
  vec3 origin = uEye > 0. ? vec3(middle.xy, uEye) : vec3(q, 1000.);
  float facing = dot(ray, up);
  float t = abs(facing) > 1e-5 ? dot(middle - origin, up) / facing : -1.;
  vec3 hit = origin + ray * t;
  vec2 spot = vec2(dot(hit - middle, axisX), dot(hit - middle, axisY)) + half_;
  // Which side of the sheet the eye is on: 0 its front, 1 its back.
  float flipped = facing < 0. ? 0. : 1.;
  float pixel = 1. / uScale;

  vec4 colour = vec4(0.);
  if (t > 0.) {
    Layer layers[2];
    bool curled = folded();
    // Folded, past the curl there's nothing: that part of the sheet has been lifted away.
    int count = curled ? layersAt(spot, layers) : 1;
    if (!curled) layers[0] = Layer(spot, 0., vec3(0., 0., 1.), 0., 1.);
    for (int i = 0; i < 2; i++) {
      if (i >= count || colour.a > .995) break;
      Layer layer = layers[i];
      float cut = cutAt(layer.at);
      float cover = clamp(.5 - cut * layer.squeeze / (pixel * 1.1), 0., 1.);
      if (cover <= 0.) continue;
      float back = abs(layer.back - flipped);
      vec3 onSheet = layer.normal;
      // The cut's rounded edge: the face tilts out over its last pixels.
      if (cut > -2.5 * pixel) onSheet = normalize(onSheet + vec3(cutSlope(layer.at) * smoothstep(-2.5 * pixel, 0., cut) * .9, 0.));
      vec3 normal = normalize(axisX * onSheet.x + axisY * onSheet.y + up * onSheet.z);
      if (dot(normal, -ray) < 0.) normal = -normal;
      vec3 where = hit + up * layer.height;
      vec2 uv = layer.at / uBox;
      vec3 shaded;
      if (back > .5) {
        vec3 paper = uBack;
        if (uPrinted > .5) {
          vec4 ink = texture(uPrint, vec2(1. - uv.x, uv.y));
          paper = paper * (1. - ink.a) + ink.rgb;
        }
        vec3 toLight = normalize(uLight.xyz - where);
        float nh = max(dot(normal, normalize(toLight + VIEW)), 0.);
        shaded = paper * (room(normal) * (.9 + .1 * normal.z) + .8 * torch(where)) + uLight.w * .12 * pow(nh, 30.);
      } else {
        vec4 art = texture(uArt, uv);
        vec3 base = uBorder * (1. - art.a) + art.rgb;
        shaded = finish(base, layer.at, normal, where, art.a);
      }
      // What lies under the curl is in its shadow.
      if (curled && layer.height == 0.) shaded *= 1. - .4 * curlShadow(layer.at, k);
      colour.rgb += (1. - colour.a) * cover * shaded;
      colour.a += (1. - colour.a) * cover;
    }
  }

  // The shadow the sheet casts on the page, where the page shows.
  if (colour.a < .995) {
    // From this point of the page toward the room's light, up to the sheet's plane...
    float toward = dot(uKey, up);
    float s = abs(toward) > 1e-4 ? dot(middle - vec3(q, 0.), up) / toward : 0.;
    vec3 on = vec3(q, 0.) + uKey * s;
    float height = max(on.z, 0.) + uThick;
    // ...and on by the sheet's own thickness: it never lies quite flat on the page.
    vec2 at = vec2(dot(on - middle, axisX), dot(on - middle, axisY)) + half_ + k * uThick;
    float soft = 1.2 + height * .4;
    float shadow;
    if (folded()) {
      float lying = dot(at - uFold.xy, uFold.zw) <= 0. ? materialAt(at, soft) : 0.;
      shadow = max(lying, curlShadow(at, k));
    } else shadow = materialAt(at, soft);
    float strength = mix(.24, .16, clamp(height / max(uBox.x, uBox.y) * 3., 0., 1.));
    vec4 fall = vec4(0., 0., 0., shadow * strength);
    // A glowing sticker lights the page round it with the lights off.
    if (uFinish == 4 && uDark > 0.) {
      float beyond = max(cutAt(spot), 0.);
      float bloom = exp(-beyond / (.06 * max(uBox.x, uBox.y))) * uCharge * uDark * .5;
      fall = vec4(uGlow * bloom, bloom * .7) + fall * (1. - bloom * .7);
    }
    colour += (1. - colour.a) * fall;
  }
  outColor = colour * uOpacity;
}`);
