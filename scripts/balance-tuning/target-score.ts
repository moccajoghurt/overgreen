/**
 * Target Matrix Score — two-gate compliance check.
 *
 * Gate 1 (Exclusion): Excluded subtypes must NOT appear in a niche's top-5.
 * Gate 2 (Archetype): Strong archetypes must have ≥1 subtype in the top-5 with positive modifier.
 *
 * Usage: npx tsx scripts/balance-tuning/target-score.ts
 *        npx tsx scripts/balance-tuning/target-score.ts --verbose
 */

import { Genome, archetype, Archetype } from '../../src/types/core';
import { ClimateZone, CLIMATE_ZONE_COUNT } from '../../src/types/environment';
import { classifySubtype, SUBTYPE_NAMES, subtypeArchetype, SubtypeId } from '../../src/types/subtypes';
import { EFFECTIVE_ENV, computeTraitModifier, getEnvIdx } from '../../src/simulation/trait-effects';
import { EXCLUDED, STRONG_ARCHETYPES, TARGET_NICHE_LABELS, archetypeName, isExcluded } from './lib/target-matrix';

const verbose = process.argv.includes('--verbose');

// ── Constants ──

const TERRAIN_COUNT = 6;
const SUBTYPE_COUNT = 40;
const SKIP_TERRAIN = 1; // River

const TERRAIN_NAMES = ['Soil', 'River', 'Rock', 'Hill', 'Wetland', 'Arid'];
const CLIMATE_NAMES = ['Temperate', 'Tropical', 'Mediterr', 'Desert'];

interface Niche { cz: number; tt: number; label: string; }
const NICHES: Niche[] = [];
for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
  for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
    if (tt === SKIP_TERRAIN) continue;
    NICHES.push({ cz, tt, label: `${CLIMATE_NAMES[cz]}/${TERRAIN_NAMES[tt]}` });
  }
}

// Only the 16 target niches (skip Rock)
const TARGET_NICHES = NICHES.filter(n => n.tt !== 2);

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

// ── Generate representative genomes (same as balance-matrix.ts) ──

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

// ── Compute rankings per niche ──

interface NicheRanking { name: string; modifier: number; rank: number; archetype: Archetype; }

function getNicheRankings(niche: Niche): NicheRanking[] {
  const entries: { name: string; mod: number; arch: Archetype }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    const env = EFFECTIVE_ENV[getEnvIdx(niche.cz, niche.tt)];
    entries.push({
      name: SUBTYPE_NAMES[s],
      mod: computeTraitModifier(repGenomes[s]!, env),
      arch: subtypeArchetype(s as SubtypeId),
    });
  }
  entries.sort((a, b) => b.mod - a.mod);
  return entries.map((e, i) => ({ name: e.name, modifier: e.mod, rank: i + 1, archetype: e.arch }));
}

// ── Score against target matrix ──

const out = (s: string) => process.stdout.write(s + '\n');

let exclusionViolations = 0;
let exclusionTotal = 0;
let archetypeHits = 0;
let archetypeTotal = 0;

interface NicheReport {
  label: string;
  excludedInTop5: string[];
  archetypeMissing: string[];
  archetypePresent: string[];
}

const nicheReports: NicheReport[] = [];

for (const niche of TARGET_NICHES) {
  const rankings = getNicheRankings(niche);
  const top5 = rankings.slice(0, 5);
  const top5Names = new Set(top5.map(r => r.name));

  const report: NicheReport = {
    label: niche.label,
    excludedInTop5: [],
    archetypeMissing: [],
    archetypePresent: [],
  };

  // Gate 1: Excluded subtypes must NOT be in top-5
  for (const r of top5) {
    if (isExcluded(niche.label, r.name)) {
      exclusionViolations++;
      report.excludedInTop5.push(r.name);
    }
  }
  // Count total excluded subtypes that have representative genomes
  const excludedSet = EXCLUDED[niche.label];
  if (excludedSet) {
    for (let s = 0; s < SUBTYPE_COUNT; s++) {
      if (repGenomes[s] && excludedSet.has(SUBTYPE_NAMES[s])) exclusionTotal++;
    }
  }

  // Gate 2: Strong archetypes should have ≥1 subtype in top-5 with positive modifier
  const strongArchs = STRONG_ARCHETYPES[niche.label] ?? [];
  for (const arch of strongArchs) {
    archetypeTotal++;
    const hasStrong = top5.some(r => r.archetype === arch && r.modifier > 0);
    if (hasStrong) {
      archetypeHits++;
      report.archetypePresent.push(archetypeName(arch));
    } else {
      report.archetypeMissing.push(archetypeName(arch));
    }
  }

  nicheReports.push(report);
}

// ── Compute scores ──

