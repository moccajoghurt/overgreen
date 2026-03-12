/**
 * Compare Runs
 *
 * Side-by-side diff of two or more experiment result files.
 * Shows metric deltas, highlights regressions/improvements,
 * flags health checks that flipped.
 *
 * Usage:
 *   npx tsx scripts/balance-tuning/compare-runs.ts results/a.json results/b.json
 *   npx tsx scripts/balance-tuning/compare-runs.ts results/a.json results/b.json --baseline 1
 */

import { readFileSync } from 'fs';
import {
  Report, BalanceMetrics, HealthCheck,
  extractMetrics, evaluateHealthChecks,
} from './lib/metrics';

// ── Types ──

interface RunData {
  file: string;
  shortName: string;
  report: Report;
  metrics: BalanceMetrics;
  checks: HealthCheck[];
}

// Direction: is higher or lower better for each metric?
const METRIC_DIRECTION: Record<string, 'higher' | 'lower'> = {
  finalPopulation: 'higher',
  populationStability: 'higher',
  subtypeRichness: 'higher',
  archetypeRichness: 'higher',
  shannonIndex: 'higher',
  giniCoefficient: 'lower',
  nicheDifferentiation: 'higher',
  avgMaxDominance: 'lower',
  avgNicheRichness: 'higher',
  nicheSpecializationScore: 'higher',
  extinctSubtypes: 'lower',
  archetypeBalance: 'higher',
};

const METRIC_LABELS: Record<string, string> = {
  finalPopulation: 'Final population',
  populationStability: 'Pop stability',
  subtypeRichness: 'Subtype richness',
  archetypeRichness: 'Archetype richness',
  shannonIndex: 'Shannon index',
  giniCoefficient: 'Gini coefficient',
  nicheDifferentiation: 'Niche differentiation',
  avgMaxDominance: 'Avg max dominance %',
  avgNicheRichness: 'Avg niche richness',
  nicheSpecializationScore: 'Specialization score',
  extinctSubtypes: 'Extinct subtypes',
  archetypeBalance: 'Archetype balance',
};

// ── Helpers ──

const out = (s: string) => process.stdout.write(s + '\n');
function pad(s: string, w: number) { return s.padEnd(w); }

function fmt(n: number, w = 8): string {
  if (Number.isInteger(n) && Math.abs(n) < 10000) return String(n).padStart(w);
  return n.toFixed(2).padStart(w);
}

function fmtDelta(n: number, w = 8): string {
  const sign = n > 0 ? '+' : '';
  if (Number.isInteger(n) && Math.abs(n) < 10000) return (sign + String(n)).padStart(w);
  return (sign + n.toFixed(2)).padStart(w);
}

function shortFileName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1].replace(/\.json$/, '');
}

function loadRun(file: string): RunData {
  const raw = readFileSync(file, 'utf-8');
  const report: Report = JSON.parse(raw);
  const metrics = extractMetrics(report);
  const checks = evaluateHealthChecks(metrics);
  return {
    file,
    shortName: shortFileName(file),
    report,
    metrics,
    checks,
  };
}

// ── Arg parsing ──

const args = process.argv.slice(2);
const baselineIdx = (() => {
  const idx = args.indexOf('--baseline');
  if (idx !== -1 && idx + 1 < args.length) {
    const val = parseInt(args[idx + 1], 10);
    return isNaN(val) ? 0 : val;
  }
  return 0;
})();

const files = args.filter(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));

if (files.length < 2) {
  process.stderr.write('Usage: npx tsx scripts/balance-tuning/compare-runs.ts <a.json> <b.json> [...] [--baseline N]\n');
  process.exit(1);
}

// ── Load all runs ──

const runs: RunData[] = [];
for (const file of files) {
  try {
    runs.push(loadRun(file));
  } catch (e: any) {
    process.stderr.write(`Error loading ${file}: ${e.message}\n`);
    process.exit(1);
  }
}

if (baselineIdx >= runs.length) {
  process.stderr.write(`--baseline ${baselineIdx} out of range (${runs.length} files)\n`);
  process.exit(1);
}

const baseline = runs[baselineIdx];

// ── Header ──

out('');
out('═══════════════════════════════════════════════════════════════');
out('  Compare Runs');
out('═══════════════════════════════════════════════════════════════');
out('');
for (let i = 0; i < runs.length; i++) {
  const marker = i === baselineIdx ? ' (baseline)' : '';
  out(`  [${i}] ${runs[i].file}${marker}`);
}

// ── Section A: Metric comparison ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION A: Metric Comparison');
out('───────────────────────────────────────────────────────────────');
out('');

const metricKeys = Object.keys(METRIC_LABELS);
const nameW = 22;
const valW = 10;
const deltaW = 10;

// Header row
const headerParts = [pad('Metric', nameW)];
for (let i = 0; i < runs.length; i++) {
  headerParts.push(runs[i].shortName.slice(0, valW).padStart(valW));
  if (i !== baselineIdx) {
    headerParts.push('delta'.padStart(deltaW));
  }
}
out('  ' + headerParts.join(' '));
out('  ' + '─'.repeat(headerParts.join(' ').length));

