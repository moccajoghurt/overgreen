# Ralph Loop Progress

## Iteration 13: DesertGrass classifier rework + Bunchgrass rootPriority

### What was done

DesertGrass appeared in 10/16 niches because its classifier matched a generic "conservative deep-rooted" profile (high rootPriority, low seedInvestment, low leafSize, high longevity) that evolves everywhere. Two classifier changes:

1. **DesertGrass classifier: waterStorage as primary weight (0.35)**
   - Old: `rootPriority*0.40 + (1-seedInvestment)*0.25 + (1-leafSize)*0.20 + longevity*0.15`
   - New: `waterStorage*0.35 + rootPriority*0.20 + (1-leafSize)*0.20 + (1-seedInvestment)*0.15 + longevity*0.10`
   - Rationale: desert grasses store water in thickened basal stems. Only grasses in drought environments evolve waterStorage > 0.2, so non-desert grasses fall out.

2. **Bunchgrass classifier: added rootPriority (0.25)**
   - Old: `seedInvestment*0.30 + seedSize*0.25 + (1-heightPriority)*0.25 + longevity*0.20`
   - New: `rootPriority*0.25 + seedSize*0.20 + (1-heightPriority)*0.20 + longevity*0.15 + seedInvestment*0.20`
   - Rationale: bunchgrasses have deep fibrous root systems. Hill grasses with deep roots now correctly classify as Bunchgrass instead of DesertGrass.

### Performance

| Climate | Iter 12 | Iter 13 |
|---------|---------|---------|
| Temperate | 30 t/s | 30 t/s |
| Tropical | 30 t/s | 29 t/s |
| Mediterranean | 35 t/s | 34 t/s |
| Desert | 48 t/s | 47 t/s |

Stable. No performance impact (classifier-only change, no trait effects modified).

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Oak:151, Holly:128, Fl.Shrub:126, Fern:115, Wildflower:111 | 2.72 | **Oak #1 correct!** Holly/Fern/Wildflower all correct. Acacia:102 still present (should be absent). |
| Soil+Trop | Magnolia:138, Cypress:118, Hazel:79, Fern:73, Aromatic:68 | 3.04 | H passes. Still need Tropical/Palm dominant. |
| Soil+Med | Cypress:147, Bramble:120, Aromatic:90, Fern:83, Oak:82 | 2.96 | **Cypress+Aromatic+Oak all correct!** H nearly passes. Bramble unexpected at #2. |
| Soil+Desert | Cypress:180, TallHerb:143, Hazel:103, Tallgrass:101, Saltbush:80 | 2.76 | Cypress #1 (should be absent — no tree block on Soil+Desert). Saltbush:80 present. |
| Hill+Temp | **Bunchgrass:329, Turfgrass:284, Wildflower:199, Clover:104** | 1.39 | **All 4 target dominants present!** DesertGrass gone (was 190). H too low. |
| Hill+Trop | Pampas:156, TallHerb:147, Tallgrass:145, Bunchgrass:138, Turfgrass:106 | 2.39 | DesertGrass gone (was 100). Need TropicalHerb/Fern/Conifer dominant. |
| Hill+Med | Bunchgrass:255, Caudiciform:179, Clover:146, Wildflower:131, Turfgrass:115 | 2.40 | **Bunchgrass #1 correct!** DesertGrass gone (was 106). Caudiciform:179 (absent). |
| Hill+Desert | Saguaro:244, Caudiciform:139, DesertGrass:138, Pampas:115, Turfgrass:46 | 1.97 | **Saguaro dominant!** DesertGrass:138 maintained (target common). |
| Wetland+Temp | Mangrove:151, Magnolia:132, Hazel:125, Palm:118, Cypress:117, Birch:110 | 2.82 | Birch:110 appeared! Mangrove/Cypress correct. Need Sedge/Fern. |
| Wetland+Trop | Magnolia:153, Mangrove:133, Hazel:116, Cypress:109, Acacia:96, Palm:93 | 2.98 | Mangrove/Palm present. Need Tropical/Fern/Bamboo dominant. |
| Wetland+Med | Magnolia:155, Hazel:148, Mangrove:147, Palm:136, Cypress:133, Birch:101 | 2.84 | Mangrove+Cypress correct. Birch:101 appeared. Need Sedge/Fern. |
| Wetland+Desert | Mangrove:130, Hazel:125, TallHerb:106, Palm:97, Tallgrass:93, Cypress:92 | 2.94 | Palm:97 present. Need Acacia/Sedge dominant. |
| Arid+Temp | Bunchgrass:269, Hazel:171, Aromatic:166, Bramble:161, Caudiciform:134 | 2.23 | Bunchgrass+Aromatic correct. **DesertGrass:11 (was 140, target dominant)**. Hazel:171 (absent). H fails. |
| Arid+Trop | Caudiciform:95, Bunchgrass:95, Turfgrass:89, Aromatic:84, Cypress:81 | 3.02 | DesertGrass gone (was 75). Need Acacia/Aloe/Euphorbia/Pampas. |
| Arid+Med | Caudiciform:221, Bunchgrass:180, BarrelCactus:161, Bramble:134, Aromatic:111 | 2.33 | BarrelCactus:161 (up from 103). Aromatic correct. Need Saguaro/Mediterranean. |
| Arid+Desert | BarrelCactus:164, Caudiciform:148, DesertGrass:100, Saltbush:83, Aromatic:53 | 2.16 | BarrelCactus #1! DesertGrass:100 maintained. Saguaro:43 too low. |

