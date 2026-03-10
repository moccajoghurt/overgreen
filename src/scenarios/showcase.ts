import { Scenario, TerrainType } from '../types';
import { MATURITY_HEIGHT } from '../renderer3d/plant-models';
import { SUBTYPE_NAMES } from '../types/subtypes';

/**
 * Plant Showcase — all 40 subtypes on flat soil, each with three health states
 * and both high-LOD and low-LOD mesh versions.
 *
 * Frozen scenario (sim paused on load) for visual review of plant models.
 * Each subtype has two rows of triplets (thriving, stressed, dying):
 *   Top row: high-LOD meshes
 *   Bottom row: low-LOD meshes (forceLow)
 *
 * Layout (80×80 flat soil grid, 5 archetype bands):
 *   Band 0 (y=7,11):   Grasses    — subtypes 0-5, 30, 31
 *   Band 1 (y=21,25):  Trees      — subtypes 6-11, 32, 33
 *   Band 2 (y=35,39):  Shrubs     — subtypes 12-17, 34, 35
 *   Band 3 (y=49,53):  Succulents — subtypes 18-23, 36, 37
 *   Band 4 (y=63,67):  Forbs      — subtypes 24-29, 38, 39
 *
 * Each triplet: 3 cells (spaced 2 apart), 9 cells between triplet starts.
 * Starting x=3, 8 triplets → x spans 3..71.
 */

// Health EMA values for the three states
const EMA_THRIVING = 1.0;
const EMA_STRESSED = 0.6;
const EMA_DYING = 0.3;

// Triplet: 3 plants with different health states, optionally forceLow
function triplet(x: number, y: number, sub: number, low = false) {
  const h = MATURITY_HEIGHT[sub];
  const base = { height: h, energy: 100, ...(low ? { forceLow: true } : {}) };
  return [
    { x, y, healthEMA: EMA_THRIVING, ...base },
    { x: x + 2, y, healthEMA: EMA_STRESSED, ...base },
    { x: x + 4, y, healthEMA: EMA_DYING, ...base },
  ];
}

// Archetype groups: each group has 8 subtypes
const GROUPS: { name: string; subs: number[] }[] = [
  { name: 'Grasses', subs: [0, 1, 2, 3, 4, 5, 30, 31] },
  { name: 'Trees', subs: [6, 7, 8, 9, 10, 11, 32, 33] },
  { name: 'Shrubs', subs: [12, 13, 14, 15, 16, 17, 34, 35] },
  { name: 'Succulents', subs: [18, 19, 20, 21, 22, 23, 36, 37] },
  { name: 'Forbs', subs: [24, 25, 26, 27, 28, 29, 38, 39] },
];

// Grid layout constants
const START_X = 3;         // left margin
const TRIPLET_SPACING = 9; // cells between triplet starts (5 used + 4 gap)
const ROW_Y_HI = [7, 21, 35, 49, 63];  // y position for high-LOD row per archetype
const ROW_Y_LO = [11, 25, 39, 53, 67]; // y position for low-LOD row per archetype

// Generate species with one species per subtype
let nextId = 1;
const species: Scenario['species'] = [];

