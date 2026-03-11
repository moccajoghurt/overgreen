/**
 * Probe: how often do plants die while still looking healthy?
 * Logs healthEMA at moment of death, grouped by cause × health band.
 *
 * Usage: npx tsx scripts/probe-healthy-death.ts [scenario-id] [--ticks N]
 */

import { createWorld, tickWorld, clearFrameEvents } from '../src/simulation';
import { loadScenario } from '../src/scenario-loader';
import { SCENARIOS } from '../src/scenarios';
import { getPlantConstants } from '../src/types';

const args = process.argv.slice(2);
const scenarioId = args.find(a => !a.startsWith('--')) ?? 'lindenvale';
const ticksIdx = args.indexOf('--ticks');
const totalTicks = (ticksIdx !== -1 && args[ticksIdx + 1]) ? parseInt(args[ticksIdx + 1]) : 1500;

const scenario = SCENARIOS.find(s => s.id === scenarioId);
if (!scenario) { console.error(`Unknown scenario: ${scenarioId}`); process.exit(1); }

const world = createWorld();
loadScenario(world, scenario);

type Band = 'thriving' | 'stressed' | 'dying';
type Cause = 'age' | 'starvation' | 'fire' | 'disease';

interface DeathRecord {
  cause: Cause;
  band: Band;
  healthEMA: number;
  energy: number;
  age: number;
  maxAge: number;
}

const records: DeathRecord[] = [];

function band(ema: number): Band {
  if (ema > 0.7) return 'thriving';
  if (ema > 0.5) return 'stressed';
  return 'dying';
}

console.error(`Running "${scenario.name}" for ${totalTicks} ticks...`);

// Snapshot healthEMA before each tick (death clears plant from map)
const preTick = new Map<number, { healthEMA: number; energy: number; age: number; maxAge: number }>();

for (let t = 1; t <= totalTicks; t++) {
  // Capture state of all living plants before tick
  preTick.clear();
  for (const p of world.plants.values()) {
    if (!p.alive) continue;
    preTick.set(p.id, {
      healthEMA: p.healthEMA,
      energy: p.energy,
      age: p.age,
      maxAge: getPlantConstants(p.genome).maxAge,
    });
  }

  clearFrameEvents(world);
  tickWorld(world);

  for (const evt of world.deathEvents) {
    const snap = preTick.get(evt.id);
    if (!snap) continue;
    records.push({
      cause: evt.cause as Cause,
      band: band(snap.healthEMA),
      healthEMA: snap.healthEMA,
      energy: snap.energy,
      age: snap.age,
      maxAge: snap.maxAge,
    });
  }
}

// ── Report ──

console.log(`\n=== Healthy-Death Probe: ${scenario.name}, ${totalTicks} ticks, ${records.length} total deaths ===\n`);

// Cross-tab: cause × band
const causes: Cause[] = ['age', 'starvation', 'fire', 'disease'];
const bands: Band[] = ['thriving', 'stressed', 'dying'];
const counts: Record<string, number> = {};
for (const r of records) {
  const key = `${r.cause}:${r.band}`;
  counts[key] = (counts[key] || 0) + 1;
}

// Header
const colW = 12;
process.stdout.write('cause'.padEnd(14));
for (const b of bands) process.stdout.write(b.padStart(colW));
process.stdout.write('     total\n');
process.stdout.write('-'.repeat(14 + colW * 3 + 10) + '\n');

for (const c of causes) {
  process.stdout.write(c.padEnd(14));
  let rowTotal = 0;
  for (const b of bands) {
    const n = counts[`${c}:${b}`] || 0;
    rowTotal += n;
    process.stdout.write(String(n).padStart(colW));
  }
  process.stdout.write(String(rowTotal).padStart(10) + '\n');
}

// Totals row
process.stdout.write('TOTAL'.padEnd(14));
let grandTotal = 0;
for (const b of bands) {
  let colTotal = 0;
  for (const c of causes) colTotal += counts[`${c}:${b}`] || 0;
  grandTotal += colTotal;
  process.stdout.write(String(colTotal).padStart(colW));
}
process.stdout.write(String(grandTotal).padStart(10) + '\n');

// Percentage of "thriving" deaths
const thrivingDeaths = bands.slice(0, 1).flatMap(b => causes.map(c => counts[`${c}:${b}`] || 0)).reduce((a, b) => a + b, 0);
console.log(`\n${thrivingDeaths} of ${records.length} deaths (${(thrivingDeaths / records.length * 100).toFixed(1)}%) occurred while plant looked THRIVING (EMA > 0.7)`);

// Show some example thriving-death records
const thrivingExamples = records.filter(r => r.band === 'thriving').slice(0, 15);
if (thrivingExamples.length > 0) {
  console.log(`\nSample thriving-at-death plants:`);
  console.log('  cause        healthEMA  energy    age  maxAge');
  for (const r of thrivingExamples) {
    console.log(`  ${r.cause.padEnd(12)} ${r.healthEMA.toFixed(3).padStart(9)}  ${r.energy.toFixed(2).padStart(6)}  ${String(r.age).padStart(5)}  ${String(r.maxAge).padStart(6)}`);
  }
}
