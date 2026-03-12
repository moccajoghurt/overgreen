/**
 * Trajectory Analysis
 *
 * Temporal analysis of a single experiment's snapshot time series.
 * Detects: equilibrium reached vs still drifting, oscillation,
 * late extinctions, boom-bust cycles, per-niche stability.
 *
 * Usage:
 *   npx tsx scripts/balance-tuning/trajectory-analysis.ts results/experiment.json
 *   npx tsx scripts/balance-tuning/trajectory-analysis.ts results/experiment.json --window 4
 *   npx tsx scripts/balance-tuning/trajectory-analysis.ts results/experiment.json --verbose
 */

import { readFileSync } from 'fs';
import { Report, SnapshotWithNiche, SUBTYPE_ARCHETYPES } from './lib/metrics';

// ── Types ──

interface EquilibriumResult {
  reached: boolean;
  atTick: number | null;
  finalCV: number;
  trend: 'stable' | 'growing' | 'declining' | 'oscillating';
}

interface LateExtinction {
  subtypeName: string;
  lastSeenTick: number;
  peakPopulation: number;
  peakTick: number;
}

interface BoomBust {
  subtypeName: string;
  niche: string;
  peakPct: number;
  peakTick: number;
  finalPct: number;
}

interface NicheStability {
  niche: string;
  equilibrium: EquilibriumResult;
  dominantChanges: number;
  currentDominant: string;
  currentDominantPct: number;
}

// ── Helpers ──

const out = (s: string) => process.stdout.write(s + '\n');
function pad(s: string, w: number) { return s.padEnd(w); }
function fmt(n: number, w = 8): string {
  if (Number.isInteger(n) && Math.abs(n) < 10000) return String(n).padStart(w);
  return n.toFixed(2).padStart(w);
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function linearTrend(values: number[]): number {
  // Returns slope normalized by mean. Positive = growing, negative = declining.
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sumXY = 0, sumX2 = 0;
  const xMean = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    sumXY += (i - xMean) * (values[i] - mean);
    sumX2 += (i - xMean) ** 2;
  }
  const slope = sumX2 > 0 ? sumXY / sumX2 : 0;
  return slope / mean;
}

function countPeaks(values: number[]): number {
  let peaks = 0;
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) peaks++;
  }
  return peaks;
}

// ── Equilibrium detection ──

function detectEquilibrium(
  values: number[],
  ticks: number[],
  windowSize: number,
  cvThreshold = 0.05,
): EquilibriumResult {
  if (values.length < windowSize) {
    return { reached: false, atTick: null, finalCV: 0, trend: 'stable' };
  }

  // Final window CV
  const tail = values.slice(-windowSize);
  const finalCV = coefficientOfVariation(tail);

  // Trend in last window
  const trendVal = linearTrend(tail);
  const peaks = countPeaks(values.slice(-Math.max(windowSize, 6)));

  let trend: EquilibriumResult['trend'];
  if (peaks >= 2 && finalCV > cvThreshold) {
    trend = 'oscillating';
  } else if (Math.abs(trendVal) < 0.01) {
    trend = 'stable';
  } else if (trendVal > 0) {
    trend = 'growing';
  } else {
    trend = 'declining';
  }

  const reached = finalCV < cvThreshold && trend === 'stable';

  // Walk backwards to find when equilibrium was first reached
  let atTick: number | null = null;
  if (reached) {
    for (let end = windowSize; end <= values.length; end++) {
      const window = values.slice(end - windowSize, end);
      const cv = coefficientOfVariation(window);
      if (cv < cvThreshold) {
        atTick = ticks[end - 1];
        break;
      }
    }
  }

  return { reached, atTick, finalCV, trend };
}

// ── Late extinction detection ──