// Genome lookup: hand-crafted genomes that classify to each target subtype.
// Copied from the original showcase — each genome is tuned to hit its subtype.
const GENOMES: Record<number, { genome: Scenario['species'][0]['genome']; color: Scenario['species'][0]['color'] }> = {
  // Grasses
  0: { genome: { rootPriority: 0.20, heightPriority: 0.01, leafSize: 0.01, seedInvestment: 0.30, seedSize: 0.50, defense: 0.10, woodiness: 0.01, waterStorage: 0.10, longevity: 0.01 }, color: { r: 0.40, g: 0.75, b: 0.25 } },
  1: { genome: { rootPriority: 0.20, heightPriority: 0.99, leafSize: 0.49, seedInvestment: 0.40, seedSize: 0.50, defense: 0.10, woodiness: 0.01, waterStorage: 0.10, longevity: 0.60 }, color: { r: 0.50, g: 0.70, b: 0.15 } },
  2: { genome: { rootPriority: 0.99, heightPriority: 0.45, leafSize: 0.49, seedInvestment: 0.01, seedSize: 0.50, defense: 0.10, woodiness: 0.01, waterStorage: 0.10, longevity: 0.50 }, color: { r: 0.55, g: 0.65, b: 0.20 } },
  3: { genome: { rootPriority: 0.10, heightPriority: 0.70, leafSize: 0.01, seedInvestment: 0.20, seedSize: 0.50, defense: 0.10, woodiness: 0.39, waterStorage: 0.10, longevity: 0.30 }, color: { r: 0.35, g: 0.65, b: 0.10 } },
  4: { genome: { rootPriority: 0.10, heightPriority: 0.05, leafSize: 0.49, seedInvestment: 0.99, seedSize: 0.50, defense: 0.10, woodiness: 0.35, waterStorage: 0.10, longevity: 0.01 }, color: { r: 0.45, g: 0.80, b: 0.30 } },
  5: { genome: { rootPriority: 0.80, heightPriority: 0.30, leafSize: 0.10, seedInvestment: 0.10, seedSize: 0.50, defense: 0.10, woodiness: 0.10, waterStorage: 0.99, longevity: 0.70 }, color: { r: 0.30, g: 0.60, b: 0.35 } },
  30: { genome: { rootPriority: 0.10, heightPriority: 0.80, leafSize: 0.49, seedInvestment: 0.80, seedSize: 0.50, defense: 0.10, woodiness: 0.01, waterStorage: 0.10, longevity: 0.99 }, color: { r: 0.60, g: 0.65, b: 0.40 } },
  31: { genome: { rootPriority: 0.99, heightPriority: 0.10, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.99, woodiness: 0.15, waterStorage: 0.01, longevity: 0.30 }, color: { r: 0.65, g: 0.60, b: 0.30 } },
  // Trees
  6: { genome: { rootPriority: 0.50, heightPriority: 0.30, leafSize: 0.99, seedInvestment: 0.01, seedSize: 0.50, defense: 0.60, woodiness: 0.90, waterStorage: 0.10, longevity: 0.70 }, color: { r: 0.30, g: 0.55, b: 0.15 } },
  7: { genome: { rootPriority: 0.30, heightPriority: 0.01, leafSize: 0.60, seedInvestment: 0.01, seedSize: 0.50, defense: 0.99, woodiness: 0.80, waterStorage: 0.10, longevity: 0.50 }, color: { r: 0.25, g: 0.50, b: 0.20 } },
  8: { genome: { rootPriority: 0.01, heightPriority: 0.99, leafSize: 0.01, seedInvestment: 0.30, seedSize: 0.50, defense: 0.30, woodiness: 0.90, waterStorage: 0.10, longevity: 0.70 }, color: { r: 0.15, g: 0.45, b: 0.15 } },
  9: { genome: { rootPriority: 0.99, heightPriority: 0.40, leafSize: 0.50, seedInvestment: 0.20, seedSize: 0.50, defense: 0.20, woodiness: 0.80, waterStorage: 0.50, longevity: 0.40 }, color: { r: 0.20, g: 0.60, b: 0.10 } },
  10: { genome: { rootPriority: 0.01, heightPriority: 0.99, leafSize: 0.01, seedInvestment: 0.20, seedSize: 0.50, defense: 0.01, woodiness: 0.80, waterStorage: 0.10, longevity: 0.50 }, color: { r: 0.25, g: 0.55, b: 0.25 } },
  11: { genome: { rootPriority: 0.10, heightPriority: 0.50, leafSize: 0.30, seedInvestment: 0.99, seedSize: 0.50, defense: 0.01, woodiness: 0.80, waterStorage: 0.10, longevity: 0.01 }, color: { r: 0.40, g: 0.65, b: 0.30 } },
  32: { genome: { rootPriority: 0.50, heightPriority: 0.85, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.70, woodiness: 0.90, waterStorage: 0.10, longevity: 0.99 }, color: { r: 0.10, g: 0.40, b: 0.20 } },
  33: { genome: { rootPriority: 0.20, heightPriority: 0.20, leafSize: 0.80, seedInvestment: 0.70, seedSize: 0.50, defense: 0.80, woodiness: 0.80, waterStorage: 0.01, longevity: 0.30 }, color: { r: 0.45, g: 0.55, b: 0.10 } },
  // Shrubs
  12: { genome: { rootPriority: 0.40, heightPriority: 0.01, leafSize: 0.70, seedInvestment: 0.01, seedSize: 0.50, defense: 0.80, woodiness: 0.55, waterStorage: 0.10, longevity: 0.70 }, color: { r: 0.20, g: 0.50, b: 0.15 } },
  13: { genome: { rootPriority: 0.20, heightPriority: 0.50, leafSize: 0.50, seedInvestment: 0.70, seedSize: 0.50, defense: 0.01, woodiness: 0.55, waterStorage: 0.10, longevity: 0.01 }, color: { r: 0.50, g: 0.60, b: 0.20 } },
  14: { genome: { rootPriority: 0.20, heightPriority: 0.50, leafSize: 0.99, seedInvestment: 0.20, seedSize: 0.50, defense: 0.20, woodiness: 0.55, waterStorage: 0.01, longevity: 0.30 }, color: { r: 0.35, g: 0.55, b: 0.25 } },
  15: { genome: { rootPriority: 0.60, heightPriority: 0.30, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.99, woodiness: 0.55, waterStorage: 0.10, longevity: 0.40 }, color: { r: 0.45, g: 0.40, b: 0.15 } },
  16: { genome: { rootPriority: 0.50, heightPriority: 0.30, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.01, woodiness: 0.55, waterStorage: 0.54, longevity: 0.20 }, color: { r: 0.55, g: 0.50, b: 0.25 } },
  17: { genome: { rootPriority: 0.99, heightPriority: 0.01, leafSize: 0.30, seedInvestment: 0.10, seedSize: 0.50, defense: 0.40, woodiness: 0.55, waterStorage: 0.40, longevity: 0.40 }, color: { r: 0.25, g: 0.45, b: 0.30 } },
  34: { genome: { rootPriority: 0.20, heightPriority: 0.30, leafSize: 0.70, seedInvestment: 0.99, seedSize: 0.50, defense: 0.01, woodiness: 0.55, waterStorage: 0.10, longevity: 0.60 }, color: { r: 0.65, g: 0.40, b: 0.55 } },
  35: { genome: { rootPriority: 0.30, heightPriority: 0.01, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.70, woodiness: 0.55, waterStorage: 0.10, longevity: 0.99 }, color: { r: 0.50, g: 0.45, b: 0.60 } },
  // Succulents
  18: { genome: { rootPriority: 0.20, heightPriority: 0.99, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.30, woodiness: 0.50, waterStorage: 0.80, longevity: 0.60 }, color: { r: 0.30, g: 0.55, b: 0.25 } },
  19: { genome: { rootPriority: 0.30, heightPriority: 0.01, leafSize: 0.99, seedInvestment: 0.10, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.70, longevity: 0.40 }, color: { r: 0.35, g: 0.60, b: 0.30 } },
  20: { genome: { rootPriority: 0.99, heightPriority: 0.01, leafSize: 0.20, seedInvestment: 0.40, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.70, longevity: 0.40 }, color: { r: 0.45, g: 0.50, b: 0.30 } },
  21: { genome: { rootPriority: 0.01, heightPriority: 0.60, leafSize: 0.20, seedInvestment: 0.80, seedSize: 0.50, defense: 0.80, woodiness: 0.50, waterStorage: 0.60, longevity: 0.30 }, color: { r: 0.40, g: 0.55, b: 0.20 } },
  22: { genome: { rootPriority: 0.01, heightPriority: 0.01, leafSize: 0.20, seedInvestment: 0.70, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.60, longevity: 0.01 }, color: { r: 0.50, g: 0.65, b: 0.50 } },
  23: { genome: { rootPriority: 0.01, heightPriority: 0.01, leafSize: 0.80, seedInvestment: 0.20, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.60, longevity: 0.50 }, color: { r: 0.40, g: 0.60, b: 0.45 } },
  36: { genome: { rootPriority: 0.50, heightPriority: 0.01, leafSize: 0.10, seedInvestment: 0.10, seedSize: 0.50, defense: 0.99, woodiness: 0.50, waterStorage: 0.90, longevity: 0.60 }, color: { r: 0.35, g: 0.50, b: 0.20 } },
  37: { genome: { rootPriority: 0.60, heightPriority: 0.01, leafSize: 0.60, seedInvestment: 0.10, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.60, longevity: 0.99 }, color: { r: 0.30, g: 0.55, b: 0.35 } },
  // Forbs
  24: { genome: { rootPriority: 0.10, heightPriority: 0.01, leafSize: 0.70, seedInvestment: 0.99, seedSize: 0.50, defense: 0.01, woodiness: 0.10, waterStorage: 0.10, longevity: 0.20 }, color: { r: 0.70, g: 0.40, b: 0.55 } },
  25: { genome: { rootPriority: 0.40, heightPriority: 0.99, leafSize: 0.60, seedInvestment: 0.20, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.10, longevity: 0.60 }, color: { r: 0.35, g: 0.60, b: 0.25 } },
  26: { genome: { rootPriority: 0.60, heightPriority: 0.20, leafSize: 0.99, seedInvestment: 0.01, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.20, longevity: 0.80 }, color: { r: 0.20, g: 0.55, b: 0.20 } },
  27: { genome: { rootPriority: 0.01, heightPriority: 0.60, leafSize: 0.50, seedInvestment: 0.80, seedSize: 0.50, defense: 0.01, woodiness: 0.10, waterStorage: 0.01, longevity: 0.60 }, color: { r: 0.30, g: 0.50, b: 0.30 } },
  28: { genome: { rootPriority: 0.60, heightPriority: 0.01, leafSize: 0.50, seedInvestment: 0.60, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.10, longevity: 0.01 }, color: { r: 0.35, g: 0.65, b: 0.30 } },
  29: { genome: { rootPriority: 0.70, heightPriority: 0.01, leafSize: 0.50, seedInvestment: 0.01, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.50, longevity: 0.60 }, color: { r: 0.25, g: 0.50, b: 0.25 } },
  38: { genome: { rootPriority: 0.60, heightPriority: 0.50, leafSize: 0.80, seedInvestment: 0.30, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.80, longevity: 0.20 }, color: { r: 0.30, g: 0.55, b: 0.35 } },
  39: { genome: { rootPriority: 0.10, heightPriority: 0.20, leafSize: 0.50, seedInvestment: 0.70, seedSize: 0.50, defense: 0.70, woodiness: 0.10, waterStorage: 0.01, longevity: 0.01 }, color: { r: 0.65, g: 0.55, b: 0.25 } },
};

for (let gi = 0; gi < GROUPS.length; gi++) {
  const group = GROUPS[gi];
  const yHi = ROW_Y_HI[gi];
  const yLo = ROW_Y_LO[gi];
  for (let si = 0; si < group.subs.length; si++) {
    const sub = group.subs[si];
    const x = START_X + si * TRIPLET_SPACING;
    const data = GENOMES[sub];
    species.push({
      id: nextId++,
      name: SUBTYPE_NAMES[sub],
      genome: data.genome,
      color: data.color,
      subtype: sub,
      placements: [
        ...triplet(x, yHi, sub, false),
        ...triplet(x, yLo, sub, true),
      ],
    });
  }
}

export const showcase: Scenario = {
  id: 'showcase',
  name: 'Plant Showcase',
  description: 'All 40 plant subtypes on flat soil — thriving/stressed/dying × high/low LOD.',
  size: 80,
  defaultTerrain: TerrainType.Soil,
  defaultElevation: 0.5,
  frozen: true,
  cells: [],
  species,
};
