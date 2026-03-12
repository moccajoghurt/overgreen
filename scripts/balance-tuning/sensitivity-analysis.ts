/**
 * OAT Sensitivity Analysis
 *
 * Varies one SIM/GRASS constant at a time (±25%, ±50%), runs the non-spatial
 * population dynamics model for each, measures how metrics change.
 * Identifies which parameters have the most impact on balance.
 *
 * Usage:
 *   npx tsx scripts/balance-tuning/sensitivity-analysis.ts
 *   npx tsx scripts/balance-tuning/sensitivity-analysis.ts --top 10     # show top 10 most sensitive
 *   npx tsx scripts/balance-tuning/sensitivity-analysis.ts --param FDS_STRENGTH  # single param detail
 */

import { Genome, archetype } from '../../src/types/core';
import { CLIMATE_ZONE_COUNT } from '../../src/types/environment';
import { classifySubtype, SUBTYPE_NAMES } from '../../src/types/subtypes';
import { EFFECTIVE_ENV, computeTraitModifier, getEnvIdx } from '../../src/simulation/trait-effects';
import { SIM, GRASS, getPlantConstants, clearPlantConstantsCache } from '../../src/types/constants';
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
const TARGET_NICHES = NICHES.filter(n => n.tt !== 2); // skip Rock

// ── Simulation parameters (same as population-dynamics.ts) ──

const GENERATIONS = 500;
const INITIAL_POP = 50;
const CARRYING_CAPACITY = 400;
const MUTATION_FRAC = 0.03;
const MIN_POP = 0.5;
const MORTALITY_SCALE = 100;
const MIN_MORTALITY = 0.02;
const SEED_INVEST_MORTALITY = 0.12;
const SEED_SCALING_EXP = 0.7;
const ESTABLISHMENT_BASE = 0.3;
const ESTABLISHMENT_RANGE = 0.7;

// ── Arg parsing ──

const args = process.argv.slice(2);
const topIdx = args.indexOf('--top');
const topN = topIdx !== -1 && topIdx + 1 < args.length ? parseInt(args[topIdx + 1]) : 0;
const paramIdx = args.indexOf('--param');
const singleParam = paramIdx !== -1 && paramIdx + 1 < args.length ? args[paramIdx + 1] : null;

// ── Genome helpers (same as population-dynamics.ts) ──

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

// ── Generate representative genomes ──

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

// ── Subtype property computation (recomputed per parameter perturbation) ──

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

function computeSubtypeProps(): (SubtypeProps | null)[] {
  const props: (SubtypeProps | null)[] = new Array(SUBTYPE_COUNT).fill(null);
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
    props[s] = {
      genome: g, traitMod, matureHeight, matureLeafArea: matureLeaf,
      maintenanceCost: maintenance, seedProductionRate, maxAge: pc.maxAge, arch,
      establishment, deathRate,
    };
  }
  return props;
}

// ── Mutation neighborhood ──

function buildMutationNeighbors(props: (SubtypeProps | null)[]): number[][] {
  const neighbors: number[][] = new Array(SUBTYPE_COUNT).fill(null).map(() => []);
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!props[s]) continue;
    const arch = props[s]!.arch;
    for (let t = 0; t < SUBTYPE_COUNT; t++) {
      if (t === s || !props[t]) continue;
      if (props[t]!.arch === arch) neighbors[s].push(t);
    }
  }
  return neighbors;
}

// ── Core niche simulation (same logic as population-dynamics.ts) ──

interface NicheResult {
  populations: { subtypeId: number; pop: number; pct: number }[];
  dominant: number;
}

