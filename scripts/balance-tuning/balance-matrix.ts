/**
 * Balance Matrix — pure-math evaluation of trait effects across all niches.
 *
 * For each of the 40 plant subtypes, generates a representative genome and
 * evaluates computeTraitModifier() in every terrain×climate niche.
 * No simulation required — runs in milliseconds.
 *
 * Usage: npx tsx scripts/balance-tuning/balance-matrix.ts
 */

import { Genome, TerrainType, archetype } from '../../src/types/core';
import { ClimateZone, CLIMATE_ZONE_COUNT } from '../../src/types/environment';
import { classifySubtype, SUBTYPE_NAMES } from '../../src/types/subtypes';
import { EFFECTIVE_ENV, computeTraitModifier, getEnvIdx } from '../../src/simulation/trait-effects';

// ── Constants ──

const TERRAIN_COUNT = 6;
const SUBTYPE_COUNT = 40;

const TERRAIN_NAMES = ['Soil', 'River', 'Rock', 'Hill', 'Wetland', 'Arid'];
const CLIMATE_NAMES = ['Temperate', 'Tropical', 'Mediterr', 'Desert'];
const ARCHETYPE_NAMES = ['Grass', 'Shrub', 'Succulent', 'Tree', 'Forb'];

const TRAIT_KEYS: (keyof Genome)[] = [
  'rootPriority', 'heightPriority', 'leafSize', 'seedInvestment',
  'seedSize', 'defense', 'woodiness', 'waterStorage', 'longevity',
];
const TRAIT_SHORT = ['root', 'hght', 'leaf', 'seed', 'sdsz', 'def ', 'wood', 'watr', 'long'];

// Skip River (terrain 1) — soilDepth = 0, nothing grows
const SKIP_TERRAIN = 1;

interface Niche { cz: number; tt: number; label: string; }
const NICHES: Niche[] = [];
for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
  for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
    if (tt === SKIP_TERRAIN) continue;
    NICHES.push({ cz, tt, label: `${CLIMATE_NAMES[cz]}/${TERRAIN_NAMES[tt]}` });
  }
}

// ── Helpers ──

function makeGenome(vals: number[]): Genome {
  return {
    rootPriority: vals[0], heightPriority: vals[1], leafSize: vals[2],
    seedInvestment: vals[3], seedSize: vals[4], defense: vals[5],
    woodiness: vals[6], waterStorage: vals[7], longevity: vals[8],
  };
}

/** Clamp genome to archetype constraints. Returns null if archetype(result) doesn't match. */
function clampToArchetype(g: Genome, arch: number): Genome | null {
  const c = { ...g };
  switch (arch) {
    case 0: // Grass: woodiness < 0.4, leafSize < 0.5, waterStorage < 0.55
      c.woodiness = Math.min(c.woodiness, 0.39);
      c.leafSize = Math.min(c.leafSize, 0.49);
      c.waterStorage = Math.min(c.waterStorage, 0.54);
      break;
    case 1: // Shrub: 0.4 <= woodiness <= 0.7, waterStorage < 0.55
      c.woodiness = Math.max(0.4, Math.min(0.7, c.woodiness));
      c.waterStorage = Math.min(c.waterStorage, 0.54);
      break;
    case 2: // Succulent: waterStorage >= 0.55
      c.waterStorage = Math.max(0.55, c.waterStorage);
      break;
    case 3: // Tree: woodiness > 0.7, waterStorage < 0.55
      c.woodiness = Math.max(0.71, c.woodiness);
      c.waterStorage = Math.min(c.waterStorage, 0.54);
      break;
    case 4: // Forb: woodiness < 0.4, leafSize >= 0.5, waterStorage < 0.55
      c.woodiness = Math.min(c.woodiness, 0.39);
      c.leafSize = Math.max(0.5, c.leafSize);
      c.waterStorage = Math.min(c.waterStorage, 0.54);
      break;
  }
  if (archetype(c) !== arch) return null;
  return c;
}

function nicheModifier(genome: Genome, niche: Niche): number {
  return computeTraitModifier(genome, EFFECTIVE_ENV[getEnvIdx(niche.cz, niche.tt)]);
}

function meanNicheModifier(genome: Genome): number {
  let sum = 0;
  for (const n of NICHES) sum += nicheModifier(genome, n);
  return sum / NICHES.length;
}

function fmt(n: number, width = 6): string {
  const s = (n >= 0 ? '+' : '') + n.toFixed(2);
  return s.padStart(width);
}

function pad(s: string, width: number): string {
  return s.padEnd(width);
}

// ── Step 1: Generate representative genomes ──

process.stderr.write('Generating representative genomes...\n');

const GRID_VALUES = [0.01, 0.5, 0.99];
const GRID_SIZE = Math.pow(3, 9); // 19683

// For each subtype: best genome and its mean modifier
const repGenomes: (Genome | null)[] = new Array(SUBTYPE_COUNT).fill(null);
const repScores: number[] = new Array(SUBTYPE_COUNT).fill(-Infinity);

