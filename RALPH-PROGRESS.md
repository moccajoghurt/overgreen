# Ralph Loop Progress

## Iteration 1: Baseline Assessment + Wind Stunting + Trait Effect Rebalance

### What was done
1. **Added subtype-per-terrain reporting** to experiment runner (`scripts/run-experiment.ts`). Now every snapshot includes `subtypesByTerrain` — subtype counts broken down by terrain type.

2. **Implemented wind stunting (krummholz effect)** in `src/simulation.ts`. Wind exposure limits maximum plant height, proportional to woodiness:
   ```
   windStunt = max(0.3, 1 - windExposure × woodiness × 0.9)
   capHeight = maxHeight × windStunt
   ```
   This prevents rigid woody trees from reaching canopy tier on exposed hills while allowing flexible grasses to grow normally.

3. **Rebalanced trait-effect coefficients** in `src/simulation/trait-effects.ts`:
   - **Flipped** woodiness × windExposure from +0.15 to **-0.25** (rigid trunks snap in wind)
   - **Increased** coefficients ~1.5-2x across the board for stronger niche differentiation
   - **Added** leafSize × diseasePressure interaction (-0.30)
   - **Added** seedInvestment × windExposure interaction (+0.20, wind dispersal)
   - Full table in the source file

4. **Optimized facilitation check** — pre-compute per-cell archetype bitmasks instead of iterating over all neighbor plants each tick. Avoids Map.get() and archetype() calls in hot loop.

### Performance
| Climate | Before | After |
|---------|--------|-------|
| Temperate | 30 t/s | 18 t/s |
| Tropical | 28 t/s | 18 t/s |
| Mediterranean | 32 t/s | 21 t/s |
| Desert | 51 t/s | 27 t/s |

~37% slower due to more plants alive (multi-tier cells are now better utilized). The facilitation optimization recovered ~50% of the initial perf regression.

### Niche Results Summary (tick 5000)

**Progress highlights:**
- Hills now show Wildflower, Turfgrass, Fern emerging alongside shrubs (was 100% tree-dominated)
- Desert hills now properly dominated by Caudiciform, Barrel Cactus (succulents)
- Arid terrain shows diverse succulent/grass communities
- Wetlands show Mangrove, Cypress, Palm correctly
- Shannon H ≥ 2.85 across all experiments

**Remaining issues (for next iteration):**
1. **Aromatic shrub too dominant everywhere** — its low-trait profile minimizes all environmental penalties. Appears top-3 in almost every niche including hills and arid where it shouldn't be.
2. **Magnolia tree still universally competitive** — dominates soil, wetland, and even appears on hills. Should be limited to tropical/Mediterranean soil.
3. **Grasses underrepresented on hills** — Turfgrass and Wildflower appear but Bunchgrass, Clover, Moss absent. Hills need stronger grass advantage.
4. **Wrong trees on soil** — Magnolia/Cypress dominate instead of Oak/Birch (temperate) or Tropical/Palm (tropical).
5. **Arid+Desert not sparse enough** — too many plants survive; should be near carrying-capacity floor.
6. **Performance recovery** — 37% slower is inherent to more plants; tierAssignment sort could be optimized.

### Suggested Next Focus
- Add **base trait benefits** (woodiness × null × +0.10, rootPriority × null × +0.10) so that LOW-trait strategies (Aromatic) have a genuine productivity cost, not just "avoids penalties"
- Or: add a **maintenance modifier** from trait effects — wrong environment increases maintenance, compounding the production penalty
- Alternatively: tune the subtype **classification boundaries** so that generalist genomes don't always map to Aromatic/Magnolia
