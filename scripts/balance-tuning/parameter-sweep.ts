/**
 * Parameter Sweep
 *
 * Full spatial simulation sweep over a SIM/GRASS constant.
 * Runs the headless simulation for each value, extracts metrics,
 * outputs a comparison table with health check results.
 *
 * Usage:
 *   npx tsx scripts/balance-tuning/parameter-sweep.ts --param FDS_STRENGTH --values 1.0,1.5,2.0 --scenario experimentNicheMatrix
 *   npx tsx scripts/balance-tuning/parameter-sweep.ts --param PHOTOSYNTHESIS_RATE --range 0.3:0.7:0.1 --scenario experimentNicheMatrix
 *   npx tsx scripts/balance-tuning/parameter-sweep.ts --param FDS_STRENGTH --values 1,2,3 --scenario experimentNicheMatrix --seeds 3 --ticks 5000
 *   npx tsx scripts/balance-tuning/parameter-sweep.ts --param FDS_STRENGTH --values 1,2 --scenario experimentNicheMatrix --save-results
 *   npx tsx scripts/balance-tuning/parameter-sweep.ts --list-params
 */

import { writeFileSync } from 'fs';
import { createWorld } from '../../src/simulation';
import { tickWorld, clearFrameEvents } from '../../src/simulation';
import { loadScenario } from '../../src/scenario-loader';
import { SCENARIOS } from '../../src/scenarios';
import { SIM, GRASS, clearPlantConstantsCache } from '../../src/types/constants';
import { classifySubtype, SUBTYPE_NAMES } from '../../src/types/subtypes';
import {
  createAccumulator, accumulateTick, computeSnapshot,
  computeTerrainSummary, computeNearRiverSet,
  Snapshot,
} from '../../src/stats';
import {
  Report, BalanceMetrics,
  extractMetrics, evaluateHealthChecks,
} from './lib/metrics';

// ── Parameter registry (same as sensitivity-analysis.ts) ──

interface ParamDef {
  name: string;
  obj: Record<string, any>;
  key: string;
  needsCacheClear: boolean;
}

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
  // Janzen-Connell
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

// ── Helpers ──

const out = (s: string) => process.stdout.write(s + '\n');
function pad(s: string, w: number) { return s.padEnd(w); }
function fmt(n: number, w = 8): string {
  if (Number.isInteger(n) && Math.abs(n) < 100000) return String(n).padStart(w);
  return n.toFixed(2).padStart(w);
}

// ── Run a single simulation ──

function runSimulation(
  scenarioId: string,
  totalTicks: number,
  snapshotInterval: number,
): { report: Report; elapsedMs: number } {
  const scenario = SCENARIOS.find(s => s.id === scenarioId)!;
  const world = createWorld();
  loadScenario(world, scenario);

  const terrainSummary = computeTerrainSummary(world);
  const nearRiver = computeNearRiverSet(world);
  const snapshots: Snapshot[] = [];
  let accumulator = createAccumulator();

  const t0 = performance.now();

  for (let t = 1; t <= totalTicks; t++) {
    clearFrameEvents(world);
    tickWorld(world);
    accumulateTick(accumulator, world);

    if (t % snapshotInterval === 0) {
      const snap = computeSnapshot(world, accumulator, terrainSummary, nearRiver) as any;

      // Attach subtypesByNiche (same as run-experiment.ts)
      const terrainNames = ['soil', 'river', 'rock', 'hill', 'wetland', 'arid'];
      const zoneNames = ['Temperate', 'Tropical', 'Mediterranean', 'Desert'];
      const subtypesByNiche: Record<string, Record<string, number>> = {};
      for (const p of world.plants.values()) {
        if (!p.alive) continue;
        const cell = world.grid[p.y][p.x];
        const tName = terrainNames[cell.terrainType] || 'unknown';
        const zName = zoneNames[cell.climateZone] || 'unknown';
        const niche = `${zName}/${tName}`;
        const stId = classifySubtype(p.genome);
        const stName = SUBTYPE_NAMES[stId] || `Subtype${stId}`;
        if (!subtypesByNiche[niche]) subtypesByNiche[niche] = {};
        subtypesByNiche[niche][stName] = (subtypesByNiche[niche][stName] || 0) + 1;
      }
      snap.subtypesByNiche = subtypesByNiche;

      snapshots.push(snap);
      accumulator = createAccumulator();
    }
  }

  const elapsedMs = performance.now() - t0;

  const report: Report = {
    scenarioId,
    scenarioName: scenario.name,
    config: { totalTicks, snapshotInterval },
    simConstants: { ...SIM } as unknown as Record<string, number>,
    snapshots: snapshots as any,
  };

  return { report, elapsedMs };
}