function runNiche(
  ni: number, fdsStrength: number,
  subtypeProps: (SubtypeProps | null)[],
  mutationNeighbors: number[][],
): NicheResult {
  const pop: number[] = new Array(SUBTYPE_COUNT).fill(0);
  const viable: number[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!subtypeProps[s]) continue;
    pop[s] = INITIAL_POP;
    viable.push(s);
  }
  if (viable.length === 0) return { populations: [], dominant: -1 };

  for (let gen = 0; gen < GENERATIONS; gen++) {
    const totalPop = pop.reduce((a, b) => a + b, 0);
    if (totalPop < 1) break;

    // Tier light competition
    const heightSorted = viable
      .filter(s => pop[s] >= MIN_POP)
      .map(s => ({ s, h: subtypeProps[s]!.matureHeight, pop: pop[s] }))
      .sort((a, b) => b.h - a.h);

    let canopyPop = 0, understoryPop = 0;
    for (const { s, h, pop: p } of heightSorted) {
      if (h >= CANOPY_THRESHOLD) canopyPop += p;
      else if (h >= GROUND_THRESHOLD) understoryPop += p;
    }

    const fullLight = SIM.BASE_LIGHT;
    const canopyCoverage = Math.min(1.0, canopyPop / CARRYING_CAPACITY);
    const understoryCoverage = Math.min(1.0, understoryPop / CARRYING_CAPACITY);

    let canopyLeafDensity = 0, understoryLeafDensity = 0;
    if (canopyPop > 0) {
      for (const { s, h, pop: p } of heightSorted) {
        if (h >= CANOPY_THRESHOLD) canopyLeafDensity += subtypeProps[s]!.matureLeafArea * p;
      }
      canopyLeafDensity /= canopyPop;
    }
    if (understoryPop > 0) {
      for (const { s, h, pop: p } of heightSorted) {
        if (h >= GROUND_THRESHOLD && h < CANOPY_THRESHOLD) understoryLeafDensity += subtypeProps[s]!.matureLeafArea * p;
      }
      understoryLeafDensity /= understoryPop;
    }

    const shadedByCanopy = Math.max(MIN_TIER_LIGHT, fullLight * (1 - canopyLeafDensity * CANOPY_FILTER_COEFF));
    const shadedByUnderstory = Math.max(MIN_TIER_LIGHT, fullLight * (1 - understoryLeafDensity * UNDERSTORY_FILTER_COEFF));
    const understoryLight = canopyCoverage * shadedByCanopy + (1 - canopyCoverage) * fullLight;
    const coveredFraction = Math.min(1.0, canopyCoverage + understoryCoverage);
    const deepShade = Math.max(MIN_TIER_LIGHT, shadedByCanopy * (1 - understoryLeafDensity * UNDERSTORY_FILTER_COEFF));
    const groundLight = coveredFraction * deepShade + (1 - coveredFraction) * fullLight;

    const tierLight: Map<number, number> = new Map();
    for (const { s, h } of heightSorted) {
      tierLight.set(s, h >= CANOPY_THRESHOLD ? fullLight : h >= GROUND_THRESHOLD ? understoryLight : groundLight);
    }

    // Per-subtype energy surplus
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

    // Reproductive fitness
    const reproFitness: number[] = new Array(SUBTYPE_COUNT).fill(0);
    let totalReproFitness = 0;
    for (const s of viable) {
      if (pop[s] < MIN_POP || surplus[s] <= 0) continue;
      const props = subtypeProps[s]!;
      let f = surplus[s] * Math.pow(props.seedProductionRate, SEED_SCALING_EXP);
      f *= props.establishment;
      const freq = pop[s] / totalPop;
      const fdsMult = Math.max(0.3, Math.min(2.0, 1.0 - (freq - 1.0 / SUBTYPE_COUNT) * fdsStrength));
      f *= fdsMult;
      reproFitness[s] = Math.max(0, f);
      totalReproFitness += reproFitness[s] * pop[s];
    }

    // Mortality
    const newPop: number[] = new Array(SUBTYPE_COUNT).fill(0);
    let totalDeaths = 0;
    for (const s of viable) {
      if (pop[s] < MIN_POP) continue;
      const props = subtypeProps[s]!;
      const traitMod = props.traitMod.get(ni) ?? -1;
      const stressMort = traitMod < SIM.STRESS_MORTALITY_THRESHOLD ? SIM.STRESS_MORTALITY_RATE : 0;
      const survivalRate = (1.0 - props.deathRate) * (1.0 - stressMort);
      const survivors = pop[s] * survivalRate;
      totalDeaths += pop[s] - survivors;
      newPop[s] = survivors;
    }

    // Recruitment
    for (const s of viable) {
      if (pop[s] < MIN_POP || reproFitness[s] <= 0 || totalReproFitness <= 0) continue;
      const share = (reproFitness[s] * pop[s]) / totalReproFitness;
      let recruits = totalDeaths * share;
      if (recruits > 0 && mutationNeighbors[s].length > 0) {
        const mutants = recruits * MUTATION_FRAC;
        recruits -= mutants;
        const perNeighbor = mutants / mutationNeighbors[s].length;
        for (const neighbor of mutationNeighbors[s]) newPop[neighbor] += perNeighbor;
      }
      newPop[s] += recruits;
    }

    for (let s = 0; s < SUBTYPE_COUNT; s++) {
      pop[s] = newPop[s] < MIN_POP ? 0 : newPop[s];
    }
  }

  const totalPop = pop.reduce((a, b) => a + b, 0);
  const populations: { subtypeId: number; pop: number; pct: number }[] = [];
  let dominant = -1, maxPop = 0;
  for (const s of viable) {
    if (pop[s] >= MIN_POP) {
      const pct = totalPop > 0 ? (pop[s] / totalPop) * 100 : 0;
      populations.push({ subtypeId: s, pop: pop[s], pct });
      if (pop[s] > maxPop) { maxPop = pop[s]; dominant = s; }
    }
  }
  populations.sort((a, b) => b.pct - a.pct);
  return { populations, dominant };
}

