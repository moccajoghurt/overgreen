import { Genome, Archetype, archetype } from './core';

// ── SubtypeId enum (40 subtypes, 8 per archetype) ──

export const enum SubtypeId {
  // Grasses (0-5)
  Turfgrass = 0, Tallgrass = 1, Bunchgrass = 2,
  Bamboo = 3, Spreading = 4, Sedge = 5,
  // Trees (6-11)
  Oak = 6, Magnolia = 7, Conifer = 8,
  Tropical = 9, Palm = 10, Birch = 11,
  // Shrubs (12-17)
  EvergreenShrub = 12, DeciduousShrub = 13, Mediterranean = 14,
  Thorny = 15, DesertShrub = 16, Mangrove = 17,
  // Succulents (18-23)
  Saguaro = 18, Aloe = 19, Caudiciform = 20,
  Euphorbia = 21, IcePlant = 22, Epiphytic = 23,
  // Forbs (24-29)
  Wildflower = 24, TallHerb = 25, Fern = 26,
  Vine = 27, GroundCover = 28, Moss = 29,
  // Climate-zone extras (30-39)
  PampasGrass = 30, DesertGrass = 31,
  Cypress = 32, Acacia = 33,
  FloweringShrub = 34, Aromatic = 35,
  BarrelCactus = 36, Jade = 37,
  TropicalHerb = 38, DesertAnnual = 39,
}

/** Human-readable names for each subtype, indexed by SubtypeId. */
export const SUBTYPE_NAMES: string[] = [
  // Grasses (0-5)
  'Turfgrass', 'Tallgrass', 'Bunchgrass', 'Bamboo', 'Ryegrass', 'Sedge',
  // Trees (6-11)
  'Oak', 'Magnolia', 'Conifer', 'Tropical', 'Palm', 'Birch',
  // Shrubs (12-17)
  'Holly', 'Hazel', 'Mediterranean', 'Bramble', 'Saltbush', 'Mangrove',
  // Succulents (18-23)
  'Saguaro', 'Aloe', 'Caudiciform', 'Euphorbia', 'Iceplant', 'Epiphytic',
  // Forbs (24-29)
  'Wildflower', 'Tall Herb', 'Fern', 'Vine', 'Clover', 'Moss',
  // Climate-zone extras (30-39)
  'Pampas', 'Desert Grass', 'Cypress', 'Acacia',
  'Flowering Shrub', 'Aromatic', 'Barrel Cactus', 'Jade',
  'Tropical Herb', 'Desert Annual',
];

/** Archetype for each subtype, returning actual Archetype enum values. */
const SUBTYPE_ARCHETYPE: Archetype[] = [
  // Grasses 0-5
  Archetype.Grass, Archetype.Grass, Archetype.Grass,
  Archetype.Grass, Archetype.Grass, Archetype.Grass,
  // Trees 6-11
  Archetype.Tree, Archetype.Tree, Archetype.Tree,
  Archetype.Tree, Archetype.Tree, Archetype.Tree,
  // Shrubs 12-17
  Archetype.Shrub, Archetype.Shrub, Archetype.Shrub,
  Archetype.Shrub, Archetype.Shrub, Archetype.Shrub,
  // Succulents 18-23
  Archetype.Succulent, Archetype.Succulent, Archetype.Succulent,
  Archetype.Succulent, Archetype.Succulent, Archetype.Succulent,
  // Forbs 24-29
  Archetype.Forb, Archetype.Forb, Archetype.Forb,
  Archetype.Forb, Archetype.Forb, Archetype.Forb,
  // Climate: Grass 30-31
  Archetype.Grass, Archetype.Grass,
  // Climate: Tree 32-33
  Archetype.Tree, Archetype.Tree,
  // Climate: Shrub 34-35
  Archetype.Shrub, Archetype.Shrub,
  // Climate: Succulent 36-37
  Archetype.Succulent, Archetype.Succulent,
  // Climate: Forb 38-39
  Archetype.Forb, Archetype.Forb,
];

