# Balance Tuning Scripts

Tools for tuning `trait-effects.ts`. The first three scripts evaluate `computeTraitModifier(genome, env)` — a pure function — across representative genomes and niches. The remaining scripts analyze full spatial simulation results.

## Scripts

### `balance-matrix.ts`
Shows which subtypes score highest in each niche. Quick overview of the fitness landscape.

```bash
npx tsx scripts/balance-tuning/balance-matrix.ts
```

Outputs: per-niche rankings, per-subtype affinity, unconstrained niche optima, diagnostics (dead niches, homeless subtypes).

### `fitness-landscape.ts`
Hill-climbs from each subtype's representative genome in each niche to test evolutionary stability. Answers: "If evolution starts at subtype X in niche Y, does it stay there?"

```bash
npx tsx scripts/balance-tuning/fitness-landscape.ts
```

Outputs: stability matrix (stable/drifts per niche), per-subtype summary, target matrix comparison, never-stable subtypes. Uses archetype-constrained hill-climbing (grasses stay grasses, etc).

### `optimize-coefficients.ts`
Gradient descent on trait-effect coefficients to satisfy pairwise ranking constraints from the target matrix. Useful for finding coefficient directions but limited by the linear structure of the trait table.

```bash
npx tsx scripts/balance-tuning/optimize-coefficients.ts
```

### `extract-metrics.ts`
Reads experiment result JSON files and computes quantitative balance metrics. Defines pass/fail health checks for niche specialization.

```bash
npx tsx scripts/balance-tuning/extract-metrics.ts results/niche-matrix-baseline.json
```

Outputs: population health, diversity (richness, Shannon, Gini), niche specialization (differentiation, dominance, per-niche breakdown), archetype balance, and 8 pass/fail health checks.

### `compare-runs.ts`
Side-by-side diff of two or more experiment result files. Delta table for all metrics, highlights regressions/improvements, flags health checks that flipped. Shows per-niche dominant changes and config differences.

```bash
npx tsx scripts/balance-tuning/compare-runs.ts results/a.json results/b.json
npx tsx scripts/balance-tuning/compare-runs.ts results/a.json results/b.json --baseline 1
```

Outputs: metric comparison with deltas (+/- indicators for better/worse), health check matrix with flip detection, per-niche dominant changes, config diff.

### `trajectory-analysis.ts`
Temporal analysis of experiment snapshots. Detects equilibrium vs. still drifting, oscillation, late extinctions, boom-bust cycles, per-niche stability.

```bash
npx tsx scripts/balance-tuning/trajectory-analysis.ts results/experiment.json
npx tsx scripts/balance-tuning/trajectory-analysis.ts results/experiment.json --window 4 --verbose
```

Outputs: overall verdict (equilibrium/drifting/oscillating), population trajectory with sparkline, per-niche stability table, late extinctions (subtypes lost after midpoint), boom-bust cycles.

### `parameter-sweep.ts`
Full spatial simulation sweep over a SIM/GRASS constant. Runs the headless sim in-process for each value, extracts metrics, outputs comparison table. Supports `--seeds N` for stochastic robustness.

```bash
npx tsx scripts/balance-tuning/parameter-sweep.ts --param FDS_STRENGTH --values 1.0,1.5,2.0,2.5,3.0 --scenario experiment-niche-matrix
npx tsx scripts/balance-tuning/parameter-sweep.ts --param PHOTOSYNTHESIS_RATE --range 0.3:0.7:0.1 --scenario experiment-niche-matrix
npx tsx scripts/balance-tuning/parameter-sweep.ts --param FDS_STRENGTH --values 1,2,3 --scenario experiment-niche-matrix --seeds 3 --ticks 5000
npx tsx scripts/balance-tuning/parameter-sweep.ts --list-params
```

Outputs: sweep results table (key metrics per value), health check matrix, best value recommendation. ~10s per value at 3000 ticks.

## Workflow

1. Run `balance-matrix.ts` and `fitness-landscape.ts` for quick trait engine sanity checks (pure math, instant)
2. Run full simulation experiments via `scripts/run-experiment.ts` with the niche-matrix scenario
3. Extract metrics with `extract-metrics.ts` to get quantitative balance scores
4. Compare runs with `compare-runs.ts` to check for regressions
5. Use `trajectory-analysis.ts` to verify populations reach equilibrium
6. Edit coefficients in `src/simulation/trait-effects.ts`, re-run experiments, compare metrics
7. Use `parameter-sweep.ts` for systematic exploration of sensitive parameters

**Key insight:** The pure-math tools (balance-matrix, fitness-landscape) test the trait engine in isolation. The real sim adds spatial dynamics, evolution, tier displacement, and temporal effects that can't be captured analytically. Always validate with full spatial experiments.
