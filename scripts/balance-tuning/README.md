# Balance Tuning Scripts

Tools for tuning `trait-effects.ts` without running the full simulation. The first three scripts evaluate `computeTraitModifier(genome, env)` — a pure function — across representative genomes and niches. The population dynamics script adds FDS and tier competition on top.

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

### `population-dynamics.ts`
Non-spatial population dynamics simulator. Combines trait engine + FDS + tier light competition in a replicator dynamics model. Answers: "Given these coefficients, which subtypes survive in each niche when they compete?"

```bash
npx tsx scripts/balance-tuning/population-dynamics.ts              # default FDS=2.5
npx tsx scripts/balance-tuning/population-dynamics.ts --fds 1.0    # custom FDS
npx tsx scripts/balance-tuning/population-dynamics.ts --sweep       # sweep FDS 0→3
```

Outputs: per-niche equilibrium populations, diversity summary, subtype presence, diagnostics (monopolized niches, extinct subtypes, archetype balance). Sweep mode shows how FDS strength affects diversity vs. competitive exclusion.

### `extract-metrics.ts`
Reads experiment result JSON files and computes quantitative balance metrics. Defines pass/fail health checks for niche specialization.

```bash
npx tsx scripts/balance-tuning/extract-metrics.ts results/niche-matrix-baseline.json
```

Outputs: population health, diversity (richness, Shannon, Gini), niche specialization (differentiation, dominance, per-niche breakdown), archetype balance, and 8 pass/fail health checks.

## Workflow

1. Run `balance-matrix.ts` and `fitness-landscape.ts` for quick trait engine sanity checks (pure math, instant)
2. Run full simulation experiments via `scripts/run-experiment.ts` with the niche-matrix scenario
3. Extract metrics with `extract-metrics.ts` to get quantitative balance scores
4. Edit coefficients in `src/simulation/trait-effects.ts`, re-run experiments, compare metrics
5. Use `population-dynamics.ts` as a fast (but approximate) competitive dynamics sanity check

**Key insight:** The pure-math tools (balance-matrix, fitness-landscape) test the trait engine in isolation. The real sim adds spatial dynamics, evolution, tier displacement, and temporal effects that can't be captured analytically. Always validate with real experiments.
