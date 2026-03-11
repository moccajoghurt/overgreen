## Loop Protocol

You are one iteration of an autonomous Ralph loop. You have NO memory of previous iterations — your only link to the past is the filesystem.

**Start of iteration:**
1. `git log --oneline -20` — see what previous iterations did
2. Read `RALPH-PROGRESS.md` (if it exists) — previous iteration left you notes
3. Decide what to do this iteration (see Decision Framework below)

**End of iteration:**
4. Commit your changes with a descriptive message
5. Update `RALPH-PROGRESS.md` (see Progress File Format below)
6. If ALL 16 niches pass (dominant subtypes match, Shannon H ≥ 2.5): output RALPH_COMPLETE

---

## Decision Framework

Each iteration, choose ONE of these approaches based on the current state:

### Tactical fix (default)
A single coefficient tweak, classifier adjustment, or germination filter. Good when the problem is clearly scoped and the fix is obvious.

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
3. If a problem has survived 3+ iterations of tactical fixes, it needs a structural change this iteration
4. Write your strategic assessment in the progress file before proceeding

---

## Goal

Build a plant ecosystem sim that realistically models how diverse environments form. This sim should teach people why temperate forests look different from deserts, why wetlands have different species than hilltops.

Achieve the 16-niche target matrix below: 4 terrains (Soil, Hill, Wetland, Arid) × 4 climates (Temperate, Tropical, Mediterranean, Desert). Each niche should produce its realistic community of coexisting plant subtypes.

## What you can do

- Add new environment variables to `CellEnvironment` and `deriveCellEnv` (this is the primary way to give the trait engine new axes of differentiation)
- Add trait-effect rows to the `TRAIT_EFFECTS` table
- Add or rework classifiers in `src/types/subtypes.ts`
- Add germination filters or other mechanics in `src/simulation.ts`
- Tweak constants and tuning values
- Rework or delete existing systems that aren't working

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

`RALPH-PROGRESS.md` must have these sections:

```markdown
# Ralph Loop Progress

## Iteration N: <title>

### What was done
<description of changes>

### Experiment results
<niche table, performance numbers>

### What improved
<specific wins vs previous iteration>

### Regressions
<anything that got worse>

## Stuck Problems

Problems that persist across iterations. Add new ones, increment the counter on existing ones, remove solved ones.

| Problem | Iterations stuck | Root cause hypothesis | Suggested approach |
|---------|-----------------|----------------------|-------------------|
| <description> | <count> | <why tactical fixes haven't worked> | <structural change needed> |

## Next iteration suggestion
<what to do next, informed by the stuck problems table>
```

The **Stuck Problems** table is critical. It's your long-term memory. Rules:
- When a problem appears for the first time, add it with count 1
- Each iteration where it's still present, increment the count
- When a problem is solved, remove it
- When a problem hits count 3, the "Suggested approach" column MUST contain a structural change, not another coefficient tweak

---

## Target Matrix

40 subtypes: Grasses — Turfgrass, Tallgrass, Bunchgrass, Bamboo, Ryegrass, Sedge, Pampas, Desert Grass. Trees — Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Acacia. Shrubs — Holly, Hazel, Mediterranean, Bramble, Saltbush, Mangrove, Flowering Shrub, Aromatic. Succulents — Saguaro, Aloe, Caudiciform, Euphorbia, Iceplant, Epiphytic, Barrel Cactus, Jade. Forbs — Wildflower, Tall Herb, Fern, Vine, Clover, Moss, Tropical Herb, Desert Annual.

Each niche: **Dominant** (most abundant), **Common** (reliably present), **Minor** (sparse), **Absent** (ecologically impossible).

### Soil

**Soil+Temperate** — Central European broadleaf forest

- Dominant: Oak, Birch, Hazel
- Common: Holly, Bramble, Wildflower, Fern, Clover, Moss, Tallgrass
- Minor: Magnolia, Turfgrass, Ryegrass, Tall Herb, Vine
- Absent: Tropical, Palm, Bamboo, Pampas, Desert Grass, Saltbush, Mangrove, Mediterranean, Aromatic, all Succulents, Tropical Herb, Desert Annual

**Soil+Tropical** — Tropical rainforest

