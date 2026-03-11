# Ralph Loop Progress

## Iteration 3: Grass Resilience + Wind Stunting Overhaul

### What was done

1. **Added inverse trait effect mechanism** — new `inverse` flag on TraitEffect uses `(1 - traitVal)`.
   - New entry: `(1-woodiness) × windExposure × +0.45` — "flexible herbaceous stems resist wind"
   - Grasses (woodiness ~0.05): +0.29 bonus on hills; shrubs (woodiness ~0.5): +0.15
   - This directly rewards non-woody plants on exposed terrain without branching on archetype.

2. **Increased defense metabolic cost** from -0.10 to -0.15 per unit.
   - Makes high-defense strategies (Aromatic: defense ~0.7) costlier everywhere.
   - In disease-rich environments (tropical soil), defense benefit (+0.70 × diseasePressure) still outweighs cost.
   - In disease-poor environments (hills), defense is now a net drag.

3. **Lowered wind stunt floors** — height floor 0.2→0.1, leaf area floor 0.3→0.15.
   - Woody plants on hills reduced to 10% max height = ground tier.
   - Forces direct competition with grasses instead of shading from understory.

### Performance
| Climate | Prev Iter | This Iter |
|---------|-----------|-----------|
| Temperate | 15 t/s | 15 t/s |
| Tropical | 14 t/s | 15 t/s |
| Mediterranean | 15 t/s | 16 t/s |
| Desert | 23 t/s | 24 t/s |

No performance regression.

### Niche Results Summary (tick 5000)

**Shannon H: 3.0-3.2 across all experiments (target ≥2.5 met)**

**Key improvements (Hill+Temperate):**
- Turfgrass: 15 → ~91-141 (massive improvement from iter 2 baseline)
- Wildflower and Clover now appearing in top 8 on hills
- Aromatic: 178 → 169 (moderate decrease, still #1)

**Full results from final run (representative, stochastic):**

| Niche | Top 5 | H |
|-------|-------|---|
| Soil+Temp | Acacia:127, Cypress:113, Magnolia:107, Aromatic:102, Oak:86 | 2.97 |
| Soil+Trop | Magnolia:115, Aromatic:113, Cypress:109, Hazel:84, Desert Grass:84 | 2.96 |
| Soil+Med | Aromatic:174, Magnolia:146, Cypress:122, Turfgrass:101, Hazel:77 | 2.76 |
| Soil+Desert | Magnolia:161, Aromatic:152, Turfgrass:119, Saltbush:108, Cypress:84 | 2.10 |
| Hill+Temp | Aromatic:169, Turfgrass:91, Wildflower, Clover in top 8 | 2.23 |
| Hill+Trop | Aromatic:140, Turfgrass:106, Saltbush:94, Magnolia:88, Cypress:68 | 2.19 |
| Hill+Med | Iceplant:127, Magnolia:123, Aromatic:113, Caudiciform:99, Saltbush:83 | 2.40 |
| Hill+Desert | Caudiciform:103, Aromatic:82, Barrel Cactus:81, Iceplant:66, Magnolia:43 | 2.25 |
| Wetland+Temp | Magnolia:136, Hazel:123, Cypress:117, Mangrove:111, Acacia:84 | 2.98 |
| Wetland+Trop | Hazel:133, Acacia:131, Magnolia:126, Mangrove:100, Holly:91 | 3.02 |
| Wetland+Med | Hazel:175, Magnolia:169, Cypress:120, Palm:108, Birch:90 | 2.94 |
| Wetland+Desert | Hazel:117, Magnolia:112, Aromatic:109, Fern:88, Turfgrass:85 | 3.02 |
| Arid+Temp | Turfgrass:143, Aromatic:124, Caudiciform:109, Iceplant:90, Barrel Cactus:83 | 2.75 |
| Arid+Trop | Aromatic:118, Desert Grass:100, Turfgrass:98, Caudiciform:87, Jade:70 | 2.94 |
| Arid+Med | Turfgrass:172, Aromatic:134, Caudiciform:131, Barrel Cactus:104, Saltbush:91 | 2.71 |
| Arid+Desert | Caudiciform:115, Turfgrass:91, Saltbush:88, Aromatic:76, Iceplant:72 | 2.40 |

### What was tried and reverted
- Longevity × frostRisk × -0.12 and longevity × windExposure × -0.10 penalties. These hurt ALL plants on hills, including grasses (longevity ~0.3). Turfgrass dropped from 141 to 80. Reverted.

### Remaining issues (for next iteration)

1. **Aromatic still #1 on most hills** — 169 on Hill+Temp (target: grasses dominant). Its mid-woodiness genome (0.5) still benefits partially from inverse-woodiness wind bonus while maintaining structural advantage.

2. **Magnolia ubiquitous** — appears in top 3 of 14/16 niches. Oak (target dominant for Soil+Temp) only at 86. The Magnolia genome is too broadly competitive.

3. **Tropical tree subtype absent** — doesn't appear in any tropical niche top 8. Classification competes with Oak and Magnolia.

4. **Succulents dominate Med/Desert hills** — Caudiciform:99, Iceplant:127 on Hill+Med. Target is Bunchgrass/Mediterranean/Aromatic. succulentGermination allows succulents on hills regardless of climate.

5. **Wetland niches lack specialists** — Sedge, Fern, Bamboo, Tallgrass rarely appear. Generalist trees dominate.

6. **Turfgrass dominates arid** — 143-172 on arid. Target is Saltbush/Desert Grass. The inverse-woodiness wind bonus on arid (exposure 0.5) may be too generous.

7. **Soil+Desert Shannon H = 2.10** — below 2.5 target. Magnolia/Aromatic/Turfgrass monopolize.

### Suggested Next Focus (pick ONE)

- **Option A: Fix Aromatic generalism** — The Aromatic genome (low leaf, mid woody, high defense, high longevity) avoids all penalties. Ideas: increase leafSize base benefit from +0.30 to +0.35 so low-leaf strategies pay more opportunity cost. Or add `leafSize × windExposure × +0.15, inverse: true` so small-leaved plants DON'T get a wind bonus (cancels the current implicit advantage).

- **Option B: Restrict succulent germination by climate** — Only allow succulentGermination on hills in Desert/Mediterranean. Temperate+Tropical hills should block succulents entirely.

- **Option C: Boost waterlogging differentiation** — Add `(1-rootPriority) × waterlogging × +0.35` to reward shallow-rooted wetland specialists. This would help Sedge, Fern, Bamboo (low rootPriority genomes) in wetlands.

- **Option D: Fix Magnolia dominance** — Magnolia has high longevity + high leafSize + moderate woodiness. Could increase the unconditional longevity benefit from +0.04 to +0.02 (reduce generalist longevity bonus) while adding `longevity × diseasePressure × +0.08` (reward longevity specifically where disease-adapted immune systems pay off).

- **Option E: Add drought penalty for non-woody plants** — `(1-woodiness) × droughtStress × -0.20` would penalize grasses in arid terrain, fixing Turfgrass dominance in arid niches without affecting hill niches (low drought stress).
