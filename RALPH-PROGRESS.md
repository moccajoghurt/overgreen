# Ralph Loop Progress

## Iteration 12: Woodiness drought/aridity penalties + defense drought bonus + Arid tree block

### What was done

4 changes targeting tree removal from desert/arid niches:

1. **`woodiness × droughtStress: -0.15 → -0.35`** — Doubled the water cost of woody tissue in drought. Affects all woody plants but hits trees (woodiness >0.7) hardest in dry climates.

2. **New: `woodiness × extremeAridity × -1.50`** — Xylem cavitation and wood cracking in extreme desert. Only fires when droughtStress > 0.35 (Soil+Desert: 0.10, Arid+Med: 0.10, Hill+Desert: 0.28, Arid+Desert: 0.46). Zero effect on temperate/tropical/wetland.

3. **New: `defense × droughtStress × +0.35`** — Thorns and thick bark reduce water loss in drought. Differentiates Acacia (high defense) from Cypress (low defense) in desert conditions. Also benefits Holly, Saltbush, and defensive succulents.

4. **Arid `treeGermination: false`** + extended tree filter to block Arid+Mediterranean. Trees now blocked on: Hill+Temp, Hill+Desert, Arid+Temp, Arid+Desert, Arid+Med. Trees allowed on: Arid+Tropical (for Acacia dominant target).

### Performance

| Climate | Iter 11 | Iter 12 |
|---------|---------|---------|
| Temperate | 30 t/s | 30 t/s |
| Tropical | 30 t/s | 30 t/s |
| Mediterranean | 32 t/s | 35 t/s |
| Desert | 49 t/s | 48 t/s |

Stable. No performance impact.

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Acacia:160, Magnolia:118, Oak:118, Fern:116, Fl.Shrub:89 | 2.76 | Oak/Fern correct. **Acacia:160 is #1 (should be absent!)** Side effect of defense×drought bonus. |
| Soil+Trop | Magnolia:117, Hazel:94, Cypress:86, Holly:82, Birch:78 | 3.03 | H passes. Still need Tropical/Palm dominant. |
| Soil+Med | Cypress:226, Aromatic:128, Magnolia:101, Mediterranean:92, Hazel:88 | 2.81 | **Cypress+Aromatic+Mediterranean correct!** Oak missing. |
| Soil+Desert | TallHerb:153, Tallgrass:127, DesertGrass:105, Hazel:104, Mangrove:96 | 2.76 | **Cypress GONE from top 5!** (was 223). DesertGrass present. Need Saltbush/Acacia. |
| Hill+Temp | Bunchgrass:285, Turfgrass:237, DesertGrass:190, Wildflower:130, Clover:27 | 1.52 | Top3 grasses correct but DesertGrass:190 (absent). H fails. |
| Hill+Trop | TallHerb:219, Pampas:185, Bunchgrass:136, DesertGrass:100, Tallgrass:99 | 2.30 | Need TropicalHerb/Fern/Conifer. H fails. |
| Hill+Med | Bunchgrass:223, Wildflower:169, Caudiciform:130, Saguaro:121, DesertGrass:106 | 2.57 | Bunchgrass correct! Caudiciform/Saguaro (absent). |
| Hill+Desert | **Saguaro:324**, Tallgrass:130, DesertGrass:126, Pampas:97, TallHerb:63 | 1.88 | **Saguaro dominant! (was 205 best).** Need BarrelCactus. |
| Wetland+Temp | Mangrove:139, Magnolia:137, Hazel:127, Cypress:114, Acacia:111 | 2.84 | Mangrove/Cypress present. Need Birch/Sedge/Fern. |
| Wetland+Trop | Hazel:145, Cypress:144, Magnolia:135, Mangrove:132, Acacia:101 | 2.97 | Mangrove present. Need Tropical/Palm/Fern/Bamboo. |
| Wetland+Med | Mangrove:148, Cypress:145, Magnolia:126, Palm:121, Hazel:121 | 2.99 | **Mangrove+Cypress #1+#2 correct!** Need Sedge/Fern. |
| Wetland+Desert | Hazel:133, TallHerb:101, Cypress:91, Magnolia:84, Vine:75 | 2.99 | Need Palm/Acacia/Sedge/Tallgrass. |
| Arid+Temp | Bunchgrass:224, Aromatic:176, Bramble:153, DesertGrass:140, Hazel:131 | 2.33 | **Bunchgrass+Aromatic+DesertGrass correct!** Need Saltbush. Hazel:131 (absent). H fails. |
| Arid+Trop | Caudiciform:131, Bunchgrass:117, Aromatic:101, DesertGrass:75, Cypress:73 | 2.89 | Need Acacia/Aloe/Euphorbia/Pampas. Cypress:73 still present (not blocked in Trop). |
| Arid+Med | Caudiciform:231, DesertGrass:149, Aromatic:143, Bunchgrass:132, BarrelCactus:103 | 2.46 | Aromatic correct. BarrelCactus:103 present. Need Saguaro/Mediterranean. |
| Arid+Desert | Caudiciform:145, BarrelCactus:139, DesertGrass:119, Saguaro:89, Aromatic:85 | 2.16 | **BarrelCactus:139 (up!)**, Saguaro:89 (up from 49). Caudiciform still #1. |

