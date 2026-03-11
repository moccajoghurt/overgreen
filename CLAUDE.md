# Overgreen — Claude Code Instructions

## Development

- Vite dev server handles incremental compilation — do NOT run `npx tsc --noEmit` or `npx vite build` for routine checks. Both are slow and unnecessary during development. The dev server surfaces errors on its own. Only use these when absolutely necessary (e.g. major refactors touching many files, or verifying a production build before deploy).

## Simulation Architecture: Trait Tradeoff Engine

Plant physics use a two-layer data-driven system. **Never branch on terrain type or climate zone in plant logic.**

- **Layer 1** (`src/simulation/trait-effects.ts`): Terrain physics × climate physics → continuous cell environment variables. Seasonally modulated.
- **Layer 2** (`src/simulation/trait-effects.ts`): Entry `trait × envVar × coefficient` table. Each genome trait has benefits AND costs scaled by environment variables. Sums to a single production modifier on photosynthesis.
- **Layer 3** (`src/simulation/tiers.ts`): Vertical competition via canopy/understory/ground tier slots per cell. Up to 3 plants coexist at different heights. Light cascades top-down through occupied tiers into `plant.effectiveLight`. Tier assignment runs each tick: plants sorted by height desc claim their preferred slot or fall down; no slot → death.

**The rule:** If you need niche-specific behavior, adjust terrain/climate base properties or add a table row — never add `if (terrain === X)` or `if (climate === Y)` in plant physics. All differentiation flows through continuous environment variables.
