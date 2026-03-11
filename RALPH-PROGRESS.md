# Ralph Loop Progress

## Iteration 5: Soil Fertility + Stress Mortality + Shade Rebalance

### What was done

6 interconnected changes to break generalist dominance and reward niche specialists:

1. **soilFertility environment variable** — `soilDepth × humidity × (1 - exposure × 0.5)`. High on Soil+Tropical (0.69), moderate on Soil+Temperate (0.38), low on Hill (0.09) and Arid (0.15). Drives 4 new trait effects.

2. **Trait effects for fertility** — leafSize × soilFertility × +0.60, (1-leafSize) × soilFertility × -0.30, woodiness × soilFertility × +0.25, heightPriority × soilFertility × +0.30. Big-leaved tall trees get strong production bonus on productive soil; small-leaved short shrubs get penalized.

3. **Wind coefficient rebalance** — Rigid trunk penalty -0.35→-0.50, flexible stem bonus +0.38→+0.20. Breakeven woodiness dropped from 0.40 to 0.29. Shrubs at woodiness 0.4 now pay -0.08 × windExposure in wind; previously they paid 0.

4. **Defense cost increase** — Base cost -0.15→-0.25. Defense now only provides net benefit when diseasePressure > 0.36. Aromatic's defense advantage on moderate-disease environments (Soil+Temp, Hill+Temp) eliminated.

5. **Stress mortality mechanic** — Plants with trait modifier below +0.05 threshold face per-tick death chance: `(threshold - modifier) × 0.08`. Adds `lastTraitModifier` field to Plant (stored during phaseUpdatePlants, read during phaseDeath).

6. **Shade tolerance rebalance** — Base shade tolerance 1.5→0.5, leaf-based shade efficiency 1.0→1.5. Large-leaved shade plants (Fern, Tropical Herb) keep strong shade performance; small-leaved plants (Aromatic) lose shade compensation. Also lowered trait modifier floor from 0.3→0.15.

### Performance

| Climate | Iter 4 | Iter 5 |
|---------|--------|--------|
| Temperate | 31 t/s | 14 t/s |
| Tropical | 32 t/s | 15 t/s |
| Mediterranean | 35 t/s | 15 t/s |
| Desert | 51 t/s | 23 t/s |

