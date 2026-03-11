# Ralph Loop Progress

## Iteration 6: Wind Rebalance + Stress Mortality Tuning

### What was done

3 coefficient changes to improve hill niche differentiation and strengthen appropriate specialists:

1. **Woodiness × wind penalty: -0.50 → -0.70** — Rigid trunks now pay 40% more in wind. At w=0.4 (shrub minimum), net woodiness-wind effect on Hill+Temp goes from -0.054 to -0.109.

2. **Leaf × wind penalty: -0.40 → -0.20** — Reduced foliage damage in wind. Leaves flutter/shed but don't break the plant. The key structural failure in wind is trunk breakage (woodiness penalty), not leaf damage. This especially helps grasses whose wind advantage from flexible stems was being canceled by the leaf penalty.

3. **Stress mortality rate: 0.08 → 0.10** — Modest increase. Poorly-adapted plants die faster but not so fast that turnover eliminates diversity.

### Key learnings from experimentation

- Adding `(1-heightPriority) × windExposure × +0.20` was tried and BACKFIRED. Aromatic IS a compact, low-height plant, so any "reward for being short" also rewards Aromatic. Removed after one experiment.
- Stress mortality at 0.15 was too aggressive — killed all plants on hills including grasses, leaving Aromatic (with longevity/defense advantages) to dominate the high-turnover environment. Reduced to 0.10.
- The leaf × wind reduction was the key insight: with -0.40, even grasses had strongly negative modifiers on hills, so stress mortality killed them too. With -0.20, the woodiness-wind differentiation between grasses and shrubs actually matters.

### Performance

| Climate | Iter 5 | Iter 6 |
|---------|--------|--------|
| Temperate | 14 t/s | 15 t/s |
| Tropical | 15 t/s | 15 t/s |
| Mediterranean | 15 t/s | 16 t/s |
| Desert | 23 t/s | 24 t/s |

Performance slightly improved (1 fewer trait effect entry than iter 5 baseline after removing the backfiring height-wind term that was tried and reverted).

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Oak:116, Cypress:109, Fern:109, Mangrove:108, Magnolia:103 | 2.87 | **Improved**: Oak now #1 (was absent in iter 5 top 5). 28 subtypes coexist. |
| Soil+Trop | Magnolia:130, Cypress:112, Hazel:91, Vine:77, Birch:72 | 3.04 | Mixed: H:3.04 is excellent diversity. Tropical tree still missing. |
| Soil+Med | Magnolia:147, Aromatic:124, Cypress:112, Fern:112, Oak:106 | 2.76 | Mixed: Aromatic correct. Oak present. Need Mediterranean shrub dominant. |
| Soil+Desert | Magnolia:157, Saltbush:148, Aromatic:140, Cypress:124, Turfgrass:109 | 2.23 | Mixed: Saltbush rising (148). Need Desert Grass/Acacia/Barrel Cactus more. |
| Hill+Temp | Aromatic:232, Turfgrass:193, Hazel:176, Desert Grass:155, Wildflower:121 | 1.96 | **Improved grasses**: Turfgrass 173→193, Wildflower appeared 121, Clover 118. But Aromatic still #1 (target: Absent). |
| Hill+Trop | Aromatic:168, Desert Grass:135, Saltbush:129, Turfgrass:102, Wildflower:85 | 2.32 | Mixed: Turfgrass/Wildflower present. Target: Bunchgrass/Fern/Conifer dominant. |
| Hill+Med | Caudiciform:218, Turfgrass:172, Saltbush:172, Aromatic:153, Wildflower:90 | 2.37 | Mixed: Turfgrass good. Caudiciform shouldn't dominate (Absent target). |
| Hill+Desert | Caudiciform:120, Saltbush:87, Aromatic:86, Barrel Cactus:63, Turfgrass:46 | 2.17 | **Improved**: Barrel Cactus rising (48→63). Need Saguaro/Desert Grass. |
| Wetland+Temp | Hazel:127, Mangrove:126, Magnolia:124, Palm:114, Cypress:109 | 2.94 | **Improved**: Sedge appeared at 78 (was absent)! Hazel/Mangrove/Cypress all present. |
| Wetland+Trop | Magnolia:143, Mangrove:140, Cypress:115, Oak:115, Palm:109 | 2.96 | Mixed: Mangrove/Palm correct. Need Tropical tree, Fern, Bamboo dominant. |
| Wetland+Med | Magnolia:175, Hazel:155, Birch:136, Cypress:134, Mangrove:107 | 2.89 | Mixed: Cypress/Mangrove present. Need Sedge/Fern dominant. |
| Wetland+Desert | Hazel:154, Magnolia:107, Wildflower:81, Cypress:80, Fern:80 | 2.97 | Mixed: Fern present. Need Palm/Acacia/Sedge/Tallgrass dominant. |
| Arid+Temp | Desert Grass:146, Turfgrass:134, Aromatic:115, Caudiciform:115, Hazel:110 | 2.71 | Mixed: Desert Grass correct! Aromatic correct! Need Saltbush/Bunchgrass. |
| Arid+Trop | Turfgrass:132, Aromatic:117, Barrel Cactus:93, Caudiciform:85 | 2.80 | Mixed: Barrel Cactus emerging. Need Acacia/Aloe/Euphorbia/Pampas. |
| Arid+Med | Caudiciform:143, Turfgrass:122, Aromatic:115, Desert Grass:104 | 2.69 | Mixed: Need Barrel Cactus/Saguaro/Mediterranean dominant. |
| Arid+Desert | Caudiciform:142, Turfgrass:140, Aromatic:86, Barrel Cactus:65 | 2.33 | Mixed: Barrel Cactus present. Saguaro at 24. Need extreme sparsity. |

