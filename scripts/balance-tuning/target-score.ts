/**
 * Target Matrix Score — single-number compliance check.
 *
 * Compares balance-matrix output (pure-math trait modifiers) against target-matrix.md.
 * Outputs a single compliance percentage + per-gate breakdown.
 * Runs in milliseconds — use as primary iteration feedback.
 *
 * Usage: npx tsx scripts/balance-tuning/target-score.ts
 *        npx tsx scripts/balance-tuning/target-score.ts --verbose
 */

import { Genome, TerrainType, archetype } from '../../src/types/core';
import { ClimateZone, CLIMATE_ZONE_COUNT } from '../../src/types/environment';
import { classifySubtype, SUBTYPE_NAMES } from '../../src/types/subtypes';
import { EFFECTIVE_ENV, computeTraitModifier, getEnvIdx } from '../../src/simulation/trait-effects';
import { getTargetTier, getSubtypesForTier, TARGET_NICHE_LABELS, type Tier } from './lib/target-matrix';

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

interface NicheRanking { name: string; modifier: number; rank: number; }

function getNicheRankings(niche: Niche): NicheRanking[] {
  const entries: { name: string; mod: number }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    const env = EFFECTIVE_ENV[getEnvIdx(niche.cz, niche.tt)];
    entries.push({ name: SUBTYPE_NAMES[s], mod: computeTraitModifier(repGenomes[s]!, env) });
  }
  entries.sort((a, b) => b.mod - a.mod);
  return entries.map((e, i) => ({ name: e.name, modifier: e.mod, rank: i + 1 }));
}

// ── Score against target matrix ──

const out = (s: string) => process.stdout.write(s + '\n');

let absentViolations = 0;
let absentTotal = 0;
let dominantHits = 0;
let dominantTotal = 0;
let commonPositive = 0;
let commonTotal = 0;
let minorReasonable = 0; // modifier > -0.5 (not strongly penalized)
let minorTotal = 0;

interface NicheReport {
  label: string;
  absentInTop5: string[];
  dominantInTop3: string[];
  dominantMissing: string[];
  commonNegative: string[];
}

const nicheReports: NicheReport[] = [];

for (const niche of TARGET_NICHES) {
  const rankings = getNicheRankings(niche);
  const rankMap = new Map(rankings.map(r => [r.name, r]));
  const top5Names = new Set(rankings.slice(0, 5).map(r => r.name));
  const top3Names = new Set(rankings.slice(0, 3).map(r => r.name));

  const report: NicheReport = {
    label: niche.label,
    absentInTop5: [],
    dominantInTop3: [],
    dominantMissing: [],
    commonNegative: [],
  };

  // Gate 1: Absent subtypes must NOT be in top-5
  const absentSubtypes = getSubtypesForTier(niche.label, 'absent');
  // Everything not listed as dominant/common/minor is absent
  const allListed = new Set([
    ...getSubtypesForTier(niche.label, 'dominant'),
    ...getSubtypesForTier(niche.label, 'common'),
    ...getSubtypesForTier(niche.label, 'minor'),
  ]);
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    const name = SUBTYPE_NAMES[s];
    if (!allListed.has(name)) {
      absentTotal++;
      if (top5Names.has(name)) {
        absentViolations++;
        report.absentInTop5.push(name);
      }
    }
  }

  // Gate 2: Dominant subtypes should be in top-3
  const dominants = getSubtypesForTier(niche.label, 'dominant');
  for (const name of dominants) {
    dominantTotal++;
    if (top3Names.has(name)) {
      dominantHits++;
      report.dominantInTop3.push(name);
    } else {
      report.dominantMissing.push(name);
    }
  }

  // Gate 3: Common subtypes should have positive modifiers
  const commons = getSubtypesForTier(niche.label, 'common');
  for (const name of commons) {
    commonTotal++;
    const r = rankMap.get(name);
    if (r && r.modifier > 0) {
      commonPositive++;
    } else {
      report.commonNegative.push(name);
    }
  }

  // Gate 4: Minor subtypes shouldn't be strongly penalized
  const minors = getSubtypesForTier(niche.label, 'minor');
  for (const name of minors) {
    minorTotal++;
    const r = rankMap.get(name);
    if (r && r.modifier > -0.5) minorReasonable++;
  }

  nicheReports.push(report);
}

// ── Compute scores ──

const absentScore = absentTotal > 0 ? ((absentTotal - absentViolations) / absentTotal) * 100 : 100;
const dominantScore = dominantTotal > 0 ? (dominantHits / dominantTotal) * 100 : 100;
const commonScore = commonTotal > 0 ? (commonPositive / commonTotal) * 100 : 100;
const minorScore = minorTotal > 0 ? (minorReasonable / minorTotal) * 100 : 100;

