# Ralph Loop Progress

## Iteration 7: Shrub Germination Filter + Root/Wind Trait Effects

### What was done

3 changes to remove Aromatic dominance from temperate/tropical hills and reduce Caudiciform on windy terrain:

1. **Shrub germination block on Hill terrain for Temperate/Tropical climates** — Added `shrubGermination` terrain property (false for Hill). In germination, shrub seeds cannot establish on Hill terrain when climate is Temperate or Tropical. Allowed on Hill+Med and Hill+Desert where shrubs are target dominants. Models the reality that woody shrub seedlings are killed by persistent cold/humid wind before establishment.

2. **rootPriority × windExposure × -0.20** — New trait effect. Deep taproots in thin exposed hillside soil get wind-levered. Specifically targets Caudiciform (rootPriority=0.5 in classifier) while sparing shallow-rooted succulents like Saguaro and Barrel Cactus.

3. **waterStorage × windExposure penalty: -0.25 → -0.35** — Heavy succulent tissue suffers more mechanical stress in wind.

### Key learnings from experimentation

- The shrub germination filter was the key breakthrough. 3 iterations of coefficient tuning couldn't differentiate compact shrubs from grasses because they share similar trait profiles (low height, small leaves). A germination-level restriction directly enforces the ecological reality.
- The pattern follows the existing succulent germination restriction — terrain property + climate check.
- Removing shrubs from temperate/tropical hills opened space for target plants (grasses, forbs) to expand naturally.
- Performance nearly doubled — fewer plants competing on hills means less computation per tick.

### Performance

| Climate | Iter 6 | Iter 7 |
|---------|--------|--------|
| Temperate | 15 t/s | 28 t/s |
| Tropical | 15 t/s | 29 t/s |
| Mediterranean | 16 t/s | 32 t/s |
| Desert | 24 t/s | 51 t/s |

Major improvement across all climates. Likely due to reduced competition density on hills + one fewer iteration over qualifying seeds.

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Oak:162, Fern:133, Cypress:131, Acacia:119, Magnolia:110 | 2.68 | **Oak #1** (target dominant). Fern present. Need Birch/Hazel higher, Acacia absent. |
| Soil+Trop | Magnolia:120, Cypress:103, Acacia:93, Hazel:88, Birch:80 | 2.96 | Mixed: Magnolia correct. Need Tropical/Palm/Fern dominant. Hazel should be absent. |
| Soil+Med | Magnolia:116, Aromatic:108, Hazel:102, Acacia:101, Cypress:100 | 2.91 | Aromatic correct. Cypress correct. Need Mediterranean shrub dominant, Oak higher. |
| Soil+Desert | Saltbush:159, Magnolia:147, Aromatic:126, Cypress:113, Turfgrass:111 | 2.13 | Saltbush #1 (target dominant!). Need Desert Grass/Acacia/Desert Annual higher. |
| Hill+Temp | Turfgrass:257, Clover:191, Wildflower:172, Desert Grass:170, Magnolia:127 | 1.95 | **MAJOR WIN**: Turfgrass/Clover/Wildflower now top 3 (target dominants). Aromatic GONE. Desert Grass (170) should be Absent. |
| Hill+Trop | Turfgrass:259, Desert Grass:191, Wildflower:186, Fern:142, Clover:140 | 1.94 | **MAJOR WIN**: Aromatic GONE. Fern 142 (target dominant!). Need Bunchgrass/Tropical Herb/Conifer. Desert Grass should be Absent. |
| Hill+Med | Turfgrass:183, Wildflower:129, Caudiciform:124, Iceplant:115, Desert Grass:114 | 2.53 | Caudiciform dropped 218→124. Aromatic at 74 (target dominant, needs more). Need Mediterranean shrub. |
| Hill+Desert | Caudiciform:160, Saltbush:93, Iceplant:81, Aromatic:51, Barrel Cactus:51 | 2.00 | Barrel Cactus present. Need Saguaro/Desert Grass dominant, Caudiciform absent. |
| Wetland+Temp | Magnolia:143, Acacia:142, Mangrove:142, Cypress:133, Hazel:131 | 2.78 | Mangrove/Cypress correct. Need Birch/Sedge/Fern dominant. Acacia should be absent. |
| Wetland+Trop | Mangrove:158, Magnolia:145, Hazel:139, Palm:129, Cypress:127 | 2.85 | Mangrove/Palm correct. Need Tropical/Fern/Bamboo dominant. |
| Wetland+Med | Magnolia:169, Hazel:159, Mangrove:143, Palm:140, Cypress:113 | 2.86 | Mangrove/Cypress correct. Need Sedge/Fern dominant. Magnolia/Hazel too high. |
| Wetland+Desert | Magnolia:129, Hazel:126, Flowering Shrub:102, Fern:100, Desert Grass:79 | 2.89 | Fern present. Need Palm/Acacia/Sedge/Tallgrass dominant. |
| Arid+Temp | Desert Grass:211, Aromatic:164, Caudiciform:149, Hazel:138, Clover:138 | 2.42 | Desert Grass #1 (target: correct!). Aromatic correct. Need Saltbush/Bunchgrass higher. |
| Arid+Trop | Aromatic:113, Caudiciform:110, Turfgrass:103, Magnolia:79, Desert Grass:79 | 2.88 | Mixed. Need Acacia/Aloe/Euphorbia/Pampas dominant. |
| Arid+Med | Caudiciform:175, Turfgrass:158, Aromatic:132, Saltbush:116, Magnolia:91 | 2.65 | Need Barrel Cactus/Saguaro/Mediterranean/Aromatic dominant. |
| Arid+Desert | Caudiciform:124, Turfgrass:110, Saltbush:99, Barrel Cactus:79, Aromatic:57 | 2.37 | Barrel Cactus rising (65→79). Saltbush correct. Need Saguaro dominant. |