export function subtypeArchetype(subtype: SubtypeId): Archetype {
  return SUBTYPE_ARCHETYPE[subtype];
}

/** Subtypes rendered by the grass blade shader (not instanced mesh). */
export const SHADER_GRASS_SUBTYPES = new Set([0, 1, 3, 4]);

// ── Classification ──

const GRASS_IDS: SubtypeId[] = [0, 1, 2, 3, 4, 5, 30, 31];

function classifyGrass(g: Genome): SubtypeId {
  const scores = new Float64Array(8);

  // Turfgrass: low height, shallow roots — default short lawn grass
  scores[0] = (1 - g.heightPriority) * 0.45 + (1 - g.rootPriority) * 0.15 + (1 - g.woodiness) * 0.20 + (1 - g.leafSize) * 0.1 + (1 - g.longevity) * 0.1;

  // Tallgrass: high heightPriority, perennial
  scores[1] = g.heightPriority * 0.6 + g.leafSize * 0.2 + g.seedInvestment * 0.1 + g.longevity * 0.1;

  // Bunchgrass: hill-adapted tussock — high reproductive investment, big seeds, compact, persistent
  scores[2] = g.seedInvestment * 0.30 + g.seedSize * 0.25 + (1 - g.heightPriority) * 0.25 + g.longevity * 0.20;

  // Bamboo: high woodiness (within grass range)
  scores[3] = g.woodiness * 0.6 + g.heightPriority * 0.3 + (1 - g.leafSize) * 0.1;

  // Spreading: high seedInvestment (stolons), short-lived colonizer
  scores[4] = g.seedInvestment * 0.45 + g.leafSize * 0.15 + (1 - g.heightPriority) * 0.3 + (1 - g.longevity) * 0.1;

  // Sedge: wetland grass — shallow roots, efficient leaves
  scores[5] = (1 - g.rootPriority) * 0.35 + g.leafSize * 0.3 + g.heightPriority * 0.2 + (1 - g.waterStorage) * 0.15;

  // Pampas: tall ornamental, feathery plumes
  scores[6] = g.heightPriority * 0.4 + g.seedInvestment * 0.25 + g.longevity * 0.2 + g.leafSize * 0.15;

  // Desert Grass: arid-adapted, deep-rooted drought miner, low reproductive investment
  scores[7] = g.rootPriority * 0.40 + (1 - g.seedInvestment) * 0.25 + (1 - g.leafSize) * 0.20 + g.longevity * 0.15;

  let best = 0;
  for (let i = 1; i < 8; i++) if (scores[i] > scores[best]) best = i;
  return GRASS_IDS[best];
}

const TREE_IDS: SubtypeId[] = [6, 7, 8, 9, 10, 11, 32, 33];

function classifyTree(g: Genome): SubtypeId {
  const scores = new Float64Array(8);

  // Oak: wide leafSize, balanced, long-lived
  scores[0] = g.leafSize * 0.45 + g.rootPriority * 0.15 + (1 - g.seedInvestment) * 0.15 + g.defense * 0.15 + g.longevity * 0.1;

  // Magnolia: ancient long-lived broadleaf tree
  scores[1] = g.longevity * 0.35 + g.leafSize * 0.25 + (1 - g.seedInvestment) * 0.2 + (1 - g.heightPriority) * 0.2;

  // Conifer: tall + narrow (high heightPriority, low leafSize), long-lived
  scores[2] = g.heightPriority * 0.45 + (1 - g.leafSize) * 0.25 + (1 - g.rootPriority) * 0.2 + g.longevity * 0.1;

  // Tropical: disease-resistant canopy tree — tall, broad-leaved
  scores[3] = g.defense * 0.3 + g.heightPriority * 0.3 + g.leafSize * 0.25 + (1 - g.rootPriority) * 0.15;

  // Palm: tall, unbranched feel (high height, low root, low defense)
  scores[4] = g.heightPriority * 0.35 + (1 - g.rootPriority) * 0.25 + (1 - g.defense) * 0.2 + (1 - g.leafSize) * 0.2;

  // Birch: pioneer (high seedInvestment, thin), short-lived
  scores[5] = g.seedInvestment * 0.45 + (1 - g.rootPriority) * 0.15 + g.heightPriority * 0.15 + (1 - g.defense) * 0.15 + (1 - g.longevity) * 0.1;

  // Cypress: tall columnar evergreen, dense wood
  scores[6] = g.heightPriority * 0.4 + (1 - g.leafSize) * 0.25 + g.longevity * 0.2 + g.woodiness * 0.15;

  // Acacia: wide flat-topped, thorny, arid-adapted
  scores[7] = g.defense * 0.3 + (1 - g.waterStorage) * 0.25 + g.leafSize * 0.25 + g.seedInvestment * 0.2;

  let best = 0;
  for (let i = 1; i < 8; i++) if (scores[i] > scores[best]) best = i;
  return TREE_IDS[best];
}