function detectLateExtinctions(snapshots: SnapshotWithNiche[]): LateExtinction[] {
  if (snapshots.length < 3) return [];

  const midIdx = Math.floor(snapshots.length / 2);
  const midSnap = snapshots[midIdx];
  const lastSnap = snapshots[snapshots.length - 1];

  // Get global subtype counts at midpoint
  const midCounts: Record<string, number> = {};
  for (const niche of Object.values(midSnap.subtypesByNiche ?? {})) {
    for (const [st, count] of Object.entries(niche)) {
      midCounts[st] = (midCounts[st] ?? 0) + count;
    }
  }

  // Get global subtype counts at end
  const endCounts: Record<string, number> = {};
  for (const niche of Object.values(lastSnap.subtypesByNiche ?? {})) {
    for (const [st, count] of Object.entries(niche)) {
      endCounts[st] = (endCounts[st] ?? 0) + count;
    }
  }

  const results: LateExtinction[] = [];

  for (const st of Object.keys(midCounts)) {
    if (midCounts[st] > 0 && (!endCounts[st] || endCounts[st] === 0)) {
      // Find peak and last-seen tick
      let peakPop = 0, peakTick = 0, lastSeenTick = 0;

      for (const snap of snapshots) {
        let count = 0;
        for (const niche of Object.values(snap.subtypesByNiche ?? {})) {
          count += niche[st] ?? 0;
        }
        if (count > 0) lastSeenTick = snap.tick;
        if (count > peakPop) { peakPop = count; peakTick = snap.tick; }
      }

      results.push({
        subtypeName: st,
        lastSeenTick,
        peakPopulation: peakPop,
        peakTick,
      });
    }
  }

  return results.sort((a, b) => b.peakPopulation - a.peakPopulation);
}

// ── Boom-bust detection ──

function detectBoomBusts(snapshots: SnapshotWithNiche[]): BoomBust[] {
  if (snapshots.length < 4) return [];

  const lastSnap = snapshots[snapshots.length - 1];
  const results: BoomBust[] = [];

  // For each niche, track subtypes that peaked high then crashed
  const allNiches = new Set<string>();
  for (const snap of snapshots) {
    for (const niche of Object.keys(snap.subtypesByNiche ?? {})) {
      if (!niche.includes('rock') && !niche.includes('river')) allNiches.add(niche);
    }
  }

  for (const niche of allNiches) {
    // Collect all subtypes seen in this niche
    const subtypes = new Set<string>();
    for (const snap of snapshots) {
      for (const st of Object.keys(snap.subtypesByNiche?.[niche] ?? {})) subtypes.add(st);
    }

    for (const st of subtypes) {
      let peakPct = 0, peakTick = 0;

      for (const snap of snapshots) {
        const nicheData = snap.subtypesByNiche?.[niche] ?? {};
        const nicheTotal = Object.values(nicheData).reduce((a, b) => a + b, 0);
        if (nicheTotal === 0) continue;
        const pct = ((nicheData[st] ?? 0) / nicheTotal) * 100;
        if (pct > peakPct) { peakPct = pct; peakTick = snap.tick; }
      }

      // Final pct
      const finalNiche = lastSnap.subtypesByNiche?.[niche] ?? {};
      const finalTotal = Object.values(finalNiche).reduce((a, b) => a + b, 0);
      const finalPct = finalTotal > 0 ? ((finalNiche[st] ?? 0) / finalTotal) * 100 : 0;

      // Boom-bust: peaked above 15%, fell below 3%
      if (peakPct > 15 && finalPct < 3) {
        results.push({ subtypeName: st, niche, peakPct, peakTick, finalPct });
      }
    }
  }

  return results.sort((a, b) => b.peakPct - a.peakPct);
}

// ── Per-niche stability ──

function analyzeNicheStability(
  snapshots: SnapshotWithNiche[],
  windowSize: number,
): NicheStability[] {
  const allNiches = new Set<string>();
  for (const snap of snapshots) {
    for (const niche of Object.keys(snap.subtypesByNiche ?? {})) {
      if (!niche.includes('rock') && !niche.includes('river')) allNiches.add(niche);
    }
  }

  const results: NicheStability[] = [];

  for (const niche of [...allNiches].sort()) {
    // Extract population time series for this niche
    const pops: number[] = [];
    const ticks: number[] = [];
    const dominants: string[] = [];

    for (const snap of snapshots) {
      const data = snap.subtypesByNiche?.[niche] ?? {};
      const total = Object.values(data).reduce((a, b) => a + b, 0);
      pops.push(total);
      ticks.push(snap.tick);

      const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
      dominants.push(entries.length > 0 ? entries[0][0] : '(empty)');
    }

    const equilibrium = detectEquilibrium(pops, ticks, windowSize);

    // Count dominant changes
    let changes = 0;
    for (let i = 1; i < dominants.length; i++) {
      if (dominants[i] !== dominants[i - 1]) changes++;
    }

    // Current dominant + pct
    const lastData = snapshots[snapshots.length - 1].subtypesByNiche?.[niche] ?? {};
    const lastTotal = Object.values(lastData).reduce((a, b) => a + b, 0);
    const lastEntries = Object.entries(lastData).sort((a, b) => b[1] - a[1]);
    const currentDominant = lastEntries.length > 0 ? lastEntries[0][0] : '(empty)';
    const currentDominantPct = lastTotal > 0 && lastEntries.length > 0
      ? (lastEntries[0][1] / lastTotal) * 100
      : 0;

    results.push({ niche, equilibrium, dominantChanges: changes, currentDominant, currentDominantPct });
  }

  return results;
}