// ── Arg parsing ──

const args = process.argv.slice(2);

function getFlag(name: string, defaultVal: string | null): string | null {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return defaultVal;
  return args[idx + 1];
}

function getIntFlag(name: string, defaultVal: number): number {
  const val = getFlag(name, null);
  if (val === null) return defaultVal;
  const n = parseInt(val, 10);
  return isNaN(n) ? defaultVal : n;
}

if (args.includes('--list-params')) {
  out('');
  out('Available parameters for sweep:');
  out('');
  for (const p of PARAMS) {
    out(`  ${pad(p.name, 22)} current=${p.obj[p.key]}`);
  }
  out('');
  process.exit(0);
}

const paramName = getFlag('--param', null);
const scenarioId = getFlag('--scenario', null);
const valuesStr = getFlag('--values', null);
const rangeStr = getFlag('--range', null);
const totalTicks = getIntFlag('--ticks', 3000);
const snapshotInterval = getIntFlag('--interval', 250);
const numSeeds = getIntFlag('--seeds', 1);
const saveResults = args.includes('--save-results');

if (!paramName || !scenarioId || (!valuesStr && !rangeStr)) {
  process.stderr.write('Usage: npx tsx scripts/balance-tuning/parameter-sweep.ts --param NAME --values V1,V2,... --scenario ID\n');
  process.stderr.write('  or:  --range MIN:MAX:STEP instead of --values\n');
  process.stderr.write('  Options: --ticks N --interval N --seeds N --save-results --list-params\n');
  process.exit(1);
}

// Find parameter
const param = PARAMS.find(p => p.name.toLowerCase() === paramName.toLowerCase());
if (!param) {
  process.stderr.write(`Unknown parameter: "${paramName}"\n`);
  const similar = PARAMS.filter(p => p.name.toLowerCase().includes(paramName.toLowerCase()));
  if (similar.length > 0) {
    process.stderr.write(`Similar: ${similar.map(p => p.name).join(', ')}\n`);
  }
  process.stderr.write('Use --list-params to see all available parameters.\n');
  process.exit(1);
}

// Validate scenario
const scenario = SCENARIOS.find(s => s.id === scenarioId);
if (!scenario) {
  process.stderr.write(`Unknown scenario: "${scenarioId}"\n`);
  process.stderr.write('Available: ' + SCENARIOS.map(s => s.id).join(', ') + '\n');
  process.exit(1);
}

// Parse values
let sweepValues: number[];
if (valuesStr) {
  sweepValues = valuesStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
} else {
  const parts = rangeStr!.split(':').map(s => parseFloat(s.trim()));
  if (parts.length !== 3 || parts.some(isNaN)) {
    process.stderr.write('--range format: MIN:MAX:STEP (e.g. 0.3:0.7:0.1)\n');
    process.exit(1);
  }
  const [min, max, step] = parts;
  sweepValues = [];
  for (let v = min; v <= max + step * 0.001; v += step) {
    sweepValues.push(Math.round(v * 1e6) / 1e6); // avoid float drift
  }
}

if (sweepValues.length === 0) {
  process.stderr.write('No valid values to sweep.\n');
  process.exit(1);
}

if (sweepValues.length > 20) {
  process.stderr.write(`Warning: ${sweepValues.length} values × ${numSeeds} seeds = ${sweepValues.length * numSeeds} simulation runs.\n`);
  process.stderr.write(`Estimated time: ~${Math.round(sweepValues.length * numSeeds * totalTicks / 1000)} seconds.\n`);
}

// ── Run sweep ──

const originalValue = param.obj[param.key];

interface SweepResult {
  value: number;
  seed: number;
  metrics: BalanceMetrics;
  checks: { label: string; pass: boolean; value: string }[];
  elapsedMs: number;
}

