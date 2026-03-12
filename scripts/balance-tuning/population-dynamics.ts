/**
 * Non-spatial Population Dynamics Simulator
 *
 * Simulates subtype competition within each niche using real trait engine +
 * FDS + tier light competition, but without a spatial grid. Runs all 16 niches
 * in under a second.
 *
 * Usage:
 *   npx tsx scripts/balance-tuning/population-dynamics.ts              # default FDS=2.5
 *   npx tsx scripts/balance-tuning/population-dynamics.ts --fds 1.0    # custom FDS
 *   npx tsx scripts/balance-tuning/population-dynamics.ts --sweep      # sweep FDS 0→3
 */

import { Genome, TerrainType, archetype } from '../../src/types/core';
import { ClimateZone, CLIMATE_ZONE_COUNT } from '../../src/types/environment';
import { classifySubtype, SUBTYPE_NAMES } from '../../src/types/subtypes';
import { EFFECTIVE_ENV, computeTraitModifier, getEnvIdx } from '../../src/simulation/trait-effects';
import { SIM, getPlantConstants } from '../../src/types/constants';
import {
  CANOPY_THRESHOLD, GROUND_THRESHOLD,
  CANOPY_FILTER_COEFF, UNDERSTORY_FILTER_COEFF, MIN_TIER_LIGHT,
} from '../../src/types/constants';

// ── Constants ──

const TERRAIN_COUNT = 6;
const SUBTYPE_COUNT = 40;
const SKIP_TERRAIN = 1; // River

const TERRAIN_NAMES = ['Soil', 'River', 'Rock', 'Hill', 'Wetland', 'Arid'];
const CLIMATE_NAMES = ['Temperate', 'Tropical', 'Mediterr', 'Desert'];
const ARCHETYPE_NAMES = ['Grass', 'Shrub', 'Succulent', 'Tree', 'Forb'];

interface Niche { cz: number; tt: number; label: string; }
const NICHES: Niche[] = [];
for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
  for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
    if (tt === SKIP_TERRAIN) continue;
    NICHES.push({ cz, tt, label: `${CLIMATE_NAMES[cz]}/${TERRAIN_NAMES[tt]}` });
  }
}

// Skip Rock niches (not plantable)
const TARGET_NICHES = NICHES.filter(n => n.tt !== 2);

// ── Simulation parameters ──

const GENERATIONS = 500;
const INITIAL_POP = 50;
const CARRYING_CAPACITY = 400;
const MUTATION_FRAC = 0.03;
const MIN_POP = 0.5;

// ── Longevity-dependent mortality (replaces flat TURNOVER=0.15) ──
// Short-lived grass (maxAge=750): 13.3% + fragility
// Long-lived tree (maxAge=2500): 4.0% + fragility
const MORTALITY_SCALE = 100;
const MIN_MORTALITY = 0.02;

// ── r/K mortality tradeoff ──
// r-strategists (high seedInvestment) have thinner energy margins → more
// vulnerable to drought, herbivory, and stochastic stress. In the real sim
// this emerges from reduced growth/reserves; here we model it directly.
const SEED_INVEST_MORTALITY = 0.12;

// ── Diminishing returns on seed quantity ──
// In the real sim, seeds need empty cells nearby. Most seeds from r-strategists
// land on occupied cells and die. Power scaling models spatial bottleneck.
const SEED_SCALING_EXP = 0.7;

// ── Seed size establishment probability ──
// Larger seeds start with more energy → better seedling survival.
const ESTABLISHMENT_BASE = 0.3;
const ESTABLISHMENT_RANGE = 0.7;

// ── Arg parsing ──

const args = process.argv.slice(2);
const sweepMode = args.includes('--sweep');
const fdsIdx = args.indexOf('--fds');
const cmdFds = fdsIdx !== -1 && fdsIdx + 1 < args.length ? parseFloat(args[fdsIdx + 1]) : NaN;

// ── Helpers ──

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

function fmt(n: number, width = 6): string {
  const s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(1);
  return s.padStart(width);
}

function pad(s: string, w: number): string { return s.padEnd(w); }

// ── Step 1: Generate representative genomes ──

