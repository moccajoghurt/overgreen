/**
 * Target matrix data — shared between scoring, fitness-landscape, and optimize-coefficients.
 * Source of truth: target-matrix.md
 *
 * Two-tier structure:
 *   1. Excluded subtypes per niche (hard constraint)
 *   2. Strong archetypes per niche (soft constraint)
 */

import { Archetype } from '../../../src/types/core';
import { SUBTYPE_NAMES, subtypeArchetype, SubtypeId } from '../../../src/types/subtypes';

// ── Exclusions: subtypes that must NOT appear in a niche's top-5 ──

const EXCLUDED: Record<string, Set<string>> = {};

function addExclusions(niche: string, subtypes: string[]) {
  EXCLUDED[niche] = new Set(subtypes);
}

// Helper to expand "all Succulents" etc.
const ALL_SUCCULENTS = ['Saguaro', 'Aloe', 'Caudiciform', 'Euphorbia', 'Iceplant', 'Epiphytic', 'Barrel Cactus', 'Jade'];
const ALL_TREES = ['Oak', 'Magnolia', 'Conifer', 'Tropical', 'Palm', 'Birch', 'Cypress', 'Acacia'];
const ALL_SHRUBS = ['Holly', 'Hazel', 'Mediterranean', 'Bramble', 'Saltbush', 'Mangrove', 'Flowering Shrub', 'Aromatic'];
const ALL_GRASSES = ['Turfgrass', 'Tallgrass', 'Bunchgrass', 'Bamboo', 'Ryegrass', 'Sedge', 'Pampas', 'Desert Grass'];
const ALL_FORBS = ['Wildflower', 'Tall Herb', 'Fern', 'Vine', 'Clover', 'Moss', 'Tropical Herb', 'Desert Annual'];

// Soil
addExclusions('Temperate/Soil', [
  'Tropical', 'Palm', 'Bamboo', 'Pampas', 'Desert Grass',
  'Saltbush', 'Mangrove', 'Mediterranean', 'Aromatic',
  ...ALL_SUCCULENTS, 'Tropical Herb', 'Desert Annual',
]);
addExclusions('Tropical/Soil', [
  'Oak', 'Birch', 'Conifer', 'Cypress', 'Holly', 'Mediterranean', 'Aromatic', 'Saltbush',
  'Saguaro', 'Barrel Cactus', 'Jade',
  'Desert Grass', 'Desert Annual', 'Pampas', 'Turfgrass', 'Ryegrass',
]);
addExclusions('Mediterr/Soil', [
  'Tropical', 'Palm', 'Birch', 'Magnolia', 'Bamboo', 'Mangrove', 'Saltbush',
  'Saguaro', 'Barrel Cactus',
  'Pampas', 'Fern', 'Moss', 'Vine', 'Tropical Herb', 'Desert Annual', 'Desert Grass',
]);
addExclusions('Desert/Soil', [
  'Oak', 'Birch', 'Magnolia', 'Conifer', 'Tropical', 'Palm', 'Cypress',
  'Holly', 'Hazel', 'Mangrove', 'Bramble', 'Flowering Shrub',
  'Iceplant', 'Epiphytic',
  'Wildflower', 'Tall Herb', 'Fern', 'Vine', 'Clover', 'Moss', 'Tropical Herb',
  'Tallgrass', 'Turfgrass', 'Ryegrass', 'Sedge', 'Bamboo',
]);

// Hill
addExclusions('Temperate/Hill', [
  'Oak', 'Magnolia', 'Tropical', 'Palm', 'Birch', 'Cypress', 'Acacia',
  'Hazel', 'Mediterranean', 'Bramble', 'Saltbush', 'Mangrove', 'Flowering Shrub',
  ...ALL_SUCCULENTS,
  'Bamboo', 'Pampas', 'Desert Grass', 'Sedge', 'Vine', 'Tropical Herb', 'Desert Annual',
]);
addExclusions('Tropical/Hill', [
  'Oak', 'Magnolia', 'Palm', 'Birch', 'Cypress', 'Acacia',
  'Holly', 'Hazel', 'Mediterranean', 'Saltbush', 'Mangrove', 'Aromatic',
  'Saguaro', 'Barrel Cactus', 'Jade', 'Iceplant',
  'Pampas', 'Desert Grass', 'Turfgrass', 'Ryegrass', 'Desert Annual',
]);
addExclusions('Mediterr/Hill', [
  'Oak', 'Magnolia', 'Tropical', 'Palm', 'Birch', 'Acacia',
  'Hazel', 'Bramble', 'Saltbush', 'Mangrove', 'Flowering Shrub',
  'Saguaro', 'Aloe', 'Iceplant', 'Epiphytic', 'Jade',
  'Bamboo', 'Pampas', 'Desert Grass', 'Fern', 'Vine', 'Moss', 'Tropical Herb', 'Desert Annual',
]);
addExclusions('Desert/Hill', [
  'Oak', 'Magnolia', 'Conifer', 'Tropical', 'Palm', 'Birch', 'Cypress', 'Acacia',
  'Holly', 'Hazel', 'Mediterranean', 'Bramble', 'Mangrove', 'Flowering Shrub',
  'Iceplant', 'Epiphytic',
  'Tallgrass', 'Turfgrass', 'Ryegrass', 'Bamboo', 'Pampas', 'Sedge',
  'Wildflower', 'Tall Herb', 'Fern', 'Vine', 'Clover', 'Moss', 'Tropical Herb',
]);