interface AggregatedResult {
  value: number;
  meanMetrics: Record<string, number>;
  stdMetrics: Record<string, number>;
  passRate: Record<string, number>;
  totalChecks: number;
  passedChecks: number;
  runs: SweepResult[];
}

out('');
out('═══════════════════════════════════════════════════════════════');
out(`  Parameter Sweep: ${param.name}`);
out(`  Scenario: ${scenario.name} (${scenarioId})`);
out(`  Ticks: ${totalTicks}, Interval: ${snapshotInterval}, Seeds: ${numSeeds}`);
out(`  Values: ${sweepValues.join(', ')}`);
out(`  Current: ${originalValue}`);
out('═══════════════════════════════════════════════════════════════');

const allResults: SweepResult[] = [];
const totalRuns = sweepValues.length * numSeeds;
let runIdx = 0;

for (const value of sweepValues) {
  for (let seed = 0; seed < numSeeds; seed++) {
    runIdx++;
    process.stderr.write(`  [${runIdx}/${totalRuns}] ${param.name}=${value}${numSeeds > 1 ? ` seed=${seed}` : ''}...`);

    // Mutate constant
    param.obj[param.key] = value;
    if (param.needsCacheClear) clearPlantConstantsCache();

    try {
      const { report, elapsedMs } = runSimulation(scenarioId, totalTicks, snapshotInterval);
      const metrics = extractMetrics(report);
      const checks = evaluateHealthChecks(metrics);

      allResults.push({ value, seed, metrics, checks, elapsedMs });

      const passed = checks.filter(c => c.pass).length;
      process.stderr.write(` ${(elapsedMs / 1000).toFixed(1)}s, pop=${metrics.finalPopulation}, health=${passed}/${checks.length}\n`);

      // Save individual results if requested
      if (saveResults) {
        const filename = `results/sweep-${param.name}-${value}${numSeeds > 1 ? `-seed${seed}` : ''}.json`;
        writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
        process.stderr.write(`    → ${filename}\n`);
      }
    } catch (e: any) {
      process.stderr.write(` ERROR: ${e.message}\n`);
    }
  }
}

// Restore original value
param.obj[param.key] = originalValue;
if (param.needsCacheClear) clearPlantConstantsCache();

if (allResults.length === 0) {
  process.stderr.write('No successful runs.\n');
  process.exit(1);
}

// ── Aggregate by value ──

const NUMERIC_KEYS: (keyof BalanceMetrics)[] = [
  'finalPopulation', 'populationStability',
  'subtypeRichness', 'archetypeRichness', 'shannonIndex', 'giniCoefficient',
  'nicheDifferentiation', 'avgMaxDominance', 'avgNicheRichness', 'nicheSpecializationScore',
  'extinctSubtypes', 'archetypeBalance',
];

const aggregated: AggregatedResult[] = [];

for (const value of sweepValues) {
  const runs = allResults.filter(r => r.value === value);
  if (runs.length === 0) continue;

  const meanMetrics: Record<string, number> = {};
  const stdMetrics: Record<string, number> = {};

  for (const key of NUMERIC_KEYS) {
    const vals = runs.map(r => r.metrics[key] as number);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    meanMetrics[key] = mean;
    if (vals.length > 1) {
      const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length;
      stdMetrics[key] = Math.sqrt(variance);
    } else {
      stdMetrics[key] = 0;
    }
  }

  // Health check pass rates
  const passRate: Record<string, number> = {};
  const checkLabels = runs[0].checks.map(c => c.label);
  for (let ci = 0; ci < checkLabels.length; ci++) {
    const passes = runs.filter(r => r.checks[ci].pass).length;
    passRate[checkLabels[ci]] = passes / runs.length;
  }

  const totalChecks = checkLabels.length;
  const passedChecks = Object.values(passRate).filter(r => r >= 0.5).length;

  aggregated.push({ value, meanMetrics, stdMetrics, passRate, totalChecks, passedChecks, runs });
}

// ── Section A: Sweep table ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION A: Sweep Results');
out('───────────────────────────────────────────────────────────────');
out('');