process.stderr.write('Generating representative genomes...\n');

const GRID_VALUES = [0.01, 0.5, 0.99];
const GRID_SIZE = Math.pow(3, 9);

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
    let sum = 0;
    for (const n of TARGET_NICHES) {
      sum += computeTraitModifier(clamped, EFFECTIVE_ENV[getEnvIdx(n.cz, n.tt)]);
    }
    const score = sum / TARGET_NICHES.length;
    if (score > repScores[subId]) {
      repScores[subId] = score;
      repGenomes[subId] = clamped;
    }
  }
}

const missing: number[] = [];
for (let i = 0; i < SUBTYPE_COUNT; i++) {
  if (!repGenomes[i]) missing.push(i);
}
if (missing.length > 0) {
  process.stderr.write(`WARNING: No genome for: ${missing.map(i => SUBTYPE_NAMES[i]).join(', ')}\n`);
}

// ── Step 2: Compute per-subtype properties ──

process.stderr.write('Computing subtype properties...\n');

interface SubtypeProps {
  genome: Genome;
  traitMod: Map<number, number>;
  matureHeight: number;
  matureLeafArea: number;
  maintenanceCost: number;
  seedProductionRate: number;
  maxAge: number;
  arch: number;
  establishment: number;
  deathRate: number;
}

const subtypeProps: (SubtypeProps | null)[] = new Array(SUBTYPE_COUNT).fill(null);

for (let s = 0; s < SUBTYPE_COUNT; s++) {
  const g = repGenomes[s];
  if (!g) continue;

  const pc = getPlantConstants(g);
  const arch = archetype(g);

  const total = g.rootPriority + g.heightPriority + g.leafSize;
  const hFrac = total > 0 ? g.heightPriority / total : 0;
  const lFrac = total > 0 ? g.leafSize / total : 0;
  const rFrac = total > 0 ? g.rootPriority / total : 0;

  const matureHeight = pc.maxHeight * (0.3 + 0.7 * hFrac);
  const matureLeaf = pc.maxLeafArea * (0.3 + 0.7 * lFrac);
  const matureRoot = pc.maxRootDepth * (0.3 + 0.7 * rFrac);

  const effectiveLeaf = Math.pow(matureLeaf, SIM.LEAF_EFFICIENCY_EXPONENT);
  const maintenance = pc.maintenanceBase
    + matureHeight * pc.maintenancePerHeight
    + matureRoot * pc.maintenancePerRoot
    + effectiveLeaf * pc.maintenancePerLeaf
    + g.defense * SIM.DEFENSE_MAINTENANCE_RATE
    + g.waterStorage * SIM.WATER_STORAGE_MAINTENANCE
    + g.seedInvestment * SIM.REPRODUCTIVE_MAINTENANCE_RATE
    + g.longevity * SIM.LONGEVITY_MAINTENANCE_RATE;

  const seedProductionRate = g.seedInvestment / (pc.seedEnergyCost * (SIM.SEED_SIZE_MULT_MIN + g.seedSize * SIM.SEED_SIZE_MULT_RANGE));

  const traitMod = new Map<number, number>();
  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    const n = TARGET_NICHES[ni];
    traitMod.set(ni, computeTraitModifier(g, EFFECTIVE_ENV[getEnvIdx(n.cz, n.tt)]));
  }

  const establishment = ESTABLISHMENT_BASE + g.seedSize * ESTABLISHMENT_RANGE;
  const deathRate = Math.max(MIN_MORTALITY, MORTALITY_SCALE / pc.maxAge + SEED_INVEST_MORTALITY * g.seedInvestment);

  subtypeProps[s] = {
    genome: g, traitMod, matureHeight, matureLeafArea: matureLeaf,
    maintenanceCost: maintenance, seedProductionRate, maxAge: pc.maxAge, arch,
    establishment, deathRate,
  };
}

// ── Mutation neighborhood (same archetype only) ──

const mutationNeighbors: number[][] = new Array(SUBTYPE_COUNT).fill(null).map(() => []);
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  if (!subtypeProps[s]) continue;
  const arch = subtypeProps[s]!.arch;
  for (let t = 0; t < SUBTYPE_COUNT; t++) {
    if (t === s || !subtypeProps[t]) continue;
    if (subtypeProps[t]!.arch === arch) mutationNeighbors[s].push(t);
  }
}

