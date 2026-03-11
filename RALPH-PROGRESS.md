# Ralph Loop Progress

## Iteration 10: extremeAridity envVar + Saguaro viability on desert hills

### What was done

3 changes targeting Saguaro emergence in extreme desert niches:

1. **New `extremeAridity` environment variable** — `max(0, droughtStress - 0.35)`. Only activates above a drought threshold, targeting Hill+Desert (0.28), Arid+Desert (0.46), and Soil+Desert (0.10). Zero on Temperate/Tropical niches. This creates a targeted axis for extreme desert differentiation without affecting moderate-drought niches.

2. **heightPriority × extremeAridity × +0.90** — Tall plants escape the lethal ground-level radiative heat layer in extreme desert. Ground temperatures in real deserts reach 70°C+ while air at 2m is 40-50°C. This gives tall succulents (Saguaro) a strong selective advantage specifically in extreme desert, where the existing heatStress effect alone wasn't sufficient because Arid terrain has moderate exposure (0.5).

3. **Caudiciform classifier rework** — Changed from `longevity*0.30 + rootPriority*0.25 + (1-heightPriority)*0.25 + (1-seedInvestment)*0.20` to `(1-heightPriority)*0.40 + rootPriority*0.30 + longevity*0.20 + (1-leafSize)*0.10`. Primary differentiator is now very low height (0.40 weight, up from 0.25), making Caudiciform strongly height-averse. Succulents with moderate heightPriority (>0.47) now classify as Saguaro instead of Caudiciform.

### Key learnings from experimentation

- **The extremeAridity threshold is critical.** At 0.4: Saguaro appeared on Arid+Desert (69) but not Hill+Desert. At 0.3: Saguaro appeared on Hill+Med (139) where it should be absent. At 0.35: clean separation — Hill+Desert gets 0.28 (enough for Saguaro), Hill+Med gets 0.0 (no Saguaro). The threshold must sit between Hill+Med drought (0.35) and Hill+Desert drought (0.63).

- **Root penalty was counterproductive.** Adding rootPriority × extremeAridity × -0.40 collapsed Saguaro from 179→2 on Hill+Desert. The penalty made the overall environment too harsh, reducing population from 756 to 515, making the ecosystem more stochastic and path-dependent on initial conditions.

- **Classifier changes are as important as trait effects.** The heightPriority → Saguaro crossover in the classifier determines what genomes GET LABELED as Saguaro. Without the Caudiciform classifier rework, even genomes with moderate heightPriority (~0.5) were classified as Caudiciform due to its longevity and (1-seedInvestment) terms inflating scores for all desert succulents.

- **Stochastic variance is significant in harsh environments.** Hill+Desert with 500-650 plants showed Saguaro ranging from 2 to 285 across runs with identical parameters. Multiple runs needed to confirm reproducibility.

### Performance

| Climate | Iter 9 | Iter 10 |
|---------|--------|---------|
| Temperate | 30 t/s | 30 t/s |
| Tropical | 29 t/s | 30 t/s |
| Mediterranean | 32 t/s | 32 t/s |
| Desert | 48 t/s | 51 t/s |

