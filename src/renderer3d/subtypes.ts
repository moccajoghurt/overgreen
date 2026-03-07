import { Genome } from '../types';
import { Archetype, renderArchetype } from '../simulation/plants';

// ── SubtypeId enum (24 subtypes, 6 per archetype) ──

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
}

/** Archetype from subtype: Math.floor(subtypeId / 6) → 0=Grass, 1=Tree, 2=Shrub, 3=Succulent */
export function subtypeArchetype(subtype: SubtypeId): number {
  return (subtype / 6) | 0;
}

// ── Classification ──

function classifyGrass(g: Genome): SubtypeId {
  // Weighted scoring for 6 grass subtypes
  const scores = new Float64Array(6);

  // Turfgrass: low height, low woodiness — default short lawn grass
  scores[0] = (1 - g.heightPriority) * 0.6 + (1 - g.woodiness) * 0.3 + (1 - g.leafSize) * 0.1;

  // Tallgrass: high heightPriority
  scores[1] = g.heightPriority * 0.7 + g.leafSize * 0.2 + g.seedInvestment * 0.1;

  // Bunchgrass: high leafSize × rootPriority, tight cluster
  scores[2] = g.leafSize * 0.4 + g.rootPriority * 0.4 + (1 - g.seedInvestment) * 0.2;

  // Bamboo: high woodiness (within grass range)
  scores[3] = g.woodiness * 0.6 + g.heightPriority * 0.3 + (1 - g.leafSize) * 0.1;

  // Spreading: high seedInvestment (stolons)
  scores[4] = g.seedInvestment * 0.5 + g.leafSize * 0.2 + (1 - g.heightPriority) * 0.3;

  // Sedge: high waterStorage
  scores[5] = g.waterStorage * 0.5 + g.heightPriority * 0.2 + g.rootPriority * 0.3;

  let best = 0;
  for (let i = 1; i < 6; i++) if (scores[i] > scores[best]) best = i;
  return best as SubtypeId;
}

function classifyTree(g: Genome): SubtypeId {
  const scores = new Float64Array(6);

  // Oak: wide leafSize, balanced
  scores[0] = g.leafSize * 0.5 + g.rootPriority * 0.2 + (1 - g.seedInvestment) * 0.15 + g.defense * 0.15;

  // Magnolia: high defense (evergreen), moderate height
  scores[1] = g.defense * 0.4 + (1 - g.seedInvestment) * 0.2 + g.leafSize * 0.2 + (1 - g.heightPriority) * 0.2;

  // Conifer: tall + narrow (high heightPriority, low leafSize)
  scores[2] = g.heightPriority * 0.5 + (1 - g.leafSize) * 0.3 + (1 - g.rootPriority) * 0.2;

  // Tropical: high rootPriority (buttress roots)
  scores[3] = g.rootPriority * 0.5 + g.leafSize * 0.2 + g.heightPriority * 0.15 + g.waterStorage * 0.15;

  // Palm: tall, unbranched feel (high height, low root, low defense)
  scores[4] = g.heightPriority * 0.35 + (1 - g.rootPriority) * 0.25 + (1 - g.defense) * 0.2 + (1 - g.leafSize) * 0.2;

  // Birch: pioneer (high seedInvestment, thin)
  scores[5] = g.seedInvestment * 0.5 + (1 - g.rootPriority) * 0.2 + g.heightPriority * 0.15 + (1 - g.defense) * 0.15;

  let best = 0;
  for (let i = 1; i < 6; i++) if (scores[i] > scores[best]) best = i;
  return (6 + best) as SubtypeId;
}

function classifyShrub(g: Genome): SubtypeId {
  const scores = new Float64Array(6);

  // Evergreen: moderate defense, dense
  scores[0] = g.defense * 0.35 + g.leafSize * 0.3 + (1 - g.seedInvestment) * 0.2 + (1 - g.heightPriority) * 0.15;

  // Deciduous: balanced, moderate everything
  scores[1] = (1 - Math.abs(g.leafSize - 0.5)) * 0.3 + (1 - Math.abs(g.heightPriority - 0.5)) * 0.3
    + g.seedInvestment * 0.2 + (1 - g.defense) * 0.2;

  // Mediterranean: moderate height, dense foliage
  scores[2] = g.leafSize * 0.4 + (1 - g.heightPriority) * 0.2 + g.heightPriority * 0.2 + (1 - g.waterStorage) * 0.2;

  // Thorny: high defense
  scores[3] = g.defense * 0.6 + (1 - g.leafSize) * 0.2 + g.rootPriority * 0.2;

  // Desert: high waterStorage (within shrub range), sparse
  scores[4] = g.waterStorage * 0.4 + (1 - g.leafSize) * 0.3 + g.rootPriority * 0.15 + (1 - g.defense) * 0.15;

  // Mangrove: high rootPriority (prop roots)
  scores[5] = g.rootPriority * 0.5 + g.waterStorage * 0.2 + (1 - g.heightPriority) * 0.15 + g.defense * 0.15;

  let best = 0;
  for (let i = 1; i < 6; i++) if (scores[i] > scores[best]) best = i;
  return (12 + best) as SubtypeId;
}

function classifySucculent(g: Genome): SubtypeId {
  const scores = new Float64Array(6);

  // Saguaro: tall columnar (high heightPriority)
  scores[0] = g.heightPriority * 0.6 + (1 - g.leafSize) * 0.2 + g.waterStorage * 0.2;

  // Aloe: rosette (high leafSize, low height)
  scores[1] = g.leafSize * 0.5 + (1 - g.heightPriority) * 0.3 + g.waterStorage * 0.2;

  // Caudiciform: fat caudex (high rootPriority)
  scores[2] = g.rootPriority * 0.5 + (1 - g.heightPriority) * 0.2 + g.waterStorage * 0.15 + g.seedInvestment * 0.15;

  // Euphorbia: candelabra (moderate height, branching)
  scores[3] = g.heightPriority * 0.3 + g.seedInvestment * 0.25 + g.defense * 0.25 + (1 - g.rootPriority) * 0.2;

  // Ice plant: ground cover (low height, spreading)
  scores[4] = (1 - g.heightPriority) * 0.4 + g.seedInvestment * 0.3 + (1 - g.rootPriority) * 0.3;

  // Epiphytic: low root, low height, aerial
  scores[5] = (1 - g.rootPriority) * 0.4 + (1 - g.heightPriority) * 0.3 + g.leafSize * 0.3;

  let best = 0;
  for (let i = 1; i < 6; i++) if (scores[i] > scores[best]) best = i;
  return (18 + best) as SubtypeId;
}

/** Classify a genome into one of 24 subtypes. Deterministic — same genome always maps to same subtype. */
export function classifySubtype(genome: Genome): SubtypeId {
  const arch = renderArchetype(genome);
  switch (arch) {
    case Archetype.Grass: return classifyGrass(genome);
    case Archetype.Tree: return classifyTree(genome);
    case Archetype.Shrub: return classifyShrub(genome);
    case Archetype.Succulent: return classifySucculent(genome);
    default: return classifyTree(genome);
  }
}