// ── Core simulation function ──

interface NicheResult {
  niche: Niche;
  populations: { subtypeId: number; pop: number; pct: number }[];
  extinct: number[];
  dominant: number;
  generations: number;
}

function runNiche(ni: number, fdsStrength: number): NicheResult {
  const niche = TARGET_NICHES[ni];

  const pop: number[] = new Array(SUBTYPE_COUNT).fill(0);
  const viable: number[] = [];

  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!subtypeProps[s]) continue;
    pop[s] = INITIAL_POP;
    viable.push(s);
  }

  if (viable.length === 0) {
    return { niche, populations: [], extinct: [], dominant: -1, generations: 0 };
  }

  let equilibriumGen = GENERATIONS;

  for (let gen = 0; gen < GENERATIONS; gen++) {
    const totalPop = pop.reduce((a, b) => a + b, 0);
    if (totalPop < 1) break;

    // ── Tier light competition ──
    const heightSorted = viable
      .filter(s => pop[s] >= MIN_POP)
      .map(s => ({ s, h: subtypeProps[s]!.matureHeight, pop: pop[s] }))
      .sort((a, b) => b.h - a.h);

    let canopyPop = 0, understoryPop = 0;
    for (const { s, h, pop: p } of heightSorted) {
      if (h >= CANOPY_THRESHOLD) canopyPop += p;
      else if (h >= GROUND_THRESHOLD) understoryPop += p;
    }

    // ── Spatial light model ──
    // In the real sim, not all cells have trees. Ground plants in open cells
    // get full light. We model this by computing the fraction of "cells"
    // covered by each tier and giving uncovered plants full light.
    const fullLight = SIM.BASE_LIGHT;

    // Fraction of cells covered by canopy/understory (each individual occupies ~1 cell)
    const canopyCoverage = Math.min(1.0, canopyPop / CARRYING_CAPACITY);
    const understoryCoverage = Math.min(1.0, understoryPop / CARRYING_CAPACITY);

    // Compute leaf density per tier (for shading calculation)
    let canopyLeafDensity = 0, understoryLeafDensity = 0;
    if (canopyPop > 0) {
      for (const { s, h, pop: p } of heightSorted) {
        if (h >= CANOPY_THRESHOLD) canopyLeafDensity += subtypeProps[s]!.matureLeafArea * p;
      }
      canopyLeafDensity /= canopyPop; // avg leaf area per canopy plant
    }
    if (understoryPop > 0) {
      for (const { s, h, pop: p } of heightSorted) {
        if (h >= GROUND_THRESHOLD && h < CANOPY_THRESHOLD) understoryLeafDensity += subtypeProps[s]!.matureLeafArea * p;
      }
      understoryLeafDensity /= understoryPop;
    }

    // Light under canopy and under understory
    const shadedByCanopy = Math.max(MIN_TIER_LIGHT, fullLight * (1 - canopyLeafDensity * CANOPY_FILTER_COEFF));
    const shadedByUnderstory = Math.max(MIN_TIER_LIGHT, fullLight * (1 - understoryLeafDensity * UNDERSTORY_FILTER_COEFF));

    // Canopy plants: always full light
    // Understory plants: mix of open (no canopy above) and shaded (under canopy)
    const understoryLight = canopyCoverage * shadedByCanopy + (1 - canopyCoverage) * fullLight;
    // Ground plants: can be under canopy, under understory, or in open cells
    const coveredFraction = Math.min(1.0, canopyCoverage + understoryCoverage);
    const deepShade = Math.max(MIN_TIER_LIGHT, shadedByCanopy * (1 - understoryLeafDensity * UNDERSTORY_FILTER_COEFF));
    const groundLight = coveredFraction * deepShade + (1 - coveredFraction) * fullLight;

    const tierLight: Map<number, number> = new Map();
    for (const { s, h } of heightSorted) {
      tierLight.set(s, h >= CANOPY_THRESHOLD ? fullLight : h >= GROUND_THRESHOLD ? understoryLight : groundLight);
    }

    // ── Compute per-subtype energy surplus ──
    const surplus: number[] = new Array(SUBTYPE_COUNT).fill(0);

    for (const s of viable) {
      if (pop[s] < MIN_POP) continue;

      const props = subtypeProps[s]!;
      const traitMod = props.traitMod.get(ni) ?? -1;
      const light = tierLight.get(s) ?? groundLight;

      const effectiveLeaf = Math.pow(props.matureLeafArea, SIM.LEAF_EFFICIENCY_EXPONENT);
      const rawEnergy = light * effectiveLeaf * SIM.PHOTOSYNTHESIS_RATE;
      const energy = rawEnergy * Math.max(0.15, 1.0 + traitMod);
      surplus[s] = energy - props.maintenanceCost;
    }

    // ── Reproductive fitness with diminishing seed returns ──
    // In the real sim, most seeds land on occupied cells. sqrt scaling models
    // this spatial bottleneck: doubling seed count less than doubles success.
    const reproFitness: number[] = new Array(SUBTYPE_COUNT).fill(0);
    let totalReproFitness = 0;

    for (const s of viable) {
      if (pop[s] < MIN_POP) continue;

      const props = subtypeProps[s]!;
      if (surplus[s] <= 0) continue; // no surplus → no reproduction

      // Seed production with diminishing returns (sqrt scaling)
      let f = surplus[s] * Math.pow(props.seedProductionRate, SEED_SCALING_EXP);

      // Seed quality: larger seeds establish better
      f *= props.establishment;

      // FDS: frequency-dependent selection on reproduction
      const freq = pop[s] / totalPop;
      const fdsMult = Math.max(0.3, Math.min(2.0, 1.0 - (freq - 1.0 / SUBTYPE_COUNT) * fdsStrength));
      f *= fdsMult;

      reproFitness[s] = Math.max(0, f);
      totalReproFitness += reproFitness[s] * pop[s];
    }

    // ── Longevity-based mortality + stress → survivors and freed slots ──
    const newPop: number[] = new Array(SUBTYPE_COUNT).fill(0);
    let totalDeaths = 0;

    for (const s of viable) {
      if (pop[s] < MIN_POP) continue;

      const props = subtypeProps[s]!;
      const traitMod = props.traitMod.get(ni) ?? -1;

      // Per-subtype death rate: short-lived species turn over fast
      const stressMort = traitMod < SIM.STRESS_MORTALITY_THRESHOLD ? SIM.STRESS_MORTALITY_RATE : 0;
      const survivalRate = (1.0 - props.deathRate) * (1.0 - stressMort);
      const survivors = pop[s] * survivalRate;
      const deaths = pop[s] - survivors;

      totalDeaths += deaths;
      newPop[s] = survivors;
    }

    // ── Recruits compete for freed slots (deaths = available space) ──
    for (const s of viable) {
      if (pop[s] < MIN_POP || reproFitness[s] <= 0 || totalReproFitness <= 0) continue;

      const share = (reproFitness[s] * pop[s]) / totalReproFitness;
      let recruits = totalDeaths * share;

      // Mutation: some recruits become neighboring subtypes
      if (recruits > 0 && mutationNeighbors[s].length > 0) {
        const mutants = recruits * MUTATION_FRAC;
        recruits -= mutants;
        const perNeighbor = mutants / mutationNeighbors[s].length;
        for (const neighbor of mutationNeighbors[s]) newPop[neighbor] += perNeighbor;
      }

      newPop[s] += recruits;
    }

    let maxDelta = 0;
    for (const s of viable) {
      if (pop[s] >= MIN_POP || newPop[s] >= MIN_POP) {
        const delta = Math.abs(newPop[s] - pop[s]) / Math.max(pop[s], 1);
        maxDelta = Math.max(maxDelta, delta);
      }
    }
    if (gen > 50 && maxDelta < 0.01) equilibriumGen = gen;

    for (let s = 0; s < SUBTYPE_COUNT; s++) {
      pop[s] = newPop[s] < MIN_POP ? 0 : newPop[s];
    }
  }

  const totalPop = pop.reduce((a, b) => a + b, 0);
  const populations: { subtypeId: number; pop: number; pct: number }[] = [];
  const extinct: number[] = [];
  let dominant = -1, maxPop = 0;

  for (const s of viable) {
    if (pop[s] >= MIN_POP) {
      const pct = totalPop > 0 ? (pop[s] / totalPop) * 100 : 0;
      populations.push({ subtypeId: s, pop: pop[s], pct });
      if (pop[s] > maxPop) { maxPop = pop[s]; dominant = s; }
    } else {
      extinct.push(s);
    }
  }
  populations.sort((a, b) => b.pct - a.pct);

  return { niche, populations, extinct, dominant, generations: equilibriumGen };
}

