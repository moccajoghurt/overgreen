/**
 * Niche Diagnostic — shows top-10 rankings per niche with modifiers and genome traits.
 * Identifies what's blocking each missing dominant subtype.
 *
 * Usage: npx tsx scripts/balance-tuning/niche-diagnostic.ts [niche-filter]
 *   e.g. npx tsx scripts/balance-tuning/niche-diagnostic.ts Temperate
 */

import { Genome, TerrainType, archetype } from '../../src/types/core';
import { ClimateZone, CLIMATE_ZONE_COUNT } from '../../src/types/environment';
import { classifySubtype, SUBTYPE_NAMES } from '../../src/types/subtypes';
import { EFFECTIVE_ENV, computeTraitModifier, getEnvIdx } from '../../src/simulation/trait-effects';
import { getSubtypesForTier, type Tier } from './lib/target-matrix';

const filter = process.argv[2] || '';

const TERRAIN_COUNT = 6;
const SUBTYPE_COUNT = 40;
const TERRAIN_NAMES = ['Soil', 'River', 'Rock', 'Hill', 'Wetland', 'Arid'];
const CLIMATE_NAMES = ['Temperate', 'Tropical', 'Mediterr', 'Desert'];

interface Niche { cz: number; tt: number; label: string; }
const TARGET_NICHES: Niche[] = [];
for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
  for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
    if (tt === 1 || tt === 2) continue; // Skip River and Rock
    TARGET_NICHES.push({ cz, tt, label: `${CLIMATE_NAMES[cz]}/${TERRAIN_NAMES[tt]}` });
  }
}

function makeGenome(vals: number[]): Genome {
  return {
    rootPriority: vals[0], heightPriority: vals[1], leafSize: vals[2],
    seedInvestment: vals[3], seedSize: vals[4], defense: vals[5],
    woodiness: vals[6], waterStorage: vals[7], longevity: vals[8],
  };
}

function clampToArchetype(g: Genome, arch: number): Genome | null {
  const c = { ...g };
  switch (arch) {
    case 0: c.woodiness = Math.min(c.woodiness, 0.39); c.leafSize = Math.min(c.leafSize, 0.49); c.waterStorage = Math.min(c.waterStorage, 0.54); break;
    case 1: c.woodiness = Math.max(0.4, Math.min(0.7, c.woodiness)); c.waterStorage = Math.min(c.waterStorage, 0.54); break;
    case 2: c.waterStorage = Math.max(0.55, c.waterStorage); break;
    case 3: c.woodiness = Math.max(0.71, c.woodiness); c.waterStorage = Math.min(c.waterStorage, 0.54); break;
    case 4: c.woodiness = Math.min(c.woodiness, 0.39); c.leafSize = Math.max(0.5, c.leafSize); c.waterStorage = Math.min(c.waterStorage, 0.54); break;
  }
  if (archetype(c) !== arch) return null;
  return c;
}

const GRID_VALUES = [0.01, 0.5, 0.99];
const GRID_SIZE = Math.pow(3, 9);

const repGenomes: (Genome | null)[] = new Array(SUBTYPE_COUNT).fill(null);
const repScores: number[] = new Array(SUBTYPE_COUNT).fill(-Infinity);

for (let arch = 0; arch < 5; arch++) {
  for (let gi = 0; gi < GRID_SIZE; gi++) {
    const vals: number[] = [];
    let idx = gi;
    for (let t = 0; t < 9; t++) { vals.push(GRID_VALUES[idx % 3]); idx = Math.floor(idx / 3); }
    const raw = makeGenome(vals);
    const clamped = clampToArchetype(raw, arch);
    if (!clamped) continue;
    const subId = classifySubtype(clamped) as number;
    let sum = 0;
    for (const n of TARGET_NICHES) sum += computeTraitModifier(clamped, EFFECTIVE_ENV[getEnvIdx(n.cz, n.tt)]);
    const score = sum / TARGET_NICHES.length;
    if (score > repScores[subId]) { repScores[subId] = score; repGenomes[subId] = clamped; }
  }
}

const out = (s: string) => process.stdout.write(s + '\n');

// Show which subtypes have no representative genome
const missing: string[] = [];
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  if (!repGenomes[s]) missing.push(SUBTYPE_NAMES[s]);
}
if (missing.length > 0) out(`\nSubtypes with NO representative genome: ${missing.join(', ')}\n`);

// Show rep genomes summary
out('\n=== Representative Genomes ===');
const traitNames = ['root', 'hgt', 'leaf', 'seed', 'sdSz', 'def', 'wood', 'wStr', 'long'];
out(`${'Subtype'.padEnd(20)} ${traitNames.map(t => t.padStart(5)).join('')}  mean`);
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  const g = repGenomes[s];
  if (!g) continue;
  const vals = [g.rootPriority, g.heightPriority, g.leafSize, g.seedInvestment, g.seedSize, g.defense, g.woodiness, g.waterStorage, g.longevity];
  out(`${SUBTYPE_NAMES[s].padEnd(20)} ${vals.map(v => v.toFixed(2).padStart(5)).join('')}  ${repScores[s].toFixed(3)}`);
}

// Per-niche rankings
for (const niche of TARGET_NICHES) {
  if (filter && !niche.label.toLowerCase().includes(filter.toLowerCase())) continue;

  const entries: { name: string; mod: number; subId: number }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    const env = EFFECTIVE_ENV[getEnvIdx(niche.cz, niche.tt)];
    entries.push({ name: SUBTYPE_NAMES[s], mod: computeTraitModifier(repGenomes[s]!, env), subId: s });
  }
  entries.sort((a, b) => b.mod - a.mod);

  const dominants = new Set(getSubtypesForTier(niche.label, 'dominant'));
  const commons = new Set(getSubtypesForTier(niche.label, 'common'));

  out(`\n── ${niche.label} ──`);
  out(`${'Rank'.padStart(4)} ${'Subtype'.padEnd(20)} ${'Modifier'.padStart(8)}  Target`);
  for (let i = 0; i < Math.min(entries.length, 15); i++) {
    const e = entries[i];
    let tier = '';
    if (dominants.has(e.name)) tier = '◆ DOMINANT';
    else if (commons.has(e.name)) tier = '● common';
    else {
      const allListed = new Set([
        ...getSubtypesForTier(niche.label, 'dominant'),
        ...getSubtypesForTier(niche.label, 'common'),
        ...getSubtypesForTier(niche.label, 'minor'),
      ]);
      if (!allListed.has(e.name)) tier = '✗ ABSENT';
    }
    const marker = i < 3 ? '>>>' : '   ';
    out(`${marker} ${(i+1).toString().padStart(2)}. ${e.name.padEnd(20)} ${e.mod.toFixed(3).padStart(8)}  ${tier}`);
  }

  // Show missing dominants and their actual ranks
  const missingDoms: string[] = [];
  for (const name of dominants) {
    const rank = entries.findIndex(e => e.name === name) + 1;
    if (rank > 3) {
      const mod = entries[rank - 1]?.mod ?? 0;
      const top3Mod = entries[2]?.mod ?? 0;
      missingDoms.push(`${name} (rank ${rank}, mod=${mod.toFixed(3)}, gap=${(top3Mod - mod).toFixed(3)})`);
    }
  }
  if (missingDoms.length > 0) {
    out(`  Missing dominants: ${missingDoms.join('; ')}`);
  }
}

out('');
