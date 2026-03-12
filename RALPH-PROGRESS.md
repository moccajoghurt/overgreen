# Ralph Progress

## Iteration 0 — Architecture Reset (human-driven)

Previous Ralph run (27 iterations) got stuck in a loop of germination blocks and coefficient hacks. The architecture was fundamentally changed:

1. **Trait interactions** added to `TRAIT_EFFECTS` table — entries with `trait2` field create cross-trait products (`trait × trait2 × envVar × coeff`), producing multiple fitness peaks per niche instead of one. This is your primary tool for making different genome profiles viable in the same environment.
2. **Peaked traits** — entries with `peaked: center` use a tent function `max(0, 1 - 2*|trait - center|)` for "moderate X is optimal" selection pressure.
3. **Frequency-dependent selection (FDS)** in `simulation.ts` — dominant subtypes in each niche get penalized seed production, rare subtypes get boosted. This maintains coexistence without manual tuning. Do NOT replace or duplicate this mechanism.
4. **Germination blocks removed** — no archetype-specific germination filters. Viability is controlled entirely through trait effects + stress mortality.

**Your job is to tune trait-effect rows (especially interactions) and classifiers to match the target matrix.** The engine now has the expressiveness to support multiple coexisting subtypes per niche — you need to give it the right rows.

### Key files changed
- `src/simulation/trait-effects.ts` — 12 interaction entries already seeded (drought, tropical, arid, wetland, Mediterranean specialization)
- `src/simulation.ts` — FDS constants: `FDS_STRENGTH = 2.5`, min multiplier 0.3, max 2.0
- `src/types/subtypes.ts` — classifier tweaks for Magnolia, Tropical tree, Cypress, Acacia, Thorny/Bramble

## Stuck Problems

| Problem | Iterations stuck | Root cause hypothesis | Suggested structural change |
|---------|-----------------|----------------------|----------------------------|
| (none yet — fresh start) | 0 | — | — |

## What I would do next iteration
Run all 4 experiments to establish a baseline with the new architecture, then identify which niches need more trait interaction rows.
