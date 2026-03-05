import { Genome, Season } from '../types';
import { RendererState, lerp } from './state';

// ── Reusable output objects (avoid per-plant allocations in hot path) ──
export const _clr = { cr: 0, cg: 0, cb: 0, tr: 0, tg: 0, tb: 0 };
export const _season = { cr: 0, cg: 0, cb: 0 };

export function naturalCanopyColor(genome: Genome, out: { cr: number; cg: number; cb: number }) {
  const { rootPriority, heightPriority, leafSize, seedInvestment } = genome;

  // Compute normalized dominance for nonlinear strategy accents
  const sum = rootPriority + heightPriority + leafSize + seedInvestment + 0.01;
  const rDom = rootPriority / sum;
  const hDom = heightPriority / sum;
  const sDom = seedInvestment / sum;

  // Base: mid-forest green
  let r = 0.18;
  let g = 0.40;
  let b = 0.14;

  // leafSize high → bright, lush, saturated emerald green
  r += leafSize * 0.02;
  g += leafSize * 0.25;
  b += leafSize * 0.04;

  // heightPriority high → dark blue-green (conifer needles)
  r -= heightPriority * 0.08;
  g -= heightPriority * 0.12;
  b += heightPriority * 0.08;

  // rootPriority high → warm olive / khaki
  r += rootPriority * 0.14;
  g += rootPriority * 0.02;
  b -= rootPriority * 0.06;

  // seedInvestment high → light yellow-green / silver-green
  r += seedInvestment * 0.10;
  g += seedInvestment * 0.08;
  b -= seedInvestment * 0.04;

  // seedSize high → warm amber shift (heavy fruit-bearing)
  r += genome.seedSize * 0.04;
  g += genome.seedSize * 0.02;
  b -= genome.seedSize * 0.02;

  // Nonlinear strategy accents (kick in when a gene is clearly dominant)
  if (hDom > 0.30) {
    const strength = (hDom - 0.30) * 2.0;
    r -= strength * 0.06;
    g -= strength * 0.05;
    b += strength * 0.10;
  }
  if (rDom > 0.30) {
    const strength = (rDom - 0.30) * 2.0;
    r += strength * 0.08;
    g += strength * 0.04;
    b -= strength * 0.04;
  }
  if (sDom > 0.30) {
    const strength = (sDom - 0.30) * 2.0;
    r += strength * 0.06;
    g += strength * 0.10;
    b += strength * 0.06;
  }

  out.cr = Math.max(0.06, Math.min(0.45, r));
  out.cg = Math.max(0.18, Math.min(0.72, g));
  out.cb = Math.max(0.04, Math.min(0.30, b));
}

export function naturalTrunkColor(genome: Genome, out: { tr: number; tg: number; tb: number }) {
  const { rootPriority, heightPriority, leafSize, seedInvestment } = genome;
  // Base: bark brown
  let r = 0.28;
  let g = 0.18;
  let b = 0.10;

  // rootPriority high → very dark, rich brown (massive ancient wood)
  r -= rootPriority * 0.10;
  g -= rootPriority * 0.08;
  b -= rootPriority * 0.04;

  // heightPriority high → pale, silvery-gray bark (birch/aspen)
  r += heightPriority * 0.14;
  g += heightPriority * 0.14;
  b += heightPriority * 0.12;

  // leafSize high → warm, mossy bark
  g += leafSize * 0.06;
  r += leafSize * 0.03;

  // seedInvestment high → reddish-brown papery bark (cherry/madrone)
  r += seedInvestment * 0.10;
  g -= seedInvestment * 0.02;
  b -= seedInvestment * 0.02;

  // defense high → dark charcoal-grey bark (thick, armored)
  r -= genome.defense * 0.12;
  g -= genome.defense * 0.08;
  b -= genome.defense * 0.02;

  out.tr = Math.max(0.12, Math.min(0.50, r));
  out.tg = Math.max(0.08, Math.min(0.38, g));
  out.tb = Math.max(0.04, Math.min(0.28, b));
}

export function naturalGrassColor(genome: Genome, out: { cr: number; cg: number; cb: number }) {
  const { rootPriority, heightPriority, leafSize, seedInvestment } = genome;

  // Base: bright grass green
  let r = 0.22;
  let g = 0.55;
  let b = 0.12;

  // leafSize high → vivid emerald
  r -= leafSize * 0.04;
  g += leafSize * 0.15;
  b += leafSize * 0.03;

  // rootPriority high → golden/dry
  r += rootPriority * 0.18;
  g -= rootPriority * 0.08;
  b -= rootPriority * 0.06;

  // seedInvestment high → pale yellow-green (meadow with seed heads)
  r += seedInvestment * 0.12;
  g += seedInvestment * 0.06;
  b -= seedInvestment * 0.04;

  // seedSize high → warm golden shift (heavy seed heads)
  r += genome.seedSize * 0.06;
  g -= genome.seedSize * 0.02;

  // heightPriority high → darker blue-green (tall fescue)
  r -= heightPriority * 0.06;
  g -= heightPriority * 0.04;
  b += heightPriority * 0.06;

  out.cr = Math.max(0.10, Math.min(0.55, r));
  out.cg = Math.max(0.30, Math.min(0.80, g));
  out.cb = Math.max(0.04, Math.min(0.25, b));
}

const GRASS_SEASON_TARGETS = [
  [0.28, 0.62, 0.14], // Spring: vivid green
  [0, 0, 0],          // Summer: identity (filled per call)
  [0.65, 0.45, 0.12], // Autumn: golden
  [0.50, 0.42, 0.25], // Winter: straw
] as const;