// ── Arg parsing ──

const args = process.argv.slice(2);
const windowSize = (() => {
  const idx = args.indexOf('--window');
  if (idx !== -1 && idx + 1 < args.length) {
    const val = parseInt(args[idx + 1], 10);
    return isNaN(val) ? 4 : val;
  }
  return 4;
})();
const verbose = args.includes('--verbose');

const file = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
if (!file) {
  process.stderr.write('Usage: npx tsx scripts/balance-tuning/trajectory-analysis.ts <result.json> [--window N] [--verbose]\n');
  process.exit(1);
}

// ── Load ──

let report: Report;
try {
  const raw = readFileSync(file, 'utf-8');
  report = JSON.parse(raw);
} catch (e: any) {
  process.stderr.write(`Error loading ${file}: ${e.message}\n`);
  process.exit(1);
}

const snapshots = report.snapshots;
if (snapshots.length < 2) {
  process.stderr.write(`Need at least 2 snapshots, got ${snapshots.length}\n`);
  process.exit(1);
}

// ── Header ──

out('');
out('═══════════════════════════════════════════════════════════════');
out(`  Trajectory Analysis: ${file}`);
out(`  ${snapshots.length} snapshots, ticks ${snapshots[0].tick}–${snapshots[snapshots.length - 1].tick}`);
out('═══════════════════════════════════════════════════════════════');

// ── Section A: Overall verdict ──

const popValues = snapshots.map(s => s.population);
const popTicks = snapshots.map(s => s.tick);
const popEquilibrium = detectEquilibrium(popValues, popTicks, windowSize);

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION A: Overall Verdict');
out('───────────────────────────────────────────────────────────────');
out('');

if (popEquilibrium.reached) {
  out(`  EQUILIBRIUM reached at tick ${popEquilibrium.atTick} (CV=${popEquilibrium.finalCV.toFixed(3)})`);
} else if (popEquilibrium.trend === 'oscillating') {
  out(`  OSCILLATING — population not settled (CV=${popEquilibrium.finalCV.toFixed(3)})`);
} else if (popEquilibrium.trend === 'growing') {
  out(`  STILL GROWING — population trend positive (CV=${popEquilibrium.finalCV.toFixed(3)})`);
} else if (popEquilibrium.trend === 'declining') {
  out(`  DECLINING — population trend negative (CV=${popEquilibrium.finalCV.toFixed(3)})`);
} else {
  out(`  NOT YET STABLE — CV=${popEquilibrium.finalCV.toFixed(3)} (threshold: 0.05)`);
}

// Shannon equilibrium
const shannonValues = snapshots.map(s => s.diversity.shannonIndex);
const shannonEq = detectEquilibrium(shannonValues, popTicks, windowSize);
const shannonStatus = shannonEq.reached ? `stable at ${shannonValues[shannonValues.length - 1].toFixed(2)}` : `drifting (CV=${shannonEq.finalCV.toFixed(3)})`;
out(`  Diversity: ${shannonStatus}`);

// ── Section B: Population trajectory ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION B: Population Trajectory');
out('───────────────────────────────────────────────────────────────');
out('');

const trajHeader = `  ${pad('Tick', 7)} ${pad('Pop', 8)} ${pad('Births', 8)} ${pad('Deaths', 8)} ${pad('Shannon', 8)} ${pad('Species', 8)}`;
out(trajHeader);
out('  ' + '─'.repeat(trajHeader.length - 2));

for (const snap of snapshots) {
  const s = snap as any;
  const births = s.birthsInPeriod ?? 0;
  const deaths = s.deathsInPeriod?.total ?? 0;
  out(`  ${fmt(snap.tick, 7)} ${fmt(snap.population, 8)} ${fmt(births, 8)} ${fmt(deaths, 8)} ${snap.diversity.shannonIndex.toFixed(2).padStart(8)} ${fmt(snap.speciesCount, 8)}`);
}