// Weighted overall: absent gate matters most, then dominant, then common, then minor
const overallScore = absentScore * 0.35 + dominantScore * 0.35 + commonScore * 0.20 + minorScore * 0.10;

// ── Output ──

out('');
out('╔═══════════════════════════════════════════════════════════╗');
out(`║  TARGET MATRIX COMPLIANCE:  ${overallScore.toFixed(1).padStart(5)}%                       ║`);
out('╚═══════════════════════════════════════════════════════════╝');
out('');
out('  Gate breakdown:');
out(`    Absent gate (35%):   ${absentScore.toFixed(1).padStart(5)}%  (${absentTotal - absentViolations}/${absentTotal} absent subtypes correctly outside top-5)`);
out(`    Dominant gate (35%): ${dominantScore.toFixed(1).padStart(5)}%  (${dominantHits}/${dominantTotal} dominant subtypes in top-3)`);
out(`    Common gate (20%):   ${commonScore.toFixed(1).padStart(5)}%  (${commonPositive}/${commonTotal} common subtypes with positive modifier)`);
out(`    Minor gate (10%):    ${minorScore.toFixed(1).padStart(5)}%  (${minorReasonable}/${minorTotal} minor subtypes not strongly penalized)`);

// Per-niche problems
out('');
out('  Per-niche issues:');

let cleanNiches = 0;
for (const report of nicheReports) {
  const problems: string[] = [];

  if (report.absentInTop5.length > 0)
    problems.push(`ABSENT in top-5: ${report.absentInTop5.join(', ')}`);
  if (report.dominantMissing.length > 0)
    problems.push(`DOMINANT missing from top-3: ${report.dominantMissing.join(', ')}`);
  if (verbose && report.commonNegative.length > 0)
    problems.push(`COMMON negative: ${report.commonNegative.join(', ')}`);

  if (problems.length > 0) {
    out(`    ${report.label}:`);
    for (const p of problems) out(`      - ${p}`);
  } else {
    cleanNiches++;
  }
}

if (cleanNiches > 0) out(`    (${cleanNiches} niches fully compliant)`);

// Diagnostic: missing dominants sorted by gap to top-3
out('');
out('  Missing dominant entries (sorted by gap to top-3):');
const gaps: { niche: string; name: string; rank: number; mod: number; top3mod: number; gap: number }[] = [];
for (const niche of TARGET_NICHES) {
  const rankings = getNicheRankings(niche);
  const top3Mod = rankings.length >= 3 ? rankings[2].modifier : -Infinity;
  const dominants = getSubtypesForTier(niche.label, 'dominant');
  const top3Names = new Set(rankings.slice(0, 3).map(r => r.name));
  for (const name of dominants) {
    if (top3Names.has(name)) continue;
    const r = rankings.find(x => x.name === name);
    if (!r) continue;
    gaps.push({ niche: niche.label, name, rank: r.rank, mod: r.modifier, top3mod: top3Mod, gap: top3Mod - r.modifier });
  }
}
gaps.sort((a, b) => a.gap - b.gap);
for (const g of gaps.slice(0, 20)) {
  out(`    ${g.niche.padEnd(18)} ${g.name.padEnd(16)} rank #${String(g.rank).padStart(2)}  mod=${g.mod >= 0 ? '+' : ''}${g.mod.toFixed(3)}  top3=${g.top3mod >= 0 ? '+' : ''}${g.top3mod.toFixed(3)}  gap=${g.gap.toFixed(3)}`);
}

// Diagnostic: dump top-10 for problem niches
if (verbose) {
  out('');
  out('  Per-niche top-10 rankings:');
  const dumpNiches = ['Temperate/Hill', 'Temperate/Arid', 'Mediterr/Hill', 'Mediterr/Wetland', 'Mediterr/Arid', 'Tropical/Soil', 'Tropical/Hill', 'Desert/Soil', 'Desert/Hill', 'Desert/Wetland', 'Temperate/Wetland', 'Tropical/Arid'];
  for (const nicheLabel of dumpNiches) {
    const niche = TARGET_NICHES.find(n => n.label === nicheLabel);
    if (!niche) continue;
    const rankings = getNicheRankings(niche);
    out(`    ${nicheLabel}:`);
    for (const r of rankings.slice(0, 10)) {
      const tier = getTargetTier(nicheLabel, r.name);
      const tierTag = tier === 'dominant' ? ' [DOM]' : tier === 'common' ? ' [com]' : tier === 'minor' ? ' [min]' : ' [ABS]';
      out(`      #${String(r.rank).padStart(2)}  ${r.name.padEnd(16)} ${r.modifier >= 0 ? '+' : ''}${r.modifier.toFixed(3)}${tierTag}`);
    }
  }
}

out('');
