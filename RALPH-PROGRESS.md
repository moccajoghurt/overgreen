# Ralph Loop Progress

## Iteration 9: Heat Stress Trait Effects + Caudiciform Classifier Rework

### What was done

3 new trait effects + 1 classifier rework targeting succulent niche balance in hot environments:

1. **heightPriority × heatStress × +0.50** — Tall columnar form radiates heat efficiently. Saguaros' real competitive advantage: high surface-area-to-volume column shape dissipates heat in hot exposed environments. This directly counteracts the wind penalty on height in desert hills.

2. **rootPriority × heatStress × -0.25** — Root zone overheating in hot exposed soil. In hot exposed terrain, soil surface temperatures exceed 70°C; deep root investment is less efficient when the root zone itself overheats. Reduces Caudiciform's rootPriority advantage in desert.

3. **defense × heatStress × +0.25** — Spines and waxy coating provide sun/heat protection. Barrel Cactus's defining trait (defense) now has a benefit in arid environments where disease pressure is near-zero. Makes defense viable to evolve in hot, exposed terrain.

4. **Caudiciform classifier rework** — Changed from `rootPriority*0.50 + (1-heightPriority)*0.20 + waterStorage*0.15 + seedInvestment*0.15` to `longevity*0.30 + rootPriority*0.25 + (1-heightPriority)*0.25 + (1-seedInvestment)*0.20`. Requires high longevity as primary differentiator (caudiciforms are centuries-old plants), reducing rootPriority weight from 0.50 to 0.25. Makes Caudiciform harder to trigger by default.

### Key learnings from experimentation

- **heatStress is the key axis for succulent differentiation.** Without it, all succulents converge on rootPriority-dominated genomes in drought (→ Caudiciform). With heat effects, three distinct strategies emerge: tall heat-radiator (Saguaro), armored sun-protector (Barrel Cactus), deep-root storage (Caudiciform).
- **First round at +0.35 height / -0.20 root was too weak** — Saguaro still absent because the height heat bonus merely canceled the wind penalty without creating a net positive. Increasing to +0.50 / -0.25 made height competitive with root investment on desert hills.
- **Defense × heatStress was crucial for Barrel Cactus** — Defense had zero benefit in arid (diseasePressure ~0.02). The heat protection bonus gives defense a purpose in hot environments, making Barrel Cactus's classifier achievable by evolution.

### Performance

| Climate | Iter 8 | Iter 9 |
|---------|--------|--------|
| Temperate | 30 t/s | 30 t/s |
| Tropical | 30 t/s | 29 t/s |
| Mediterranean | 32 t/s | 32 t/s |
| Desert | 50 t/s | 48 t/s |

