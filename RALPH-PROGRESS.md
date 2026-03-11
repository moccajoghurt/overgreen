# Ralph Loop Progress

## Iteration 2: Base Trait Benefits + Wind Stunting Overhaul

### What was done

1. **Added unconditional base benefits** for traits that previously had only conditional (environment-dependent) effects:
   - `woodiness × null × +0.12` — structural support for canopy
   - `rootPriority × null × +0.10` — nutrient mining and soil anchoring
   - `heightPriority × null × +0.06` — competitive light positioning

   **Rationale:** Generalist plants with low trait values previously avoided all environmental penalties for free. Now low-trait strategies (like Aromatic) miss out on base benefits, making specialization genuinely rewarded in benign environments.

2. **Added leafSize × windExposure penalty** (`-0.40` coefficient):
   - Wind strips and damages large foliage — big-leaved trees/shrubs are penalized on exposed terrain.
   - Small-leaved grasses and compact plants are barely affected.

3. **Strengthened wind stunting** for both height and leaf area:
   - **Height stunting** coefficient increased from `0.9` to `2.0`, floor lowered from `0.3` to `0.2`
   - **Added leaf area stunting**: `leafWindStunt = max(0.3, 1 - windExposure × leafSize × 1.5)`
   - Effect: Trees cannot reach canopy tier on hills (capHeight ~1.5). Large-leaved plants grow smaller canopies in wind. Grasses barely affected.

### Performance
| Climate | Iter 1 | Iter 2 |
|---------|--------|--------|
| Temperate | 18 t/s | 15 t/s |
| Tropical | 18 t/s | 14 t/s |
| Mediterranean | 21 t/s | 15 t/s |
| Desert | 27 t/s | 23 t/s |

~20% slower due to denser plant populations in some niches. Still playable.

### Niche Results Summary (tick 5000)

**Shannon H across all experiments: 3.0-3.2 (target ≥2.5 met)**

**Improvements:**
- Hill+Desert: Barrel Cactus:109, Caudiciform:95 now dominate (succulents correct)
- Arid terrains: Diverse succulent/grass communities (Caudiciform, Barrel Cactus, Turfgrass, Aromatic, Desert Grass)
- Wetland+Temperate: Cypress:110, Birch:81, Sedge:55 (improving toward target)
- Soil niches: More diverse (28+ subtypes present)

**Remaining issues (for next iteration):**

1. **Aromatic shrub STILL too dominant on hills** — Aromatic:178 on Hill+Temperate. Its genome (low leafSize, high defense, high longevity, mid woodiness) avoids most penalties. The wind stunting and leaf penalty barely affect it because it has small leaves. Need a mechanism that specifically rewards herbaceous plants on exposed terrain.

2. **Magnolia/Cypress dominate over Oak/Birch on temperate soil** — Magnolia:131, Cypress:105 vs Oak:83. Subtype classification boundaries may need tuning, or longevity's unconditional bonus (+0.04) overly favors Magnolia's high-longevity genome.

3. **Succulents on Mediterranean hills** — Caudiciform:133, Iceplant:87 dominate Hill+Med. Target is Bunchgrass/Mediterranean/Aromatic. The `succulentGermination` flag allows succulents on all hills regardless of climate. Consider making it climate-aware.

4. **Tropical trees absent** — Tropical tree subtype barely appears in any tropical niche. Classification for Tropical tree competes with Oak and Magnolia.

5. **Hill grasses still underrepresented** — Turfgrass:15 on Hill+Temperate (target: dominant). Even with all wind penalties, shrubs outcompete grasses due to higher absolute leaf area.

### Suggested Next Focus (pick ONE)
- **Option A:** Add a "grass resilience" unconditional benefit for low woodiness (e.g., `(1-woodiness) × null × +0.08`). This directly rewards herbaceous plants without branching on archetype. Could also be `(1-woodiness) × windExposure × +0.20` to specifically help grasses on hills.
- **Option B:** Tune subtype classification boundaries to fix Magnolia/Oak and Tropical tree confusion.
- **Option C:** Add climate-dependent succulent germination restriction to fix Med hill succulents.
- **Option D:** Increase overall magnitude of trait effect coefficients (e.g., 1.5× across board) so trait modifier is more decisive vs raw leaf area differences.
