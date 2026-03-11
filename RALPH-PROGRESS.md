# Ralph Loop Progress

## Iteration 8: Tree Germination Filter + Bunchgrass/Desert Grass Classifier Fix

### What was done

3 changes targeting hill niche accuracy and grass subtype classification:

1. **Tree germination block on Hill terrain for Temperate/Desert climates** — Added `treeGermination` terrain property (false for Hill). Tree seeds cannot establish on Hill when climate is Temperate or Desert. Allowed on Hill+Tropical (cloud forest conifers) and Hill+Mediterranean (cypress). Models the reality that tree seedlings cannot survive persistent ridgeline wind exposure.

2. **Bunchgrass classifier rework** — Changed from `seedSize + longevity + (1-rootPriority) + (1-heightPriority)` to `seedInvestment*0.30 + seedSize*0.25 + (1-heightPriority)*0.25 + longevity*0.20`. Key change: uses seedInvestment (high on hills due to wind dispersal bonus) instead of (1-rootPriority) which penalized the deep roots that hill grasses actually evolve. Bunchgrass now correctly identifies hill-adapted tussock grasses.

3. **Desert Grass classifier rework** — Changed from `rootPriority + (1-waterStorage) + longevity + (1-leafSize)` to `rootPriority*0.40 + (1-seedInvestment)*0.25 + (1-leafSize)*0.20 + longevity*0.15`. Removed (1-waterStorage) which was a free bonus for all grasses. Uses (1-seedInvestment) as counterpoint to Bunchgrass's seedInvestment — arid grasses invest less in reproduction, more in roots.

4. **Turfgrass classifier adjusted** — Added `(1-rootPriority)*0.15` to separate shallow-rooted lawn grass from deep-rooted Bunchgrass. Reduced (1-heightPriority) from 0.55 to 0.45 to compensate.

### Key learnings from experimentation

- **seedInvestment is the key trait axis separating hill vs arid grasses.** Hill grasses evolve high seedInvestment (wind dispersal bonus +0.20×windExposure), while arid grasses invest more in roots (drought bonus +0.55×droughtStress). This makes seedInvestment a reliable classifier differentiator between Bunchgrass and Desert Grass.
- **First round with rootPriority-based Bunchgrass caused over-classification** — all deep-rooted grasses became Bunchgrass, overwhelming arid terrain. The seedInvestment approach is more ecologically grounded.
- **(1-waterStorage) in Desert Grass was a near-free bonus** — grasses always have waterStorage < 0.55, so this gave ~0.24 contribution to every grass. Removing it allowed more meaningful differentiation.

### Performance

| Climate | Iter 7 | Iter 8 |
|---------|--------|--------|
| Temperate | 28 t/s | 30 t/s |
| Tropical | 29 t/s | 30 t/s |
| Mediterranean | 32 t/s | 32 t/s |
| Desert | 51 t/s | 50 t/s |

Stable. Slight improvement in Temperate/Tropical from fewer plants on hills.

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Acacia:173, Oak:165, Fern:135, FloweringShrub:133, Wildflower:103 | 2.56 | Oak correct. Fern present. Acacia should be absent (173!). |
| Soil+Trop | Magnolia:116, Fern:100, Cypress:99, Holly:94, Hazel:84 | 2.99 | Magnolia correct. Fern correct. Need Tropical/Palm dominant. |
| Soil+Med | Fern:125, Magnolia:109, Cypress:94, Oak:93, Hazel:92 | 2.95 | Cypress correct. Oak correct. Need Mediterranean/Aromatic dominant. |
| Soil+Desert | Aromatic:154, Magnolia:152, Saltbush:123, DesertGrass:115, Cypress:97 | 2.27 | Saltbush correct. Desert Grass present. Magnolia should be absent. |
| Hill+Temp | **Bunchgrass:306**, Turfgrass:194, Wildflower:156, DesertGrass:148, Ryegrass:76 | 1.60 | **MAJOR WIN**: Bunchgrass #1, Turfgrass #2, Wildflower #3 — all target dominants! Desert Grass should be absent (148). H too low (only 6 subtypes). |
| Hill+Trop | Wildflower:227, Turfgrass:193, **Bunchgrass:183**, DesertGrass:149, Clover:133 | 1.90 | Bunchgrass present. Need Tropical Herb/Fern/Conifer. Desert Grass should be absent. |
| Hill+Med | Saltbush:156, Caudiciform:151, Bunchgrass:129, DesertGrass:118, **Aromatic:109** | 2.40 | Bunchgrass + Aromatic both present (target dominants!). Caudiciform should be absent. |
| Hill+Desert | Caudiciform:161, Iceplant:94, Saltbush:92, Aromatic:91, BarrelCactus:33 | 1.74 | Barrel Cactus present. Need Saguaro/Desert Grass dominant. Caudiciform still #1 (absent target). |
| Wetland+Temp | Mangrove:138, Acacia:133, Hazel:133, Magnolia:129, Palm:123 | 2.80 | Mangrove correct. Need Birch/Cypress/Sedge/Fern dominant. Acacia should be absent. |
| Wetland+Trop | Magnolia:158, Mangrove:152, Hazel:138, Cypress:135, Palm:114 | 2.89 | Mangrove/Palm correct. Need Tropical/Fern/Bamboo dominant. |
| Wetland+Med | Magnolia:176, Mangrove:163, Cypress:155, Hazel:144, Palm:120 | 2.87 | Mangrove/Cypress correct. Need Sedge/Fern dominant. |
| Wetland+Desert | Hazel:145, Magnolia:109, Fern:98, Bunchgrass:86, Wildflower:83 | 2.98 | Fern present. Need Palm/Acacia/Sedge/Tallgrass dominant. |
| Arid+Temp | Bunchgrass:167, Aromatic:156, Hazel:149, **DesertGrass:132**, Clover:121 | 2.55 | Aromatic/Desert Grass correct (target dominants). Bunchgrass correct (target Common). H passes! |
| Arid+Trop | Bunchgrass:109, DesertGrass:96, Caudiciform:90, Aromatic:86, Magnolia:85 | 2.75 | Need Acacia/Aloe/Euphorbia/Pampas dominant. |
| Arid+Med | Caudiciform:147, Saltbush:131, Bunchgrass:127, Aromatic:117, DesertGrass:107 | 2.80 | Aromatic/Saltbush correct. Need Barrel Cactus/Saguaro/Mediterranean dominant. |
| Arid+Desert | Caudiciform:130, Aromatic:86, Saltbush:83, DesertGrass:57, Turfgrass:56 | 2.43 | Saltbush correct. Need Saguaro/Barrel Cactus dominant. |