// ── Metrics computed from a full run ──

interface Metrics {
  avgSurviving: number;     // avg subtypes alive per niche
  avgTopPct: number;        // avg % of dominant subtype per niche
  avgTop3Pct: number;       // avg % of top 3 subtypes per niche
  globalExtinct: number;    // subtypes extinct everywhere
  monopolized: number;      // niches where top >60%
  uniqueDominants: number;  // unique dominant subtypes across niches
  archetypeSpread: number;  // unique archetypes in any top-3 position
}

function runAllAndMeasure(fdsStrength: number): Metrics {
  const subtypeProps = computeSubtypeProps();
  const mutationNeighbors = buildMutationNeighbors(subtypeProps);

  const results: NicheResult[] = [];
  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    results.push(runNiche(ni, fdsStrength, subtypeProps, mutationNeighbors));
  }

  // Compute metrics
  let sumSurv = 0, sumTopPct = 0, sumTop3Pct = 0, monopolized = 0;
  const dominantSet = new Set<number>();
  const top3Archetypes = new Set<number>();

  for (const r of results) {
    sumSurv += r.populations.length;
    sumTopPct += r.populations.length > 0 ? r.populations[0].pct : 0;
    sumTop3Pct += r.populations.slice(0, 3).reduce((a, p) => a + p.pct, 0);
    if (r.populations.length > 0 && r.populations[0].pct > 60) monopolized++;
    if (r.dominant >= 0) dominantSet.add(r.dominant);
    for (const p of r.populations.slice(0, 3)) {
      if (subtypeProps[p.subtypeId]) top3Archetypes.add(subtypeProps[p.subtypeId]!.arch);
    }
  }

  let globalExtinct = 0;
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!subtypeProps[s]) continue;
    const alive = results.some(r => r.populations.some(p => p.subtypeId === s && p.pct >= 1));
    if (!alive) globalExtinct++;
  }

  return {
    avgSurviving: sumSurv / results.length,
    avgTopPct: sumTopPct / results.length,
    avgTop3Pct: sumTop3Pct / results.length,
    globalExtinct,
    monopolized,
    uniqueDominants: dominantSet.size,
    archetypeSpread: top3Archetypes.size,
  };
}

// ── Parameters to test ──

interface ParamDef {
  name: string;
  obj: Record<string, any>;
  key: string;
  needsCacheClear: boolean; // true if getPlantConstants depends on this
}