### Key improvements from iteration 6

- **Aromatic completely removed from Hill+Temp and Hill+Trop** — was 232 and 168, now 0. The shrub germination block is definitive.
- **Target grasses/forbs now dominate temperate/tropical hills**: Turfgrass, Clover, Wildflower are top 3 on both.
- **Fern appeared at 142 on Hill+Trop** — target dominant, up from ~0.
- **Caudiciform dropped on Hill+Med**: 218→124 (rootPriority×wind effect working).
- **Saltbush #1 on Soil+Desert** (159) — first time target dominant emerged here.
- **Performance nearly doubled** across all climates.

### Remaining problems (ranked by priority)

1. **Desert Grass dominates temperate/tropical hills** — 170 on Hill+Temp, 191 on Hill+Trop (target: Absent). Desert Grass is classified by rootPriority + (1-waterStorage) + longevity + (1-leafSize). Deep-rooted, long-lived grasses on hills become Desert Grass instead of Bunchgrass. This is a classifier issue — Desert Grass and Bunchgrass share similar trait profiles.

2. **Magnolia/Acacia trees on hills** — Magnolia 127 on Hill+Temp (Absent), Acacia 73 (Absent). Trees are still establishing on hills despite wind penalties. Need stronger tree suppression or tree germination filter for hills.

3. **Bunchgrass never appears as dominant** — The Bunchgrass classifier (seedSize + longevity + 1-rootPriority + 1-heightPriority) doesn't align with what succeeds on hills. Grasses that thrive on hills tend to have deep roots (for drought on exposed terrain), which pushes them toward Desert Grass classification.

4. **Caudiciform still dominates Hill+Desert and Arid niches** — 160 on Hill+Desert (Absent target). The rootPriority×wind effect helped on Hill+Med but wasn't enough for Desert hills. Saguaro (target dominant) barely appears.

5. **Tropical tree never appears** — Persistent across all iterations. Classification overlap with Cypress/Magnolia.

6. **Missing subtypes**: Mediterranean shrub (Med niches), Bamboo (tropical), Sedge (wetlands), Conifer (hills), Tallgrass (wetlands).

### Suggested next focus (pick ONE)

- **Option A: Fix Desert Grass / Bunchgrass classifier overlap** — Desert Grass dominates hills because deep-rooted grasses get classified as Desert Grass. Fix: make Desert Grass require high rootPriority AND low longevity (ephemeral drought-adapted), while Bunchgrass gets longevity + seedSize (persistent tussock). Or add a waterStorage component to separate them.

- **Option B: Tree germination filter for Hill terrain** — Similar pattern to shrub filter. Block tree germination on hills in all climates except Tropical (where Conifer should be present). This removes Magnolia/Acacia from hills and opens space for grasses.

- **Option C: Boost Saguaro/Barrel Cactus on arid hills** — Caudiciform dominates because rootPriority gives production bonus via drought. Saguaro uses heightPriority instead. Add a heightPriority × heatStress bonus (tall columnar form radiates heat efficiently) to help Saguaro in hot exposed terrain.

- **Option D: Fix Tropical tree classification** — The Tropical tree classifier requires defense + heightPriority + leafSize + (1-rootPriority). This overlaps with Cypress (heightPriority + woodiness) and Magnolia (longevity + leafSize). Tropical trees could be differentiated by adding a negative woodiness weight (Tropical trees have flexible trunks, not dense rigid wood).

**Recommendation: Option B.** Trees on hills is the second-biggest remaining issue and follows the same proven pattern (germination filter) that just solved the shrub problem. After removing trees from hills, the remaining plant pool (grasses + forbs + succulents in desert) better matches the target matrix. Combined with Option A in the same iteration if time allows.
