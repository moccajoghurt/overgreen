import { Genome, Season } from '../types';
import { RendererState, lerp } from './state';

/**
 * Compute a single RGB tint multiplier for a plant instance.
 *
 * The vertex colors are baked into the merged geometry from gallery materials.
 * THREE.js multiplies vertexColor × instanceColor, so:
 * - (1,1,1) = gallery colors unchanged
 * - values < 1 darken, > 1 brighten
 *
 * Tint encodes: natural genome variation, species color mode, seasonal shift.
 */
export function computePlantTint(
  state: RendererState,
  plantId: number,
  speciesId: number,
  genome: Genome,
  archetype: number,
  env: { season: Season; seasonProgress: number },
): { r: number; g: number; b: number } {
  // Check cache first
  const cached = state.plantColorCache.get(plantId);
  if (cached) {
    // Apply seasonal shift on top of cached base tint
    return applySeasonal(cached.cr, cached.cg, cached.cb, archetype, env);
  }

  let r = 1.0, g = 1.0, b = 1.0;

  if (state.colorMode === 'natural') {
    // Subtle genome-based variation (±15% per channel)
    r += (genome.rootPriority - 0.5) * 0.2;
    g += (genome.leafSize - 0.5) * 0.15;
    b += (genome.heightPriority - 0.5) * 0.15;

    // Seed investment → slight warmth
    r += genome.seedInvestment * 0.06;
    g -= genome.seedInvestment * 0.02;

    // Defense → slightly darker
    r -= genome.defense * 0.05;
    g -= genome.defense * 0.03;
  } else {
    // Species mode: tint toward species color
    const sc = state.world.speciesColors.get(speciesId);
    if (sc) {
      r = 0.4 + sc.r * 0.8;
      g = 0.4 + sc.g * 0.8;
      b = 0.4 + sc.b * 0.8;
    } else {
      // Fallback genome-based species color
      r = 0.4 + (0.2 + genome.rootPriority * 0.6) * 0.8;
      g = 0.4 + (0.3 + genome.leafSize * 0.5) * 0.8;
      b = 0.4 + (0.2 + genome.heightPriority * 0.6) * 0.8;
    }
  }

  // Cache the base tint (before seasonal)
  state.plantColorCache.set(plantId, { cr: r, cg: g, cb: b, tr: r, tg: g, tb: b });

  return applySeasonal(r, g, b, archetype, env);
}

/** Apply seasonal color shift to a base tint. */
function applySeasonal(
  r: number, g: number, b: number,
  archetype: number,
  env: { season: Season; seasonProgress: number },
): { r: number; g: number; b: number } {
  const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;
  const s0 = env.season;

  // Succulents are evergreen — minimal seasonal shift
  if (archetype === 3) {
    // Just a very subtle shift
    if (s0 === Season.Winter) {
      r = lerp(r, r * 0.9, 0.1);
      g = lerp(g, g * 0.95, 0.1);
      b = lerp(b, b * 1.05, 0.1);
    }
    return { r, g, b };
  }

  // Seasonal tint multipliers (applied on top of base tint)
  // Spring: slightly fresher green
  // Summer: identity (no change)
  // Autumn: warm shift (increase R, decrease G/B)
  // Winter: cool, desaturated
  let sr = 1, sg = 1, sb = 1;

  if (archetype === 0) {
    // Grasses: stronger seasonal response
    const seasonMult: [number, number, number][] = [
      [0.95, 1.08, 0.95], // Spring: vivid green boost
      [1, 1, 1],           // Summer: identity
      [1.35, 0.82, 0.50],  // Autumn: golden
      [1.20, 0.85, 0.70],  // Winter: straw
    ];
    const m0 = seasonMult[s0];
    const m1 = seasonMult[(s0 + 1) % 4];
    sr = m0[0] + (m1[0] - m0[0]) * t;
    sg = m0[1] + (m1[1] - m0[1]) * t;
    sb = m0[2] + (m1[2] - m0[2]) * t;

    // Stronger blend for grasses
    const strength = s0 === Season.Summer ? 0.1 + t * 0.15
      : s0 === Season.Autumn ? 0.5 + t * 0.3
      : s0 === Season.Winter ? 0.65
      : 0.4 * (1 - t);
    sr = lerp(1, sr, strength);
    sg = lerp(1, sg, strength);
    sb = lerp(1, sb, strength);
  } else {
    // Trees and shrubs
    const seasonMult: [number, number, number][] = [
      [0.95, 1.05, 0.95], // Spring
      [1, 1, 1],           // Summer
      [1.5, 0.55, 0.25],   // Autumn: orange-red
      [0.90, 0.75, 0.65],  // Winter: bare/brown
    ];
    const m0 = seasonMult[s0];
    const m1 = seasonMult[(s0 + 1) % 4];
    sr = m0[0] + (m1[0] - m0[0]) * t;
    sg = m0[1] + (m1[1] - m0[1]) * t;
    sb = m0[2] + (m1[2] - m0[2]) * t;

    const strength = s0 === Season.Summer ? 0.05 + t * 0.12
      : s0 === Season.Autumn ? 0.35 + t * 0.4
      : s0 === Season.Winter ? 0.5
      : 0.35 * (1 - t);
    sr = lerp(1, sr, strength);
    sg = lerp(1, sg, strength);
    sb = lerp(1, sb, strength);
  }

  return { r: r * sr, g: g * sg, b: b * sb };
}