// Archetype order: Grass=0, Shrub=1, Succulent=2, Tree=3, Forb=4
for (let arch = 0; arch < 5; arch++) {
  for (let gi = 0; gi < GRID_SIZE; gi++) {
    // Decode grid index to trait values
    const vals: number[] = [];
    let idx = gi;
    for (let t = 0; t < 9; t++) {
      vals.push(GRID_VALUES[idx % 3]);
      idx = Math.floor(idx / 3);
    }
    const raw = makeGenome(vals);
    const clamped = clampToArchetype(raw, arch);
    if (!clamped) continue;

    const subId = classifySubtype(clamped) as number;
    const score = meanNicheModifier(clamped);
    if (score > repScores[subId]) {
      repScores[subId] = score;
      repGenomes[subId] = clamped;
    }
  }
}

// Check for missing subtypes
const missing: number[] = [];
for (let i = 0; i < SUBTYPE_COUNT; i++) {
  if (!repGenomes[i]) missing.push(i);
}
if (missing.length > 0) {
  process.stderr.write(`WARNING: No representative genome found for: ${missing.map(i => SUBTYPE_NAMES[i]).join(', ')}\n`);
}

// ── Step 2: Compute 40×20 matrix ──

process.stderr.write('Computing balance matrix...\n');

// matrix[subtypeId][nicheIdx] = traitModifier
const matrix: number[][] = [];
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  const row: number[] = [];
  for (const n of NICHES) {
    row.push(repGenomes[s] ? nicheModifier(repGenomes[s]!, n) : -999);
  }
  matrix.push(row);
}

// ── Step 3: Niche optima (unconstrained corner search) ──

process.stderr.write('Finding niche optima...\n');

const CORNER_SIZE = Math.pow(2, 9); // 512
interface NicheOptimum { modifier: number; genome: Genome; subtypeId: number; }
const nicheOptima: NicheOptimum[] = [];

for (const n of NICHES) {
  let best: NicheOptimum = { modifier: -Infinity, genome: makeGenome(new Array(9).fill(0.01)), subtypeId: 0 };
  for (let ci = 0; ci < CORNER_SIZE; ci++) {
    const vals: number[] = [];
    for (let t = 0; t < 9; t++) {
      vals.push((ci >> t) & 1 ? 0.99 : 0.01);
    }
    const g = makeGenome(vals);
    const mod = nicheModifier(g, n);
    if (mod > best.modifier) {
      best = { modifier: mod, genome: g, subtypeId: classifySubtype(g) as number };
    }
  }
  nicheOptima.push(best);
}

// ── Output ──

const out = (s: string) => process.stdout.write(s + '\n');

// Section A: Per-niche rankings
out('');
out('═══════════════════════════════════════════════════════════════');
out('  SECTION A: Per-Niche Rankings (top 5 subtypes)');
out('═══════════════════════════════════════════════════════════════');

for (let ni = 0; ni < NICHES.length; ni++) {
  const n = NICHES[ni];
  // Gather all subtypes with their modifier for this niche
  const entries: { id: number; mod: number }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    entries.push({ id: s, mod: matrix[s][ni] });
  }
  entries.sort((a, b) => b.mod - a.mod);

  out('');
  out(`  ${pad(n.label, 20)}`);
  for (let r = 0; r < Math.min(5, entries.length); r++) {
    const e = entries[r];
    out(`    #${r + 1}  ${pad(SUBTYPE_NAMES[e.id], 16)} ${fmt(e.mod)}`);
  }
}

// Section B: Per-subtype affinity
out('');
out('═══════════════════════════════════════════════════════════════');
out('  SECTION B: Per-Subtype Niche Affinity');
out('═══════════════════════════════════════════════════════════════');
out('');

for (let s = 0; s < SUBTYPE_COUNT; s++) {
  if (!repGenomes[s]) continue;
  const row = matrix[s];
  // Find best and worst niches
  let bestNi = 0, worstNi = 0;
  for (let ni = 1; ni < NICHES.length; ni++) {
    if (row[ni] > row[bestNi]) bestNi = ni;
    if (row[ni] < row[worstNi]) worstNi = ni;
  }
  // Find second-best
  let best2Ni = bestNi === 0 ? 1 : 0;
  for (let ni = 0; ni < NICHES.length; ni++) {
    if (ni === bestNi) continue;
    if (row[ni] > row[best2Ni]) best2Ni = ni;
  }

  out(
    `  ${pad(SUBTYPE_NAMES[s], 16)} ` +
    `best: ${pad(NICHES[bestNi].label, 16)} ${fmt(row[bestNi])}  ` +
    `${pad(NICHES[best2Ni].label, 16)} ${fmt(row[best2Ni])}  ` +
    `| worst: ${pad(NICHES[worstNi].label, 16)} ${fmt(row[worstNi])}`
  );
}

// Section C: Niche optima
out('');
out('═══════════════════════════════════════════════════════════════');
out('  SECTION C: Niche Optima (unconstrained corner genomes)');
out('═══════════════════════════════════════════════════════════════');
out('');
out(`  ${pad('Niche', 20)} ${pad('Best Mod', 9)} ${pad('Classifies As', 16)} ${TRAIT_SHORT.join(' ')}`);
out(`  ${'─'.repeat(20)} ${'─'.repeat(9)} ${'─'.repeat(16)} ${TRAIT_SHORT.map(t => '────').join(' ')}`);

