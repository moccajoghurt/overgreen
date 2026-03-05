import { createWorld } from '../src/simulation';
import { tickWorld } from '../src/simulation';
import { loadScenario } from '../src/scenario-loader';
import { SCENARIOS } from '../src/scenarios';
import { SIM } from '../src/types';
import {
  createAccumulator, accumulateTick, computeSnapshot,
  computeTerrainSummary, computeNearRiverSet,
  Snapshot, TerrainSummary,
} from '../src/stats';

// ── Arg parsing ──

const args = process.argv.slice(2);

function getFlag(name: string, defaultVal: number): number {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return defaultVal;
  const val = parseInt(args[idx + 1], 10);
  return isNaN(val) ? defaultVal : val;
}

if (args.includes('--list')) {
  process.stderr.write('Available scenarios:\n');
  for (const s of SCENARIOS) {
    process.stderr.write(`  ${s.id.padEnd(35)} ${s.name}\n`);
  }
  process.exit(0);
}

const scenarioId = args.find(a => !a.startsWith('--'));
if (!scenarioId) {
  process.stderr.write('Usage: npx tsx scripts/run-experiment.ts <scenario-id> [--ticks N] [--interval N]\n');
  process.stderr.write('       npx tsx scripts/run-experiment.ts --list\n');
  process.exit(1);
}

const scenario = SCENARIOS.find(s => s.id === scenarioId);
if (!scenario) {
  process.stderr.write(`Unknown scenario: "${scenarioId}"\n`);
  process.stderr.write('Use --list to see available scenarios.\n');
  process.exit(1);
}

const totalTicks = getFlag('--ticks', 3000);
const interval = getFlag('--interval', 250);
const outputFile = (() => {
  const idx = args.indexOf('--out');
  return (idx !== -1 && idx + 1 < args.length) ? args[idx + 1] : null;
})();

// ── Run simulation ──

process.stderr.write(`Running "${scenario.name}" for ${totalTicks} ticks (snapshot every ${interval})...\n`);

const world = createWorld();
loadScenario(world, scenario);

const terrainSummary = computeTerrainSummary(world);
const nearRiver = computeNearRiverSet(world);
const snapshots: Snapshot[] = [];
let accumulator = createAccumulator();

const t0 = performance.now();

for (let t = 1; t <= totalTicks; t++) {
  tickWorld(world);
  accumulateTick(accumulator, world);

  if (t % interval === 0) {
    snapshots.push(computeSnapshot(world, accumulator, terrainSummary, nearRiver));
    accumulator = createAccumulator();

    // Progress to stderr
    const pct = ((t / totalTicks) * 100).toFixed(0);
    process.stderr.write(`  tick ${t}/${totalTicks} (${pct}%)\n`);
  }
}

const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
process.stderr.write(`Done in ${elapsed}s — ${snapshots.length} snapshots\n`);

// ── Output report ──

interface ExperimentReport {
  scenarioId: string;
  scenarioName: string;
  config: { totalTicks: number; snapshotInterval: number };
  gridSize: { width: number; height: number };
  terrainSummary: TerrainSummary;
  simConstants: Record<string, number>;
  snapshots: Snapshot[];
}

const report: ExperimentReport = {
  scenarioId: scenario.id,
  scenarioName: scenario.name,
  config: { totalTicks, snapshotInterval: interval },
  gridSize: { width: world.width, height: world.height },
  terrainSummary,
  simConstants: { ...SIM } as unknown as Record<string, number>,
  snapshots,
};

import { writeFileSync } from 'fs';

const jsonOutput = JSON.stringify(report, null, 2) + '\n';
if (outputFile) {
  writeFileSync(outputFile, jsonOutput);
  process.stderr.write(`Report written to ${outputFile}\n`);
} else {
  process.stdout.write(jsonOutput);
}