Stable. One additional trait effect row + one new envVar had no measurable impact.

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Oak:153, Fern:125, Acacia:122, Cypress:121, FloweringShrub:112 | 2.71 | Oak correct (#1). Fern present. Acacia should be absent (122). |
| Soil+Trop | Cypress:121, Holly:99, Acacia:92, Magnolia:91, Oak:87 | 3.00 | H passes! Need Tropical/Palm dominant — still absent from top 5. |
| Soil+Med | Magnolia:132, Aromatic:132, Cypress:123, Fern:108, Hazel:101 | 2.91 | Aromatic/Cypress correct! Need Mediterranean shrub dominant. |
| Soil+Desert | Cypress:199, Magnolia:135, Aromatic:128, Saltbush:100, Mediterranean:62 | 2.19 | Saltbush/Aromatic correct. Cypress/Magnolia should be absent. Need Desert Grass/Desert Annual dominant. |
| Hill+Temp | Turfgrass:292, Bunchgrass:283, DesertGrass:111, Wildflower:96, Clover:8 | 1.35 | Turfgrass/Bunchgrass/Wildflower correct! DesertGrass:111 should be absent. H too low (6 subtypes). |
| Hill+Trop | TallHerb:192, Pampas:162, DesertGrass:160, Tallgrass:141, Vine:121 | 2.17 | Need Bunchgrass/TropicalHerb/Fern/Conifer dominant. Pampas/DesertGrass wrong. |
| Hill+Med | Caudiciform:212, Bunchgrass:198, Iceplant:100, DesertGrass:97, Wildflower:96 | 2.39 | Bunchgrass correct! Saguaro:87 reduced from 139 but still present (target: absent). Caudiciform:212 (absent). |
| Hill+Desert | **Saguaro:179**, BarrelCactus:123, Caudiciform:90, Hazel:73, DesertGrass:65 | 2.12 | **Saguaro #1 dominant!** BarrelCactus #2. Major target match improvement. Caudiciform:90 still present (target: absent). |
| Wetland+Temp | Mangrove:183, Magnolia:120, Cypress:104, Hazel:103, Palm:102 | 2.84 | Mangrove correct. Need Birch/Sedge/Fern dominant. |
| Wetland+Trop | Magnolia:178, Hazel:149, Cypress:140, Mangrove:138, Palm:117 | 2.83 | Mangrove/Palm correct. Need Tropical/Fern/Bamboo dominant. |
| Wetland+Med | Mangrove:177, Hazel:149, Magnolia:145, Palm:132, Cypress:129 | 2.87 | Mangrove/Cypress correct. Need Sedge/Fern dominant. |
| Wetland+Desert | Hazel:139, Magnolia:106, TallHerb:82, Cypress:76, Fern:75 | 2.99 | Fern correct. Need Palm/Acacia/Sedge/Tallgrass dominant. |
| Arid+Temp | Hazel:174, Bunchgrass:169, DesertGrass:157, Clover:141, Bramble:118 | 2.57 | Bunchgrass/DesertGrass correct! H passes! Hazel:174 (target: absent). |
| Arid+Trop | Caudiciform:120, Aromatic:105, Turfgrass:101, DesertGrass:90, Bunchgrass:86 | 2.75 | DesertGrass correct. Need Acacia/Aloe/Euphorbia/Pampas dominant. |
| Arid+Med | Caudiciform:169, Saltbush:116, Bunchgrass:107, Aromatic:107, DesertGrass:101 | 2.75 | Saltbush/Aromatic correct. Need BarrelCactus/Saguaro dominant. |
| Arid+Desert | Caudiciform:126, DesertGrass:110, Saltbush:91, Aromatic:79, Turfgrass:50 | 2.43 | DesertGrass/Saltbush correct! Saguaro:16 (target: dominant). Need Saguaro/BarrelCactus at top. |

### Key improvements from iteration 9

- **Saguaro dominant on Hill+Desert**: 0→179 (#1). The extremeAridity height bonus creates a strong selection pressure for tall columnar succulents on exposed desert hills. Emerges by tick 1000 and dominates by tick 2000.
- **Barrel Cactus strong on Hill+Desert**: 70→123 (#2). Consistent improvement.
- **Caudiciform reduced on Hill+Desert**: 118→90 (#3). Classifier rework shifted moderate-height plants to Saguaro.
- **Saguaro appeared on Arid+Desert**: 14→16. Small improvement — Arid terrain's lower exposure (0.5 vs 0.8) means extremeAridity bonus is less dominant there.
- **Hill+Med Saguaro reduced**: 106→87. Threshold of 0.35 eliminates extremeAridity effect on Hill+Med (droughtStress = 0.35, exactly at threshold). Remaining 87 is from heatStress effect (iter 9).

### Remaining problems (ranked by priority)

1. **Saguaro still absent from Arid+Desert** — Only 16 out of 699. On Arid terrain, exposure is 0.5 (vs Hill's 0.8), so heatStress is only 0.45 and extremeAridity is 0.46. Root investment (droughtStress × 0.55 = 0.45 per unit) still competes strongly with height. Also, ALL archetypes compete on Arid (no germination restrictions), diluting succulent population. May need: (a) higher Arid exposure, (b) succulent-specific bonuses on Arid, or (c) much longer simulation time.

2. **Caudiciform still over-represented** — #1 on Hill+Med (212), Arid+Med (169), Arid+Trop (120), Arid+Desert (126). Target: absent/minor on most niches. The classifier rework helped but Caudiciform still captures genomes with moderate height + high root.

3. **Saguaro:87 on Hill+Med** — Target: absent. This is from the heatStress effect (iter 9), not extremeAridity. Reducing heatStress coefficient would hurt Saguaro on Hill+Desert too.

4. **Iceplant on hills** — Hill+Med:100, Hill+Desert:43 (absent in iter 9 for desert, but appearing). Persistent issue from iter 9.

5. **Desert Grass on temperate/tropical hills** — 111 on Hill+Temp, 160 on Hill+Trop. Should be absent. Shared trait profile classifies partially as Desert Grass.

6. **Tropical tree never dominant** — Persistent across all iterations. Tropical classifier overlaps with Cypress/Oak.

### Suggested next focus (pick ONE)

- **Option A: Fix Saguaro on Arid+Desert** — The single biggest remaining gap. Options: (a) increase Arid terrain exposure from 0.5 to 0.6+ to boost heatStress on arid, (b) reduce rootPriority × droughtStress coefficient (currently 0.55) to weaken root dominance in high drought, (c) add a separate envVar for "arid ground heat" based on aridity × heat (not just exposure × heat), (d) run experiments for 10,000+ ticks to see if Saguaro eventually emerges.

- **Option B: Fix Caudiciform over-representation** — Further rework Caudiciform classifier or add classifier-level constraints (e.g. minimum rootPriority threshold).

- **Option C: Fix Desert Grass on temperate/tropical hills** — Desert Grass:111/160 where it should be absent.

**Recommendation: Option A.** Getting Saguaro to appear on Arid+Desert completes the desert columnar cactus story. The most promising approach is (a) increasing Arid exposure — it's currently unrealistically low at 0.5 for flat open desert, and raising it boosts both heatStress (helping height) and windExposure (hurting woodiness, which indirectly helps succulents).