// Wetland
addExclusions('Temperate/Wetland', [
  'Magnolia', 'Tropical', 'Palm', 'Acacia', 'Conifer',
  'Mediterranean', 'Aromatic', 'Saltbush', 'Flowering Shrub',
  ...ALL_SUCCULENTS,
  'Bamboo', 'Pampas', 'Desert Grass', 'Bunchgrass', 'Turfgrass',
  'Vine', 'Tropical Herb', 'Desert Annual',
]);
addExclusions('Tropical/Wetland', [
  'Oak', 'Birch', 'Conifer', 'Cypress', 'Acacia',
  'Holly', 'Hazel', 'Mediterranean', 'Aromatic', 'Bramble', 'Saltbush',
  'Saguaro', 'Aloe', 'Barrel Cactus', 'Jade', 'Iceplant', 'Caudiciform', 'Euphorbia',
  'Turfgrass', 'Ryegrass', 'Bunchgrass', 'Pampas', 'Desert Grass',
  'Wildflower', 'Clover', 'Desert Annual',
]);
addExclusions('Mediterr/Wetland', [
  'Oak', 'Magnolia', 'Tropical', 'Palm', 'Acacia', 'Conifer',
  'Hazel', 'Aromatic', 'Bramble', 'Saltbush', 'Flowering Shrub',
  ...ALL_SUCCULENTS,
  'Bamboo', 'Pampas', 'Desert Grass', 'Bunchgrass', 'Turfgrass',
  'Vine', 'Tropical Herb', 'Desert Annual',
]);
addExclusions('Desert/Wetland', [
  'Oak', 'Birch', 'Magnolia', 'Conifer', 'Tropical', 'Cypress',
  'Holly', 'Hazel', 'Mediterranean', 'Aromatic', 'Bramble', 'Flowering Shrub',
  // Euphorbia allowed — large genus with many species near desert water sources (oases, seasonal streams)
  'Saguaro', 'Aloe', 'Caudiciform', 'Iceplant', 'Epiphytic', 'Barrel Cactus', 'Jade',
  'Bamboo', 'Pampas', 'Desert Grass', 'Bunchgrass', 'Turfgrass',
  'Vine', 'Tall Herb', 'Tropical Herb', 'Desert Annual',
]);

// Arid
addExclusions('Temperate/Arid', [
  'Oak', 'Magnolia', 'Conifer', 'Tropical', 'Palm', 'Birch', 'Cypress',
  'Hazel', 'Mediterranean', 'Bramble', 'Mangrove', 'Flowering Shrub',
  'Iceplant', 'Epiphytic', 'Barrel Cactus',
  'Tallgrass', 'Turfgrass', 'Bamboo', 'Pampas', 'Sedge',
  'Tall Herb', 'Fern', 'Vine', 'Moss', 'Tropical Herb',
]);
addExclusions('Tropical/Arid', [
  // Magnolia allowed — represents broadleaf trees which dominate tropical dry forests
  // Fern allowed — drought-adapted ferns (Cheilanthes, Pellaea) thrive in tropical arid
  'Oak', 'Conifer', 'Tropical', 'Palm', 'Birch', 'Cypress',
  'Holly', 'Hazel', 'Mediterranean', 'Bramble', 'Mangrove', 'Flowering Shrub',
  'Iceplant', 'Epiphytic',
  'Tallgrass', 'Turfgrass', 'Ryegrass', 'Bamboo', 'Sedge',
  'Wildflower', 'Tall Herb', 'Vine', 'Clover', 'Moss',
]);
addExclusions('Mediterr/Arid', [
  'Oak', 'Magnolia', 'Conifer', 'Tropical', 'Palm', 'Birch', 'Cypress',
  'Holly', 'Hazel', 'Bramble', 'Mangrove', 'Flowering Shrub',
  'Iceplant', 'Epiphytic',
  'Tallgrass', 'Turfgrass', 'Ryegrass', 'Bamboo', 'Pampas', 'Sedge',
  'Tall Herb', 'Fern', 'Vine', 'Clover', 'Moss', 'Tropical Herb',
]);
addExclusions('Desert/Arid', [
  ...ALL_TREES,
  ...ALL_SHRUBS.filter(s => s !== 'Saltbush'),
  'Iceplant', 'Epiphytic', 'Aloe',
  ...ALL_GRASSES.filter(s => s !== 'Desert Grass'),
  ...ALL_FORBS.filter(s => s !== 'Desert Annual'),
]);