for (let ni = 0; ni < NICHES.length; ni++) {
  const n = NICHES[ni];
  const opt = nicheOptima[ni];
  const g = opt.genome;
  const traitVals = TRAIT_KEYS.map(k => g[k].toFixed(2).padStart(4)).join(' ');
  out(
    `  ${pad(n.label, 20)} ${fmt(opt.modifier, 9)} ${pad(SUBTYPE_NAMES[opt.subtypeId], 16)} ${traitVals}`
  );
}

// Section D: Diagnostics
out('');
out('═══════════════════════════════════════════════════════════════');
out('  SECTION D: Diagnostics');
out('═══════════════════════════════════════════════════════════════');

// Dead niches: all subtypes negative
out('');
out('  Dead niches (all subtypes negative):');
let deadCount = 0;
for (let ni = 0; ni < NICHES.length; ni++) {
  const allNeg = matrix.every((row, s) => !repGenomes[s] || row[ni] < 0);
  if (allNeg) {
    out(`    ${NICHES[ni].label}`);
    deadCount++;
  }
}
if (deadCount === 0) out('    (none)');

// Homeless subtypes: never in top-5 anywhere
out('');
out('  Homeless subtypes (never in top-5 of any niche):');
const inTop5 = new Set<number>();
for (let ni = 0; ni < NICHES.length; ni++) {
  const entries: { id: number; mod: number }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    entries.push({ id: s, mod: matrix[s][ni] });
  }
  entries.sort((a, b) => b.mod - a.mod);
  for (let r = 0; r < Math.min(5, entries.length); r++) {
    inTop5.add(entries[r].id);
  }
}
let homelessCount = 0;
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  if (!repGenomes[s]) continue;
  if (!inTop5.has(s)) {
    const row = matrix[s];
    let bestNi = 0;
    for (let ni = 1; ni < NICHES.length; ni++) {
      if (row[ni] > row[bestNi]) bestNi = ni;
    }
    // Find rank in that niche
    const entries: { id: number; mod: number }[] = [];
    for (let ss = 0; ss < SUBTYPE_COUNT; ss++) {
      if (!repGenomes[ss]) continue;
      entries.push({ id: ss, mod: matrix[ss][bestNi] });
    }
    entries.sort((a, b) => b.mod - a.mod);
    const rank = entries.findIndex(e => e.id === s) + 1;
    out(`    ${pad(SUBTYPE_NAMES[s], 16)} — best: ${pad(NICHES[bestNi].label, 16)} ${fmt(row[bestNi])} (rank #${rank})`);
    homelessCount++;
  }
}
if (homelessCount === 0) out('    (none)');

// Crowded niches: top-2 gap < 0.05
out('');
out('  Crowded niches (top-2 gap < 0.05):');
let crowdedCount = 0;
for (let ni = 0; ni < NICHES.length; ni++) {
  const entries: { id: number; mod: number }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    entries.push({ id: s, mod: matrix[s][ni] });
  }
  entries.sort((a, b) => b.mod - a.mod);
  if (entries.length >= 2) {
    const gap = entries[0].mod - entries[1].mod;
    if (gap < 0.05) {
      out(
        `    ${pad(NICHES[ni].label, 16)}: ` +
        `${pad(SUBTYPE_NAMES[entries[0].id], 14)} ${fmt(entries[0].mod)} vs ` +
        `${pad(SUBTYPE_NAMES[entries[1].id], 14)} ${fmt(entries[1].mod)} ` +
        `(gap ${gap.toFixed(3)})`
      );
      crowdedCount++;
    }
  }
}
if (crowdedCount === 0) out('    (none)');

// Representative genomes summary (at the end, for reference)
out('');
out('═══════════════════════════════════════════════════════════════');
out('  APPENDIX: Representative Genomes');
out('═══════════════════════════════════════════════════════════════');
out('');
out(`  ${pad('#', 3)} ${pad('Subtype', 16)} ${pad('Arch', 10)} ${TRAIT_SHORT.join(' ')}  meanMod`);
out(`  ${pad('─', 3)} ${pad('─'.repeat(16), 16)} ${pad('─'.repeat(10), 10)} ${TRAIT_SHORT.map(() => '────').join(' ')}  ${'─'.repeat(7)}`);

for (let s = 0; s < SUBTYPE_COUNT; s++) {
  if (!repGenomes[s]) {
    out(`  ${String(s).padStart(3)} ${pad(SUBTYPE_NAMES[s], 16)} (no representative)`);
    continue;
  }
  const g = repGenomes[s]!;
  const arch = archetype(g);
  const traitVals = TRAIT_KEYS.map(k => g[k].toFixed(2).padStart(4)).join(' ');
  out(
    `  ${String(s).padStart(3)} ${pad(SUBTYPE_NAMES[s], 16)} ${pad(ARCHETYPE_NAMES[arch], 10)} ${traitVals}  ${fmt(repScores[s])}`
  );
}

out('');
process.stderr.write('Done.\n');
