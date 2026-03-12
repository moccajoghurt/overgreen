# Overgreen — Claude Code Instructions

## Development

- Vite dev server handles incremental compilation — do NOT run `npx tsc --noEmit` or `npx vite build` for routine checks. Both are slow and unnecessary during development. The dev server surfaces errors on its own. Only use these when absolutely necessary (e.g. major refactors touching many files, or verifying a production build before deploy).

## Simulation Architecture: Trait Tradeoff Engine

Plant physics use a two-layer data-driven system. **Never branch on terrain type or climate zone in plant logic.**

- **Layer 1** (`src/simulation/trait-effects.ts`): Terrain physics × climate physics → continuous cell environment variables. Seasonally modulated.
- **Layer 2** (`src/simulation/trait-effects.ts`): Entry `trait × envVar × coefficient` table. Each genome trait has benefits AND costs scaled by environment variables. Sums to a single production modifier on photosynthesis. Supports **trait interactions** (`trait × trait2 × envVar`) for creating multiple competing fitness peaks within the same niche, and **peaked traits** (`max(0, 1 - 2*|trait - center|)`) for "moderate X is optimal" selection pressure.
- **Layer 2b** (`src/simulation.ts`): **Subtype frequency-dependent selection (FDS)** — per-niche subtype population counts scale seed production. Dominant subtypes are penalized, rare subtypes boosted. This maintains multi-subtype coexistence without manual tuning. Do NOT add alternative competitive exclusion mechanisms (e.g. per-niche traitMod averaging, ENV_SIMILARITY matrices) — FDS handles coexistence.
- **Layer 3** (`src/simulation/tiers.ts`): Vertical competition via canopy/understory/ground tier slots per cell. Up to 3 plants coexist at different heights. Light cascades top-down through occupied tiers into `plant.effectiveLight`. Tier assignment runs each tick: plants sorted by height desc claim their preferred slot or fall down; no slot → death.

**The rule:** If you need niche-specific behavior, adjust terrain/climate base properties or add a table row — never add `if (terrain === X)` or `if (climate === Y)` in plant physics. All differentiation flows through continuous environment variables. This includes germination: **never add archetype-specific germination blocks** (e.g. "succulents can only germinate on Arid"). If an archetype shouldn't thrive on a terrain, make the trait engine produce a negative traitModifier for that genome profile — stress mortality will handle the rest. Hard germination blocks bypass natural selection and prevent evolution from discovering unexpected-but-viable strategies.