const SHRUB_IDS: SubtypeId[] = [12, 13, 14, 15, 16, 17, 34, 35];

function classifyShrub(g: Genome): SubtypeId {
  const scores = new Float64Array(8);

  // Evergreen: moderate defense, dense, long-lived
  scores[0] = g.defense * 0.3 + g.leafSize * 0.25 + (1 - g.seedInvestment) * 0.2 + (1 - g.heightPriority) * 0.15 + g.longevity * 0.1;

  // Deciduous: balanced, moderate everything, shorter-lived
  scores[1] = (1 - Math.abs(g.leafSize - 0.5)) * 0.25 + (1 - Math.abs(g.heightPriority - 0.5)) * 0.25
    + g.seedInvestment * 0.2 + (1 - g.defense) * 0.2 + (1 - g.longevity) * 0.1;

  // Mediterranean: fire-adapted scrub — thick bark, small leaves, drought-hardy
  scores[2] = g.woodiness * 0.3 + (1 - g.leafSize) * 0.25 + g.waterStorage * 0.25 + g.longevity * 0.2;

  // Thorny: high defense
  scores[3] = g.defense * 0.6 + (1 - g.leafSize) * 0.2 + g.rootPriority * 0.2;

  // Desert: high waterStorage (within shrub range), sparse
  scores[4] = g.waterStorage * 0.4 + (1 - g.leafSize) * 0.3 + g.rootPriority * 0.15 + (1 - g.defense) * 0.15;

  // Mangrove: wetland shrub — shallow roots, tall, lush
  scores[5] = (1 - g.rootPriority) * 0.3 + g.heightPriority * 0.3 + g.leafSize * 0.2 + (1 - g.waterStorage) * 0.2;

  // Flowering Shrub: ornamental, high reproductive investment
  scores[6] = g.seedInvestment * 0.4 + g.leafSize * 0.25 + (1 - g.defense) * 0.2 + g.longevity * 0.15;

  // Aromatic: low compact shrub (lavender-type)
  scores[7] = (1 - g.heightPriority) * 0.3 + g.defense * 0.25 + g.longevity * 0.25 + (1 - g.leafSize) * 0.2;

  let best = 0;
  for (let i = 1; i < 8; i++) if (scores[i] > scores[best]) best = i;
  return SHRUB_IDS[best];
}

const SUCC_IDS: SubtypeId[] = [18, 19, 20, 21, 22, 23, 36, 37];