### Improvements from iteration 11

- **Soil+Desert Cypress**: 223 → gone from top 5. Trees successfully removed from desert soil.
- **Hill+Desert Saguaro**: 205 (best of 3) → 324. Solidly dominant.
- **Arid+Desert BarrelCactus**: not in top 5 → 139 (#2). Saguaro 49 → 89.
- **Arid+Med BarrelCactus**: 88 → 103. Trees removed via germination filter.
- **Arid+Temp**: Trees (Cypress/Acacia/etc.) removed. Aromatic now #2 (target dominant).

### Side effects

- **Soil+Temp Acacia**: 120 (#3) → 160 (#1). The `defense × droughtStress × +0.35` bonus boosted Acacia on temperate soil (droughtStress=0.15, defense 0.7 → +0.037 each tick). Acacia should be absent on Soil+Temp.

### Remaining problems (ranked by priority)

1. **Caudiciform dominance on Arid/Desert** — #1 on Arid+Trop (131), Arid+Med (231), Arid+Desert (145). Caudiciform is a short fat succulent that thrives via waterStorage+rootPriority. Need Saguaro (tall columnar) to beat it. The JC discovery from iter 11 means classifier changes backfire.

2. **Soil+Temp Acacia (#1 when should be absent)** — defense × droughtStress bonus side effect. May need to reduce coefficient or add a drought threshold.

3. **Tropical trees never dominant** — Soil+Trop needs Tropical/Palm, Wetland+Trop needs Tropical/Palm/Bamboo. Cypress/Hazel/Magnolia dominate instead.

4. **Wetland subtypes wrong** — All wetlands dominated by Magnolia/Hazel/Cypress/Mangrove instead of Birch/Sedge/Fern/Bamboo. Need wetland-specific positive effects for these subtypes.

5. **Hill diversity low** — Hill+Temp H=1.52, Hill+Desert H=1.88. Grass/succulent monocultures.

6. **DesertGrass everywhere** — Shows up in 10/16 niches including Hill+Temp (190), Hill+Trop (100), Hill+Med (106) where it should be absent.

### Suggested next focus (pick ONE)

- **Option A: Fix DesertGrass ubiquity** — DesertGrass appears in too many non-desert niches. The DesertGrass classifier may be too easy to satisfy, or there's a trait combination that scores high on DesertGrass across many environments. Rework the classifier to require extreme drought traits, or add trait interactions that penalize DesertGrass-like genomes in wet/temperate conditions.

- **Option B: Fix Caudiciform dominance** — The core issue is that short, fat succulents (high waterStorage + rootPriority) outcompete tall ones (high heightPriority) in most arid niches. Need a mechanism that specifically advantages height over root depth in arid environments. The existing extremeAridity × heightPriority helps but isn't enough outside Hill+Desert.

- **Option C: Fix Tropical tree absence** — Rework Tropical tree classifier or add trait interactions that favor defense+leaf+height genomes in humid, warm environments. Currently Cypress (height+longevity) beats Tropical (defense+height+leaf) because leafSize penalties in disease/wind outweigh benefits.

- **Option D: Fix wetland subtypes** — Add waterlogging-positive effects for grass-like (Sedge) and forb-like (Fern) plants. Currently waterlogging is mostly a penalty.

**Recommendation: Option A (DesertGrass).** DesertGrass appearing in 10/16 niches is the most widespread classifier/niche issue. Fixing it would improve Hill+Temp (H too low due to DesertGrass), Hill+Med, and several other niches in one change.
