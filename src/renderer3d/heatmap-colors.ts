import type { ColorMode } from '../types/renderer';

/** Normalize a resource value to 0–1 based on mode.
 *  - Water: recharge rate, soil baseline (0.4) → midpoint
 *  - Nutrients: terrain nutrient cap, soil max (10) → 1.0
 *  - Light: t³ gamma spreads the 0.7–1.0 cluster where most values sit */
export function normalizeResource(mode: ColorMode, value: number): number {
  if (mode === 'light') {
    const raw = Math.min(1, Math.max(0, value));
    return raw * raw * raw;
  }
  if (mode === 'water') return Math.min(1, Math.max(0, value / 0.8));
  // nutrients
  return Math.min(1, Math.max(0, value / 10));
}

/** Fertility = average of terrain capacity resources. 0 = barren, 1 = fertile.
 *  Water uses recharge rate, nutrients use terrain cap, light is direct. */
export function fertilityValue(waterRecharge: number, light: number, nutrientMax: number): number {
  const w = Math.min(1, Math.max(0, waterRecharge / 0.8));
  const l = Math.min(1, Math.max(0, light));
  const n = Math.min(1, Math.max(0, nutrientMax / 10));
  return (w + l + n) / 3;
}

/** Lerp between two RGB triples. */
function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** 3-stop gradient: low → mid → high, with midpoint at t=0.5. */
function gradient3(
  low: [number, number, number],
  mid: [number, number, number],
  high: [number, number, number],
  t: number,
): [number, number, number] {
  if (t < 0.5) return lerp3(low, mid, t * 2);
  return lerp3(mid, high, (t - 0.5) * 2);
}

/** Return [r, g, b] gradient color for a normalized 0–1 value.
 *  3-stop gradients for richer visual banding. */
export function heatmapColor(mode: ColorMode, t: number): [number, number, number] {
  if (mode === 'water') {
    // brown (dry) → teal (moderate) → blue (wet)
    return gradient3(
      [0.60, 0.35, 0.08],  // warm brown
      [0.15, 0.50, 0.55],  // teal
      [0.05, 0.15, 0.95],  // deep blue
      t,
    );
  }
  if (mode === 'light') {
    // deep purple (shadow) → warm orange (partial) → saturated gold (full sun)
    return gradient3(
      [0.15, 0.02, 0.35],  // deep purple
      [0.80, 0.30, 0.05],  // warm orange
      [0.85, 0.72, 0.08],  // saturated gold (won't blow out under lighting)
      t,
    );
  }
  if (mode === 'fertility') {
    // dark red (barren) → yellow (moderate) → bright green (fertile)
    return gradient3(
      [0.55, 0.05, 0.05],  // dark red
      [0.85, 0.70, 0.10],  // warm yellow
      [0.15, 0.85, 0.20],  // bright green
      t,
    );
  }
  if (mode === 'health') {
    // dark maroon (dying) → amber (stressed) → emerald (thriving)
    return gradient3(
      [0.45, 0.05, 0.10],  // dark maroon
      [0.90, 0.55, 0.10],  // warm amber
      [0.10, 0.75, 0.35],  // emerald green
      t,
    );
  }
  if (mode === 'trait') {
    // cool blue (low) → green (mid) → warm red (high) — stays saturated throughout
    return gradient3(
      [0.15, 0.30, 0.85],
      [0.20, 0.75, 0.20],
      [0.85, 0.15, 0.10],
      t,
    );
  }
  // nutrients: dark gray (depleted) → olive (moderate) → vivid green (rich)
  return gradient3(
    [0.30, 0.25, 0.25],  // dark gray-brown
    [0.45, 0.55, 0.15],  // olive
    [0.10, 0.90, 0.12],  // vivid green
    t,
  );
}
