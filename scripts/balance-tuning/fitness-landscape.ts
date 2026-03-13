/**
 * Fitness Landscape Stability Diagnostic
 *
 * For each niche × subtype: start from a representative genome, hill-climb
 * traitModifier with small steps, check if the genome still classifies as
 * the same subtype after convergence.
 *
 * This answers: "Is subtype X a stable evolutionary attractor in niche Y?"
 *
 * Usage: npx tsx scripts/balance-tuning/fitness-landscape.ts
 */

import { Genome, TerrainType, archetype, Archetype } from '../../src/types/core';
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

const SKIP_TERRAIN = 1; // River

interface Niche { cz: number; tt: number; label: string; }
const NICHES: Niche[] = [];
for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
  for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
    if (tt === SKIP_TERRAIN) continue;
    NICHES.push({ cz, tt, label: `${CLIMATE_NAMES[cz]}/${TERRAIN_NAMES[tt]}` });
  }
}

// Only the 16 target niches (skip Rock)
const TARGET_NICHES = NICHES.filter(n => n.tt !== 2); // Rock=2

// ── Helpers ──

function makeGenome(vals: number[]): Genome {
  return {
    rootPriority: vals[0], heightPriority: vals[1], leafSize: vals[2],
    seedInvestment: vals[3], seedSize: vals[4], defense: vals[5],
    woodiness: vals[6], waterStorage: vals[7], longevity: vals[8],
  };
}

function genomeToArray(g: Genome): number[] {
  return TRAIT_KEYS.map(k => g[k]);
}

function clampTrait(v: number): number {
  return Math.max(0.01, Math.min(0.99, v));
}

function cloneGenome(g: Genome): Genome {
  return { ...g };
}

function nicheModifier(genome: Genome, niche: Niche): number {
  return computeTraitModifier(genome, EFFECTIVE_ENV[getEnvIdx(niche.cz, niche.tt)]);
}

function pad(s: string, w: number): string { return s.padEnd(w); }
function fmt(n: number, w = 6): string {
  return ((n >= 0 ? '+' : '') + n.toFixed(2)).padStart(w);
}

// ── Generate representative genomes (same as balance-matrix) ──

process.stderr.write('Generating representative genomes...\n');

const GRID_VALUES = [0.01, 0.5, 0.99];
const GRID_SIZE = Math.pow(3, 9);

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

function meanNicheModifier(genome: Genome): number {
  let sum = 0;
  for (const n of TARGET_NICHES) sum += nicheModifier(genome, n);
  return sum / TARGET_NICHES.length;
}

const repGenomes: (Genome | null)[] = new Array(SUBTYPE_COUNT).fill(null);
const repScores: number[] = new Array(SUBTYPE_COUNT).fill(-Infinity);

