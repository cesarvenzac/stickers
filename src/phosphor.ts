/**
 * A glow-in-the-dark sticker's charge. Light charges its phosphor quickly; in the dark it gives the
 * charge back as light, bright at first and dimmer and dimmer, as real phosphorescence fades: its
 * afterglow falls as one over time (the charge c follows dc/dt = −c²/τ), half in `HALF` seconds
 * from full, a quarter in three times that. A little light on it (a torch, a pointer) charges it
 * again. Pure: no DOM.
 */

/** Seconds for a full charge to fade to half in the dark. */
export const HALF = 12;
/** Seconds for light to charge it most of the way (to 63%). */
export const FILL = 0.8;

/**
 * The charge (0 to 1) `dt` seconds on, under `light` (0 to 1: 1 in a lit room, 0 in the dark, in
 * between under a torch). Exact on any clock: two half steps land where one step does.
 */
export function chargeAfter(charge: number, light: number, dt: number) {
  if (dt <= 0) return charge;
  const c = Math.min(Math.max(charge, 0), 1);
  const lit = Math.min(Math.max(light, 0), 1);
  // Below what the light holds it at, it charges toward that, never past it.
  if (c < lit) return lit - (lit - c) * Math.exp((-lit * dt) / FILL);
  // Above, the charge the light can't hold up fades, given back as glow.
  const above = c - lit;
  return lit + above / (1 + (above * dt) / HALF);
}

/** How brightly it glows at a charge: what it gives back, never quite nothing, so a sticker in the dark stays findable. */
export const glowOf = (charge: number, least = 0.06) => least + (1 - least) * charge;