function runAllNiches(fdsStrength: number): NicheResult[] {
  const results: NicheResult[] = [];
  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    results.push(runNiche(ni, fdsStrength));
  }
  return results;
}

// ── Output helpers ──

const out = (s: string) => process.stdout.write(s + '\n');

function countExtinct(results: NicheResult[]): number {
  let count = 0;
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!subtypeProps[s]) continue;
    const alive = results.some(r => r.populations.some(p => p.subtypeId === s && p.pct >= 1));
    if (!alive) count++;
  }
  return count;
}

function getExtinctNames(results: NicheResult[]): string[] {
  const names: string[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!subtypeProps[s]) continue;
    const alive = results.some(r => r.populations.some(p => p.subtypeId === s && p.pct >= 1));
    if (!alive) names.push(SUBTYPE_NAMES[s]);
  }
  return names;
}

function avgSurviving(results: NicheResult[]): number {
  return results.reduce((a, r) => a + r.populations.length, 0) / results.length;
}

function avgTopPct(results: NicheResult[]): number {
  return results.reduce((a, r) => a + (r.populations.length > 0 ? r.populations[0].pct : 0), 0) / results.length;
}

function avgTop3Pct(results: NicheResult[]): number {
  return results.reduce((a, r) => a + r.populations.slice(0, 3).reduce((b, p) => b + p.pct, 0), 0) / results.length;
}