function classifySucculent(g: Genome): SubtypeId {
  const scores = new Float64Array(8);

  // Saguaro: tall columnar (high heightPriority), long-lived
  scores[0] = g.heightPriority * 0.5 + (1 - g.leafSize) * 0.2 + g.waterStorage * 0.2 + g.longevity * 0.1;

  // Aloe: rosette (high leafSize, low height)
  scores[1] = g.leafSize * 0.5 + (1 - g.heightPriority) * 0.3 + g.waterStorage * 0.2;

  // Caudiciform: fat caudex — very compact ground-hugging storage specialist with deep taproot
  scores[2] = (1 - g.heightPriority) * 0.40 + g.rootPriority * 0.30 + g.longevity * 0.20 + (1 - g.leafSize) * 0.10;

  // Euphorbia: candelabra (moderate height, branching)
  scores[3] = g.heightPriority * 0.3 + g.seedInvestment * 0.25 + g.defense * 0.25 + (1 - g.rootPriority) * 0.2;

  // Ice plant: ground cover (low height, spreading), short-lived
  scores[4] = (1 - g.heightPriority) * 0.35 + g.seedInvestment * 0.25 + (1 - g.rootPriority) * 0.3 + (1 - g.longevity) * 0.1;

  // Epiphytic: low root, low height, aerial
  scores[5] = (1 - g.rootPriority) * 0.4 + (1 - g.heightPriority) * 0.3 + g.leafSize * 0.3;

  // Barrel Cactus: squat, heavily defended
  scores[6] = g.defense * 0.35 + (1 - g.heightPriority) * 0.25 + g.waterStorage * 0.25 + g.rootPriority * 0.15;

  // Jade: compact succulent tree, long-lived
  scores[7] = g.longevity * 0.3 + g.leafSize * 0.25 + (1 - g.heightPriority) * 0.25 + g.rootPriority * 0.2;

  let best = 0;
  for (let i = 1; i < 8; i++) if (scores[i] > scores[best]) best = i;
  return SUCC_IDS[best];
}

const FORB_IDS: SubtypeId[] = [24, 25, 26, 27, 28, 29, 38, 39];

function classifyForb(g: Genome): SubtypeId {
  const scores = new Float64Array(8);

  // Wildflower: low height, flowering (high seedInvestment)
  scores[0] = g.seedInvestment * 0.35 + (1 - g.heightPriority) * 0.25 + g.leafSize * 0.2 + (1 - g.defense) * 0.2;

  // Tall Herb: tall upright (high heightPriority)
  scores[1] = g.heightPriority * 0.5 + g.leafSize * 0.2 + g.longevity * 0.15 + g.rootPriority * 0.15;

  // Fern: shade-loving, broad fronds, perennial
  scores[2] = g.leafSize * 0.4 + g.rootPriority * 0.2 + g.longevity * 0.2 + (1 - g.seedInvestment) * 0.2;

  // Vine: climbing/creeping (high seedInvestment, low rootPriority)
  scores[3] = g.seedInvestment * 0.3 + (1 - g.rootPriority) * 0.3 + g.heightPriority * 0.2 + (1 - g.defense) * 0.2;

  // Ground Cover (Clover): low, spreading
  scores[4] = (1 - g.heightPriority) * 0.35 + g.seedInvestment * 0.25 + g.rootPriority * 0.2 + (1 - g.longevity) * 0.2;

  // Moss: ultra-low, moisture-loving
  scores[5] = (1 - g.heightPriority) * 0.3 + g.rootPriority * 0.25 + (1 - g.seedInvestment) * 0.25 + g.waterStorage * 0.2;

  // Tropical Herb: lush broadleaf, wet-adapted
  scores[6] = g.leafSize * 0.35 + g.waterStorage * 0.25 + g.heightPriority * 0.2 + g.rootPriority * 0.2;

  // Desert Annual: ephemeral, high seed output, shallow-rooted
  scores[7] = (1 - g.longevity) * 0.3 + g.seedInvestment * 0.25 + (1 - g.waterStorage) * 0.25 + (1 - g.rootPriority) * 0.2;

  let best = 0;
  for (let i = 1; i < 8; i++) if (scores[i] > scores[best]) best = i;
  return FORB_IDS[best];
}

/** Classify a genome into one of 40 subtypes. Deterministic — same genome always maps to same subtype. */
export function classifySubtype(genome: Genome): SubtypeId {
  const arch = archetype(genome);
  switch (arch) {
    case Archetype.Grass: return classifyGrass(genome);
    case Archetype.Tree: return classifyTree(genome);
    case Archetype.Shrub: return classifyShrub(genome);
    case Archetype.Succulent: return classifySucculent(genome);
    case Archetype.Forb: return classifyForb(genome);
    default: return classifyGrass(genome);
  }
}
