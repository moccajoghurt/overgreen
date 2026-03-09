import { Scenario, TerrainType } from '../types';
import { genesis } from './genesis';
import { MATURITY_HEIGHT } from '../renderer3d/plant-models';

/**
 * Plant Showcase — all 40 subtypes at maturity height on the Genesis terrain.
 *
 * Frozen scenario (sim paused on load) for visual review of plant models
 * in context. Each species has a hand-crafted genome that classifies to
 * its target subtype, placed in terrain appropriate to its archetype.
 *
 * Layout (80×80 Genesis grid):
 *   Trees (6-11, 32-33):      3×2 blocks along NW wadi corridor (y≈14–20, x≈22–39)
 *   Shrubs (12-17, 34-35):    3×2 blocks on escarpment flanks (y≈34–44, x≈16–24)
 *   Succulents (18-23, 36-37): 3×2 blocks in east desert (y≈40–53, x≈68–77)
 *   Grasses (0-5, 30-31):     5×3 blocks on flat SE desert (y≈58–64, x≈55–77)
 *   Forbs (24-29, 38-39):     Mixed with grass on flat desert (y≈66–76, x≈55–77)
 *                              + hill corner samples (y≈7–11, x≈35–42)
 *                              + wetland samples (y≈52–56, x≈19–24)
 */

// Shorthand for placement with maturity height and survival energy
function p(x: number, y: number, subtypeIndex: number) {
  return { x, y, height: MATURITY_HEIGHT[subtypeIndex], energy: 100 };
}

// ── Forb mixing ──
// Forb subtypes: Wildflower(24), Tall Herb(25), Fern(26), Vine(27),
//                Ground Cover(28), Moss(29), Tropical Herb(38), Desert Annual(39)
const FORB_SUBS = [24, 25, 26, 27, 28, 29, 38, 39] as const;
const GRASS_FILL = 0; // Turfgrass subtype for filler

// Single-forb 5×5 patch: ~40% forb, ~60% grass filler
function singleForbPatch(sx: number, sy: number, forbSub: number, seed: number) {
  const forb: ReturnType<typeof p>[] = [];
  const grass: ReturnType<typeof p>[] = [];
  for (let dy = 0; dy < 5; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      const x = sx + dx, y = sy + dy;
      if (((x * 7 + y * 13 + seed * 31) >>> 0) % 5 < 2) {
        forb.push(p(x, y, forbSub));
      } else {
        grass.push(p(x, y, GRASS_FILL));
      }
    }
  }
  return { forb, grass };
}

// Multi-forb patch: all 8 forb types + grass in one area (~50/50)
function multiForbPatch(sx: number, sy: number, w: number, h: number, seed: number) {
  const n = FORB_SUBS.length;
  const forbs = new Map<number, ReturnType<typeof p>[]>();
  for (const s of FORB_SUBS) forbs.set(s, []);
  const grass: ReturnType<typeof p>[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = sx + dx, y = sy + dy;
      const bucket = ((x * 11 + y * 17 + seed * 37) >>> 0) % (n * 2);
      if (bucket < n) {
        forbs.get(FORB_SUBS[bucket])!.push(p(x, y, FORB_SUBS[bucket]));
      } else {
        grass.push(p(x, y, GRASS_FILL));
      }
    }
  }
  return { forbs, grass };
}

// Pre-compute: 8 flat desert patches (one per forb, mixed with grass)
const flat = [
  singleForbPatch(55, 66, 24, 1),  // Wildflower
  singleForbPatch(61, 66, 25, 2),  // Tall Herb
  singleForbPatch(67, 66, 26, 3),  // Fern
  singleForbPatch(73, 66, 27, 4),  // Vine
  singleForbPatch(55, 72, 28, 5),  // Ground Cover
  singleForbPatch(61, 72, 29, 6),  // Moss
  singleForbPatch(67, 72, 38, 7),  // Tropical Herb
  singleForbPatch(73, 72, 39, 8),  // Desert Annual
];

// Pre-compute: hill corner (NE highlands) — all forbs mixed, 8×5 cells
const hill = multiForbPatch(35, 7, 8, 5, 99);