// Mini sparkline
const maxPop = Math.max(...popValues);
const sparkW = 40;
out('');
out('  Population sparkline:');
for (const snap of snapshots) {
  const bar = Math.round((snap.population / maxPop) * sparkW);
  out(`  ${String(snap.tick).padStart(5)} ${'█'.repeat(bar)}${'░'.repeat(sparkW - bar)} ${snap.population}`);
}

// ── Section C: Per-niche stability ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION C: Per-Niche Stability');
out('───────────────────────────────────────────────────────────────');
out('');

const nicheStability = analyzeNicheStability(snapshots, windowSize);

// Sort: unstable first
nicheStability.sort((a, b) => {
  if (a.equilibrium.reached !== b.equilibrium.reached) return a.equilibrium.reached ? 1 : -1;
  return b.dominantChanges - a.dominantChanges;
});

const nicheW = 26;
const stHeader = `  ${pad('Niche', nicheW)} ${pad('Status', 12)} ${pad('CV', 7)} ${pad('DomChg', 7)} ${pad('Dominant', 16)} ${pad('Dom%', 6)}`;
out(stHeader);
out('  ' + '─'.repeat(stHeader.length - 2));

let stableCount = 0;
for (const ns of nicheStability) {
  const status = ns.equilibrium.reached ? 'STABLE' : ns.equilibrium.trend.toUpperCase();
  if (ns.equilibrium.reached) stableCount++;
  out(`  ${pad(ns.niche, nicheW)} ${pad(status, 12)} ${ns.equilibrium.finalCV.toFixed(3).padStart(7)} ${String(ns.dominantChanges).padStart(7)} ${pad(ns.currentDominant, 16)} ${ns.currentDominantPct.toFixed(1).padStart(5)}%`);
}
out(`\n  ${stableCount}/${nicheStability.length} niches at equilibrium`);

// ── Section D: Late extinctions ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION D: Late Extinctions');
out('───────────────────────────────────────────────────────────────');
out('');

const lateExtinctions = detectLateExtinctions(snapshots);

if (lateExtinctions.length === 0) {
  out('  No late extinctions detected (all midpoint subtypes survived to end)');
} else {
  const leHeader = `  ${pad('Subtype', 18)} ${pad('Archetype', 12)} ${pad('Peak', 6)} ${pad('PeakTick', 9)} ${pad('LastSeen', 9)}`;
  out(leHeader);
  out('  ' + '─'.repeat(leHeader.length - 2));

  for (const le of lateExtinctions) {
    const arch = SUBTYPE_ARCHETYPES[le.subtypeName] ?? '?';
    out(`  ${pad(le.subtypeName, 18)} ${pad(arch, 12)} ${String(le.peakPopulation).padStart(6)} ${String(le.peakTick).padStart(9)} ${String(le.lastSeenTick).padStart(9)}`);
  }
  out(`\n  ${lateExtinctions.length} subtypes went extinct after midpoint`);
}

// ── Section E: Boom-bust cycles ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION E: Boom-Bust Cycles');
out('───────────────────────────────────────────────────────────────');
out('');

const boomBusts = detectBoomBusts(snapshots);

if (boomBusts.length === 0) {
  out('  No boom-bust cycles detected');
} else {
  const bbHeader = `  ${pad('Subtype', 18)} ${pad('Niche', 22)} ${pad('PeakPct', 8)} ${pad('PeakTick', 9)} ${pad('FinalPct', 9)}`;
  out(bbHeader);
  out('  ' + '─'.repeat(bbHeader.length - 2));

  // Show top 20 at most
  for (const bb of boomBusts.slice(0, 20)) {
    out(`  ${pad(bb.subtypeName, 18)} ${pad(bb.niche, 22)} ${bb.peakPct.toFixed(1).padStart(7)}% ${String(bb.peakTick).padStart(9)} ${bb.finalPct.toFixed(1).padStart(8)}%`);
  }
  if (boomBusts.length > 20) {
    out(`  ... and ${boomBusts.length - 20} more`);
  }
  out(`\n  ${boomBusts.length} boom-bust events (peaked >15%, fell below 3%)`);
}

out('');