// Select the most balance-relevant parameters (not all 200+)
const PARAMS: ParamDef[] = [
  // Core energy
  { name: 'PHOTOSYNTHESIS_RATE', obj: SIM, key: 'PHOTOSYNTHESIS_RATE', needsCacheClear: false },
  { name: 'LEAF_EFFICIENCY_EXP', obj: SIM, key: 'LEAF_EFFICIENCY_EXPONENT', needsCacheClear: false },
  { name: 'BASE_LIGHT', obj: SIM, key: 'BASE_LIGHT', needsCacheClear: false },

  // Maintenance
  { name: 'MAINTENANCE_BASE', obj: SIM, key: 'MAINTENANCE_BASE', needsCacheClear: true },
  { name: 'MAINT_PER_HEIGHT', obj: SIM, key: 'MAINTENANCE_PER_HEIGHT', needsCacheClear: true },
  { name: 'MAINT_PER_ROOT', obj: SIM, key: 'MAINTENANCE_PER_ROOT', needsCacheClear: true },
  { name: 'MAINT_PER_LEAF', obj: SIM, key: 'MAINTENANCE_PER_LEAF', needsCacheClear: true },
  { name: 'DEFENSE_MAINT', obj: SIM, key: 'DEFENSE_MAINTENANCE_RATE', needsCacheClear: false },
  { name: 'WATER_STOR_MAINT', obj: SIM, key: 'WATER_STORAGE_MAINTENANCE', needsCacheClear: false },
  { name: 'REPRO_MAINT', obj: SIM, key: 'REPRODUCTIVE_MAINTENANCE_RATE', needsCacheClear: false },
  { name: 'LONGEVITY_MAINT', obj: SIM, key: 'LONGEVITY_MAINTENANCE_RATE', needsCacheClear: false },

  // Reproduction
  { name: 'SEED_ENERGY_COST', obj: SIM, key: 'SEED_ENERGY_COST', needsCacheClear: true },
  { name: 'SEED_SIZE_MULT_MIN', obj: SIM, key: 'SEED_SIZE_MULT_MIN', needsCacheClear: false },
  { name: 'SEED_SIZE_MULT_RNG', obj: SIM, key: 'SEED_SIZE_MULT_RANGE', needsCacheClear: false },

  // Stress / death
  { name: 'STRESS_MORT_RATE', obj: SIM, key: 'STRESS_MORTALITY_RATE', needsCacheClear: false },
  { name: 'STRESS_MORT_THRESH', obj: SIM, key: 'STRESS_MORTALITY_THRESHOLD', needsCacheClear: false },

  // FDS
  { name: 'FDS_STRENGTH', obj: SIM, key: 'FDS_STRENGTH', needsCacheClear: false },

  // Janzen-Connell (modeled indirectly via FDS in non-spatial sim, but still test)
  { name: 'JC_SUBTYPE_COEFF', obj: SIM, key: 'JC_SUBTYPE_COEFF', needsCacheClear: false },

  // Grass-specific
  { name: 'GRASS_MAX_HEIGHT', obj: GRASS, key: 'MAX_HEIGHT', needsCacheClear: true },
  { name: 'GRASS_MAX_LEAF', obj: GRASS, key: 'MAX_LEAF_AREA', needsCacheClear: true },
  { name: 'GRASS_MAINT_BASE', obj: GRASS, key: 'MAINTENANCE_BASE', needsCacheClear: true },
  { name: 'GRASS_SEED_COST', obj: GRASS, key: 'SEED_ENERGY_COST', needsCacheClear: true },
  { name: 'GRASS_GROWTH_EFF', obj: GRASS, key: 'GROWTH_EFFICIENCY', needsCacheClear: true },
  { name: 'GRASS_MAX_AGE', obj: GRASS, key: 'MAX_AGE', needsCacheClear: true },

  // Woody plant limits
  { name: 'MAX_HEIGHT', obj: SIM, key: 'MAX_HEIGHT', needsCacheClear: true },
  { name: 'MAX_LEAF_AREA', obj: SIM, key: 'MAX_LEAF_AREA', needsCacheClear: true },
  { name: 'MAX_ROOT_DEPTH', obj: SIM, key: 'MAX_ROOT_DEPTH', needsCacheClear: true },
  { name: 'GROWTH_EFFICIENCY', obj: SIM, key: 'GROWTH_EFFICIENCY', needsCacheClear: true },
  { name: 'MAX_AGE', obj: SIM, key: 'MAX_AGE', needsCacheClear: true },
];

// ── Perturbation levels ──

const PERTURBATIONS = [-0.50, -0.25, +0.25, +0.50];
const PERTURBATION_LABELS = ['-50%', '-25%', '+25%', '+50%'];

// ── Output helpers ──

const out = (s: string) => process.stdout.write(s + '\n');
function pad(s: string, w: number): string { return s.padEnd(w); }
function fmt(n: number, w = 7): string { return n.toFixed(1).padStart(w); }
function fmtD(n: number, w = 7): string {
  const s = (n >= 0 ? '+' : '') + n.toFixed(1);
  return s.padStart(w);
}

// ── Main ──

process.stderr.write('Computing baseline...\n');
const baseline = runAllAndMeasure(SIM.FDS_STRENGTH);

process.stderr.write(`Baseline: avgSurv=${baseline.avgSurviving.toFixed(1)}, avgTop%=${baseline.avgTopPct.toFixed(1)}, extinct=${baseline.globalExtinct}, monopol=${baseline.monopolized}\n`);