~50% performance regression. Main costs: more trait effects entries (+7 entries × ~15K plants/tick = extra computation in updatePlants), stress mortality threshold creating more turnover (higher germination cost). The death phase itself is optimized (2-3ms via cached lastTraitModifier).

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Cypress:145, Fern:144, Magnolia:141, Hazel:114, Acacia:89 | 2.69 | Mixed: Hazel good, Oak missing (was briefly #2 in v3). Fern/Cypress shouldn't be dominant. |
| Soil+Trop | Cypress:120, Magnolia:117, Hazel:92, Fern:84, Birch:79 | 3.01 | Poor: Tropical/Palm should dominate. Magnolia is expected. |
| Soil+Med | Magnolia:163, Aromatic:159, Cypress:143, Bramble:112, Acacia:99 | 2.63 | Mixed: Aromatic/Cypress correct. Mediterranean shrub missing. |
| Soil+Desert | Cypress:163, Magnolia:135, Aromatic:113, Saltbush:107, Hazel:77 | 2.29 | Mixed: Saltbush emerging. Desert Grass/Acacia needed dominant. |
| Hill+Temp | Aromatic:195, Turfgrass:173, Hazel:157, Desert Grass:135, Birch:113 | 2.27 | Improved: Turfgrass 76→173 (big jump). Aromatic still #1 (should be Absent). |
| Hill+Trop | Aromatic:132, Saltbush:121, Magnolia:96, Turfgrass:95, Cypress:63 | 2.01 | Poor: Bunchgrass/Fern/Conifer should dominate. |
| Hill+Med | Caudiciform:163, Aromatic:161, Turfgrass:142, Saltbush:107, Magnolia:100 | 2.53 | Mixed: Caudiciform is a succulent (should be absent from Med hills). Aromatic correct here. |
| Hill+Desert | Caudiciform:113, Aromatic:82, Magnolia:66, Iceplant:57, Barrel Cactus:48 | 2.21 | Mixed: Caudiciform good (succulent), Barrel Cactus emerging. Saguaro missing. |
| Wetland+Temp | Mangrove:177, Magnolia:131, Hazel:127, Palm:98, Birch:97 | 2.90 | Good: Mangrove surged to #1! Hazel/Birch correct. Need Cypress/Sedge/Fern. |
| Wetland+Trop | Magnolia:157, Hazel:153, Mangrove:132, Cypress:130, Palm:97 | 2.86 | Mixed: Mangrove/Palm present. Tropical tree missing as dominant. |
| Wetland+Med | Magnolia:156, Hazel:144, Palm:131, Cypress:117, Mangrove:106 | 2.97 | Good: Cypress present. Need Sedge/Fern dominant. |
| Wetland+Desert | Hazel:148, Desert Grass:102, Magnolia:95, Fern:95, Palm:94 | 2.88 | Mixed: Palm present. Need Acacia/Sedge/Tallgrass dominant. |
| Arid+Temp | Turfgrass:137, Aromatic:133, Caudiciform:129, Desert Grass:119, Magnolia:90 | 2.64 | Mixed: Aromatic correct! Desert Grass correct! Need Saltbush/Bunchgrass. |
| Arid+Trop | Turfgrass:129, Aromatic:109, Barrel Cactus:100, Caudiciform:75, Cypress:72 | 2.77 | Mixed: Barrel Cactus emerging. Need Acacia/Aloe/Euphorbia/Pampas. |
| Arid+Med | Turfgrass:147, Aromatic:134, Barrel Cactus:130, Caudiciform:125, Magnolia:102 | 2.70 | Mixed: Barrel Cactus good! Aromatic correct. Need Saguaro/Mediterranean. |
| Arid+Desert | Caudiciform:106, Saltbush:87, Turfgrass:78, Aromatic:66, Barrel Cactus:57 | 2.55 | Mixed: Barrel Cactus/Saltbush present. Need Saguaro dominant. |

### Key improvements from iteration 4

- **Turfgrass surged on Hill+Temp**: 76→173 (now #2, was #5)
- **Mangrove became #1 on Wetland+Temp**: 96→177
- **Desert specialists emerging across arid niches**: Caudiciform, Barrel Cactus, Saltbush, Desert Grass consistently in top 5
- **Trees stronger on productive soil**: Cypress/Magnolia/Hazel dominating soil pockets
- **Aromatic weakened on soil**: Soil+Temp Aromatic dropped from 142 to absent from top 5 (in v3)

### Remaining problems (ranked by priority)

1. **Aromatic still dominates hills** — 195 on Hill+Temp (target: Absent). Evolved genomes sit at woodiness 0.4 (min shrub threshold), dodging wind penalties. The linear trait effects system is fundamentally gamed by evolution finding sweet spots.

2. **Tropical tree never appears** — Classification requires high defense + high heightPriority + high leafSize + low rootPriority. This genome overlaps heavily with Cypress (high heightPriority + low leafSize) and Magnolia (high longevity + high leafSize). May need classification weight adjustment.

3. **Performance regression ~50%** — 14-15 tps vs 31-35 tps in iter 4. Caused by 7 extra trait effects entries and higher turnover from stress mortality. May need to optimize computeTraitModifier (e.g., unroll loop, cache per-species).

4. **Cypress dominates where it shouldn't** — Appearing as top-1/2 in Soil+Temp, Soil+Trop, Soil+Desert. Should be Common in Soil+Med and wetlands, not a generalist.

5. **Missing subtypes**: Sedge (wetlands), Bunchgrass (hills), Conifer (hills), Saguaro (arid), Aloe/Euphorbia (arid), Mediterranean shrub, most forbs.

### Suggested next focus (pick ONE)

- **Option A: Fix archetype woodiness boundary** — The shrub range (0.4-0.7) lets Aromatic evolve to 0.4 and dodge wind penalties. Consider either: (a) narrowing shrub range to 0.45-0.7, pushing borderline shrubs to grass/forb, or (b) adding a woodiness² term in wind effects so the penalty is more convex (harder to dodge by being at the boundary).

- **Option B: Fix Tropical tree classification** — Tropical tree requires defense + heightPriority + leafSize + low rootPriority. This overlaps with Cypress and Magnolia. Adjusting classification weights or adding a tropical-specific trait interaction could help.

- **Option C: Performance optimization** — The trait modifier computation is O(entries × plants) per tick. Could pre-compute modifier per (genome_hash, cell_env_index) and cache, or unroll the TRAIT_EFFECTS loop into direct arithmetic.

- **Option D: Add climate-specific germination filters** — Block tropical trees outside tropical climate, succulents on non-arid/hill terrain in wet climates. This directly enforces absent-list constraints without needing production modifier differentiation.

- **Option E: Add competition height penalty** — Short plants in cells with tall canopy trees receive a competition penalty (separate from light). This would directly hurt Aromatic in productive environments where trees grow tall, without affecting hills/arid where there's no canopy.

**Recommendation: Option A.** The woodiness boundary is the single biggest reason Aromatic escapes wind penalties on hills. If shrubs start at 0.45 instead of 0.40, Aromatic's evolved genomes would need woodiness ≥ 0.45 and would pay wind × (-0.50 × 0.45 + 0.20 × 0.55) = wind × -0.115. On Hill+Temp that's -0.078 — a real penalty that triggers stress mortality.
