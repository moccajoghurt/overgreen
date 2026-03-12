# Ralph Loop: Reach the Target Matrix

**You are in an iterative loop.** You may have done prior work — check `RALPH-PROGRESS.md` and recent git history before starting. Build on previous iterations, don't restart from zero.

## Your Mission

Make the Overgreen plant ecosystem simulator produce population distributions that match `target-matrix.md`. 16 niches (4 climates × 4 terrains, excluding River/Rock), 40 plant subtypes. Each niche specifies which subtypes should be Dominant, Common, Minor, or Absent.

**You are a researcher, not a tuner.** Your job is to understand WHY the system can or can't produce the target distribution, and to design architectural solutions when tuning alone fails. You have full permission to modify any part of the codebase.

## The System (read these files to understand)

- `src/simulation/trait-effects.ts` — Layer 1 (terrain×climate → environment variables) + Layer 2 (trait×envVar→modifier table, 65 rows currently)
- `src/types/subtypes.ts` — 40 subtypes classified from 9 genome traits via weighted scoring
- `src/simulation/growth.ts` — FDS (frequency-dependent selection), photosynthesis, reproduction
- `src/simulation/tiers.ts` — Vertical competition (canopy/understory/ground)
- `src/types/core.ts` — Genome interface (9 traits), archetype function
- `src/simulation.ts` — Tick loop (9 phases)
- `target-matrix.md` — The target
- `CLAUDE.md` — Architecture rules (READ THIS FIRST)

## Fast Feedback Tools

Use these in order of speed. Do NOT run full sim experiments for every change.

1. **Pure math (milliseconds):**
   - `npx tsx scripts/balance-tuning/target-score.ts` — **Single compliance score.** Run this after every change. Shows overall %, per-gate breakdown, and per-niche violations. Add `--verbose` for common-gate details. **This is your scoreboard.**
   - `npx tsx scripts/balance-tuning/balance-matrix.ts` — 40×16 trait modifier grid. Shows top-5 per niche. Use this to understand WHY the score is what it is.
   - `npx tsx scripts/balance-tuning/fitness-landscape.ts` — Hill-climb stability. Shows if subtypes are evolutionary attractors.
   - `npx tsx scripts/balance-tuning/optimize-coefficients.ts` — Gradient descent on coefficients to satisfy target ranking constraints. If this can't converge, the current architecture lacks the expressiveness to reach the target.

2. **Full sim validation (10-30 seconds):**
   - `npx tsx scripts/run-experiment.ts experiment-niche-matrix --ticks 3000 --out results/ralph-iter-N.json`
   - `npx tsx scripts/balance-tuning/extract-metrics.ts results/ralph-iter-N.json`
   - `npx tsx scripts/balance-tuning/compare-runs.ts results/ralph-iter-A.json results/ralph-iter-B.json`
   - `npx tsx scripts/balance-tuning/trajectory-analysis.ts results/ralph-iter-N.json`

3. **Parameter sweep (minutes):**
   - `npx tsx scripts/balance-tuning/parameter-sweep.ts --param X --values ... --scenario experiment-niche-matrix`

## Success Criteria

Run `npx tsx scripts/balance-tuning/target-score.ts` to get a single compliance number. Current baseline: **68.9%**.

The score breaks down into 4 gates (weighted):
- **Absent gate (35%):** "Absent" subtypes must NOT appear in the top-5 for that niche. No palms in temperate forest. Currently 92.6%.
- **Dominant gate (35%):** "Dominant" subtypes should appear in the niche's top-3. Currently **24.2%** — this is the main problem.
- **Common gate (20%):** "Common" subtypes should have positive modifiers. Currently 91.5%.
- **Minor gate (10%):** "Minor" subtypes shouldn't be strongly penalized. Currently 96.8%.