### Key improvements from iteration 5

- **Oak emerged as #1 on Soil+Temp** — was absent from top 5, now 116. Major win.
- **Sedge appeared on Wetland+Temp** at 78 — was completely absent before.
- **Target grasses/forbs on Hill+Temp**: Turfgrass 193, Wildflower 121, Clover 118 — 3 of 4 target dominants now present.
- **Higher diversity**: Soil+Trop H:3.04, Wetland+Desert H:2.97, Soil+Temp H:2.87 (all up from iter 5).
- **Performance recovered** to iter 4 levels (~15 tps).

### Remaining problems (ranked by priority)

1. **Aromatic still dominates hills** — 232 on Hill+Temp (target: Absent). The trait system can't differentiate compact shrubs from grasses because both share: low height, small leaves, moderate roots. The ONLY differentiator is woodiness (0.4 vs 0.15), and the wind penalty gap isn't large enough to overcome Aromatic's advantages in longevity and defense.

2. **Tropical tree never appears** — Classification requires high defense + heightPriority + leafSize + low rootPriority. Genomes that match this score higher for Cypress or Magnolia in the tree classifier.

3. **Caudiciform dominates Hill+Med** — A succulent shouldn't thrive on Mediterranean hills. The succulent germination filter allows them on Hill terrain. May need to restrict succulents to Arid terrain only in non-desert climates.

4. **Missing subtypes**: Bunchgrass (hills), Conifer (hills/temperate), Mediterranean shrub (Med niches), most tropical plants, Tallgrass (wetlands).

5. **Hazel/Desert Grass shouldn't be on hills** — Hazel (deciduous shrub) at 176 on Hill+Temp (target: Absent). Desert Grass at 155 (target: Absent). These are classification or niche-fitness issues.

### Suggested next focus (pick ONE)

- **Option A: Aromatic archetype bypass** — Instead of trying to suppress Aromatic through production modifiers (which proved hard), add a shrub-specific germination filter for Hill terrain. Similar to succulent germination restrictions. This directly enforces the absent-list constraint. Add `TERRAIN_PROPS[Hill].shrubGermination = false` or use a continuous woodiness threshold for germination on exposed terrain.

- **Option B: Fix Tropical tree classification** — The Tropical tree classifier scores: defense×0.3 + heightPriority×0.3 + leafSize×0.25 + (1-rootPriority)×0.15. This overlaps heavily with Cypress (heightPriority×0.4 + (1-leafSize)×0.25 + longevity×0.2 + woodiness×0.15). Plants that are tall + defensive + broad-leaved get pulled toward Tropical, but if they also have high woodiness they go Cypress. Possible fix: add a negative weight for woodiness in Tropical score (Tropical trees have flexible trunks, not dense rigid wood).

- **Option C: Restrict succulent germination further** — Currently succulents can germinate on Hill terrain. In Temperate/Tropical, restrict to Arid only. In Mediterranean, allow Hill+Arid. This would remove Caudiciform from Hill+Med and Hill+Temp.

- **Option D: Add climate affinity environment variable** — Create `tropicality = heat × humidity` and `continentality = frostRisk × droughtStress`. Add trait effects that reward/penalize based on these composites. E.g., high defense × tropicality gives bonus (modeling disease pressure in tropics), while longevity × continentality gives bonus (perennial strategies in continental climates).

**Recommendation: Option A.** The Aromatic-on-hills problem has persisted through 3 iterations of coefficient tuning. The trait effects approach fundamentally can't differentiate compact shrubs from grasses because they share the same small-leaf, low-height profile. A germination-level restriction (like the existing succulent restriction) is the cleanest way to enforce this ecological reality. In real hills, woody shrub seedlings are damaged by persistent wind before they can establish — this is a germination/establishment filter, not a growth-rate issue.
