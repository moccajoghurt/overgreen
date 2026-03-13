# Ralph Progress — Target Matrix Tuning

## Iteration 1
### Hypothesis — What I think the problem is
Dominant gate at 22.6% is the critical bottleneck. Three root causes:
1. **HeightPriority net-negative in most niches** — wind (-1.00) and shallowSoil (-0.60) penalties crush tall subtypes (Saguaro, Tallgrass, Conifer, Palm). Even in desert where extremeAridity bonus exists, the net is negative.
2. **8 subtypes never stable** (Tallgrass, Conifer, Mediterranean, Aloe, Wildflower, Vine, Flowering Shrub, Iceplant) — classifiers use (1-defense) weights that fight the trait engine rewarding defense everywhere. Optimal genomes always drift away.
3. **Barrel Cactus absorbs all succulents** — defense×extremeAridity (+0.80) makes the defense-heavy Barrel Cactus profile dominate over Saguaro (heightPriority) and Aloe (leafSize) in all desert niches.
4. **SeedInvestment undervalued** — Wildflower, Birch, Desert Annual, Flowering Shrub need it but it has almost no positive coefficients.

### Changes — What I did
After 10+ failed attempts at piecemeal coefficient changes and one failed comprehensive overhaul (62.1%), discovered a key technique: **zero-mean paired terms**.

**Key insight:** Any single trait-effects term changes the MEAN modifier across all 16 niches, causing the grid-search optimizer to pick different representative genomes (cascading). Paired terms on complementary env vars (winterHarshness/tropicality) achieve near-zero mean shift while creating strong niche-specific differentiation.

Changes applied (cumulative):

1. **Paired seed×leaf climate axis** — near-zero mean shift
   - `seedInvestment × leafSize × winterHarshness × +1.20` — flowering forbs thrive in harsh-winter meadows
   - `seedInvestment × leafSize × tropicality × -1.00` — vegetative reproduction outperforms seeding in tropical canopy
   - **Effect:** Pushes seed×leaf subtypes (Desert Annual, Wildflower) DOWN in tropical niches where they're absent, allowing Tropical Herb, Fern, and Aloe to reach top-3 in their target niches. Gained +3 dominant hits (TropHerb in Trop/Hill, Fern in Trop/Hill, Aloe in Trop/Arid).

2. **SeedSize fitness terms** — differentiates Bunchgrass from Pampas
   - `seedSize × shallowSoil × +0.25` — large seeds anchor in rocky shallow soil
   - `seedSize × windExposure × -0.15` — heavy seeds can't wind-disperse on exposed terrain
   - Also added seedSize to compiled trait system (GENOME_TRAITS, _traitBuf).
   - **Effect:** Fixed 2 absent violations where Pampas (seedSize=0.01) was incorrectly in top-5 on hill niches (Pampas dropped out of Temp/Hill and Desert/Wetland top-5).

### Results
- **67.1% → 69.8%** (+2.7%)
- Absent: 91.2% → 92.1% (395→399 of 433)
- Dominant: 22.6% → 27.4% (14→17 of 62)
- Common: 87.8% → 91.5% (72→75 of 82)
- Minor: 96.8% → 96.8% (61 of 63, unchanged)

### Failed approaches this iteration
- Inverse woodiness on soilFertility (-0.55): +2 dominant but hurt common/absent gates equally
- Defense×seedInvestment×winterHarshness (-1.50): cascade effects cancelled gains
- Comprehensive 30-change overhaul: crashed to 62.1% — too many cascading genome selection changes
- Single winterHarshness term (+1.20 or +0.60): cascade from non-zero mean
- Woodiness×soilFertility increase (+0.50→+0.80): lost 1 dominant hit
- Defense×rootPriority seasonality/tropicality pair: lost 3 dominant hits (tropicality penalty too strong)

### Remaining gaps (45 missing dominant entries)
Closest to fixing (smallest gap from diagnostic):
- Med/Soil: Aromatic (gap 0.055), Oak (gap 0.064)
- Med/Wetl: Fern (gap 0.055)
- Med/Hill: Bunchgrass (gap 0.149)
- Trop/Arid: Aloe was fixed ✓
- Trop/Hill: TropHerb and Fern were fixed ✓

Structural blockers:
- Bunchgrass and Pampas have identical modifiers (only differ by seedSize — partially fixed)
- Defense=0.99 universal attractor (mean +0.107 contribution)
- Trees crushed by wind+shallowSoil on hills (woodiness=-1.40×wind, -0.80×shallow)
- 8 never-stable subtypes from classifier vs fitness conflicts

