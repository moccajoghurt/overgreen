import { createWorld } from '../src/simulation';
import { tickWorld, clearFrameEvents } from '../src/simulation';
import { loadScenario } from '../src/scenario-loader';
import { SCENARIOS } from '../src/scenarios';
import { SIM } from '../src/types';
import { PerfTracker } from '../src/perf';
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

const perf = new PerfTracker();
const phases = ['environment', 'rechargeWater', 'calculateLight', 'tierAssignment', 'tierLight', 'updatePlants', 'herbivores', 'death', 'decomposition', 'germination'];
for (const p of phases) perf.register(p, 'sim');

const terrainSummary = computeTerrainSummary(world);
const nearRiver = computeNearRiverSet(world);
const snapshots: Snapshot[] = [];
let accumulator = createAccumulator();

const t0 = performance.now();

for (let t = 1; t <= totalTicks; t++) {
  clearFrameEvents(world);
  tickWorld(world, perf);
  accumulateTick(accumulator, world);

  if (t % interval === 0) {
    const snap = computeSnapshot(world, accumulator, terrainSummary, nearRiver) as Snapshot & { lineageRoots?: Record<number, number[]> };
    // Attach per-plant lineage root data for lineage analysis
    const lineageRoots: Record<number, number[]> = {};
    for (const p of world.plants.values()) {
      if (!p.alive) continue;
      const arr = lineageRoots[p.lineageRoot] ??= [];
      if (!arr.includes(p.speciesId)) arr.push(p.speciesId);
    }
    snap.lineageRoots = lineageRoots;
    // Attach all species detail with per-terrain breakdown
    const allSpecies: Array<{ id: number; name: string; count: number; terrain: Record<string, number> }> = [];
    const spCounts = new Map<number, { total: number; terrain: Record<string, number> }>();
    const terrainNames = ['soil', 'river', 'rock', 'hill', 'wetland', 'arid'];
    for (const p of world.plants.values()) {
      if (!p.alive) continue;
      const cell = world.grid[p.y][p.x];
      const tName = terrainNames[cell.terrainType] || 'unknown';
      let entry = spCounts.get(p.speciesId);
      if (!entry) { entry = { total: 0, terrain: {} }; spCounts.set(p.speciesId, entry); }
      entry.total++;
      entry.terrain[tName] = (entry.terrain[tName] || 0) + 1;
    }
    for (const [id, entry] of spCounts) {
      allSpecies.push({ id, name: world.speciesNames.get(id) ?? `Sp ${id}`, count: entry.total, terrain: entry.terrain });
    }
    (snap as any).speciesDetail = allSpecies;
    snapshots.push(snap);
    accumulator = createAccumulator();

    // Progress to stderr
    const pct = ((t / totalTicks) * 100).toFixed(0);
    process.stderr.write(`  tick ${t}/${totalTicks} (${pct}%)\n`);
  }
}

process.stderr.write(`Done in ${((performance.now() - t0) / 1000).toFixed(2)}s — ${snapshots.length} snapshots\n`);

// Per-phase profiling
process.stderr.write('\nPer-phase avg ms/tick:\n');
for (const e of perf.getEntries()) {
  process.stderr.write(`  ${e.label.padEnd(20)} ${e.avgMs.toFixed(3)} ms\n`);
}

// ── Output report ──

interface PerfStats {
  elapsedSeconds: number;
  msPerTick: number;
  ticksPerSecond: number;
  phases: Record<string, number>;
}

interface ExperimentReport {
  scenarioId: string;
  scenarioName: string;
  config: { totalTicks: number; snapshotInterval: number };
  gridSize: { width: number; height: number };
  terrainSummary: TerrainSummary;
  perfStats: PerfStats;
  simConstants: Record<string, number>;
  snapshots: Snapshot[];
}

const elapsedSec = (performance.now() - t0) / 1000;
const phaseStats: Record<string, number> = {};
for (const e of perf.getEntries()) {
  phaseStats[e.label] = Math.round(e.avgMs * 1000) / 1000;
}
const perfStats: PerfStats = {
  elapsedSeconds: Math.round(elapsedSec * 100) / 100,
  msPerTick: Math.round((elapsedSec * 1000 / totalTicks) * 100) / 100,
  ticksPerSecond: Math.round(totalTicks / elapsedSec),
  phases: phaseStats,
};

const report: ExperimentReport = {
  scenarioId: scenario.id,
  scenarioName: scenario.name,
  config: { totalTicks, snapshotInterval: interval },
  gridSize: { width: world.width, height: world.height },
  terrainSummary,
  perfStats,
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
