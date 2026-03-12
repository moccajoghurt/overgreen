/**
 * Balance Metrics Extractor
 *
 * Reads experiment results (JSON) and computes quantitative balance metrics.
 * These metrics define what "good niche specialization" means numerically.
 *
 * Usage:
 *   npx tsx scripts/balance-tuning/extract-metrics.ts results/niche-matrix-baseline.json
 *   npx tsx scripts/balance-tuning/extract-metrics.ts results/*.json   # compare runs
 */

import { readFileSync } from 'fs';
import {
  Report, BalanceMetrics,
  extractMetrics, evaluateHealthChecks,
} from './lib/metrics';

// ── Output ──

const out = (s: string) => process.stdout.write(s + '\n');

function pad(s: string, w: number) { return s.padEnd(w); }

function printMetrics(file: string, metrics: BalanceMetrics) {
  out('');
  out(`═══════════════════════════════════════════════════════════════`);
  out(`  Balance Metrics: ${file}`);
  out(`═══════════════════════════════════════════════════════════════`);

  out('');
  out('  ── Population ──');
  out(`  Final population:      ${metrics.finalPopulation}`);
  out(`  Stability:             ${metrics.populationStability} (1.0 = constant)`);

  out('');
  out('  ── Diversity ──');
  out(`  Subtype richness:      ${metrics.subtypeRichness} / 40`);
  out(`  Archetype richness:    ${metrics.archetypeRichness} / 5`);
  out(`  Shannon index:         ${metrics.shannonIndex}`);
  out(`  Gini coefficient:      ${metrics.giniCoefficient} (0 = equal, 1 = monopoly)`);
  out(`  Extinct subtypes:      ${metrics.extinctSubtypes} / 40`);
  out(`  Archetype balance:     ${metrics.archetypeBalance} (1.0 = all equal)`);

  out('');
  out('  ── Niche Specialization ──');
  out(`  Niche differentiation: ${metrics.nicheDifferentiation} (unique dominants / niches)`);
  out(`  Avg max dominance:     ${metrics.avgMaxDominance}% (lower = more diverse)`);
  out(`  Avg niche richness:    ${metrics.avgNicheRichness} subtypes per niche`);
  out(`  Specialization score:  ${metrics.nicheSpecializationScore} (% subtypes that dominate somewhere)`);

  out('');
  out('  ── Per-Niche Breakdown ──');
  out(`  ${pad('Niche', 26)} ${pad('Plants', 7)} ${pad('Dominant', 16)} ${pad('Dom%', 6)} ${pad('Rich', 5)} Top 3`);
  out(`  ${'─'.repeat(26)} ${'─'.repeat(7)} ${'─'.repeat(16)} ${'─'.repeat(6)} ${'─'.repeat(5)} ${'─'.repeat(40)}`);

  for (const n of metrics.nicheBreakdown) {
    out(
      `  ${pad(n.niche, 26)} ${String(n.total).padStart(7)} ${pad(n.dominant, 16)} ${n.dominantPct.toFixed(1).padStart(5)}% ${String(n.richness).padStart(5)} ${n.top3.join(', ')}`
    );
  }

  // ── Health checks ──
  out('');
  out('  ── Health Check (target ranges) ──');
  const checks = evaluateHealthChecks(metrics);

  let pass = 0;
  for (const check of checks) {
    const icon = check.pass ? 'PASS' : 'FAIL';
    out(`  ${check.pass ? '  ' : '! '}[${icon}] ${pad(check.label, 35)} (${check.value})`);
    if (check.pass) pass++;
  }
  out(`\n  Score: ${pass}/${checks.length} checks passed`);
}

// ── Main ──

const files = process.argv.slice(2);
if (files.length === 0) {
  process.stderr.write('Usage: npx tsx scripts/balance-tuning/extract-metrics.ts <result.json> [...]\n');
  process.exit(1);
}

for (const file of files) {
  try {
    const raw = readFileSync(file, 'utf-8');
    const report: Report = JSON.parse(raw);
    const metrics = extractMetrics(report);
    printMetrics(file, metrics);
  } catch (e: any) {
    process.stderr.write(`Error reading ${file}: ${e.message}\n`);
  }
}

out('');