for (let arch = 0; arch < 5; arch++) {
  for (let gi = 0; gi < GRID_SIZE; gi++) {
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

// ── Hill-climbing ──

const STEP_SIZE = 0.02;
const MAX_ITERS = 500;
const CONVERGENCE_THRESHOLD = 0.0001;

interface ClimbResult {
  startSubtype: number;
  endSubtype: number;
  startModifier: number;
  endModifier: number;
  endGenome: Genome;
  iters: number;
  stable: boolean;
}

/** Archetype constraints: min/max for each trait to stay within archetype. */
function getArchetypeConstraints(arch: number): { min: number[]; max: number[] } {
  const min = TRAIT_KEYS.map(() => 0.01);
  const max = TRAIT_KEYS.map(() => 0.99);
  const idx = (k: keyof Genome) => TRAIT_KEYS.indexOf(k);
  switch (arch) {
    case 0: // Grass: woodiness < 0.4, leafSize < 0.5, waterStorage < 0.55
      max[idx('woodiness')] = 0.39; max[idx('leafSize')] = 0.49; max[idx('waterStorage')] = 0.54; break;
    case 1: // Shrub: 0.4 <= woodiness <= 0.7, waterStorage < 0.55
      min[idx('woodiness')] = 0.40; max[idx('woodiness')] = 0.70; max[idx('waterStorage')] = 0.54; break;
    case 2: // Succulent: waterStorage >= 0.55
      min[idx('waterStorage')] = 0.55; break;
    case 3: // Tree: woodiness > 0.7, waterStorage < 0.55
      min[idx('woodiness')] = 0.71; max[idx('waterStorage')] = 0.54; break;
    case 4: // Forb: woodiness < 0.4, leafSize >= 0.5, waterStorage < 0.55
      max[idx('woodiness')] = 0.39; min[idx('leafSize')] = 0.50; max[idx('waterStorage')] = 0.54; break;
  }
  return { min, max };
}

function hillClimb(startGenome: Genome, niche: Niche, constrainArchetype = false): ClimbResult {
  const startSubtype = classifySubtype(startGenome) as number;
  const startModifier = nicheModifier(startGenome, niche);
  const startArch = archetype(startGenome);
  const constraints = constrainArchetype ? getArchetypeConstraints(startArch) : null;

  let current = cloneGenome(startGenome);
  let currentMod = startModifier;

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    // Compute numerical gradient
    const grad: number[] = [];
    for (let ti = 0; ti < TRAIT_KEYS.length; ti++) {
      const key = TRAIT_KEYS[ti];
      const orig = current[key];
      const h = 0.001;
      current[key] = clampTrait(orig + h);
      const fPlus = nicheModifier(current, niche);
      current[key] = clampTrait(orig - h);
      const fMinus = nicheModifier(current, niche);
      current[key] = orig;
      let g = (fPlus - fMinus) / (2 * h);
      // Zero out gradient if it would push past archetype boundary
      if (constraints) {
        if (g > 0 && orig >= constraints.max[ti] - 0.01) g = 0;
        if (g < 0 && orig <= constraints.min[ti] + 0.01) g = 0;
      }
      grad.push(g);
    }

    // Normalize gradient
    let norm = 0;
    for (const g of grad) norm += g * g;
    norm = Math.sqrt(norm);
    if (norm < CONVERGENCE_THRESHOLD) break;

    // Step
    let improved = false;
    const next = cloneGenome(current);
    for (let i = 0; i < TRAIT_KEYS.length; i++) {
      let v = current[TRAIT_KEYS[i]] + STEP_SIZE * grad[i] / norm;
      v = clampTrait(v);
      if (constraints) {
        v = Math.max(constraints.min[i], Math.min(constraints.max[i], v));
      }
      (next as any)[TRAIT_KEYS[i]] = v;
    }
    const nextMod = nicheModifier(next, niche);
    if (nextMod > currentMod + CONVERGENCE_THRESHOLD) {
      current = next;
      currentMod = nextMod;
      improved = true;
    }

    if (!improved) break;
  }

  const endSubtype = classifySubtype(current) as number;
  return {
    startSubtype,
    endSubtype,
    startModifier: startModifier,
    endModifier: currentMod,
    endGenome: current,
    iters: MAX_ITERS,
    stable: startSubtype === endSubtype,
  };
}

// ── Run analysis ──

process.stderr.write('Hill-climbing all subtype × niche combinations (archetype-constrained)...\n');

// results[subtypeId][nicheIdx] — constrained to stay within starting archetype
const results: (ClimbResult | null)[][] = [];
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  const row: (ClimbResult | null)[] = [];
  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    if (!repGenomes[s]) {
      row.push(null);
      continue;
    }
    row.push(hillClimb(repGenomes[s]!, TARGET_NICHES[ni], true));
  }
  results.push(row);
}

// ── Parse target matrix for comparison ──

import { isExcluded, EXCLUDED } from './lib/target-matrix';

// ── Output ──

const out = (s: string) => process.stdout.write(s + '\n');

// Section 1: Stability matrix — which subtypes are stable attractors in which niches?
out('');
out('═══════════════════════════════════════════════════════════════════════');
out('  SECTION 1: Attractor Stability per Niche');
out('  For each niche: which subtypes stay stable after hill-climbing?');
out('  ✓ = stable attractor, → X = drifts to subtype X');
out('═══════════════════════════════════════════════════════════════════════');

for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
  const niche = TARGET_NICHES[ni];
  out('');
  out(`  ── ${niche.label} ──`);

  const stable: { name: string; mod: number; excluded: boolean }[] = [];
  const drifted: { from: string; to: string; fromMod: number; toMod: number; excluded: boolean }[] = [];

  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    const r = results[s][ni];
    if (!r) continue;
    const name = SUBTYPE_NAMES[s];
    const excl = isExcluded(niche.label, name);
    if (r.stable) {
      stable.push({ name, mod: r.endModifier, excluded: excl });
    } else {
      drifted.push({ from: name, to: SUBTYPE_NAMES[r.endSubtype], fromMod: r.startModifier, toMod: r.endModifier, excluded: excl });
    }
  }

  // Sort stable by modifier descending
  stable.sort((a, b) => b.mod - a.mod);

  out('  Stable attractors:');
  for (const s of stable) {
    const tag = s.excluded ? ' [EXCL]' : '';
    out(`      ✓ ${pad(s.name, 16)} ${fmt(s.mod)}${tag}`);
  }

  // Show drifts for allowed subtypes (excluded drifting is fine)
  const allowedDrifts = drifted.filter(d => !d.excluded);
  if (allowedDrifts.length > 0) {
    out('  Allowed subtypes that DRIFT:');
    for (const d of allowedDrifts) {
      out(`      ${pad(d.from, 16)} → ${pad(d.to, 16)}  ${fmt(d.fromMod)} → ${fmt(d.toMod)}`);
    }
  }
}

// Section 2: Per-subtype stability summary
out('');
out('═══════════════════════════════════════════════════════════════════════');
out('  SECTION 2: Per-Subtype Stability Summary');
out('  How many niches is each subtype a stable attractor in?');
out('═══════════════════════════════════════════════════════════════════════');
out('');