## Iteration 2
### Hypothesis — What I think the problem is
Short woody subtypes (Oak, Aromatic, Birch) can't outrank non-woody subtypes (Fern, Bunchgrass) in seasonal niches. Woodiness has existing seasonality term (+0.30) but it's not enough and applies equally to tall vs short woody plants. Need a term that specifically rewards **compact woody form** — (1-heightPriority)×woodiness — in seasonal environments, with zero-mean compensation via shallowSoil penalty.

### Changes — What I did
1. **Short woody specialization — zero-mean paired term (seasonality/shallowSoil)**
   - `(1-heightPriority) × woodiness × seasonality × +1.10` — compact woody shrubs/short trees persist through seasonal cycles
   - `(1-heightPriority) × woodiness × shallowSoil × -0.906` — short woody plants still need soil anchorage
   - Zero-mean verification: 1.10×0.35 - 0.906×0.425 = 0.385 - 0.385 = 0.000 ✓
   - **Key design:** Uses (1-heightPriority) to exclude tall trees (Conifer hgt=0.99) while helping short trees/shrubs (Oak, Birch, Aromatic all hgt=0.01). The seasonality axis differentiates Mediterranean/Temperate (high seasonality) from Tropical (low).
   - **Effect:** +4 dominant entries. Oak and Aromatic enter top-3 in Med/Soil. Birch enters top-3 in Temp/Soil and Temp/Wetl.

### Failed approaches this iteration
- Mediterranean/Aromatic/Aloe classifier redesigns: crashed to 68.4% — changed rep genomes and created new absent violations
- Peaked heightPriority×waterStorage×extremeAridity +5.00 for Saguaro: crashed to 67.6% — mean shift of +0.162 for Saguaro cascaded despite targeting only 4 niches
- seed×leaf winterHarshness +1.40 / tropicality -1.20: marginal +0.1% but lost Bunchgrass in Temp/Hill and Temp/Arid (net zero on dominant)
- Short-woody pair at +0.60/-0.494: worked (+1 Oak in Med/Soil) but coefficient too small to get Aromatic past Fern

### Results
- **69.8% → 71.7%** (+1.9%)
- Absent: 92.1% → 92.1% (399 of 433, unchanged)
- Dominant: 27.4% → 33.9% (17→21 of 62)
- Common: 91.5% → 90.2% (75→74 of 82, lost 1)
- Minor: 96.8% → 95.2% (61→60 of 63, lost 1)

### Remaining gaps (41 missing dominant entries)
Closest to fixing from diagnostic:
- Med/Soil: Aromatic ✓ (fixed), Oak ✓ (fixed)
- Temp/Soil: Birch ✓ (fixed), Hazel still missing
- Temp/Wetl: Birch ✓ (fixed)
- Med/Wetl: Fern (rank 8, gap 0.080)
- Med/Hill: Bunchgrass (rank 5, gap 0.178)
- Temp/Hill: Wildflower (rank 7, gap ~0.06), Clover (rank 4, gap ~0.04)

Structural blockers remain:
- Mediterranean subtype never-stable (always drifts to Saltbush)
- Cypress very far from top-3 in its target wetland niches
- Saguaro can't compete with Barrel Cactus in extreme arid (rootPriority advantage)
- Palm has negative mean fitness (-0.112)

## Iteration 3
### Hypothesis — What I think the problem is
Three targeted issues:
1. **Saguaro blocked by Barrel Cactus in desert** — both succulents have defense=0.99, but Barrel Cactus (root=0.99, hgt=0.01) has higher mean fitness. Need peaked(hgt=0.50) to target only Saguaro (hgt=0.50) while ignoring Barrel (hgt=0.01) and Euphorbia (hgt=0.99).
2. **Defensive perennials (def=0.99, long=0.99) underrewarded in drought** — Desert Grass, Saguaro benefit from armored longevity in dry niches but the engine doesn't reward this combination specifically.
3. **Seed×leaf coefficient slightly too low** — Birch (seed=0.99, leaf=0.99) was barely above Saltbush in Temp/Soil by 0.005. Nudging the coefficient stabilizes the ranking.

### Changes — What I did
1. **3-trait interaction engine** — Added `trait3` support to TraitEffect interface, computeTraitModifier(), compiled fast path, and diagnostic labels. Enables peaked(trait1) × trait2 × trait3 × envVar for surgical subtype targeting.

