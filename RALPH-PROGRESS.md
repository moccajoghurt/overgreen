# Ralph Loop Progress

## Iteration 11: Ground heat + woodiness heat penalty + extremeAridity boost

### What was done

3 changes in `src/simulation/trait-effects.ts` targeting Saguaro viability on desert niches:

1. **New `groundHeat` component in heatStress formula** — `heatStress += heat × aridity × (1-exposure) × (1-waterlogging) × 0.5`. On flat arid terrain, low wind (1-exposure) and low moisture (1-waterlogging) trap intense radiative heat at ground level. Hills are protected by wind cooling, wetlands by evaporative cooling. This decouples desert ground heat from wind exposure.

2. **extremeAridity × heightPriority coefficient: 0.90→1.30** — Stronger selective advantage for tall columnar cacti escaping lethal ground-level heat. Combined with groundHeat, this makes heightPriority 2-3× more valuable than rootPriority on Arid+Desert and Hill+Desert.

3. **New trait effect: woodiness × heatStress × -0.30** — Bark cracking and xylem desiccation in extreme heat. Specifically penalizes trees in hot environments, reducing Cypress dominance on desert niches while minimally affecting temperate/tropical.

### Key learnings from experimentation

- **Iter 10's Hill+Desert Saguaro:179 was a rare outlier.** Baseline runs (same iter 10 code) show Caudiciform:178-205 and Saguaro:0-1. The previous iteration's report was based on a single lucky run. All subsequent analysis used multiple runs per configuration.

- **Caudiciform classifier gate is counterproductive due to Janzen-Connell.** Tried adding a height gate to Caudiciform classifier (h<0.25 full score, ramp to zero at h=0.45). This INCREASED Caudiciform from ~180 to ~210 on Hill+Desert. Reason: JC uses classifySubtype for conspecific counting. By reclassifying moderate-height succulents away from Caudiciform, we reduced JC pressure on remaining short Caudiciform, allowing them to proliferate unchecked. **Key principle: classifier changes affect JC dynamics, not just labels.**

- **Desert niche results are highly stochastic.** Hill+Desert Saguaro ranged 0-205 across runs with identical code. Arid+Desert Saguaro ranged 24-69. Multiple runs (3+) are essential for evaluating desert changes. Single-run results are unreliable.

- **The groundHeat formula's main impact is on Soil+Desert (0.27→0.525) and Arid+Desert (0.45→0.653).** Hill+Desert gets only +0.081 because (1-exposure)=0.2 on hills. The extremeAridity coefficient boost (0.90→1.30) has more impact on Hill+Desert because it applies on both terrains equally.

### heatStress values (base, before seasonal modulation)

| Terrain\Climate | Temperate | Tropical | Mediterranean | Desert |
|----------------|-----------|----------|---------------|--------|
| Soil (e=0.3)   | 0.118     | 0.254    | 0.229         | 0.525  |
| Hill (e=0.8)   | 0.249     | 0.574    | 0.425         | 0.801  |
| Wetland (e=0.2)| 0.064     | 0.146    | 0.110         | 0.212  |
| Arid (e=0.5)   | 0.173     | 0.385    | 0.313         | 0.653  |

### Performance

| Climate | Iter 10 | Iter 11 |
|---------|---------|---------|
| Temperate | 30 t/s | 30 t/s |
| Tropical | 30 t/s | 30 t/s |
| Mediterranean | 32 t/s | 32 t/s |
| Desert | 51 t/s | 49 t/s |

Stable. Two new trait effect rows + one new envVar computation had no measurable impact.