### Key improvements from iteration 7

- **Bunchgrass now dominant on hills** — was 0, now 306 on Hill+Temp (#1!), 183 Hill+Trop, 129 Hill+Med. The classifier fix using seedInvestment as differentiator worked.
- **Trees removed from Hill+Temp and Hill+Desert** — Magnolia gone from hills (was 127). Tree germination filter working.
- **Desert Grass maintained on arid terrain** — 132 on Arid+Temp (target Dominant), not stolen by Bunchgrass.
- **Aromatic appeared on Hill+Med** — 109 (target Dominant, was absent before).
- **Turfgrass maintained on hills** — 194 on Hill+Temp (target Dominant).

### Remaining problems (ranked by priority)

1. **Desert Grass still ~148 on temperate/tropical hills** — target: Absent. The trait profile that evolves on hills (deep roots, small leaves, moderate seedInvestment) still classifies partially as Desert Grass. Hard to fix via classifier alone without breaking arid Desert Grass. May need a germination-level restriction or a new environmental trait axis.

2. **Caudiciform dominates Hill+Desert (161) and Arid niches (130-147)** — target: Absent on hills, Minor on arid. rootPriority×wind effect from iter 7 isn't enough. Saguaro (target dominant) barely appears because heightPriority is penalized by wind, and Caudiciform's rootPriority gives drought bonus.

3. **Shannon H too low on Hill+Temp (1.60) and Hill+Trop (1.90)** — only 6-9 subtypes. With trees and shrubs blocked, hills can only host Grass + Forb (+ Succulent on Med/Desert). Inherent diversity ceiling from germination filters. Potential fix: allow some shrub/tree subtypes back via trait-based exemptions.

4. **Tropical tree never appears** — Persistent. Tropical classifier requires defense + heightPriority + leafSize + (1-rootPriority), which overlaps with Cypress and Oak.

5. **Acacia too common (173 on Soil+Temp, 133 Wetland+Temp)** — target: absent in temperate. Acacia classifier (defense + (1-waterStorage) + leafSize + seedInvestment) doesn't discriminate well by climate.

6. **Missing subtypes**: Sedge (wetlands), Conifer (hills), Bamboo (tropical), Tallgrass (wetlands/soil).

### Suggested next focus (pick ONE)

- **Option A: Fix Caudiciform dominance on hills/arid** — Caudiciform (rootPriority-based succulent) thrives because rootPriority gives drought bonus while height penalty doesn't apply (short plant). Saguaro (heightPriority-based) suffers from wind/drought combined penalties. Fix: add heatStress × heightPriority bonus (tall columnar form radiates heat efficiently — saguaro's real advantage). Or add rootPriority × heatStress penalty (deep caudex roots overheat in hot exposed soil).

- **Option B: Boost Shannon H on hills** — The germination filters create a diversity ceiling. Option: allow Conifer trees on hills (add climate-based tree exemption for Hill+Tropical/Mediterranean). Or relax shrub filter for Holly/Bramble (small hardy shrubs that survive hill wind). Or add new trait effects that boost forb diversity.

- **Option C: Fix Tropical tree classification** — Tropical tree never appears because its classifier overlaps with Cypress/Oak. Differentiate by adding negative woodiness weight (tropical trees have flexible trunks, not dense rigid wood) or positive waterStorage (moisture-retaining bark).

- **Option D: Fix Acacia in temperate/wetland** — Acacia dominates where it should be absent. Similar to previous germination filter approach: add an Acacia-specific or "arid tree" penalty in temperate climates via trait effects.

**Recommendation: Option A.** Caudiciform is the single most over-represented subtype across the most niches (Hill+Desert, Arid+Temp, Arid+Med, Arid+Desert). Fixing it would improve 4+ niches simultaneously while making room for target succulents (Saguaro, Barrel Cactus) to dominate.