export function seasonalGrassColor(
  cr: number, cg: number, cb: number,
  env: { season: Season; seasonProgress: number },
  out: { cr: number; cg: number; cb: number },
): void {
  const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;
  const s0 = env.season;
  const s1 = (env.season + 1) % 4;
  const c0r = s0 === 1 ? cr : GRASS_SEASON_TARGETS[s0][0];
  const c0g = s0 === 1 ? cg : GRASS_SEASON_TARGETS[s0][1];
  const c0b = s0 === 1 ? cb : GRASS_SEASON_TARGETS[s0][2];
  const c1r = s1 === 1 ? cr : GRASS_SEASON_TARGETS[s1][0];
  const c1g = s1 === 1 ? cg : GRASS_SEASON_TARGETS[s1][1];
  const c1b = s1 === 1 ? cb : GRASS_SEASON_TARGETS[s1][2];
  const tr = c0r + (c1r - c0r) * t;
  const tg = c0g + (c1g - c0g) * t;
  const tb = c0b + (c1b - c0b) * t;

  // Grass has stronger seasonal shifts than trees
  let blendStrength: number;
  if (env.season === Season.Summer) {
    blendStrength = 0.05 + t * 0.20;
  } else if (env.season === Season.Autumn) {
    blendStrength = 0.8 * t + 0.3;
  } else if (env.season === Season.Winter) {
    blendStrength = 0.75;
  } else {
    blendStrength = 0.6 * (1 - t);
  }

  out.cr = lerp(cr, tr, blendStrength);
  out.cg = lerp(cg, tg, blendStrength);
  out.cb = lerp(cb, tb, blendStrength);
}

/** Seasonal color targets (constant, no need to allocate per call) */
const SEASON_TARGETS = [
  [0.30, 0.55, 0.15], // Spring: fresh green
  [0, 0, 0],          // Summer: placeholder (identity — filled per call)
  [0.70, 0.18, 0.04], // Autumn: vivid orange-red
  [0.35, 0.28, 0.20], // Winter: gray-brown bark
] as const;

export function seasonalCanopyColor(
  cr: number, cg: number, cb: number,
  env: { season: Season; seasonProgress: number },
  out: { cr: number; cg: number; cb: number },
): void {
  const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;

  const s0 = env.season;
  const s1 = (env.season + 1) % 4;
  const c0r = s0 === 1 ? cr : SEASON_TARGETS[s0][0];
  const c0g = s0 === 1 ? cg : SEASON_TARGETS[s0][1];
  const c0b = s0 === 1 ? cb : SEASON_TARGETS[s0][2];
  const c1r = s1 === 1 ? cr : SEASON_TARGETS[s1][0];
  const c1g = s1 === 1 ? cg : SEASON_TARGETS[s1][1];
  const c1b = s1 === 1 ? cb : SEASON_TARGETS[s1][2];
  const tr = c0r + (c1r - c0r) * t;
  const tg = c0g + (c1g - c0g) * t;
  const tb = c0b + (c1b - c0b) * t;

  let blendStrength: number;
  if (env.season === Season.Summer) {
    blendStrength = 0.05 + t * 0.15;
  } else if (env.season === Season.Autumn) {
    blendStrength = 0.7 * t + 0.25;
  } else if (env.season === Season.Winter) {
    blendStrength = 0.6;
  } else {
    blendStrength = 0.5 * (1 - t);
  }

  out.cr = lerp(cr, tr, blendStrength);
  out.cg = lerp(cg, tg, blendStrength);
  out.cb = lerp(cb, tb, blendStrength);
}

/**
 * Get base plant colors, using per-plant cache to avoid recomputation.
 * Cache is invalidated when colorMode changes.
 */
export function getPlantColors(state: RendererState, plantId: number, speciesId: number, genome: Genome, isGrass = false) {
  const cached = state.plantColorCache.get(plantId);
  if (cached) return cached;

  if (state.colorMode !== 'species') {
    if (isGrass) {
      naturalGrassColor(genome, _clr);
      // Grass base color: darker version of blade color
      _clr.tr = _clr.cr * 0.6;
      _clr.tg = _clr.cg * 0.5;
      _clr.tb = _clr.cb * 0.4;
    } else {
      naturalCanopyColor(genome, _clr);
      naturalTrunkColor(genome, _clr as any);
    }
  } else {
    const sc = state.world.speciesColors.get(speciesId);
    const gr = 0.2 + genome.rootPriority * 0.6;
    const gg = 0.3 + genome.leafSize * 0.5;
    const gb = 0.2 + genome.heightPriority * 0.6;
    _clr.cr = sc ? sc.r * 0.7 + gr * 0.3 : gr;
    _clr.cg = sc ? sc.g * 0.7 + gg * 0.3 : gg;
    _clr.cb = sc ? sc.b * 0.7 + gb * 0.3 : gb;
    _clr.tr = 0.28 * 0.85 + _clr.cr * 0.15;
    _clr.tg = 0.18 * 0.85 + _clr.cg * 0.15;
    _clr.tb = 0.10 * 0.85 + _clr.cb * 0.15;
  }

  const entry = { cr: _clr.cr, cg: _clr.cg, cb: _clr.cb, tr: _clr.tr, tg: _clr.tg, tb: _clr.tb };
  state.plantColorCache.set(plantId, entry);
  return entry;
}