- Dominant: Tropical, Palm, Magnolia, Tropical Herb, Fern
- Common: Vine, Bamboo, Flowering Shrub, Tall Herb, Moss, Epiphytic
- Minor: Tallgrass, Bramble, Clover
- Absent: Oak, Birch, Conifer, Cypress, Holly, Mediterranean, Aromatic, Saltbush, Saguaro, Barrel Cactus, Jade, Desert Grass, Desert Annual, Pampas, Turfgrass, Ryegrass

**Soil+Mediterranean** — Maquis/garrigue woodland

- Dominant: Mediterranean, Aromatic, Cypress, Oak
- Common: Holly, Wildflower, Clover, Turfgrass, Ryegrass
- Minor: Aloe, Euphorbia, Bramble, Tall Herb, Bunchgrass, Acacia
- Absent: Tropical, Palm, Birch, Magnolia, Bamboo, Mangrove, Saltbush, Saguaro, Barrel Cactus, Pampas, Fern, Moss, Vine, Tropical Herb, Desert Annual, Desert Grass

**Soil+Desert** — Desert scrubland

- Dominant: Saltbush, Acacia, Desert Grass, Desert Annual
- Common: Saguaro, Barrel Cactus, Aloe, Euphorbia, Jade, Aromatic
- Minor: Bunchgrass, Caudiciform, Pampas
- Absent: Oak, Birch, Magnolia, Conifer, Tropical, Palm, Cypress, Holly, Hazel, Mangrove, Bramble, Flowering Shrub, Iceplant, Epiphytic, Wildflower, Tall Herb, Fern, Vine, Clover, Moss, Tropical Herb, Tallgrass, Turfgrass, Ryegrass, Sedge, Bamboo

### Hill

**Hill+Temperate** — Alpine/rocky meadow

- Dominant: Bunchgrass, Turfgrass, Wildflower, Clover
- Common: Ryegrass, Moss, Tallgrass, Holly
- Minor: Conifer, Aromatic, Fern, Tall Herb
- Absent: Oak, Magnolia, Tropical, Palm, Birch, Cypress, Acacia, Hazel, Mediterranean, Bramble, Saltbush, Mangrove, Flowering Shrub, all Succulents, Bamboo, Pampas, Desert Grass, Sedge, Vine, Tropical Herb, Desert Annual

**Hill+Tropical** — Tropical highland / cloud forest

- Dominant: Bunchgrass, Tropical Herb, Fern, Conifer
- Common: Wildflower, Moss, Flowering Shrub, Epiphytic, Bamboo
- Minor: Tall Herb, Vine, Clover
- Absent: Oak, Magnolia, Palm, Birch, Cypress, Acacia, Holly, Hazel, Mediterranean, Saltbush, Mangrove, Aromatic, Saguaro, Barrel Cactus, Jade, Iceplant, Pampas, Desert Grass, Turfgrass, Ryegrass, Desert Annual

**Hill+Mediterranean** — Mediterranean rocky slopes

- Dominant: Bunchgrass, Mediterranean, Aromatic
- Common: Wildflower, Turfgrass, Clover, Cypress
- Minor: Euphorbia, Barrel Cactus, Holly, Ryegrass
- Absent: Oak, Magnolia, Tropical, Palm, Birch, Acacia, Hazel, Bramble, Saltbush, Mangrove, Flowering Shrub, Saguaro, Aloe, Iceplant, Epiphytic, Jade, Bamboo, Pampas, Desert Grass, Fern, Vine, Moss, Tropical Herb, Desert Annual

**Hill+Desert** — Desert rocky highlands

- Dominant: Saguaro, Barrel Cactus, Desert Grass, Bunchgrass
- Common: Desert Annual, Euphorbia, Saltbush, Aloe
- Minor: Caudiciform, Aromatic, Jade
- Absent: Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Acacia, Holly, Hazel, Mediterranean, Bramble, Mangrove, Flowering Shrub, Iceplant, Epiphytic, Tallgrass, Turfgrass, Ryegrass, Bamboo, Pampas, Sedge, Wildflower, Tall Herb, Fern, Vine, Clover, Moss, Tropical Herb

### Wetland

**Wetland+Temperate** — Temperate riparian forest / swamp

- Dominant: Birch, Cypress, Sedge, Fern
- Common: Oak, Mangrove, Hazel, Moss, Tall Herb, Wildflower, Tallgrass
- Minor: Bramble, Clover, Ryegrass, Holly
- Absent: Magnolia, Tropical, Palm, Acacia, Conifer, Mediterranean, Aromatic, Saltbush, Flowering Shrub, all Succulents, Bamboo, Pampas, Desert Grass, Bunchgrass, Turfgrass, Vine, Tropical Herb, Desert Annual

