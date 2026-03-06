import { Season, Genome } from '../types';
import { RendererState, plantHash, computeGrassSilhouette } from './state';
import { fruitColor, flowerColor } from './plant-colors';

// ── Reusable color output ──
const _fc = { cr: 0, cg: 0, cb: 0 };

export interface FloralFactors {
  fruitAlpha: number;
  fruitRipeness: number;
  grassSeedAlpha: number;
  grassSeedColorfulness: number; // 0 = white (spring), 1 = vivid genome color (summer)
}

/** Compute seasonal visibility factors for fruit and grass seed heads. */
export function computeFloralFactors(env: { season: Season; seasonProgress: number }): FloralFactors {
  const s = env.season;
  const p = env.seasonProgress;

  let fruitAlpha = 0;
  let fruitRipeness = 0;
  let grassSeedAlpha = 0;
  let grassSeedColorfulness = 0;

  if (s === Season.Spring) {
    // Grass flowers: fade in 0.0-0.3, full 0.3-1.0 — white
    grassSeedAlpha = p < 0.3 ? p / 0.3 : 1.0;
    grassSeedColorfulness = 0;
  } else if (s === Season.Summer) {
    // Fruit on trees: fade in 0.0-0.3, full 0.3-1.0
    fruitAlpha = p < 0.3 ? p / 0.3 : 1.0;
    fruitRipeness = p < 0.3 ? 0 : (p - 0.3) / 0.7 * 0.6;
    // Grass flowers: full, colorful
    grassSeedAlpha = 1.0;
    grassSeedColorfulness = 1.0;
  } else if (s === Season.Autumn) {
    // Fruit on trees: full 0.0-0.7, fade out 0.7-1.0; ripen 0.6→1.0
    fruitAlpha = p < 0.7 ? 1.0 : 1.0 - (p - 0.7) / 0.3;
    fruitRipeness = 0.6 + Math.min(0.4, p / 0.7 * 0.4);
    // Grass flowers: full 0.0-0.5, fade out 0.5-1.0 — still colorful
    grassSeedAlpha = p < 0.5 ? 1.0 : 1.0 - (p - 0.5) / 0.5;
    grassSeedColorfulness = 1.0;
  }
  // Winter: everything is 0

  return { fruitAlpha, fruitRipeness, grassSeedAlpha, grassSeedColorfulness };
}

export interface CanopyTip { x: number; y: number; z: number; ry: number }

/** Write fruit instances at canopy tip positions. Returns instance count written. */
export function writeFruit(
  state: RendererState,
  idx: number,
  plantId: number,
  canopyTips: CanopyTip[],
  genome: Genome,
  fertility: number,
  fruitAlpha: number,
  fruitRipeness: number,
  mtx: Float32Array,
  clr: Float32Array,
): number {
  const { dummy } = state;
  let written = 0;

  const tipCount = canopyTips.length;
  if (tipCount === 0) return 0;

  const maxDecos = Math.min(4, Math.max(1, Math.round(genome.seedInvestment * 4 * fertility)));

  for (let i = 0; i < maxDecos && i < tipCount; i++) {
    const tip = canopyTips[i % tipCount];

    const ox = (plantHash(plantId, 800 + i * 3) - 0.5) * 0.35;
    const oz = (plantHash(plantId, 802 + i * 3) - 0.5) * 0.35;
    const surfaceY = tip.y + tip.ry * 0.45;

    fruitColor(genome, fruitRipeness, _fc);
    const fruitScale = (0.4 + genome.seedSize * 0.5) * fruitAlpha;

    dummy.position.set(tip.x + ox, surfaceY, tip.z + oz);
    dummy.scale.set(fruitScale, fruitScale, fruitScale);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    dummy.matrix.toArray(mtx, (idx + written) * 16);
    const ci = (idx + written) * 3;
    clr[ci]     = _fc.cr;
    clr[ci + 1] = _fc.cg;
    clr[ci + 2] = _fc.cb;
    written++;
  }

  return written;
}

/** Write grass flower instances at tuft tip positions. Returns instance count written. */
export function writeGrassFlowers(
  state: RendererState,
  idx: number,
  plantId: number,
  wx: number, wz: number, baseY: number,
  gsil: ReturnType<typeof computeGrassSilhouette>,
  genome: Genome,
  grassSeedAlpha: number,
  grassSeedColorfulness: number,
  scale: number,
  mtx: Float32Array,
  clr: Float32Array,
): number {
  const { dummy } = state;
  let written = 0;

  // Place flowers on the 1-2 tallest tufts
  const maxHeads = Math.min(2, Math.max(1, Math.round(genome.seedInvestment * 2.5)));

  // Replicate grass tuft position math (same as writeGrassTufts)
  const tufts: { ox: number; oz: number; h: number; c: number }[] = [];
  for (let c = 0; c < gsil.clumpCount; c++) {
    const ox = (plantHash(plantId, 100 + c * 3) - 0.5) * 0.50;
    const oz = (plantHash(plantId, 200 + c * 3) - 0.5) * 0.50;
    const hVar = 0.80 + plantHash(plantId, 300 + c) * 0.35;
    tufts.push({ ox, oz, h: gsil.height * scale * hVar, c });
  }

  tufts.sort((a, b) => b.h - a.h);

  for (let i = 0; i < maxHeads && i < tufts.length; i++) {
    const tuft = tufts[i];
    const seedScale = (0.5 + genome.seedInvestment * 0.6) * grassSeedAlpha;

    dummy.position.set(
      wx + tuft.ox,
      baseY + tuft.h + 0.02,
      wz + tuft.oz,
    );
    dummy.scale.set(seedScale, seedScale * 1.3, seedScale);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();

    dummy.matrix.toArray(mtx, (idx + written) * 16);
    const ci = (idx + written) * 3;

    if (grassSeedColorfulness < 0.01) {
      // Spring: white blossoms
      clr[ci]     = 0.95;
      clr[ci + 1] = 0.92;
      clr[ci + 2] = 0.90;
    } else {
      // Summer/Autumn: vivid genome-driven color
      flowerColor(genome, _fc);
      clr[ci]     = _fc.cr;
      clr[ci + 1] = _fc.cg;
      clr[ci + 2] = _fc.cb;
    }
    written++;
  }

  return written;
}