for (const key of metricKeys) {
  const baseVal = (baseline.metrics as any)[key] as number;
  const dir = METRIC_DIRECTION[key];
  const parts = [pad(METRIC_LABELS[key], nameW)];

  for (let i = 0; i < runs.length; i++) {
    const val = (runs[i].metrics as any)[key] as number;
    parts.push(fmt(val, valW));

    if (i !== baselineIdx) {
      const delta = val - baseVal;
      const absDelta = Math.abs(delta);
      const isSignificant = baseVal !== 0 ? absDelta / Math.abs(baseVal) > 0.01 : absDelta > 0;

      let indicator = ' ';
      if (isSignificant && delta !== 0) {
        const isBetter = (dir === 'higher' && delta > 0) || (dir === 'lower' && delta < 0);
        indicator = isBetter ? '+' : '-';
      }
      parts.push(fmtDelta(delta, deltaW - 2) + ' ' + indicator);
    }
  }

  out('  ' + parts.join(' '));
}

// ── Section B: Health check comparison ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION B: Health Check Comparison');
out('───────────────────────────────────────────────────────────────');
out('');

const checkLabelW = 30;
const checkColW = Math.max(10, ...runs.map(r => r.shortName.length + 2));

const checkHeader = [pad('Check', checkLabelW)];
for (const r of runs) checkHeader.push(r.shortName.slice(0, checkColW).padStart(checkColW));
checkHeader.push('  Status');
out('  ' + checkHeader.join(' '));
out('  ' + '─'.repeat(checkHeader.join(' ').length));

for (let ci = 0; ci < baseline.checks.length; ci++) {
  const baseCheck = baseline.checks[ci];
  const parts = [pad(baseCheck.label, checkLabelW)];

  let flipped = false;
  let flipType = '';

  for (let ri = 0; ri < runs.length; ri++) {
    const check = runs[ri].checks[ci];
    parts.push((check.pass ? 'PASS' : 'FAIL').padStart(checkColW));

    if (ri !== baselineIdx && check.pass !== baseCheck.pass) {
      flipped = true;
      flipType = check.pass ? 'IMPROVEMENT' : 'REGRESSION';
    }
  }

  if (flipped) {
    parts.push(`  ! ${flipType}`);
  }

  out(`  ${flipped ? '! ' : '  '}${parts.join(' ')}`);
}

// Health check score summary
const scoreParts = [pad('Score', checkLabelW)];
for (const r of runs) {
  const passed = r.checks.filter(c => c.pass).length;
  scoreParts.push(`${passed}/${r.checks.length}`.padStart(checkColW));
}
out('');
out('  ' + scoreParts.join(' '));

// ── Section C: Per-niche dominant changes ──

out('');
out('───────────────────────────────────────────────────────────────');
out('  SECTION C: Per-Niche Dominant Changes');
out('───────────────────────────────────────────────────────────────');
out('');

// Collect all niches
const allNiches = new Set<string>();
for (const r of runs) {
  for (const nb of r.metrics.nicheBreakdown) allNiches.add(nb.niche);
}
const sortedNiches = [...allNiches].sort();

const nicheNameW = 26;
const domColW = Math.max(14, ...runs.map(r => r.shortName.length + 2));

const nicheHeader = [pad('Niche', nicheNameW)];
for (const r of runs) nicheHeader.push(r.shortName.slice(0, domColW).padStart(domColW));
nicheHeader.push('  Changed');
out('  ' + nicheHeader.join(' '));
out('  ' + '─'.repeat(nicheHeader.join(' ').length));

let changedNiches = 0;
for (const niche of sortedNiches) {
  const dominants: string[] = [];
  const parts = [pad(niche, nicheNameW)];

  for (const r of runs) {
    const nb = r.metrics.nicheBreakdown.find(n => n.niche === niche);
    const dom = nb ? nb.dominant : '(none)';
    dominants.push(dom);
    parts.push(dom.slice(0, domColW).padStart(domColW));
  }

  const changed = new Set(dominants).size > 1;
  if (changed) {
    changedNiches++;
    parts.push('  *');
  }

  // Only show niches that changed (or all if few enough)
  if (changed || sortedNiches.length <= 20) {
    out(`  ${changed ? '* ' : '  '}${parts.join(' ')}`);
  }
}

if (changedNiches === 0) {
  out('  (no dominant changes across niches)');
} else {
  out(`\n  ${changedNiches}/${sortedNiches.length} niches changed dominant subtype`);
}

// ── Section D: Config diff ──

const allHaveConstants = runs.every(r => r.report.simConstants);
if (allHaveConstants) {
  const baseConsts = baseline.report.simConstants!;
  const diffs: { key: string; values: number[] }[] = [];

  const allKeys = new Set<string>();
  for (const r of runs) {
    for (const k of Object.keys(r.report.simConstants!)) allKeys.add(k);
  }

  for (const key of [...allKeys].sort()) {
    const values = runs.map(r => r.report.simConstants![key] ?? 0);
    if (values.some(v => v !== values[0])) {
      diffs.push({ key, values });
    }
  }

  if (diffs.length > 0) {
    out('');
    out('───────────────────────────────────────────────────────────────');
    out('  SECTION D: Config Differences');
    out('───────────────────────────────────────────────────────────────');
    out('');

    const constNameW = 28;
    const constHeader = [pad('Constant', constNameW)];
    for (const r of runs) constHeader.push(r.shortName.slice(0, valW).padStart(valW));
    out('  ' + constHeader.join(' '));
    out('  ' + '─'.repeat(constHeader.join(' ').length));

    for (const d of diffs) {
      const parts = [pad(d.key, constNameW)];
      for (const v of d.values) parts.push(fmt(v, valW));
      out('  ' + parts.join(' '));
    }
  }
}

out('');