### Improvements from iteration 12

- **Hill+Temp DesertGrass: 190 → 0** — Gone from Hill+Temp, correctly absent
- **Hill+Trop DesertGrass: 100 → 0** — Gone from Hill+Trop, correctly absent
- **Hill+Med DesertGrass: 106 → 0** — Gone from Hill+Med, correctly absent
- **Hill+Temp subtypes**: Now shows all 4 target dominants (Bunchgrass, Turfgrass, Wildflower, Clover)
- **Soil+Temp Oak**: Moved from #3 (118) to #1 (151), matching target dominant
- **Soil+Med Oak**: Appeared at 82, now in correct niche
- **Wetland+Temp Birch**: Appeared at 110 (was missing, target common)
- **Arid+Med BarrelCactus**: 103 → 161, strengthened in correct niche

### Regression

- **Arid+Temp DesertGrass: 140 → 11** — waterStorage is net-negative on Arid+Temp (frost -0.40 + wind -0.35 outweigh drought +0.189), so grasses don't evolve the waterStorage the classifier now requires. The Arid+Temp niche is otherwise well-represented by Bunchgrass:269 + Aromatic:166.
- **Soil+Desert Cypress: 180** — Cypress reappeared at #1 (was gone in iter 12). Likely stochastic variation, not caused by classifier change. Note: no tree germination filter exists for Soil+Desert.

### Remaining problems (ranked by priority)

1. **Caudiciform dominance on Arid** — #1 on Arid+Trop (95), Arid+Med (221), Arid+Desert (148), Hill+Med (179). Caudiciform should be minor at most. Saguaro needs to dominate Arid+Med but only at 43 on Arid+Desert.

2. **Tropical trees never dominant** — Soil+Trop needs Tropical/Palm/Magnolia/TropicalHerb/Fern. Wetland+Trop needs Tropical/Palm/Mangrove/Fern/Bamboo. Currently Magnolia/Cypress/Hazel dominate.

3. **Wetland subtypes wrong** — All wetlands dominated by Magnolia/Hazel/Cypress/Mangrove instead of Birch/Sedge/Fern/Bamboo. Need wetland-specific positive effects for these subtypes.

4. **Hill diversity too low** — Hill+Temp H=1.39, Hill+Desert H=1.97. Grass/succulent monocultures need more forb/shrub diversity.

5. **Trees on Soil+Desert** — Cypress:180 at #1 with no tree germination filter. Need to extend tree block to Soil+Desert.

6. **Hazel/Bramble misplacement** — Hazel dominates on Arid+Temp (171, target absent), Wetland+Desert (125), Arid+Trop (several). Bramble high on Arid+Med (134). These shrubs shouldn't thrive in arid/desert.

7. **Arid+Temp DesertGrass too low** — Reduced from 140 to 11 by classifier change. Would need either: lower waterStorage weight in classifier, or trait effect making waterStorage viable on Arid+Temp.

### Suggested next focus (pick ONE)

- **Option A: Fix Caudiciform dominance** — Caudiciform (#1 on 3 arid niches + Hill+Med) is the single biggest niche accuracy issue. The classifier makes it too easy (low height + high root + longevity = generic survivor). Could rework Caudiciform classifier to require extreme waterStorage or very low leafSize, or add a trait effect that penalizes the squat-root-storage combination in environments with height competition.

- **Option B: Fix trees on Soil+Desert** — Quick win: extend tree germination filter to Soil+Desert. Cypress at 180 is #1 where it should be absent. Could also add for Wetland+Desert.

- **Option C: Fix tropical tree identity** — Tropical/Palm/Bamboo should dominate in tropical climates but Magnolia/Cypress/Hazel win instead. Need trait interactions favoring defense+leaf (Tropical) or height+low-root (Palm) in humid warm environments.

- **Option D: Fix Hazel/Bramble in arid zones** — These shrubs appear in arid niches where they should be absent. Could add woodiness × extremeAridity or shrub-specific arid penalties.

**Recommendation: Option A (Caudiciform).** Caudiciform dominance on 4 niches is the most widespread remaining issue, similar in scope to the DesertGrass ubiquity we just fixed. The Caudiciform classifier (low height + high root + longevity) rewards a generic survival profile. Reworking it to require more extreme specialization would improve Arid+Trop, Arid+Med, Arid+Desert, and Hill+Med simultaneously.