const exclusionScore = exclusionTotal > 0 ? ((exclusionTotal - exclusionViolations) / exclusionTotal) * 100 : 100;
const archetypeScore = archetypeTotal > 0 ? (archetypeHits / archetypeTotal) * 100 : 100;

// Weighted overall: exclusion gate matters most
const overallScore = exclusionScore * 0.60 + archetypeScore * 0.40;

// ── Output ──

out('');
out('╔═══════════════════════════════════════════════════════════╗');
out(`║  TARGET MATRIX COMPLIANCE:  ${overallScore.toFixed(1).padStart(5)}%                       ║`);
out('╚═══════════════════════════════════════════════════════════╝');
out('');
out('  Gate breakdown:');
out(`    Exclusion gate (60%):  ${exclusionScore.toFixed(1).padStart(5)}%  (${exclusionTotal - exclusionViolations}/${exclusionTotal} excluded subtypes correctly outside top-5)`);
out(`    Archetype gate (40%): ${archetypeScore.toFixed(1).padStart(5)}%  (${archetypeHits}/${archetypeTotal} strong archetypes represented in top-5)`);

// Per-niche problems
out('');
out('  Per-niche issues:');

let cleanNiches = 0;
for (const report of nicheReports) {
  const problems: string[] = [];

  if (report.excludedInTop5.length > 0)
    problems.push(`EXCLUDED in top-5: ${report.excludedInTop5.join(', ')}`);
  if (report.archetypeMissing.length > 0)
    problems.push(`ARCHETYPE missing from top-5: ${report.archetypeMissing.join(', ')}`);

  if (problems.length > 0) {
    out(`    ${report.label}:`);
    for (const p of problems) out(`      - ${p}`);
  } else {
    cleanNiches++;
  }
}

if (cleanNiches > 0) out(`    (${cleanNiches} niches fully compliant)`);

// Diagnostic: exclusion violations detail
if (exclusionViolations > 0) {
  out('');
  out('  Exclusion violations (sorted by rank):');
  const violations: { niche: string; name: string; rank: number; mod: number }[] = [];
  for (const niche of TARGET_NICHES) {
    const rankings = getNicheRankings(niche);
    for (const r of rankings.slice(0, 5)) {
      if (isExcluded(niche.label, r.name)) {
        violations.push({ niche: niche.label, name: r.name, rank: r.rank, mod: r.modifier });
      }
    }
  }
  violations.sort((a, b) => a.rank - b.rank);
  for (const v of violations) {
    out(`    ${v.niche.padEnd(18)} ${v.name.padEnd(16)} rank #${String(v.rank).padStart(2)}  mod=${v.mod >= 0 ? '+' : ''}${v.mod.toFixed(3)}`);
  }
}

// Diagnostic: archetype gap analysis
const archGaps: { niche: string; arch: string; bestRank: number; bestMod: number; bestName: string }[] = [];
for (const niche of TARGET_NICHES) {
  const strongArchs = STRONG_ARCHETYPES[niche.label] ?? [];
  const rankings = getNicheRankings(niche);
  const top5 = rankings.slice(0, 5);
  for (const arch of strongArchs) {
    const inTop5 = top5.some(r => r.archetype === arch && r.modifier > 0);
    if (inTop5) continue;
    // Find best subtype of this archetype
    const best = rankings.find(r => r.archetype === arch);
    if (best) {
      archGaps.push({ niche: niche.label, arch: archetypeName(arch), bestRank: best.rank, bestMod: best.modifier, bestName: best.name });
    }
  }
}
if (archGaps.length > 0) {
  out('');
  out('  Missing archetype detail (best subtype per missing archetype):');
  archGaps.sort((a, b) => a.bestRank - b.bestRank);
  for (const g of archGaps) {
    out(`    ${g.niche.padEnd(18)} ${g.arch.padEnd(10)} best: ${g.bestName.padEnd(16)} rank #${String(g.bestRank).padStart(2)}  mod=${g.bestMod >= 0 ? '+' : ''}${g.bestMod.toFixed(3)}`);
  }
}

// Verbose: dump top-10 per niche
if (verbose) {
  out('');
  out('  Per-niche top-10 rankings:');
  const ARCH_SHORT: Record<number, string> = { 0: 'GRS', 1: 'SHR', 2: 'SUC', 3: 'TRE', 4: 'FRB' };
  for (const niche of TARGET_NICHES) {
    const rankings = getNicheRankings(niche);
    out(`    ${niche.label}:`);
    for (const r of rankings.slice(0, 10)) {
      const excluded = isExcluded(niche.label, r.name);
      const tag = excluded ? ' [EXCL]' : '';
      out(`      #${String(r.rank).padStart(2)}  ${r.name.padEnd(16)} ${r.modifier >= 0 ? '+' : ''}${r.modifier.toFixed(3)}  ${ARCH_SHORT[r.archetype] ?? '???'}${tag}`);
    }
  }
}

out('');
