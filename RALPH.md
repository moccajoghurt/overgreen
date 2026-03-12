## Loop Protocol

You are one iteration of an autonomous Ralph loop. You have NO memory of previous iterations — your only link to the past is the filesystem.

**Start of iteration:**
1. `git log --oneline -20` — see what previous iterations did
2. Read `RALPH-PROGRESS.md` (if it exists) — previous iteration left you notes
3. Read the Stuck Problems table. **If any problem has iterations stuck ≥ 3, you must do a structural change for it this iteration.** A structural change means adding a new environment variable, a new mechanic, or a system rework — not a coefficient tweak, classifier adjustment, or germination filter.
4. Otherwise, pick a tactical fix for the highest-priority problem.

**End of iteration:**
5. Commit your changes with a descriptive message
6. Update `RALPH-PROGRESS.md` (see Progress File Format below)
7. If ALL 16 niches pass (dominant subtypes match, Shannon H ≥ 2.5): output RALPH_COMPLETE

---

## Decision Framework

Each iteration, choose ONE of these approaches based on the current state:

### Tactical fix (default)
A single coefficient tweak, classifier adjustment, or trait-effect row. Good when the problem is clearly scoped and the fix is obvious.

### Structural change (escalate when stuck)
A new environment variable, new mechanic, or system rework. **Choose this when:**
- The same problem appears in `RALPH-PROGRESS.md` Stuck Problems for 3+ iterations
- Multiple niches share the same root cause (e.g., "climate zones don't differentiate" affects all 16 niches)
- You find yourself wanting to add another special-case filter to work around a missing environmental axis

Structural changes are higher risk but higher reward. They may produce messy experiment results on the first iteration — that's expected. The next iteration can tune the coefficients. Don't avoid structural changes just because the first experiment won't be clean.

### Strategic review (every 5 iterations)
Count the iterations from git log. On every 5th iteration (5, 10, 15, 20...), BEFORE picking a task:
1. Read the Stuck Problems section — which problems have been there longest?
2. Ask: "Am I making progress on the hard problems, or just polishing the easy ones?"
3. **Paradigm check:** "Am I stuck because coefficients are wrong, or because the trait engine can't express what I need?" If multiple niches share the same root cause, the fix is probably a new trait interaction or environment variable — not more coefficient tuning.
4. If a problem has survived 3+ iterations of tactical fixes, it needs a structural change this iteration
5. Write your strategic assessment in the progress file before proceeding

---

## Goal

Build a plant ecosystem sim that realistically models how diverse environments form. This sim should teach people why temperate forests look different from deserts, why wetlands have different species than hilltops.

Achieve the 16-niche target matrix below: 4 terrains (Soil, Hill, Wetland, Arid) × 4 climates (Temperate, Tropical, Mediterranean, Desert). Each niche should produce its realistic community of coexisting plant subtypes.

## What you can do

- Add new environment variables to `CellEnvironment` and `deriveCellEnv` (this is the primary way to give the trait engine new axes of differentiation)
- Add trait-effect rows to the `TRAIT_EFFECTS` table — including **trait interactions** (`trait × trait2 × envVar`) to create multiple fitness peaks per niche, and **peaked traits** (`peaked: center`) for "moderate X is optimal" selection pressure
- Add or rework classifiers in `src/types/subtypes.ts`
- Tweak constants and tuning values
- Rework or delete existing systems that aren't working

## What you must NOT do

- **Never add archetype-specific germination blocks** (e.g. "succulents can only germinate on Arid"). If an archetype shouldn't thrive somewhere, add trait-effect rows that make that genome profile unviable — stress mortality handles the rest. Hard germination blocks bypass natural selection.
- **Never add alternative coexistence mechanisms** (e.g. per-niche traitMod averaging, ENV_SIMILARITY matrices). Frequency-dependent selection (FDS) is already implemented in `simulation.ts` and handles multi-subtype coexistence. Tune `FDS_STRENGTH` if needed, but don't replace or duplicate the mechanism.
- **Never branch on terrain type or climate zone in plant logic** — all differentiation flows through continuous environment variables and the trait engine. See CLAUDE.md.

## Key Files

- `src/simulation/trait-effects.ts` — environment physics + trait effect coefficients (primary tuning lever)
- `src/simulation/tiers.ts` — vertical tier thresholds + light filtering
- `src/types/subtypes.ts` — subtype classifiers (how genomes map to named plant types)
- `src/types/constants.ts` — SIM constants + terrain properties
- Read `CLAUDE.md` for architectural rules before making changes

## Rules

- **Performance: current Ticks/sec should roughly stay the same** The experiment runner reports `perfStats.ticksPerSecond` in every JSON output. Log it. If a change drastically tanks perf, simplify the design, optimize performance or revert — the sim must stay fast enough for rapid iteration.
- **Never run experiment commands in the background** (no `run_in_background`). Always run them in the foreground so results are available immediately.

## Experiments

4 experiments, each 80×80 with 35×35 pockets (1,225 cells). Default: 5,000 ticks, snapshot every 1000. You may adjust `--ticks` up or down as needed — use fewer for quick smoke tests, more for convergence validation.

**Run all 4 in parallel** to save time (use `--out` and `&` + `wait`):

```bash
npx tsx --max-semi-space-size=128 --max-old-space-size=4096 scripts/run-experiment.ts experiment-terrain-quad --ticks 5000 --interval 1000 --out results/quad.json &
npx tsx --max-semi-space-size=128 --max-old-space-size=4096 scripts/run-experiment.ts experiment-terrain-quad-tropical --ticks 5000 --interval 1000 --out results/tropical.json &
npx tsx --max-semi-space-size=128 --max-old-space-size=4096 scripts/run-experiment.ts experiment-terrain-quad-mediterranean --ticks 5000 --interval 1000 --out results/mediterranean.json &
npx tsx --max-semi-space-size=128 --max-old-space-size=4096 scripts/run-experiment.ts experiment-terrain-quad-desert --ticks 5000 --interval 1000 --out results/desert.json &
wait
```

| Experiment                              | Climate       | Niches                        |
| --------------------------------------- | ------------- | ----------------------------- |
| `experiment-terrain-quad`               | Temperate     | Soil/Hill/Wetland/Arid × Temp |
| `experiment-terrain-quad-tropical`      | Tropical      | Soil/Hill/Wetland/Arid × Trop |
| `experiment-terrain-quad-mediterranean` | Mediterranean | Soil/Hill/Wetland/Arid × Med  |
| `experiment-terrain-quad-desert`        | Desert        | Soil/Hill/Wetland/Arid × Des  |

Success = dominant subtypes match the target matrix per niche, ≥8 subtypes coexist per niche (Shannon H ≥ 2.5).

---

## Progress File Format

`RALPH-PROGRESS.md` must end with these two sections (in addition to iteration notes above them):

```markdown
## Stuck Problems

| Problem | Iterations stuck | Root cause hypothesis | Suggested structural change |
|---------|-----------------|----------------------|----------------------------|
| <description> | <count> | <why> | <new env var, mechanic, or system rework> |

## What I would do next iteration
<one sentence>
```

Rules for the Stuck Problems table:
- Add new problems with count 1, increment each iteration if still present, remove when solved
- The "Suggested structural change" column must always contain a structural idea (new env var, new mechanic, system rework) — never a coefficient tweak or classifier adjustment
- The table is your long-term memory. Keep it in this exact format with this exact heading.

---

## Target Matrix

See [`target-matrix.md`](target-matrix.md) for the full 16-niche target matrix.
