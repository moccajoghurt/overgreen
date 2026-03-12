/**
 * Target matrix data — shared between scoring, fitness-landscape, and optimize-coefficients.
 * Source of truth: target-matrix.md
 */

export type Tier = 'dominant' | 'common' | 'minor' | 'absent';

// niche label → subtype name → tier
const TARGET_TIERS: Record<string, Record<string, Tier>> = {};

function addTarget(niche: string, dominant: string[], common: string[], minor: string[]) {
  const map: Record<string, Tier> = {};
  for (const s of dominant) map[s] = 'dominant';
  for (const s of common) map[s] = 'common';
  for (const s of minor) map[s] = 'minor';
  TARGET_TIERS[niche] = map;
}

// Soil
addTarget('Temperate/Soil',
  ['Oak', 'Birch', 'Hazel'],
  ['Holly', 'Bramble', 'Wildflower', 'Fern', 'Clover', 'Moss', 'Tallgrass'],
  ['Magnolia', 'Turfgrass', 'Ryegrass', 'Tall Herb', 'Vine']);
addTarget('Tropical/Soil',
  ['Tropical', 'Palm', 'Magnolia', 'Tropical Herb', 'Fern'],
  ['Vine', 'Bamboo', 'Flowering Shrub', 'Tall Herb', 'Moss', 'Epiphytic'],
  ['Tallgrass', 'Bramble', 'Clover']);
addTarget('Mediterr/Soil',
  ['Mediterranean', 'Aromatic', 'Cypress', 'Oak'],
  ['Holly', 'Wildflower', 'Clover', 'Turfgrass', 'Ryegrass'],
  ['Aloe', 'Euphorbia', 'Bramble', 'Tall Herb', 'Bunchgrass', 'Acacia']);
addTarget('Desert/Soil',
  ['Saltbush', 'Acacia', 'Desert Grass', 'Desert Annual'],
  ['Saguaro', 'Barrel Cactus', 'Aloe', 'Euphorbia', 'Jade', 'Aromatic'],
  ['Bunchgrass', 'Caudiciform', 'Pampas']);

// Hill
addTarget('Temperate/Hill',
  ['Bunchgrass', 'Turfgrass', 'Wildflower', 'Clover'],
  ['Ryegrass', 'Moss', 'Tallgrass', 'Holly'],
  ['Conifer', 'Aromatic', 'Fern', 'Tall Herb']);
addTarget('Tropical/Hill',
  ['Bunchgrass', 'Tropical Herb', 'Fern', 'Conifer'],
  ['Wildflower', 'Moss', 'Flowering Shrub', 'Epiphytic', 'Bamboo'],
  ['Tall Herb', 'Vine', 'Clover']);
addTarget('Mediterr/Hill',
  ['Bunchgrass', 'Mediterranean', 'Aromatic'],
  ['Wildflower', 'Turfgrass', 'Clover', 'Cypress'],
  ['Euphorbia', 'Barrel Cactus', 'Holly', 'Ryegrass']);
addTarget('Desert/Hill',
  ['Saguaro', 'Barrel Cactus', 'Desert Grass', 'Bunchgrass'],
  ['Desert Annual', 'Euphorbia', 'Saltbush', 'Aloe'],
  ['Caudiciform', 'Aromatic', 'Jade']);

// Wetland
addTarget('Temperate/Wetland',
  ['Birch', 'Cypress', 'Sedge', 'Fern'],
  ['Oak', 'Mangrove', 'Hazel', 'Moss', 'Tall Herb', 'Wildflower', 'Tallgrass'],
  ['Bramble', 'Clover', 'Ryegrass', 'Holly']);
addTarget('Tropical/Wetland',
  ['Tropical', 'Palm', 'Mangrove', 'Fern', 'Bamboo'],
  ['Magnolia', 'Vine', 'Tropical Herb', 'Sedge', 'Moss', 'Tall Herb'],
  ['Flowering Shrub', 'Epiphytic', 'Tallgrass']);
addTarget('Mediterr/Wetland',
  ['Cypress', 'Mangrove', 'Sedge', 'Fern'],
  ['Birch', 'Wildflower', 'Ryegrass', 'Tallgrass', 'Moss'],
  ['Mediterranean', 'Holly', 'Tall Herb', 'Clover']);
addTarget('Desert/Wetland',
  ['Palm', 'Acacia', 'Sedge', 'Tallgrass'],
  ['Fern', 'Ryegrass', 'Mangrove', 'Moss'],
  ['Saltbush', 'Wildflower', 'Clover']);

// Arid
addTarget('Temperate/Arid',
  ['Saltbush', 'Aromatic', 'Desert Grass', 'Bunchgrass'],
  ['Aloe', 'Jade', 'Euphorbia', 'Ryegrass', 'Desert Annual', 'Holly'],
  ['Acacia', 'Caudiciform', 'Saguaro', 'Wildflower', 'Clover']);
addTarget('Tropical/Arid',
  ['Acacia', 'Aloe', 'Euphorbia', 'Pampas'],
  ['Saltbush', 'Desert Grass', 'Saguaro', 'Jade', 'Desert Annual', 'Tropical Herb'],
  ['Barrel Cactus', 'Caudiciform', 'Bunchgrass', 'Aromatic']);
addTarget('Mediterr/Arid',
  ['Barrel Cactus', 'Saguaro', 'Aromatic', 'Mediterranean'],
  ['Aloe', 'Euphorbia', 'Desert Grass', 'Desert Annual', 'Saltbush'],
  ['Jade', 'Caudiciform', 'Bunchgrass', 'Acacia', 'Wildflower']);
addTarget('Desert/Arid',
  ['Saguaro', 'Barrel Cactus'],
  ['Desert Grass', 'Desert Annual'],
  ['Saltbush', 'Euphorbia', 'Jade', 'Caudiciform']);

export { TARGET_TIERS };

export function getTargetTier(niche: string, subtype: string): Tier {
  const map = TARGET_TIERS[niche];
  if (!map) return 'absent';
  return map[subtype] || 'absent';
}

/** Get all subtypes for a given tier in a niche. */
export function getSubtypesForTier(niche: string, tier: Tier): string[] {
  const map = TARGET_TIERS[niche];
  if (!map) return [];
  return Object.entries(map).filter(([, t]) => t === tier).map(([name]) => name);
}

/** All 16 target niche labels. */
export const TARGET_NICHE_LABELS = Object.keys(TARGET_TIERS);