out(`  ${pad('Subtype', 16)} ${pad('Arch', 6)} Stable  Target  Stable-in-Target  Drift-destinations`);
out(`  ${pad('─'.repeat(16), 16)} ${pad('──────', 6)} ──────  ──────  ────────────────  ──────────────────`);

for (let s = 0; s < SUBTYPE_COUNT; s++) {
  if (!repGenomes[s]) continue;
  const name = SUBTYPE_NAMES[s];
  const arch = ARCHETYPE_NAMES[archetype(repGenomes[s]!)];

  let stableCount = 0;
  let targetCount = 0;
  let stableInTarget = 0;
  const driftDests = new Map<string, number>();

  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    const r = results[s][ni]!;
    const allowed = !isExcluded(TARGET_NICHES[ni].label, name);
    if (allowed) targetCount++;
    if (r.stable) {
      stableCount++;
      if (allowed) stableInTarget++;
    } else {
      const dest = SUBTYPE_NAMES[r.endSubtype];
      driftDests.set(dest, (driftDests.get(dest) || 0) + 1);
    }
  }

  const driftStr = [...driftDests.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name}(${count})`)
    .join(', ');

  out(`  ${pad(name, 16)} ${pad(arch, 6)} ${String(stableCount).padStart(3)}/16  ${String(targetCount).padStart(3)}/16  ${String(stableInTarget).padStart(3)}/${String(targetCount).padStart(2)}              ${driftStr}`);
}

// Section 3: Target match analysis
out('');
out('═══════════════════════════════════════════════════════════════════════');
out('  SECTION 3: Target Match — Niche Attractors vs Target Matrix');
out('  For each niche: what stable attractors exist, and do they match?');
out('═══════════════════════════════════════════════════════════════════════');

let totalExcludedAttractors = 0;
let totalAllowedAttractors = 0;

for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
  const niche = TARGET_NICHES[ni];

  // Collect stable attractors in this niche
  const attractors: { id: number; name: string; mod: number; excluded: boolean }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    const r = results[s][ni];
    if (!r || !r.stable) continue;
    attractors.push({ id: s, name: SUBTYPE_NAMES[s], mod: r.endModifier, excluded: isExcluded(niche.label, SUBTYPE_NAMES[s]) });
  }
  attractors.sort((a, b) => b.mod - a.mod);

  const excludedAttractors = attractors.filter(a => a.excluded);
  totalExcludedAttractors += excludedAttractors.length;
  totalAllowedAttractors += attractors.length - excludedAttractors.length;

  out('');
  out(`  ── ${niche.label} ──`);
  out(`    Stable attractors (${attractors.length}):`);
  for (const a of attractors.slice(0, 10)) {
    const tag = a.excluded ? ' [EXCL]' : '';
    out(`      ${pad(a.name, 16)} ${fmt(a.mod)}${tag}`);
  }
  if (excludedAttractors.length > 0) {
    out(`    WARNING — excluded subtypes are stable attractors: ${excludedAttractors.map(a => a.name).join(', ')}`);
  }
}

// Section 4: Global summary
out('');
out('═══════════════════════════════════════════════════════════════════════');
out('  SECTION 4: Global Summary');
out('═══════════════════════════════════════════════════════════════════════');
out('');

// Count unique stable attractors
const allStable = new Set<number>();
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    const r = results[s][ni];
    if (r && r.stable) allStable.add(s);
  }
}
out(`  Unique subtypes that are stable attractors somewhere: ${allStable.size}/40`);
out(`  Allowed stable attractors:    ${totalAllowedAttractors}`);
out(`  Excluded stable attractors:   ${totalExcludedAttractors}  (these are problems — excluded subtypes shouldn't be attractors)`);

// Drift patterns — what do most subtypes converge to?
out('');
out('  Top drift destinations (subtype → X, count across all niches):');
const globalDrifts = new Map<string, number>();
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    const r = results[s][ni];
    if (!r || r.stable) continue;
    const dest = SUBTYPE_NAMES[r.endSubtype];
    globalDrifts.set(dest, (globalDrifts.get(dest) || 0) + 1);
  }
}
const sortedDrifts = [...globalDrifts.entries()].sort((a, b) => b[1] - a[1]);
for (const [name, count] of sortedDrifts.slice(0, 15)) {
  out(`    ${pad(name, 16)} ← ${count} drifts`);
}

// Never-stable subtypes
out('');
out('  Never-stable subtypes (no niche where they survive hill-climbing):');
let neverStable = 0;
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  if (!repGenomes[s]) continue;
  if (!allStable.has(s)) {
    const r = results[s][0];
    const dest = r ? SUBTYPE_NAMES[r.endSubtype] : '?';
    out(`    ${pad(SUBTYPE_NAMES[s], 16)} (drifts to ${dest} everywhere)`);
    neverStable++;
  }
}
if (neverStable === 0) out('    (none)');

out('');
process.stderr.write('Done.\n');
