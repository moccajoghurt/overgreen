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

## Workflow

1. Edit coefficients or add interactions in `src/simulation/trait-effects.ts`
2. Run `fitness-landscape.ts` to check stability (primary tool)
3. Run `balance-matrix.ts` for a different view of niche rankings
4. Run `population-dynamics.ts` to check competitive dynamics with FDS
5. Iterate until satisfied, then run full simulation experiments to validate