// ── Strong archetypes: which archetypes should have ≥1 competitive subtype ──

const STRONG_ARCHETYPES: Record<string, Archetype[]> = {};

function addStrong(niche: string, archetypes: Archetype[]) {
  STRONG_ARCHETYPES[niche] = archetypes;
}

addStrong('Temperate/Soil', [Archetype.Tree, Archetype.Shrub, Archetype.Forb]);
addStrong('Tropical/Soil', [Archetype.Tree, Archetype.Forb]);
addStrong('Mediterr/Soil', [Archetype.Tree, Archetype.Shrub]);
addStrong('Desert/Soil', [Archetype.Shrub, Archetype.Succulent, Archetype.Grass]);

addStrong('Temperate/Hill', [Archetype.Grass, Archetype.Forb]);
addStrong('Tropical/Hill', [Archetype.Grass, Archetype.Forb, Archetype.Tree]);
addStrong('Mediterr/Hill', [Archetype.Grass, Archetype.Shrub]);
addStrong('Desert/Hill', [Archetype.Succulent, Archetype.Grass]);

addStrong('Temperate/Wetland', [Archetype.Tree, Archetype.Grass, Archetype.Forb]);
addStrong('Tropical/Wetland', [Archetype.Tree, Archetype.Shrub, Archetype.Forb]);
addStrong('Mediterr/Wetland', [Archetype.Tree, Archetype.Grass, Archetype.Forb]);
addStrong('Desert/Wetland', [Archetype.Tree, Archetype.Grass]);

addStrong('Temperate/Arid', [Archetype.Shrub, Archetype.Grass, Archetype.Succulent]);
addStrong('Tropical/Arid', [Archetype.Tree, Archetype.Succulent, Archetype.Grass]);
addStrong('Mediterr/Arid', [Archetype.Succulent, Archetype.Shrub]);
addStrong('Desert/Arid', [Archetype.Succulent]);

// ── Exports ──

export { EXCLUDED, STRONG_ARCHETYPES };

/** All 16 target niche labels. */
export const TARGET_NICHE_LABELS = Object.keys(EXCLUDED);

const ARCHETYPE_NAMES = ['Grass', 'Shrub', 'Succulent', 'Tree', 'Forb'];
export function archetypeName(a: Archetype): string { return ARCHETYPE_NAMES[a]; }

/** Check if a subtype is excluded from a niche. */
export function isExcluded(niche: string, subtypeName: string): boolean {
  return EXCLUDED[niche]?.has(subtypeName) ?? false;
}

/** Get strong archetypes for a niche. */
export function getStrongArchetypes(niche: string): Archetype[] {
  return STRONG_ARCHETYPES[niche] ?? [];
}

/** Get archetype for a subtype by name. */
export function getArchetypeForSubtype(subtypeName: string): Archetype | undefined {
  const idx = SUBTYPE_NAMES.indexOf(subtypeName);
  if (idx < 0) return undefined;
  return subtypeArchetype(idx as SubtypeId);
}

// ── Backward compatibility (used by fitness-landscape.ts, niche-diagnostic.ts) ──

export type Tier = 'excluded' | 'allowed';

/** @deprecated Use isExcluded() instead. Returns 'excluded' or 'allowed'. */
export function getTargetTier(niche: string, subtype: string): Tier {
  return isExcluded(niche, subtype) ? 'excluded' : 'allowed';
}

/** Build a TARGET_TIERS-like record for backward compat. */
const _TARGET_TIERS: Record<string, Record<string, Tier>> = {};
for (const niche of Object.keys(EXCLUDED)) {
  const map: Record<string, Tier> = {};
  for (const name of SUBTYPE_NAMES) {
    map[name] = isExcluded(niche, name) ? 'excluded' : 'allowed';
  }
  _TARGET_TIERS[niche] = map;
}
export { _TARGET_TIERS as TARGET_TIERS };

/** @deprecated No longer has DOM/COM/MIN tiers. Returns excluded subtypes for tier='excluded'. */
export function getSubtypesForTier(niche: string, tier: string): string[] {
  const excluded = EXCLUDED[niche];
  if (!excluded) return [];
  if (tier === 'excluded' || tier === 'absent') {
    return [...excluded];
  }
  // For any other tier (dominant/common/minor), return empty — these categories no longer exist
  return [];
}