**Prioritize fixing the dominant gate** — it's by far the weakest. But don't regress the absent gate to do it. Consider tackling the absent violations first (they're the most egregious ecological errors), then focus on getting dominant subtypes into their correct niches.

Validate with a full sim run every time you believe you've made a breakthrough.

## The Core Problem (understand this before touching code)

The trait engine maps 9 genome traits × 12 environment variables → single fitness modifier. Subtype classification maps those same 9 traits → one of 8 subtypes per archetype. The problem:

**Within an archetype, subtypes with similar genome profiles get similar fitness scores.** Example: Oak (high leafSize, defense, rootPriority) and Magnolia (high leafSize, longevity, low defense) — if the dominant environment terms are leafSize×soilFertility, they both score high on fertile soil and there's nothing to make Oak beat Magnolia in temperate but Magnolia beat Oak in tropical.

The environment variables don't create enough **within-archetype niche separation**. The trait engine needs distinct "fitness landscapes" where the genome profile that classifies as "Oak" also happens to score well in temperate soil, while the profile that classifies as "Magnolia" scores well in tropical soil.

## Strategic Rules

### 1. Journal your thinking

Before AND after each iteration, append to `RALPH-PROGRESS.md`:

```
## Iteration N — [date/time]
### Hypothesis
What I think the problem is and what I'm trying.
### What I did
Concrete changes made.
### Results
balance-matrix output comparison, what improved, what regressed.
### Assessment
Is this approach working? Should I continue or pivot?
```

### 2. Recognize dead ends early

If you've spent 3+ iterations adjusting coefficients in the trait-effects table without meaningful progress on the success criteria, STOP. Write in your journal WHY it's not working. Consider:

- Are the environment variables too coarse to separate the subtypes that need separating?
- Are 9 genome traits enough dimensions to create 8 distinct fitness profiles per archetype across 16 niches?
- Is the subtype classifier fighting the trait engine (genome that classifies as "Palm" might have the wrong traits to score well in palm-appropriate niches)?
- Would a new environment variable, genome trait, or architectural pattern solve the problem more elegantly than more coefficients?

### 3. Think in dimensions, not coefficients

The right move is often NOT "change coefficient X from 0.3 to 0.5" but rather:

- "Add a new environment variable `canopyDensity` that separates forest niches from open niches"
- "Add a genome trait `temperatureTolerance` that lets the classifier separate cold-adapted from heat-adapted trees"
- "Create a new trait interaction term that gives the Oak genome profile a distinct advantage on temperate soil"

### 4. Respect the architecture

- NEVER add `if (subtype === X)` or `if (terrain === Y)` branches in plant physics
- ALL differentiation must flow through continuous environment variables and the trait table
- New traits and environment variables are welcome if they're ecologically meaningful
- The trait table can grow — but keep it principled (each row should have a real ecological justification)

### 5. Performance matters

The sim runs at ~12ms/tick with ~1500 plants. The trait engine is already compiled to ~25 groups with Float64Array lookups. If you add complexity:

- New genome traits: basically free (one more float per plant, one more buffer slot)
- New environment variables: basically free (pre-computed per niche)
- New trait-effect rows: cheap if they fold into existing compiled groups
- New sim phases or per-plant loops: expensive, justify carefully

### 6. Alignment check

The subtype classifier and the trait engine must be **aligned**: the genome that classifies as "Oak" must also be the genome that scores highest in Oak-appropriate niches. If they diverge, either fix the classifier weights or fix the trait engine — don't fight both.

Run `fitness-landscape.ts` to check alignment. If a subtype is "unstable" (hill-climbing pushes its genome to reclassify as a different subtype), that's a structural problem that no amount of coefficient tuning will fix.

## What You're Allowed to Do

Everything. This is not a tuning exercise. You're designing an ecosystem simulator. Specifically:

- Add new genome traits (update Genome interface, classifiers, trait table, compiled path)
- Add new environment variables (update CellEnvironment, deriveCellEnv, terrain/climate physics)
- Redesign how the trait engine works (as long as it stays data-driven, no hardcoded branches)
- Restructure the subtype classifier
- Modify Layer 1 (terrain/climate physics values)
- Change SIM constants
- Add new balance-tuning scripts
- Modify existing scripts
- Create entirely new architectural patterns

## What You Must NOT Do

- Add `if (terrain === X)` or `if (subtype === Y)` branches in simulation physics
- Break the renderer (don't change SubtypeId values or SUBTYPE_NAMES without updating renderers)
- Create configurations that make the sim unplayably slow (<5 FPS at 2000 plants)
- Ignore CLAUDE.md rules
- Skip journaling — if you lose track of what you've tried, you'll go in circles

## How to Start

1. Read `CLAUDE.md`, `target-matrix.md`, and the key source files listed above
2. Run `target-score.ts` — get the current compliance number
3. Run `balance-matrix.ts` — understand which niches are wrong and why
4. Run `fitness-landscape.ts` — understand subtype stability
5. Write your initial assessment in `RALPH-PROGRESS.md`: what's wrong, what's the highest-leverage fix
6. Pick the highest-leverage intervention and implement it
7. Run `target-score.ts` after every change — did the number go up?
8. When you see real progress, validate with a full sim run

## Completion

When you believe the target matrix is substantially met (primary + secondary gates passing), output:
<promise>RALPH_COMPLETE</promise>