// Filter to single param if requested
const paramsToTest = singleParam
  ? PARAMS.filter(p => p.name.toLowerCase().includes(singleParam.toLowerCase()))
  : PARAMS;

if (paramsToTest.length === 0) {
  process.stderr.write(`No parameters match "${singleParam}"\n`);
  process.exit(1);
}

// ── Run perturbations ──

interface ParamResult {
  param: ParamDef;
  baseValue: number;
  pertResults: { pct: number; metrics: Metrics }[];
  sensitivity: number; // aggregate sensitivity score
}

const allResults: ParamResult[] = [];

for (const param of paramsToTest) {
  process.stderr.write(`  ${param.name}...\n`);
  const baseValue = param.obj[param.key];
  const pertResults: { pct: number; metrics: Metrics }[] = [];

  for (const pct of PERTURBATIONS) {
    const newValue = baseValue * (1 + pct);
    // Skip if value would go negative or zero for things that must be positive
    if (newValue <= 0) {
      pertResults.push({ pct, metrics: baseline }); // use baseline as placeholder
      continue;
    }

    // Mutate
    param.obj[param.key] = newValue;
    if (param.needsCacheClear) clearPlantConstantsCache();

    const metrics = runAllAndMeasure(SIM.FDS_STRENGTH);
    pertResults.push({ pct, metrics });

    // Restore
    param.obj[param.key] = baseValue;
    if (param.needsCacheClear) clearPlantConstantsCache();
  }

  // Compute aggregate sensitivity: max absolute change across all metrics and perturbations
  // Normalized by baseline value of each metric
  let maxSensitivity = 0;
  for (const pr of pertResults) {
    const m = pr.metrics;
    const b = baseline;
    // Compute relative changes for key metrics
    const changes = [
      b.avgSurviving > 0 ? Math.abs(m.avgSurviving - b.avgSurviving) / b.avgSurviving : 0,
      b.avgTopPct > 0 ? Math.abs(m.avgTopPct - b.avgTopPct) / b.avgTopPct : 0,
      Math.abs(m.globalExtinct - b.globalExtinct) / SUBTYPE_COUNT,
      Math.abs(m.monopolized - b.monopolized) / TARGET_NICHES.length,
      b.uniqueDominants > 0 ? Math.abs(m.uniqueDominants - b.uniqueDominants) / b.uniqueDominants : 0,
    ];
    const avg = changes.reduce((a, c) => a + c, 0) / changes.length;
    maxSensitivity = Math.max(maxSensitivity, avg);
  }

  allResults.push({ param, baseValue, pertResults, sensitivity: maxSensitivity });
}

// Sort by sensitivity
allResults.sort((a, b) => b.sensitivity - a.sensitivity);

// Optionally limit output
const displayResults = topN > 0 ? allResults.slice(0, topN) : allResults;

// ── Output ──

out('');
out('═══════════════════════════════════════════════════════════════════════════════════');
out('  OAT SENSITIVITY ANALYSIS — One-At-a-Time Parameter Perturbations');
out('═══════════════════════════════════════════════════════════════════════════════════');
out('');
out('  Baseline metrics:');
out(`    Avg surviving/niche:  ${fmt(baseline.avgSurviving)}`);
out(`    Avg top subtype %:   ${fmt(baseline.avgTopPct)}`);
out(`    Avg top-3 %:         ${fmt(baseline.avgTop3Pct)}`);
out(`    Global extinct:      ${fmt(baseline.globalExtinct)}`);
out(`    Monopolized niches:  ${fmt(baseline.monopolized)}`);
out(`    Unique dominants:    ${fmt(baseline.uniqueDominants)}`);
out(`    Archetype spread:    ${fmt(baseline.archetypeSpread)}`);

// ── Section A: Sensitivity ranking ──

out('');
out('───────────────────────────────────────────────────────────────────────────────────');
out('  SECTION A: Sensitivity Ranking (sorted by impact)');
out('───────────────────────────────────────────────────────────────────────────────────');
out('');
out(`  ${pad('Parameter', 20)} ${pad('Value', 8)} ${pad('Sens', 6)}  ${PERTURBATION_LABELS.map(l => pad(l, 7)).join(' ')}  ← Δ avg surviving`);
out(`  ${'─'.repeat(20)} ${'─'.repeat(8)} ${'─'.repeat(6)}  ${PERTURBATION_LABELS.map(() => '─'.repeat(7)).join(' ')}`);