Stable. No performance impact from 3 additional trait effect rows.

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Oak:165, FloweringShrub:141, Fern:126, Cypress:120, Holly:109 | 2.62 | Oak correct (#1). Fern/Holly present. FloweringShrub should be absent. Acacia:103 still present (target: absent). |
| Soil+Trop | Magnolia:122, Hazel:109, Cypress:96, FloweringShrub:88, Fern:84 | 2.98 | Magnolia correct. Fern correct. Need Tropical/Palm dominant. Palm only 48. |
| Soil+Med | Magnolia:145, Fern:119, Aromatic:118, Cypress:105, Oak:99 | 2.80 | Aromatic/Cypress/Oak correct! Need Mediterranean shrub dominant. Med shrub only 17. |
| Soil+Desert | Cypress:182, Magnolia:150, Aromatic:120, Saltbush:109, Hazel:83 | 2.18 | Saltbush/Aromatic correct. Magnolia/Cypress should be absent. Need Desert Grass/Desert Annual dominant. |
| Hill+Temp | Bunchgrass:299, Turfgrass:270, Wildflower:112, DesertGrass:108, Clover:45 | 1.55 | Bunchgrass/Turfgrass/Wildflower all correct dominants! Desert Grass should be absent (108). H too low (7 subtypes). |
| Hill+Trop | TallHerb:199, Pampas:176, Bunchgrass:156, DesertGrass:120, Wildflower:113 | 2.22 | Bunchgrass present. Need Tropical Herb/Fern/Conifer dominant. Pampas:176 should be absent. |
| Hill+Med | Bunchgrass:207, Wildflower:202, Caudiciform:123, DesertGrass:114, Jade:108 | 2.50 | Bunchgrass correct! **Saguaro:106 appeared** (but target: absent on Hill+Med). Need Mediterranean/Aromatic dominant. |
| Hill+Desert | Aromatic:155, Caudiciform:118, Iceplant:89, **BarrelCactus:70**, Turfgrass:56 | 1.80 | **Barrel Cactus now #4** (was barely present). Caudiciform still #2 (target: absent). Need Saguaro/Desert Grass dominant. |
| Wetland+Temp | Mangrove:152, Magnolia:121, Hazel:113, Palm:105, Acacia:104 | 2.90 | Mangrove correct. Need Birch/Cypress/Sedge/Fern dominant. |
| Wetland+Trop | Magnolia:160, Mangrove:152, Cypress:119, Hazel:116, Acacia:106 | 2.91 | Mangrove correct. Need Tropical/Fern/Bamboo dominant. |
| Wetland+Med | Hazel:182, Mangrove:150, Magnolia:144, Cypress:119, Birch:119 | 2.90 | Mangrove/Cypress correct. Need Sedge/Fern dominant. Birch:119 present (target: Common). |
| Wetland+Desert | Magnolia:121, Hazel:114, Fern:98, Palm:81, Cypress:72 | 3.02 | Fern/Palm correct! Need Acacia/Sedge/Tallgrass dominant. |
| Arid+Temp | Bunchgrass:179, Aromatic:151, Clover:143, Hazel:138, DesertGrass:136 | 2.60 | Aromatic/Desert Grass/Bunchgrass all correct! Clover:143 present (target: Minor). H passes! |
| Arid+Trop | Bunchgrass:132, Aromatic:104, Caudiciform:94, DesertGrass:90, **BarrelCactus:78** | 2.73 | **Barrel Cactus appeared!** **Saguaro:51!** Need Acacia/Aloe/Euphorbia/Pampas dominant. |
| Arid+Med | Caudiciform:144, Aromatic:136, Bunchgrass:122, DesertGrass:112, Cypress:109 | 2.74 | Aromatic correct. **Barrel Cactus:86, Saguaro:59 both appeared!** Need Barrel/Saguaro/Mediterranean dominant. |
| Arid+Desert | Turfgrass:116, **BarrelCactus:103**, Caudiciform:102, Aromatic:74, Saltbush:68 | 2.45 | **Barrel Cactus now #2!** (was absent). Saltbush correct. Turfgrass:116 should be absent. Need Saguaro dominant (only 14). |

### Key improvements from iteration 8

- **Saguaro appeared for the first time**: 106 on Hill+Med, 59 on Arid+Med, 51 on Arid+Trop, 14 on Arid+Desert. Height heat radiation bonus makes tall succulents viable in hot environments.
- **Barrel Cactus surged**: Hill+Desert 33→70, Arid+Desert new→103 (#2!), Arid+Med new→86, Arid+Trop new→78. Defense heat protection bonus creates a viable evolutionary path.
- **Caudiciform reduced**: Hill+Desert 161→118, Arid+Desert 130→102. Classifier change + root heat penalty both contribute.
- **Palm appeared on Wetland+Desert**: 81 (target: Dominant). Height heat bonus helps palms in hot wetlands.
- **Clover and Barrel Cactus appeared on Arid+Temp**: Clover:143, BarrelCactus:43. Better diversity.

### Remaining problems (ranked by priority)

1. **Saguaro still absent from Hill+Desert and Arid+Desert** — Only 14 on Arid+Desert. The height heat bonus at +0.50 makes height competitive but not dominant over rootPriority. On Hill+Desert, heightPriority × (heatStress×0.50 + wind×-0.35) ≈ +0.09 vs rootPriority × (drought×0.55 + heat×-0.25) ≈ +0.15. Root still wins. May need higher height heat coefficient (+0.60?) or Saguaro classifier adjustment.

2. **Caudiciform still top 2 on Hill+Desert (118), Arid+Med (144), Arid+Desert (102)** — Reduced but not enough. Target: Absent on hills, Minor on most arid. The longevity requirement in classifier helped but plants do evolve moderate longevity in arid (drought persistence bonus +0.05).

3. **Iceplant too common on hills** — Hill+Desert:89, Hill+Med:87. Target: Absent. The trait profile that hill selects for (low height + high seedInvestment + low roots) maps exactly to Iceplant's classifier. Hard to fix without a germination restriction or making Iceplant's classifier more specific.

4. **Turfgrass 116 on Arid+Desert** — Target: Absent. Short grasses shouldn't dominate extreme desert. Likely needs a germination restriction or trait effect that penalizes grasses in extreme aridity.

5. **Tropical tree still never dominant** — Persistent. Tropical classifier (defense + height + leafSize) overlaps with Cypress/Oak.

6. **Desert Grass ~108-120 on temperate/tropical hills** — Target: Absent. Shared root-heavy trait profile classifies partially as Desert Grass.

### Suggested next focus (pick ONE)

- **Option A: Boost Saguaro further on Hill+Desert and Arid+Desert** — Increase height heat coefficient from +0.50 to +0.60, or add a new trait axis. Or rework Saguaro classifier to capture more drought-evolved succulents (e.g. add rootPriority weight to Saguaro since real saguaros have extensive root systems). Risk: may over-buff height in temperate niches.

- **Option B: Fix Iceplant on hills** — Iceplant (low height, high seed, low root) should not appear on hills. Options: (a) add seedInvestment × windExposure negative effect (wind strips reproductive structures), or (b) adjust Iceplant classifier to require a trait that hills don't select for (e.g. high leafSize for ground cover appearance).

- **Option C: Fix Turfgrass on Arid+Desert** — 116 Turfgrass in extreme desert is unrealistic. Add grass germination restriction for extreme aridity, or add a leafSize/woodiness penalty that short grasses feel in extreme drought.

- **Option D: Fix Desert Grass on temperate/tropical hills** — Still 108-120 where it should be absent. The seedInvestment-based Bunchgrass vs (1-seedInvestment)-based Desert Grass split works on arid terrain but hill plants evolve moderate seedInvestment, causing misclassification.

**Recommendation: Option A.** Saguaro is the single most iconic desert plant and a target dominant on both Hill+Desert and Arid+Desert. Getting it to appear prominently would dramatically improve those 2 niches while also testing whether the heat mechanism can be further refined. Could combine with a Saguaro classifier tweak (add rootPriority weight).