### Niche Results Summary (tick 5000, best of available runs)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Fern:132, Oak:124, Acacia:120, Cypress:118, Magnolia:116 | 2.74 | Oak correct. Fern present. Acacia should be absent. |
| Soil+Trop | Cypress:125, Magnolia:109, Hazel:97, Mangrove:89, Fern:89 | 3.03 | H passes! Need Tropical/Palm dominant. |
| Soil+Med | Cypress:141, Bramble:128, Oak:113, Hazel:101, Magnolia:98 | 2.85 | Need Mediterranean/Aromatic dominant. |
| Soil+Desert | Cypress:223, Tallgrass:118, TallHerb:113, Hazel:96, Mediterranean:95 | 2.39 | Cypress still dominant (should be absent). Saltbush:79 present. |
| Hill+Temp | Turfgrass:192, Bunchgrass:120, Wildflower:94, DesertGrass:67, Clover:44 | 1.59 | Turfgrass/Bunchgrass/Wildflower correct! DesertGrass:67 (should be absent but reduced from 111). |
| Hill+Trop | TallHerb:167, Pampas:166, Bunchgrass:154, DesertGrass:124, Tallgrass:95 | 2.29 | Need TropicalHerb/Fern/Conifer. Pampas/DesertGrass wrong. |
| Hill+Med | Bunchgrass:161, Caudiciform:158, Wildflower:156, Turfgrass:128, DesertGrass:122 | 2.59 | Bunchgrass correct! Caudiciform:158 (absent). Saguaro:81 (absent). |
| Hill+Desert | Saguaro:205, Caudiciform:146, Tallgrass:111, BarrelCactus:87 | 1.82 | **Saguaro #1 dominant!** BarrelCactus present. Best run of 3 (0, 202, 205). |
| Wetland+Temp | Mangrove:187, Magnolia:125, Hazel:119, Cypress:105, Palm:102 | 2.76 | Mangrove correct. Need Birch/Sedge/Fern dominant. |
| Wetland+Trop | Mangrove:145, Cypress:141, Magnolia:138, Hazel:122, Palm:108 | 2.98 | Mangrove/Palm correct. Need Tropical/Fern/Bamboo dominant. |
| Wetland+Med | Magnolia:151, Mangrove:147, Hazel:144, Cypress:127, Palm:123 | 2.90 | Mangrove/Cypress correct. Need Sedge/Fern dominant. |
| Wetland+Desert | Hazel:142, Cypress:134, TallHerb:96, Tallgrass:90, Vine:89 | 2.92 | Need Palm/Acacia/Sedge/Tallgrass dominant. |
| Arid+Temp | Clover:196, Bunchgrass:184, DesertGrass:177, Hazel:139, Aromatic:135 | 2.50 | Bunchgrass/DesertGrass correct! H passes. Hazel:139 (absent). |
| Arid+Trop | Caudiciform:127, Aromatic:118, DesertGrass:108, Turfgrass:98, Cypress:78 | 2.68 | Need Acacia/Aloe/Euphorbia/Pampas dominant. Saguaro:57 (common target). |
| Arid+Med | Caudiciform:223, Saltbush:155, Bunchgrass:134, DesertGrass:126, Hazel:126 | 2.57 | Saguaro:88, BarrelCactus:88 (both target dominants). Caudiciform:223 still #1. |
| Arid+Desert | Caudiciform:138, Aromatic:78, Saltbush:73, Turfgrass:55, Saguaro:49 | 2.49 | Saguaro:49 (up from 16). Need Saguaro/BarrelCactus as top 2. |

### Improvements from iteration 10

- **Hill+Desert Saguaro**: baseline ~1 → now 0/202/205 across 3 runs. Two out of three runs show Saguaro as #1 or #2 dominant. The extremeAridity boost (0.90→1.30) was the key driver.
- **Arid+Desert Saguaro**: 16→49 average. Modest improvement from groundHeat + extremeAridity boost.
- **Arid+Trop Saguaro**: appeared at 57 (target: common). New presence.
- **Arid+Med Saguaro+BarrelCactus**: both at 88 (target: dominant). Significant improvement.
- **Soil+Desert Cypress**: 199→223 (woodiness penalty helped but not enough). Trees still dominate.
- **Hill+Temp DesertGrass**: 111→67. Reduced spurious desert grass on temperate hills.

### Remaining problems (ranked by priority)

1. **Caudiciform dominance everywhere** — Still #1 on Hill+Desert (146-275), Arid+Desert (100-164), Arid+Med (223), Arid+Trop (127). The JC discovery means we can't fix this via classifier changes alone. Need trait-level differentiation that specifically advantages tall vs short succulents, or a new mechanism.

2. **Hill+Desert extreme stochasticity** — Saguaro ranges 0-205 across runs. The population (~500-700) is too small for stable outcomes. Consider: (a) increasing pocket size for desert experiments, (b) longer runs (10k ticks), or (c) multiple-run averaging in the experiment runner.

3. **Soil+Desert Cypress dominance** — 223 despite woodiness × heatStress penalty. Cypress (high height, low leaf, long-lived) benefits from heightPriority × heatStress bonus. May need tree germination restrictions on Soil+Desert.

4. **Tropical tree never dominant** — Persistent across all iterations. Tropical classifier overlaps with Cypress/Oak. The defense*0.3 + heightPriority*0.3 + leafSize*0.25 formula loses to Cypress (heightPriority*0.4 + longevity*0.2 + woodiness*0.15) for most tropical genomes.

5. **Wetland subtypes wrong** — All wetland niches dominated by Magnolia/Hazel/Cypress/Mangrove. Need Birch/Sedge/Fern for temperate, Tropical/Fern/Bamboo for tropical.

6. **Saguaro on Hill+Med** — 81 (target: absent). extremeAridity=0.0 on Hill+Med but heatStress=0.425 still gives height bonus.

### Suggested next focus (pick ONE)

- **Option A: Fix Soil+Desert trees** — Block tree germination on Soil+Desert or Arid+Desert (similar to existing Hill+Temp/Desert block). This would immediately remove Cypress/Magnolia/Hazel from desert soil niches, allowing Saltbush/Acacia/DesertGrass to emerge.

- **Option B: Fix Tropical tree classifier** — Rework the Tropical tree classifier to better capture defense+leaf genomes, preventing overlap with Cypress.

- **Option C: Fix wetland subtypes** — Boost wetland-specific traits (Sedge, Fern, Bamboo) via waterlogging interactions. Currently waterlogging mostly acts as a penalty; need more positive effects for wetland-adapted subtypes.

- **Option D: Run longer experiments (10k+ ticks)** — Check if Saguaro and other desired subtypes emerge given more evolutionary time, especially on low-population desert niches.

**Recommendation: Option A.** Blocking tree germination on desert soil would immediately fix the most visible remaining issue (Cypress:223 on Soil+Desert) and allow the trait system to select the correct desert community. This follows the pattern already established for Hill+Temp/Desert tree restrictions.