for (const r of displayResults) {
  const survDeltas = r.pertResults.map(pr => fmtD(pr.metrics.avgSurviving - baseline.avgSurviving));
  const sensStr = (r.sensitivity * 100).toFixed(0).padStart(5) + '%';
  out(`  ${pad(r.param.name, 20)} ${r.baseValue.toFixed(3).padStart(8)} ${sensStr}  ${survDeltas.join(' ')}`);
}

// ── Section B: Detailed metric deltas ──

out('');
out('───────────────────────────────────────────────────────────────────────────────────');
out('  SECTION B: Full Metric Deltas (top parameters)');
out('───────────────────────────────────────────────────────────────────────────────────');

const detailCount = singleParam ? displayResults.length : Math.min(10, displayResults.length);

for (let i = 0; i < detailCount; i++) {
  const r = displayResults[i];
  out('');
  out(`  ── ${r.param.name} (baseline: ${r.baseValue.toFixed(4)}, sensitivity: ${(r.sensitivity * 100).toFixed(1)}%) ──`);
  out('');
  out(`  ${pad('Metric', 22)} ${pad('Base', 8)} ${PERTURBATION_LABELS.map(l => pad(l, 8)).join(' ')}`);
  out(`  ${'─'.repeat(22)} ${'─'.repeat(8)} ${PERTURBATION_LABELS.map(() => '─'.repeat(8)).join(' ')}`);

  const metricDefs: { label: string; get: (m: Metrics) => number }[] = [
    { label: 'Avg surviving', get: m => m.avgSurviving },
    { label: 'Avg top %', get: m => m.avgTopPct },
    { label: 'Avg top-3 %', get: m => m.avgTop3Pct },
    { label: 'Global extinct', get: m => m.globalExtinct },
    { label: 'Monopolized niches', get: m => m.monopolized },
    { label: 'Unique dominants', get: m => m.uniqueDominants },
    { label: 'Archetype spread', get: m => m.archetypeSpread },
  ];

  for (const md of metricDefs) {
    const baseVal = md.get(baseline);
    const deltas = r.pertResults.map(pr => {
      const val = md.get(pr.metrics);
      const delta = val - baseVal;
      return fmtD(delta, 8);
    });
    out(`  ${pad(md.label, 22)} ${fmt(baseVal, 8)} ${deltas.join(' ')}`);
  }
}

// ── Section C: Direction summary ──

out('');
out('───────────────────────────────────────────────────────────────────────────────────');
out('  SECTION C: Parameter Direction Guide');
out('  "↑ param → ↑ diversity" means increasing this parameter increases diversity');
out('───────────────────────────────────────────────────────────────────────────────────');
out('');

for (const r of displayResults) {
  if (r.sensitivity < 0.01) continue; // skip insensitive params

  // Look at +25% perturbation for direction
  const plus25 = r.pertResults.find(pr => pr.pct === 0.25);
  if (!plus25) continue;

  const survDelta = plus25.metrics.avgSurviving - baseline.avgSurviving;
  const topDelta = plus25.metrics.avgTopPct - baseline.avgTopPct;
  const extinctDelta = plus25.metrics.globalExtinct - baseline.globalExtinct;

  const effects: string[] = [];
  if (Math.abs(survDelta) > 0.3) {
    effects.push(`↑ param → ${survDelta > 0 ? '↑' : '↓'} diversity (${survDelta > 0 ? '+' : ''}${survDelta.toFixed(1)} surviving/niche)`);
  }
  if (Math.abs(topDelta) > 1) {
    effects.push(`↑ param → ${topDelta > 0 ? '↑' : '↓'} dominance (${topDelta > 0 ? '+' : ''}${topDelta.toFixed(1)}% top subtype)`);
  }
  if (Math.abs(extinctDelta) > 1) {
    effects.push(`↑ param → ${extinctDelta > 0 ? '↑' : '↓'} extinctions (${extinctDelta > 0 ? '+' : ''}${extinctDelta.toFixed(0)} extinct)`);
  }

  if (effects.length > 0) {
    out(`  ${pad(r.param.name, 20)} ${effects.join('; ')}`);
  }
}

out('');
process.stderr.write('Done.\n');
