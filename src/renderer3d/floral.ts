import { Season } from '../types';

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
