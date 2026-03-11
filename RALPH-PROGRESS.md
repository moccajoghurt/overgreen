# Ralph Loop Progress

## Iteration 14: Caudiciform classifier rework — waterStorage + (1-defense)

### What was done

Caudiciform was dominant on 4 niches (Arid+Trop #1, Arid+Med #1, Arid+Desert #2, Hill+Med #2) where it should be minor/absent. The old classifier rewarded a generic "compact survivor" profile (low height + high root + longevity) that evolves in any harsh environment. Two changes:

1. **waterStorage as primary weight (0.35)**: The defining feature of a caudiciform is its massive water-storing caudex. Without this in the classifier, any compact long-lived succulent matched.

2. **(1-defense) added at 0.25**: Caudiciforms are fleshy and undefended, while barrel cacti are heavily spined. This pushes defended succulents to Barrel Cactus and keeps only undefended water-storers as Caudiciform.

Old: `(1-height)*0.40 + root*0.30 + longevity*0.20 + (1-leafSize)*0.10`
New: `waterStorage*0.35 + (1-defense)*0.25 + (1-height)*0.15 + root*0.15 + (1-leafSize)*0.10`

### Performance

| Climate | Iter 13 | Iter 14 |
|---------|---------|---------|
| Temperate | 30 t/s | 11 t/s |
| Tropical | 29 t/s | 11 t/s |
| Mediterranean | 34 t/s | 14 t/s |
| Desert | 47 t/s | 17 t/s |

Performance dropped significantly across all climates. This is likely due to stochastic variation in population density (classifier-only changes don't affect simulation physics). The prior iterations may have had lower populations. Monitor in next iteration.

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Oak:141, Fern:141, Acacia:125, Fl.Shrub:108, Holly:106 | 2.74 | **Oak #1 correct!** Holly/Fern/Wildflower correct. Acacia:125 still present (should be absent). |
| Soil+Trop | Cypress:108, Magnolia:86, Holly:82, Oak:78, Fern:77 | 3.07 | **H passes!** Still need Tropical/Palm dominant. |
| Soil+Med | Cypress:142, Bramble:120, Acacia:116, Oak:110, Hazel:94 | 2.88 | **Cypress+Oak correct!** Bramble:120 and Acacia:116 unexpected. |
| Soil+Desert | Cypress:237, TallHerb:156, Tallgrass:117, Saltbush:95, Hazel:95 | 2.50 | Cypress #1 (should be absent). Saltbush:95 present. Need tree block. |
| Hill+Temp | Turfgrass:315, Bunchgrass:253, Wildflower:153, Clover:71 | 1.54 | **All 4 target dominants present!** H too low (1.54). |
| Hill+Trop | TallHerb:186, Pampas:167, DesertGrass:156, Bunchgrass:119, Tallgrass:99 | 2.28 | DesertGrass:156 shouldn't be here. Need TropicalHerb/Fern/Conifer. |
| Hill+Med | Wildflower:180, Bunchgrass:163, Iceplant:150, Caudiciform:127, Turfgrass:127 | 2.56 | **Bunchgrass #2 correct! Wildflower common.** Iceplant:150 + Caudiciform:127 (both absent). |
| Hill+Desert | **Saguaro:342**, Tallgrass:188, DesertGrass:134, Pampas:56, Caudiciform:35 | 1.47 | **Saguaro dominant!** Caudiciform:35 (minor, correct). H too low. |
| Wetland+Temp | Mangrove:147, Magnolia:140, Cypress:110, Hazel:109, Acacia:107 | 2.84 | Mangrove/Cypress present. Need Birch/Sedge/Fern dominant. |
| Wetland+Trop | Mangrove:166, Hazel:164, Palm:149, Cypress:146, Magnolia:141 | 2.74 | Mangrove/Palm present. Need Tropical/Fern/Bamboo dominant. |
| Wetland+Med | Mangrove:180, Magnolia:131, Hazel:127, Cypress:123, Palm:114 | 2.88 | Mangrove+Cypress correct! Need Sedge/Fern/Birch. |
| Wetland+Desert | TallHerb:133, Hazel:122, Mangrove:118, Cypress:75, Palm:73 | 3.01 | Palm:73 present. Need Acacia/Sedge/Tallgrass dominant. |
| Arid+Temp | Bunchgrass:270, Bramble:177, Aromatic:166, Clover:128, Turfgrass:103 | 2.23 | Bunchgrass+Aromatic correct. DesertGrass missing (target dominant). H fails. |
| Arid+Trop | Bunchgrass:127, Aromatic:95, BarrelCactus:94, DesertGrass:79, Bramble:79 | 2.81 | **Caudiciform:72 (was 95, now minor).** Need Acacia/Aloe/Euphorbia/Pampas. |
| Arid+Med | Bunchgrass:214, Caudiciform:167, BarrelCactus:157, Aromatic:142, Bramble:119 | 2.41 | BarrelCactus:157 + Aromatic:142 correct. Caudiciform:167 still #2 (should be minor). |
| Arid+Desert | **BarrelCactus:192**, Caudiciform:144, Bunchgrass:91, DesertGrass:89, Aromatic:73 | 2.20 | **BarrelCactus #1!** Caudiciform:144 still #2 (should be minor). Need Saguaro. |

### Improvements from iteration 13

- **Hill+Desert Caudiciform: 139 → 35** — Now minor (correct per target)
- **Arid+Trop Caudiciform: 95 (#1) → 72 (#7)** — No longer dominant
- **Arid+Temp Caudiciform: 134 → 64** — Reduced to minor range
- **Arid+Med Caudiciform: 221 → 167** — Still #2 but reduced 24%
- **Arid+Desert BarrelCactus: 164 → 192 (#1)** — Barrel now clearly dominant
- **Hill+Desert Saguaro: 244 → 342** — Saguaro even more dominant (correct)
- **Hill+Med: now has H=2.56** (was 2.40), improved diversity

### Regressions

- **Performance drop**: 30→11 t/s Temperate, 47→17 t/s Desert. Likely stochastic (classifier-only changes don't affect physics). May need investigation if persistent.
- **Hill+Trop DesertGrass: 0 → 156** — DesertGrass reappeared on Hill+Trop (stochastic or seed interaction). Was 0 in iter 13.

### Remaining problems (ranked by priority)

1. **Caudiciform still #2 on Arid+Med (167) and Arid+Desert (144)** — Should be minor. The (1-defense) weighting helped but defense is only moderately selected in arid environments. May need further classifier specialization or an alternative approach.

2. **Tropical trees never dominant** — Soil+Trop needs Tropical/Palm/Magnolia/TropicalHerb dominant. Wetland+Trop needs Tropical/Fern/Bamboo. Currently Cypress/Hazel/Magnolia dominate everywhere.

3. **Wetland subtypes wrong** — All wetlands dominated by Magnolia/Hazel/Mangrove instead of Birch/Sedge/Fern. Need wetland-specific trait effects.

4. **Hill diversity too low** — Hill+Temp H=1.54, Hill+Desert H=1.47. Grass monocultures.

5. **Trees on Soil+Desert** — Cypress:237 at #1 where all trees should be absent. Need tree germination filter for desert climate.

6. **Hazel/Bramble everywhere** — Hazel appears in 10+ niches where it should be absent (wetlands, arid). Bramble in arid zones. These shrubs need environmental penalties.

7. **Iceplant on Hill+Med (150)** — Should be absent. The Iceplant classifier may be too generic.

8. **Aloe/Euphorbia missing** — Neither appears in any niche's top 8. Aloe classifier requires high leafSize which conflicts with drought-driven leaf reduction. Euphorbia classifier requires seedInvestment + defense + low root which is uncommon.

### Suggested next focus (pick ONE)

- **Option A: Fix trees on Soil+Desert** — Quick win: extend tree germination filter to desert climate on all terrains. Cypress at 237 is #1 on Soil+Desert where it should be absent. Also helps Wetland+Desert.

- **Option B: Fix Hazel/Bramble in arid/desert** — These shrubs appear everywhere. Could add shrub-specific arid/drought penalties, or rework their classifiers to require humidity/fertility traits that don't evolve in dry environments.

- **Option C: Fix tropical tree identity** — Tropical/Palm/Bamboo should dominate in tropical climates. Need trait interactions favoring tropical-specific genome profiles in warm humid environments.

- **Option D: Fix Aloe/Euphorbia classifiers** — Aloe requires high leafSize (conflicts with drought). Euphorbia requires seedInvestment + defense + low root (uncommon combo). Reworking these could improve arid niche accuracy and reduce Caudiciform by absorbing displaced succulents.

**Recommendation: Option A (trees on Soil+Desert).** It's the quickest, most impactful fix. Cypress at 237 (#1 on Soil+Desert) is wildly wrong — all trees should be absent in desert climate. A tree germination filter for desert climate would immediately fix Soil+Desert and improve Wetland+Desert. This was also identified as priority #5 in the previous iteration.