// ── Sweep mode ──

if (sweepMode) {
  process.stderr.write('Running FDS sweep...\n');

  const FDS_VALUES = [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

  out('');
  out('═══════════════════════════════════════════════════════════════════════════════════');
  out('  FDS STRENGTH SWEEP — How frequency-dependent selection affects population dynamics');
  out('═══════════════════════════════════════════════════════════════════════════════════');

  // Summary table
  out('');
  out(`  ${pad('FDS', 5)} ${pad('AvgSurv', 8)} ${pad('AvgTop%', 8)} ${pad('AvgTop3%', 9)} ${pad('Extinct', 8)} ${pad('Monopol', 8)}`);
  out(`  ${'─'.repeat(5)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(9)} ${'─'.repeat(8)} ${'─'.repeat(8)}`);

  const sweepResults: { fds: number; results: NicheResult[] }[] = [];

  for (const fds of FDS_VALUES) {
    process.stderr.write(`  FDS=${fds}...\n`);
    const results = runAllNiches(fds);
    sweepResults.push({ fds, results });

    const extinct = countExtinct(results);
    const monopolized = results.filter(r => r.populations.length > 0 && r.populations[0].pct > 60).length;

    out(`  ${fmt(fds, 5)} ${fmt(avgSurviving(results), 8)} ${fmt(avgTopPct(results), 7)}% ${fmt(avgTop3Pct(results), 8)}% ${fmt(extinct, 8)} ${fmt(monopolized, 8)}`);
  }

  // Detail for each FDS value: per-niche dominant + diversity
  out('');
  out('───────────────────────────────────────────────────────────────────────────────────');
  out('  Per-Niche Dominant Subtype at Each FDS Level');
  out('───────────────────────────────────────────────────────────────────────────────────');
  out('');

  // Header
  const fdsLabels = FDS_VALUES.map(f => f.toFixed(2));
  out(`  ${pad('Niche', 20)} ${fdsLabels.map(f => pad(f, 14)).join(' ')}`);
  out(`  ${'─'.repeat(20)} ${fdsLabels.map(() => '─'.repeat(14)).join(' ')}`);

  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    const parts: string[] = [];
    for (const { results } of sweepResults) {
      const r = results[ni];
      if (r.populations.length > 0) {
        const top = r.populations[0];
        const name = SUBTYPE_NAMES[top.subtypeId].slice(0, 10);
        parts.push(`${name} ${top.pct.toFixed(0)}%`.padEnd(14));
      } else {
        parts.push(pad('(empty)', 14));
      }
    }
    out(`  ${pad(TARGET_NICHES[ni].label, 20)} ${parts.join(' ')}`);
  }

  // Extinct subtypes at each level
  out('');
  out('───────────────────────────────────────────────────────────────────────────────────');
  out('  Extinct Subtypes at Each FDS Level');
  out('───────────────────────────────────────────────────────────────────────────────────');
  out('');

  for (const { fds, results } of sweepResults) {
    const extinct = getExtinctNames(results);
    if (extinct.length > 0) {
      out(`  FDS=${fds.toFixed(2)}: ${extinct.length} extinct — ${extinct.join(', ')}`);
    } else {
      out(`  FDS=${fds.toFixed(2)}: none extinct`);
    }
  }

  // Niche differentiation: do different niches have different dominants?
  out('');
  out('───────────────────────────────────────────────────────────────────────────────────');
  out('  Niche Differentiation (unique dominants across niches)');
  out('───────────────────────────────────────────────────────────────────────────────────');
  out('');

  for (const { fds, results } of sweepResults) {
    const dominants = new Set(results.map(r => r.dominant).filter(d => d >= 0));
    const top3sets = new Set<number>();
    for (const r of results) {
      for (const p of r.populations.slice(0, 3)) top3sets.add(p.subtypeId);
    }
    out(`  FDS=${fmt(fds, 4)}: ${pad(String(dominants.size), 3)} unique dominants, ${pad(String(top3sets.size), 3)} in any top-3`);
  }

  out('');
  process.stderr.write('Done.\n');

} else {
  // ── Single run mode ──

  const fdsStrength = !isNaN(cmdFds) ? cmdFds : 2.5;
  process.stderr.write(`Running population dynamics (FDS=${fdsStrength})...\n`);

  const results = runAllNiches(fdsStrength);

  out('');
  out('═══════════════════════════════════════════════════════════════════════');
  out('  POPULATION DYNAMICS — Non-spatial Equilibrium Simulator');
  out('  (Trait Engine + FDS + Tier Light Competition)');
  out(`  ${GENERATIONS} generations, K=${CARRYING_CAPACITY}, FDS=${fdsStrength}`);
  out('═══════════════════════════════════════════════════════════════════════');

  // Section A: Per-niche equilibrium
  out('');
  out('───────────────────────────────────────────────────────────────────────');
  out('  SECTION A: Per-Niche Equilibrium Populations');
  out('───────────────────────────────────────────────────────────────────────');

  for (const r of results) {
    out('');
    out(`  ${pad(r.niche.label, 20)} (equilibrium at gen ${r.generations}, ${r.populations.length} surviving)`);

    for (let i = 0; i < Math.min(8, r.populations.length); i++) {
      const p = r.populations[i];
      const bar = '█'.repeat(Math.round(p.pct / 2));
      const arch = subtypeProps[p.subtypeId]?.arch ?? -1;
      out(`    ${pad(SUBTYPE_NAMES[p.subtypeId], 16)} ${fmt(p.pct, 5)}%  ${pad(ARCHETYPE_NAMES[arch] ?? '?', 10)} ${bar}`);
    }
    if (r.populations.length > 8) {
      out(`    ... and ${r.populations.length - 8} more`);
    }
  }

  // Section B: Diversity summary
  out('');
  out('───────────────────────────────────────────────────────────────────────');
  out('  SECTION B: Niche Diversity Summary');
  out('───────────────────────────────────────────────────────────────────────');
  out('');
  out(`  ${pad('Niche', 20)} ${pad('Surviving', 10)} ${pad('Top Subtype', 16)} ${pad('Top%', 6)} ${pad('Top3%', 6)} ${pad('Equil', 6)}`);
  out(`  ${'─'.repeat(20)} ${'─'.repeat(10)} ${'─'.repeat(16)} ${'─'.repeat(6)} ${'─'.repeat(6)} ${'─'.repeat(6)}`);

  for (const r of results) {
    const topName = r.dominant >= 0 ? SUBTYPE_NAMES[r.dominant] : '(empty)';
    const topPct = r.populations.length > 0 ? r.populations[0].pct : 0;
    const top3Pct = r.populations.slice(0, 3).reduce((a, p) => a + p.pct, 0);
    out(`  ${pad(r.niche.label, 20)} ${pad(String(r.populations.length), 10)} ${pad(topName, 16)} ${fmt(topPct, 5)}% ${fmt(top3Pct, 5)}% ${pad(String(r.generations), 6)}`);
  }

  // Section C: Per-subtype presence
  out('');
  out('───────────────────────────────────────────────────────────────────────');
  out('  SECTION C: Subtype Presence (% in each niche where present)');
  out('───────────────────────────────────────────────────────────────────────');
  out('');

  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!subtypeProps[s]) continue;
    const presences: { niche: string; pct: number }[] = [];
    for (let ni = 0; ni < results.length; ni++) {
      const entry = results[ni].populations.find(p => p.subtypeId === s);
      if (entry && entry.pct >= 1) presences.push({ niche: results[ni].niche.label, pct: entry.pct });
    }
    presences.sort((a, b) => b.pct - a.pct);
    const arch = subtypeProps[s]!.arch;
    const top3 = presences.slice(0, 3).map(p => `${p.niche} ${p.pct.toFixed(0)}%`).join(', ');
    const status = presences.length === 0 ? 'EXTINCT EVERYWHERE' : `${presences.length} niches`;
    out(`  ${pad(SUBTYPE_NAMES[s], 16)} ${pad(ARCHETYPE_NAMES[arch], 10)} ${pad(status, 18)} ${top3}`);
  }

  // Section D: Diagnostics
  out('');
  out('───────────────────────────────────────────────────────────────────────');
  out('  SECTION D: Diagnostics');
  out('───────────────────────────────────────────────────────────────────────');

  out('');
  out('  Monopolized niches (top subtype >60%):');
  let monoCount = 0;
  for (const r of results) {
    if (r.populations.length > 0 && r.populations[0].pct > 60) {
      out(`    ${pad(r.niche.label, 20)} ${pad(SUBTYPE_NAMES[r.populations[0].subtypeId], 16)} ${r.populations[0].pct.toFixed(1)}%`);
      monoCount++;
    }
  }
  if (monoCount === 0) out('    (none)');

  out('');
  out('  Low-diversity niches (<3 subtypes >5%):');
  let lowDivCount = 0;
  for (const r of results) {
    const significant = r.populations.filter(p => p.pct > 5).length;
    if (significant < 3) {
      const names = r.populations.filter(p => p.pct > 5).map(p => SUBTYPE_NAMES[p.subtypeId]).join(', ');
      out(`    ${pad(r.niche.label, 20)} ${significant} subtypes: ${names}`);
      lowDivCount++;
    }
  }
  if (lowDivCount === 0) out('    (none)');

  out('');
  out('  Globally extinct subtypes (0% in all niches):');
  const extinctNames = getExtinctNames(results);
  if (extinctNames.length > 0) {
    for (const name of extinctNames) out(`    ${name}`);
  } else {
    out('    (none)');
  }

  out('');
  out('  Archetype balance per niche:');
  for (const r of results) {
    const archPop: number[] = [0, 0, 0, 0, 0];
    for (const p of r.populations) {
      archPop[subtypeProps[p.subtypeId]?.arch ?? 0] += p.pct;
    }
    const parts = ARCHETYPE_NAMES.map((name, i) => archPop[i] > 1 ? `${name.slice(0, 3)}:${archPop[i].toFixed(0)}%` : '').filter(Boolean).join(' ');
    out(`    ${pad(r.niche.label, 20)} ${parts}`);
  }

  out('');
  process.stderr.write('Done.\n');
}