const displayKeys: { key: string; label: string; width: number }[] = [
  { key: 'finalPopulation', label: 'Pop', width: 7 },
  { key: 'subtypeRichness', label: 'Rich', width: 5 },
  { key: 'shannonIndex', label: 'Shan', width: 6 },
  { key: 'giniCoefficient', label: 'Gini', width: 6 },
  { key: 'nicheDifferentiation', label: 'NDiff', width: 6 },
  { key: 'avgMaxDominance', label: 'Dom%', width: 6 },
  { key: 'extinctSubtypes', label: 'Ext', width: 4 },
  { key: 'archetypeBalance', label: 'ABal', width: 6 },
];

const valW = 10;
const header = [pad('Value', valW), ...displayKeys.map(d => d.label.padStart(d.width)), 'Health'.padStart(7)];
out('  ' + header.join(' '));
out('  ' + '─'.repeat(header.join(' ').length));

for (const agg of aggregated) {
  const marker = agg.value === originalValue ? ' *' : '  ';
  const parts = [String(agg.value).padStart(valW)];

  for (const dk of displayKeys) {
    const mean = agg.meanMetrics[dk.key];
    if (numSeeds > 1 && agg.stdMetrics[dk.key] > 0) {
      parts.push(`${mean.toFixed(1)}`.padStart(dk.width));
    } else {
      parts.push(fmt(mean, dk.width));
    }
  }

  parts.push(`${agg.passedChecks}/${agg.totalChecks}`.padStart(7));
  out(marker + parts.join(' '));
}

if (numSeeds > 1) {
  out('');
  out('  Standard deviations:');
  out('  ' + header.join(' '));
  out('  ' + '─'.repeat(header.join(' ').length));
  for (const agg of aggregated) {
    const parts = [String(agg.value).padStart(valW)];
    for (const dk of displayKeys) {
      parts.push(`±${agg.stdMetrics[dk.key].toFixed(1)}`.padStart(dk.width));
    }
    parts.push(''.padStart(7));
    out('  ' + parts.join(' '));
  }
}

out(`\n  * = current value (${originalValue})`);

// ── Section B: Health check matrix ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION B: Health Check Matrix');
out('───────────────────────────────────────────────────────────────');
out('');

const checkLabels = aggregated[0]?.runs[0]?.checks.map(c => c.label) ?? [];
const checkLabelW = 30;
const checkValW = Math.max(8, ...sweepValues.map(v => String(v).length + 2));

const checkHeader = [pad('Check', checkLabelW), ...sweepValues.map(v => String(v).padStart(checkValW))];
out('  ' + checkHeader.join(' '));
out('  ' + '─'.repeat(checkHeader.join(' ').length));

for (const label of checkLabels) {
  const parts = [pad(label, checkLabelW)];
  for (const agg of aggregated) {
    const rate = agg.passRate[label];
    if (numSeeds > 1) {
      parts.push(`${(rate * 100).toFixed(0)}%`.padStart(checkValW));
    } else {
      parts.push((rate >= 0.5 ? 'PASS' : 'FAIL').padStart(checkValW));
    }
  }
  out('  ' + parts.join(' '));
}

// Score row
const scoreParts = [pad('Score', checkLabelW)];
for (const agg of aggregated) {
  scoreParts.push(`${agg.passedChecks}/${agg.totalChecks}`.padStart(checkValW));
}
out('');
out('  ' + scoreParts.join(' '));

// ── Section C: Best value ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION C: Best Value');
out('───────────────────────────────────────────────────────────────');
out('');

// Sort by: health checks passed (desc), then Gini (asc), then Shannon (desc)
const ranked = [...aggregated].sort((a, b) => {
  if (b.passedChecks !== a.passedChecks) return b.passedChecks - a.passedChecks;
  const giniDiff = a.meanMetrics['giniCoefficient'] - b.meanMetrics['giniCoefficient'];
  if (Math.abs(giniDiff) > 0.01) return giniDiff;
  return b.meanMetrics['shannonIndex'] - a.meanMetrics['shannonIndex'];
});

const best = ranked[0];
out(`  Best value: ${best.value} (${best.passedChecks}/${best.totalChecks} health checks)`);
out(`    Shannon: ${best.meanMetrics['shannonIndex'].toFixed(2)}, Gini: ${best.meanMetrics['giniCoefficient'].toFixed(3)}, Niche diff: ${best.meanMetrics['nicheDifferentiation'].toFixed(3)}`);

if (best.value !== originalValue) {
  out(`    (current value is ${originalValue})`);
}

out('');
