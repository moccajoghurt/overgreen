import type { ColorMode } from '../types/renderer';

/** Normalize a resource value to 0–1 based on mode. */
export function normalizeResource(mode: ColorMode, value: number): number {
  if (mode === 'light') {
    const raw = Math.min(1, Math.max(0, value));
    // Gamma t³ spreads the 0.7–1.0 range where most values cluster
    return raw * raw * raw;
  }
  // water and nutrients both range 0–10
  return Math.min(1, Math.max(0, value / 10));
}

/** Stress = min of all three normalized resources. 0 = severely stressed, 1 = thriving. */
export function stressValue(water: number, light: number, nutrients: number): number {
  const w = Math.min(1, Math.max(0, water / 10));
  const l = Math.min(1, Math.max(0, light));
  const n = Math.min(1, Math.max(0, nutrients / 10));
  return Math.min(w, l, n);
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
  if (mode === 'stress') {
    // dark red (struggling) → yellow (moderate) → bright green (thriving)
    return gradient3(
      [0.55, 0.05, 0.05],  // dark red
      [0.85, 0.70, 0.10],  // warm yellow
      [0.15, 0.85, 0.20],  // bright green
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
