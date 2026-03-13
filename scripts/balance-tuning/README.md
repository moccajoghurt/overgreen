# Balance Tuning Scripts

Tools for tuning `trait-effects.ts`. The first two scripts evaluate `computeTraitModifier(genome, env)` — a pure function — across representative genomes and niches. The remaining scripts analyze full spatial simulation results.

## Target Matrix

The target matrix (`target-matrix.md`) uses a two-tier structure:
- **Excluded** (hard): subtypes that must NOT appear in a niche's top-5
- **Strong archetypes** (soft): which archetypes should have competitive representatives

Scoring via `target-score.ts` checks both gates.

## Scripts

### `target-score.ts`
Single-number compliance check against the target matrix. Two gates: exclusion (60% weight) and archetype presence (40% weight).

```bash
npx tsx scripts/balance-tuning/target-score.ts
npx tsx scripts/balance-tuning/target-score.ts --verbose
```

### `balance-matrix.ts`
Shows which subtypes score highest in each niche. Quick overview of the fitness landscape.

```bash
npx tsx scripts/balance-tuning/balance-matrix.ts
```

### `fitness-landscape.ts`
Hill-climbs from each subtype's representative genome in each niche to test evolutionary stability. Answers: "If evolution starts at subtype X in niche Y, does it stay there?"

```bash
npx tsx scripts/balance-tuning/fitness-landscape.ts
```

### `extract-metrics.ts`
Reads experiment result JSON files and computes quantitative balance metrics.

```bash
npx tsx scripts/balance-tuning/extract-metrics.ts results/niche-matrix-baseline.json
```

### `compare-runs.ts`
Side-by-side diff of two or more experiment result files.

```bash
npx tsx scripts/balance-tuning/compare-runs.ts results/a.json results/b.json
```

### `trajectory-analysis.ts`
Temporal analysis of experiment snapshots. Detects equilibrium vs. still drifting.

```bash
npx tsx scripts/balance-tuning/trajectory-analysis.ts results/experiment.json
```

### `parameter-sweep.ts`
Full spatial simulation sweep over a SIM constant. Runs the headless sim in-process for each value.

```bash
npx tsx scripts/balance-tuning/parameter-sweep.ts --param FDS_STRENGTH --values 1.0,1.5,2.0,2.5,3.0 --scenario experiment-niche-matrix
```

### `env-dump.ts`
Dumps environment variable values for all 16 niches.

```bash
npx tsx scripts/balance-tuning/env-dump.ts
```

## Workflow

1. Run `target-score.ts` for compliance check (instant)
2. Run `balance-matrix.ts` and `fitness-landscape.ts` for trait engine analysis (pure math, instant)
3. Run full simulation experiments via `scripts/run-experiment.ts`
4. Extract metrics with `extract-metrics.ts`, compare with `compare-runs.ts`
5. Edit coefficients in `src/simulation/trait-effects.ts`, re-run, compare