2. **Peaked Saguaro term — peaked(hgt=0.50) × defense × waterStorage × extremeAridity**
   - `peaked(hgt, 0.50) × defense × waterStorage × extremeAridity × +5.00`
   - `peaked(hgt, 0.50) × defense × waterStorage × soilFertility × -1.343`
   - Zero-mean: 5.00×0.059 - 1.343×0.219 = 0.294 - 0.294 = 0.000 ✓
   - **Key design:** peaked(0.50) gives Saguaro (hgt=0.50) value 1.0, while Barrel Cactus (hgt=0.01) and Euphorbia (hgt=0.99) get 0.02. With def×wStr as additional filters, only Saguaro gets the full 50× multiplier.
   - **Effect:** Saguaro enters top-1 in Des/Hill and Des/Arid. +1 dominant (Saguaro in Des/Arid), +2 absent fixes.

3. **Defense × longevity climate axis** — armored perennials in drought vs tropical
   - `defense × longevity × droughtStress × +0.25`
   - `defense × longevity × tropicality × -0.405`
   - Zero-mean: 0.25×0.261 - 0.405×0.161 = 0.065 - 0.065 = 0.000 ✓
   - **Effect:** Desert Grass (def=0.99, long=0.99) passes Caudiciform (def=0.50, long=0.01) in Des/Hill. +1 dominant (Desert Grass in Des/Hill). Minor gate +1.

4. **Seed×leaf coefficient nudge** — winterHarshness +1.20→+1.25, tropicality -1.00→-1.07
   - Stabilizes Birch above Saltbush in Temp/Soil (margin was 0.002 after defense×longevity term).
   - **Effect:** Birch restored to top-3 in Temp/Soil. +1 dominant (Birch back).

### Failed approaches this iteration
- Wetland perennial term (leafSize×(1-seed)×(1-wood)×waterlogging) with multiple compensators:
  - droughtStress compensator (+0.40/-0.172): crashed to 71.6% — droughtStress penalty crushed grasses/Desert Grass on hills (ds=0.630 on Des/Hill)
  - diseasePressure compensator (+1.00/-0.428): crashed to 71.4% — dp=0.450 in Trop/Arid penalized Aloe (lost dominant), Bunchgrass in Temp/Arid also lost
  - Peaked(leaf=0.99) variant: swaps Fern for Sedge in Med/Wetl (net zero) since peaked=0 for Sedge (leaf=0.49)
  - Combined r-strategist suppression + peaked Fern: 72.5% — lost Aloe in Trop/Arid from seasonality compensator
- longevity×leafSize winterHarshness/tropicality (+0.60/-0.514): crashed to 70.8% — too broad (affects Fern, Holly, Jade, Epiphytic equally), lost Birch, Bunchgrass, Aromatic, Aloe

### Key insight — why wetland terms consistently fail
Any term benefiting leaf=0.99 non-woody perennials in wetlands (waterlogging+) inevitably penalizes the same subtypes in other niches via the compensator. The affected group (Fern, Aloe, Epiphytic, Jade, Holly) overlaps heavily with target dominants in OTHER niches (Aloe in Trop/Arid, Fern in Trop/Soil). Every compensator variable (droughtStress, diseasePressure, seasonality, soilFertility) is high enough in at least one critical niche to cause collateral dominant/common losses that offset the Med/Wetl gain.

### Results
- **71.7% → 72.8%** (+1.1%)
- Absent: 92.1% → 92.4% (399→400 of 433)
- Dominant: 33.9% → 37.1% (21→23 of 62)
- Common: 90.2% → 89.0% (74→73 of 82, lost 1)
- Minor: 95.2% → 96.8% (60→61 of 63, gained 1)

### Remaining gaps (39 missing dominant entries)
Closest to fixing (gap < 0.12):
- Temp/Hill: Wildflower (rank 5, gap 0.043), Clover (rank 6, gap 0.052) — but 4 dominants for 3 slots, Ryegrass (common) at rank 2 blocks both
- Des/Wetl: Sedge (rank 12, gap 0.056) — ALL top-3 are ABSENT subtypes
- Med/Wetl: Fern (rank 8, gap 0.078) — blocked by Desert Annual (ABSENT, rank 2, immune to trait terms)
- Med/Hill: Bunchgrass (rank 5, gap 0.117) — Caudiciform (ABSENT, rank 1) and Turfgrass (common) block

Structural blockers:
- **Turfgrass dominance on Arid**: leaf=0.01, hgt=0.01 avoids all major penalties. Rank 1 ABSENT in Temp/Arid (0.973) and Med/Arid (1.197)
- **Desert Wetland broken**: All top-3 are ABSENT (TropHerb, Bunchgrass, Turfgrass). Env values all near-zero, no lever available
- **Swap problem**: Tight margins (0.002-0.010) mean any new term displaces existing dominant entries. 5+ wetland term variants all scored net zero or negative on dominant gate
- **Mediterranean, Cypress, Palm**: Rep genomes have fundamentally weak profiles (mean 0.037, 0.109, -0.117). Need classifier changes, not trait-effects tuning