**Wetland+Tropical** — Tropical swamp / mangrove forest

- Dominant: Tropical, Palm, Mangrove, Fern, Bamboo
- Common: Magnolia, Vine, Tropical Herb, Sedge, Moss, Tall Herb
- Minor: Flowering Shrub, Epiphytic, Tallgrass
- Absent: Oak, Birch, Conifer, Cypress, Acacia, Holly, Hazel, Mediterranean, Aromatic, Bramble, Saltbush, Saguaro, Aloe, Barrel Cactus, Jade, Iceplant, Caudiciform, Euphorbia, Turfgrass, Ryegrass, Bunchgrass, Pampas, Desert Grass, Wildflower, Clover, Desert Annual

**Wetland+Mediterranean** — Seasonal Mediterranean wetland

- Dominant: Cypress, Mangrove, Sedge, Fern
- Common: Birch, Wildflower, Ryegrass, Tallgrass, Moss
- Minor: Mediterranean, Holly, Tall Herb, Clover
- Absent: Oak, Magnolia, Tropical, Palm, Acacia, Conifer, Hazel, Aromatic, Bramble, Saltbush, Flowering Shrub, all Succulents, Bamboo, Pampas, Desert Grass, Bunchgrass, Turfgrass, Vine, Tropical Herb, Desert Annual

**Wetland+Desert** — Desert oasis

- Dominant: Palm, Acacia, Sedge, Tallgrass
- Common: Fern, Ryegrass, Mangrove, Moss
- Minor: Saltbush, Wildflower, Clover
- Absent: Oak, Birch, Magnolia, Conifer, Tropical, Cypress, Holly, Hazel, Mediterranean, Aromatic, Bramble, Flowering Shrub, all Succulents, Bamboo, Pampas, Desert Grass, Bunchgrass, Turfgrass, Vine, Tall Herb, Tropical Herb, Desert Annual

### Arid

**Arid+Temperate** — Temperate steppe / dry scrubland

- Dominant: Saltbush, Aromatic, Desert Grass, Bunchgrass
- Common: Aloe, Jade, Euphorbia, Ryegrass, Desert Annual, Holly
- Minor: Acacia, Caudiciform, Saguaro, Wildflower, Clover
- Absent: Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Hazel, Mediterranean, Bramble, Mangrove, Flowering Shrub, Iceplant, Epiphytic, Barrel Cactus, Tallgrass, Turfgrass, Bamboo, Pampas, Sedge, Tall Herb, Fern, Vine, Moss, Tropical Herb

**Arid+Tropical** — Tropical arid savanna

- Dominant: Acacia, Aloe, Euphorbia, Pampas
- Common: Saltbush, Desert Grass, Saguaro, Jade, Desert Annual, Tropical Herb
- Minor: Barrel Cactus, Caudiciform, Bunchgrass, Aromatic
- Absent: Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Holly, Hazel, Mediterranean, Bramble, Mangrove, Flowering Shrub, Iceplant, Epiphytic, Tallgrass, Turfgrass, Ryegrass, Bamboo, Sedge, Wildflower, Tall Herb, Fern, Vine, Clover, Moss

**Arid+Mediterranean** — Hot Mediterranean arid (Sonoran/North African)

- Dominant: Barrel Cactus, Saguaro, Aromatic, Mediterranean
- Common: Aloe, Euphorbia, Desert Grass, Desert Annual, Saltbush
- Minor: Jade, Caudiciform, Bunchgrass, Acacia, Wildflower
- Absent: Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Holly, Hazel, Bramble, Mangrove, Flowering Shrub, Iceplant, Epiphytic, Tallgrass, Turfgrass, Ryegrass, Bamboo, Pampas, Sedge, Tall Herb, Fern, Vine, Clover, Moss, Tropical Herb

**Arid+Desert** — Extreme desert (Sahara/Atacama interior)

- Dominant: Saguaro, Barrel Cactus (sparse)
- Common: Desert Grass (ephemeral), Desert Annual (ephemeral)
- Minor: Saltbush, Euphorbia, Jade, Caudiciform
- Absent: All Trees, all Shrubs except Saltbush, Iceplant, Epiphytic, Aloe, all Grasses except Desert Grass, all Forbs except Desert Annual
- Note: very low total population — near carrying-capacity floor