// Pre-compute: wetland (delta island) — all forbs mixed, 6×5 cells
const wet = multiForbPatch(19, 52, 6, 5, 77);

// All filler grass across forb areas → added to Turfgrass placements
const fillerGrass = [
  ...flat.flatMap(fp => fp.grass),
  ...hill.grass,
  ...wet.grass,
];

export const showcase: Scenario = {
  id: 'showcase',
  name: 'Plant Showcase',
  description: 'All 40 plant subtypes at maturity height on Genesis terrain. Frozen for visual review.',
  size: genesis.size,
  defaultTerrain: genesis.defaultTerrain,
  defaultElevation: genesis.defaultElevation,
  defaultZone: genesis.defaultZone,
  frozen: true,
  cells: genesis.cells,
  species: [
    // ── Grasses (subtypes 0-5, 30-31) — flat SE desert, 5×3 blocks ──
    // Turfgrass also serves as filler in forb mix areas

    {
      id: 1, name: 'Turfgrass',
      genome: { rootPriority: 0.20, heightPriority: 0.01, leafSize: 0.01, seedInvestment: 0.30, seedSize: 0.50, defense: 0.10, woodiness: 0.01, waterStorage: 0.10, longevity: 0.01 },
      color: { r: 0.40, g: 0.75, b: 0.25 },
      placements: [
        p(55, 58, 0), p(56, 58, 0), p(57, 58, 0), p(58, 58, 0), p(59, 58, 0),
        p(55, 59, 0), p(56, 59, 0), p(57, 59, 0), p(58, 59, 0), p(59, 59, 0),
        p(55, 60, 0), p(56, 60, 0), p(57, 60, 0), p(58, 60, 0), p(59, 60, 0),
        ...fillerGrass,
      ],
    },
    {
      id: 2, name: 'Tallgrass',
      genome: { rootPriority: 0.20, heightPriority: 0.99, leafSize: 0.49, seedInvestment: 0.40, seedSize: 0.50, defense: 0.10, woodiness: 0.01, waterStorage: 0.10, longevity: 0.60 },
      color: { r: 0.50, g: 0.70, b: 0.15 },
      placements: [
        p(61, 58, 1), p(62, 58, 1), p(63, 58, 1), p(64, 58, 1), p(65, 58, 1),
        p(61, 59, 1), p(62, 59, 1), p(63, 59, 1), p(64, 59, 1), p(65, 59, 1),
        p(61, 60, 1), p(62, 60, 1), p(63, 60, 1), p(64, 60, 1), p(65, 60, 1),
      ],
    },
    {
      id: 3, name: 'Bunchgrass',
      genome: { rootPriority: 0.99, heightPriority: 0.45, leafSize: 0.49, seedInvestment: 0.01, seedSize: 0.50, defense: 0.10, woodiness: 0.01, waterStorage: 0.10, longevity: 0.50 },
      color: { r: 0.55, g: 0.65, b: 0.20 },
      placements: [
        p(67, 58, 2), p(68, 58, 2), p(69, 58, 2), p(70, 58, 2), p(71, 58, 2),
        p(67, 59, 2), p(68, 59, 2), p(69, 59, 2), p(70, 59, 2), p(71, 59, 2),
        p(67, 60, 2), p(68, 60, 2), p(69, 60, 2), p(70, 60, 2), p(71, 60, 2),
      ],
    },
    {
      id: 4, name: 'Bamboo',
      genome: { rootPriority: 0.10, heightPriority: 0.70, leafSize: 0.01, seedInvestment: 0.20, seedSize: 0.50, defense: 0.10, woodiness: 0.39, waterStorage: 0.10, longevity: 0.30 },
      color: { r: 0.35, g: 0.65, b: 0.10 },
      placements: [
        p(73, 58, 3), p(74, 58, 3), p(75, 58, 3), p(76, 58, 3), p(77, 58, 3),
        p(73, 59, 3), p(74, 59, 3), p(75, 59, 3), p(76, 59, 3), p(77, 59, 3),
        p(73, 60, 3), p(74, 60, 3), p(75, 60, 3), p(76, 60, 3), p(77, 60, 3),
      ],
    },
    {
      id: 5, name: 'Spreading Grass',
      genome: { rootPriority: 0.10, heightPriority: 0.05, leafSize: 0.49, seedInvestment: 0.99, seedSize: 0.50, defense: 0.10, woodiness: 0.35, waterStorage: 0.10, longevity: 0.01 },
      color: { r: 0.45, g: 0.80, b: 0.30 },
      placements: [
        p(55, 62, 4), p(56, 62, 4), p(57, 62, 4), p(58, 62, 4), p(59, 62, 4),
        p(55, 63, 4), p(56, 63, 4), p(57, 63, 4), p(58, 63, 4), p(59, 63, 4),
        p(55, 64, 4), p(56, 64, 4), p(57, 64, 4), p(58, 64, 4), p(59, 64, 4),
      ],
    },
    {
      id: 6, name: 'Sedge',
      genome: { rootPriority: 0.80, heightPriority: 0.30, leafSize: 0.10, seedInvestment: 0.10, seedSize: 0.50, defense: 0.10, woodiness: 0.10, waterStorage: 0.99, longevity: 0.70 },
      color: { r: 0.30, g: 0.60, b: 0.35 },
      placements: [
        p(61, 62, 5), p(62, 62, 5), p(63, 62, 5), p(64, 62, 5), p(65, 62, 5),
        p(61, 63, 5), p(62, 63, 5), p(63, 63, 5), p(64, 63, 5), p(65, 63, 5),
        p(61, 64, 5), p(62, 64, 5), p(63, 64, 5), p(64, 64, 5), p(65, 64, 5),
      ],
    },
    {
      id: 7, name: 'Pampas Grass',
      genome: { rootPriority: 0.10, heightPriority: 0.80, leafSize: 0.49, seedInvestment: 0.80, seedSize: 0.50, defense: 0.10, woodiness: 0.01, waterStorage: 0.10, longevity: 0.99 },
      color: { r: 0.60, g: 0.65, b: 0.40 },
      placements: [
        p(67, 62, 30), p(68, 62, 30), p(69, 62, 30), p(70, 62, 30), p(71, 62, 30),
        p(67, 63, 30), p(68, 63, 30), p(69, 63, 30), p(70, 63, 30), p(71, 63, 30),
        p(67, 64, 30), p(68, 64, 30), p(69, 64, 30), p(70, 64, 30), p(71, 64, 30),
      ],
    },
    {
      id: 8, name: 'Desert Grass',
      genome: { rootPriority: 0.99, heightPriority: 0.10, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.99, woodiness: 0.15, waterStorage: 0.01, longevity: 0.30 },
      color: { r: 0.65, g: 0.60, b: 0.30 },
      placements: [
        p(73, 62, 31), p(74, 62, 31), p(75, 62, 31), p(76, 62, 31), p(77, 62, 31),
        p(73, 63, 31), p(74, 63, 31), p(75, 63, 31), p(76, 63, 31), p(77, 63, 31),
        p(73, 64, 31), p(74, 64, 31), p(75, 64, 31), p(76, 64, 31), p(77, 64, 31),
      ],
    },

    // ── Trees (subtypes 6-11, 32-33) — 3×2 blocks along NW wadi corridor ──

    {
      id: 9, name: 'Oak',
      genome: { rootPriority: 0.50, heightPriority: 0.30, leafSize: 0.99, seedInvestment: 0.01, seedSize: 0.50, defense: 0.60, woodiness: 0.90, waterStorage: 0.10, longevity: 0.70 },
      color: { r: 0.30, g: 0.55, b: 0.15 },
      placements: [
        p(22, 14, 6), p(23, 14, 6), p(24, 14, 6),
        p(22, 15, 6), p(23, 15, 6), p(24, 15, 6),
      ],
    },
    {
      id: 10, name: 'Magnolia',
      genome: { rootPriority: 0.30, heightPriority: 0.01, leafSize: 0.60, seedInvestment: 0.01, seedSize: 0.50, defense: 0.99, woodiness: 0.80, waterStorage: 0.10, longevity: 0.50 },
      color: { r: 0.25, g: 0.50, b: 0.20 },
      placements: [
        p(27, 14, 7), p(28, 14, 7), p(29, 14, 7),
        p(27, 15, 7), p(28, 15, 7), p(29, 15, 7),
      ],
    },
    {
      id: 11, name: 'Conifer',
      genome: { rootPriority: 0.01, heightPriority: 0.99, leafSize: 0.01, seedInvestment: 0.30, seedSize: 0.50, defense: 0.30, woodiness: 0.90, waterStorage: 0.10, longevity: 0.70 },
      color: { r: 0.15, g: 0.45, b: 0.15 },
      placements: [
        p(32, 14, 8), p(33, 14, 8), p(34, 14, 8),
        p(32, 15, 8), p(33, 15, 8), p(34, 15, 8),
      ],
    },
    {
      id: 12, name: 'Tropical Tree',
      genome: { rootPriority: 0.99, heightPriority: 0.40, leafSize: 0.50, seedInvestment: 0.20, seedSize: 0.50, defense: 0.20, woodiness: 0.80, waterStorage: 0.50, longevity: 0.40 },
      color: { r: 0.20, g: 0.60, b: 0.10 },
      placements: [
        p(37, 14, 9), p(38, 14, 9), p(39, 14, 9),
        p(37, 15, 9), p(38, 15, 9), p(39, 15, 9),
      ],
    },
    {
      id: 13, name: 'Palm',
      genome: { rootPriority: 0.01, heightPriority: 0.99, leafSize: 0.01, seedInvestment: 0.20, seedSize: 0.50, defense: 0.01, woodiness: 0.80, waterStorage: 0.10, longevity: 0.50 },
      color: { r: 0.25, g: 0.55, b: 0.25 },
      placements: [
        p(22, 19, 10), p(23, 19, 10), p(24, 19, 10),
        p(22, 20, 10), p(23, 20, 10), p(24, 20, 10),
      ],
    },
    {
      id: 14, name: 'Birch',
      genome: { rootPriority: 0.10, heightPriority: 0.50, leafSize: 0.30, seedInvestment: 0.99, seedSize: 0.50, defense: 0.01, woodiness: 0.80, waterStorage: 0.10, longevity: 0.01 },
      color: { r: 0.40, g: 0.65, b: 0.30 },
      placements: [
        p(27, 19, 11), p(28, 19, 11), p(29, 19, 11),
        p(27, 20, 11), p(28, 20, 11), p(29, 20, 11),
      ],
    },
    {
      id: 15, name: 'Cypress',
      genome: { rootPriority: 0.50, heightPriority: 0.85, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.70, woodiness: 0.90, waterStorage: 0.10, longevity: 0.99 },
      color: { r: 0.10, g: 0.40, b: 0.20 },
      placements: [
        p(32, 19, 32), p(33, 19, 32), p(34, 19, 32),
        p(32, 20, 32), p(33, 20, 32), p(34, 20, 32),
      ],
    },
    {
      id: 16, name: 'Acacia',
      genome: { rootPriority: 0.20, heightPriority: 0.20, leafSize: 0.80, seedInvestment: 0.70, seedSize: 0.50, defense: 0.80, woodiness: 0.80, waterStorage: 0.01, longevity: 0.30 },
      color: { r: 0.45, g: 0.55, b: 0.10 },
      placements: [
        p(37, 19, 33), p(38, 19, 33), p(39, 19, 33),
        p(37, 20, 33), p(38, 20, 33), p(39, 20, 33),
      ],
    },

    // ── Shrubs (subtypes 12-17, 34-35) — 3×2 blocks on escarpment flanks ──

    {
      id: 17, name: 'Evergreen Shrub',
      genome: { rootPriority: 0.40, heightPriority: 0.01, leafSize: 0.70, seedInvestment: 0.01, seedSize: 0.50, defense: 0.80, woodiness: 0.55, waterStorage: 0.10, longevity: 0.70 },
      color: { r: 0.20, g: 0.50, b: 0.15 },
      placements: [
        p(16, 34, 12), p(17, 34, 12), p(18, 34, 12),
        p(16, 35, 12), p(17, 35, 12), p(18, 35, 12),
      ],
    },
    {
      id: 18, name: 'Deciduous Shrub',
      genome: { rootPriority: 0.20, heightPriority: 0.50, leafSize: 0.50, seedInvestment: 0.70, seedSize: 0.50, defense: 0.01, woodiness: 0.55, waterStorage: 0.10, longevity: 0.01 },
      color: { r: 0.50, g: 0.60, b: 0.20 },
      placements: [
        p(22, 34, 13), p(23, 34, 13), p(24, 34, 13),
        p(22, 35, 13), p(23, 35, 13), p(24, 35, 13),
      ],
    },
    {
      id: 19, name: 'Mediterranean Shrub',
      genome: { rootPriority: 0.20, heightPriority: 0.50, leafSize: 0.99, seedInvestment: 0.20, seedSize: 0.50, defense: 0.20, woodiness: 0.55, waterStorage: 0.01, longevity: 0.30 },
      color: { r: 0.35, g: 0.55, b: 0.25 },
      placements: [
        p(16, 37, 14), p(17, 37, 14), p(18, 37, 14),
        p(16, 38, 14), p(17, 38, 14), p(18, 38, 14),
      ],
    },
    {
      id: 20, name: 'Thorny Shrub',
      genome: { rootPriority: 0.60, heightPriority: 0.30, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.99, woodiness: 0.55, waterStorage: 0.10, longevity: 0.40 },
      color: { r: 0.45, g: 0.40, b: 0.15 },
      placements: [
        p(22, 37, 15), p(23, 37, 15), p(24, 37, 15),
        p(22, 38, 15), p(23, 38, 15), p(24, 38, 15),
      ],
    },
    {
      id: 21, name: 'Desert Shrub',
      genome: { rootPriority: 0.50, heightPriority: 0.30, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.01, woodiness: 0.55, waterStorage: 0.54, longevity: 0.20 },
      color: { r: 0.55, g: 0.50, b: 0.25 },
      placements: [
        p(16, 40, 16), p(17, 40, 16), p(18, 40, 16),
        p(16, 41, 16), p(17, 41, 16), p(18, 41, 16),
      ],
    },
    {
      id: 22, name: 'Mangrove',
      genome: { rootPriority: 0.99, heightPriority: 0.01, leafSize: 0.30, seedInvestment: 0.10, seedSize: 0.50, defense: 0.40, woodiness: 0.55, waterStorage: 0.40, longevity: 0.40 },
      color: { r: 0.25, g: 0.45, b: 0.30 },
      placements: [
        p(22, 40, 17), p(23, 40, 17), p(24, 40, 17),
        p(22, 41, 17), p(23, 41, 17), p(24, 41, 17),
      ],
    },
    {
      id: 23, name: 'Flowering Shrub',
      genome: { rootPriority: 0.20, heightPriority: 0.30, leafSize: 0.70, seedInvestment: 0.99, seedSize: 0.50, defense: 0.01, woodiness: 0.55, waterStorage: 0.10, longevity: 0.60 },
      color: { r: 0.65, g: 0.40, b: 0.55 },
      placements: [
        p(16, 43, 34), p(17, 43, 34), p(18, 43, 34),
        p(16, 44, 34), p(17, 44, 34), p(18, 44, 34),
      ],
    },
    {
      id: 24, name: 'Aromatic Shrub',
      genome: { rootPriority: 0.30, heightPriority: 0.01, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.70, woodiness: 0.55, waterStorage: 0.10, longevity: 0.99 },
      color: { r: 0.50, g: 0.45, b: 0.60 },
      placements: [
        p(22, 43, 35), p(23, 43, 35), p(24, 43, 35),
        p(22, 44, 35), p(23, 44, 35), p(24, 44, 35),
      ],
    },

    // ── Succulents (subtypes 18-23, 36-37) — 3×2 blocks in east desert ──

    {
      id: 25, name: 'Saguaro',
      genome: { rootPriority: 0.20, heightPriority: 0.99, leafSize: 0.01, seedInvestment: 0.10, seedSize: 0.50, defense: 0.30, woodiness: 0.50, waterStorage: 0.80, longevity: 0.60 },
      color: { r: 0.30, g: 0.55, b: 0.25 },
      placements: [
        p(68, 40, 18), p(69, 40, 18), p(70, 40, 18),
        p(68, 41, 18), p(69, 41, 18), p(70, 41, 18),
      ],
    },
    {
      id: 26, name: 'Aloe',
      genome: { rootPriority: 0.30, heightPriority: 0.01, leafSize: 0.99, seedInvestment: 0.10, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.70, longevity: 0.40 },
      color: { r: 0.35, g: 0.60, b: 0.30 },
      placements: [
        p(75, 40, 19), p(76, 40, 19), p(77, 40, 19),
        p(75, 41, 19), p(76, 41, 19), p(77, 41, 19),
      ],
    },
    {
      id: 27, name: 'Caudiciform',
      genome: { rootPriority: 0.99, heightPriority: 0.01, leafSize: 0.20, seedInvestment: 0.40, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.70, longevity: 0.40 },
      color: { r: 0.45, g: 0.50, b: 0.30 },
      placements: [
        p(68, 44, 20), p(69, 44, 20), p(70, 44, 20),
        p(68, 45, 20), p(69, 45, 20), p(70, 45, 20),
      ],
    },
    {
      id: 28, name: 'Euphorbia',
      genome: { rootPriority: 0.01, heightPriority: 0.60, leafSize: 0.20, seedInvestment: 0.80, seedSize: 0.50, defense: 0.80, woodiness: 0.50, waterStorage: 0.60, longevity: 0.30 },
      color: { r: 0.40, g: 0.55, b: 0.20 },
      placements: [
        p(75, 44, 21), p(76, 44, 21), p(77, 44, 21),
        p(75, 45, 21), p(76, 45, 21), p(77, 45, 21),
      ],
    },
    {
      id: 29, name: 'Ice Plant',
      genome: { rootPriority: 0.01, heightPriority: 0.01, leafSize: 0.20, seedInvestment: 0.70, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.60, longevity: 0.01 },
      color: { r: 0.50, g: 0.65, b: 0.50 },
      placements: [
        p(68, 48, 22), p(69, 48, 22), p(70, 48, 22),
        p(68, 49, 22), p(69, 49, 22), p(70, 49, 22),
      ],
    },
    {
      id: 30, name: 'Epiphytic Succulent',
      genome: { rootPriority: 0.01, heightPriority: 0.01, leafSize: 0.80, seedInvestment: 0.20, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.60, longevity: 0.50 },
      color: { r: 0.40, g: 0.60, b: 0.45 },
      placements: [
        p(75, 48, 23), p(76, 48, 23), p(77, 48, 23),
        p(75, 49, 23), p(76, 49, 23), p(77, 49, 23),
      ],
    },
    {
      id: 31, name: 'Barrel Cactus',
      genome: { rootPriority: 0.50, heightPriority: 0.01, leafSize: 0.10, seedInvestment: 0.10, seedSize: 0.50, defense: 0.99, woodiness: 0.50, waterStorage: 0.90, longevity: 0.60 },
      color: { r: 0.35, g: 0.50, b: 0.20 },
      placements: [
        p(68, 52, 36), p(69, 52, 36), p(70, 52, 36),
        p(68, 53, 36), p(69, 53, 36), p(70, 53, 36),
      ],
    },
    {
      id: 32, name: 'Jade',
      genome: { rootPriority: 0.60, heightPriority: 0.01, leafSize: 0.60, seedInvestment: 0.10, seedSize: 0.50, defense: 0.10, woodiness: 0.50, waterStorage: 0.60, longevity: 0.99 },
      color: { r: 0.30, g: 0.55, b: 0.35 },
      placements: [
        p(75, 52, 37), p(76, 52, 37), p(77, 52, 37),
        p(75, 53, 37), p(76, 53, 37), p(77, 53, 37),
      ],
    },

    // ── Forbs (subtypes 24-29, 38-39) — mixed with grass ──
    // Each forb has a 5×5 desert patch (scattered among Turfgrass filler),
    // plus appearances in the hill corner and wetland mixed patches.

    {
      id: 33, name: 'Wildflower',
      genome: { rootPriority: 0.10, heightPriority: 0.01, leafSize: 0.70, seedInvestment: 0.99, seedSize: 0.50, defense: 0.01, woodiness: 0.10, waterStorage: 0.10, longevity: 0.20 },
      color: { r: 0.70, g: 0.40, b: 0.55 },
      placements: [...flat[0].forb, ...(hill.forbs.get(24) ?? []), ...(wet.forbs.get(24) ?? [])],
    },
    {
      id: 34, name: 'Tall Herb',
      genome: { rootPriority: 0.40, heightPriority: 0.99, leafSize: 0.60, seedInvestment: 0.20, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.10, longevity: 0.60 },
      color: { r: 0.35, g: 0.60, b: 0.25 },
      placements: [...flat[1].forb, ...(hill.forbs.get(25) ?? []), ...(wet.forbs.get(25) ?? [])],
    },
    {
      id: 35, name: 'Fern',
      genome: { rootPriority: 0.60, heightPriority: 0.20, leafSize: 0.99, seedInvestment: 0.01, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.20, longevity: 0.80 },
      color: { r: 0.20, g: 0.55, b: 0.20 },
      placements: [...flat[2].forb, ...(hill.forbs.get(26) ?? []), ...(wet.forbs.get(26) ?? [])],
    },
    {
      id: 36, name: 'Vine',
      genome: { rootPriority: 0.01, heightPriority: 0.60, leafSize: 0.50, seedInvestment: 0.80, seedSize: 0.50, defense: 0.01, woodiness: 0.10, waterStorage: 0.01, longevity: 0.60 },
      color: { r: 0.30, g: 0.50, b: 0.30 },
      placements: [...flat[3].forb, ...(hill.forbs.get(27) ?? []), ...(wet.forbs.get(27) ?? [])],
    },
    {
      id: 37, name: 'Ground Cover',
      genome: { rootPriority: 0.60, heightPriority: 0.01, leafSize: 0.50, seedInvestment: 0.60, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.10, longevity: 0.01 },
      color: { r: 0.35, g: 0.65, b: 0.30 },
      placements: [...flat[4].forb, ...(hill.forbs.get(28) ?? []), ...(wet.forbs.get(28) ?? [])],
    },
    {
      id: 38, name: 'Moss',
      genome: { rootPriority: 0.70, heightPriority: 0.01, leafSize: 0.50, seedInvestment: 0.01, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.50, longevity: 0.60 },
      color: { r: 0.25, g: 0.50, b: 0.25 },
      placements: [...flat[5].forb, ...(hill.forbs.get(29) ?? []), ...(wet.forbs.get(29) ?? [])],
    },
    {
      id: 39, name: 'Tropical Herb',
      genome: { rootPriority: 0.60, heightPriority: 0.50, leafSize: 0.80, seedInvestment: 0.30, seedSize: 0.50, defense: 0.20, woodiness: 0.10, waterStorage: 0.80, longevity: 0.20 },
      color: { r: 0.30, g: 0.55, b: 0.35 },
      placements: [...flat[6].forb, ...(hill.forbs.get(38) ?? []), ...(wet.forbs.get(38) ?? [])],
    },
    {
      id: 40, name: 'Desert Annual',
      genome: { rootPriority: 0.10, heightPriority: 0.20, leafSize: 0.50, seedInvestment: 0.70, seedSize: 0.50, defense: 0.70, woodiness: 0.10, waterStorage: 0.01, longevity: 0.01 },
      color: { r: 0.65, g: 0.55, b: 0.25 },
      placements: [...flat[7].forb, ...(hill.forbs.get(39) ?? []), ...(wet.forbs.get(39) ?? [])],
    },
  ],
};
