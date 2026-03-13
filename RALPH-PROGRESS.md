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

## Iteration 4
### Hypothesis — What I think the problem is
Three issues targeted:
1. **Palm classifier forces bad genome** — `(1-def)*0.20 + (1-leaf)*0.20` penalizes defense and leaf, which are the most rewarded traits globally. Result: mean=-0.117 (worst of all subtypes). Palm needs these penalties removed.
2. **Turfgrass absent violations in desert/arid** — Turfgrass (leaf=0.01, def=0.99, root=0.99) avoids all penalties and collects universal defense/root bonuses, making it top-5 in 5+ niches where it should be absent. Need surgical suppression targeting only leaf=0.01 non-woody armored plants in drought.
3. **Wildflower/Clover below top-3 in Temp/Hill** — Both are rank 5-6, gap 0.043-0.052. A broadleaf defended seed-producer bonus on shallow soil (hills) could push them up.

### Changes — What I did
1. **Palm classifier redesign** — removed `(1-defense)*0.20 + (1-leafSize)*0.20`, replaced with `longevity*0.20 + (1-seedInvestment)*0.15 + seedSize*0.10`. Allows optimizer to choose def=0.99 without classifier penalty. Mean improved from -0.117 to +0.140. Palm still not competitive in target niches (rank 34 in Trop/Soil) but improved absent gate by +3 (Conifer dropped out of Trop/Soil and Temp/Wetl top-5 as cascade).

2. **Turfgrass arid suppression — peaked(leaf=0.01) × (1-woodiness) × defense**
   - `peaked(leafSize, 0.01) × (1-woodiness) × defense × droughtStress × -0.60`
   - `peaked(leafSize, 0.01) × (1-woodiness) × defense × tropicality × +0.973`
   - Zero-mean: 0.60×0.261 = 0.973×0.161 = 0.157 ✓
   - **Key design:** peaked(0.01) gives Turfgrass (leaf=0.01) value 1.0, leaf=0.50 gets 0.02. (1-woodiness) filter excludes trees (wood=0.71 → 0.29 = 30% effect). Tropicality compensator concentrates positive effect in Tropical niches where Turfgrass isn't problematic.
   - **Effect:** Fixed 4+ Turfgrass absent violations (Des/Soil, Des/Hill, Med/Arid, Temp/Arid-Pampas). Turfgrass entered Trop/Hill top-5 (new absent violation via tropicality compensator, but Desert Annual dropped out — net zero).

3. **Broadleaf seed-producer hill boost — zero-mean (shallowSoil/tropicality)**
   - `seedInvestment × leafSize × defense × shallowSoil × +0.08`
   - `seedInvestment × leafSize × defense × tropicality × -0.211`
   - Zero-mean: 0.08×0.425 = 0.211×0.161 = 0.034 ✓
   - **Effect:** Wildflower entered top-3 in Temp/Hill (+1 dominant). Bunchgrass dropped from rank 3 to rank 4 (-1 dominant). Net 0 dominant change but Bunchgrass gap narrowed to 0.002. Also fixed additional absent violations via combined cascade.

### Failed approaches this iteration
- **Mediterranean classifier** (1-hgt)*0.25 + wood*0.25 + def*0.20 + long*0.15 + (1-seed)*0.15: new genome (def=0.99, wood=0.70, mean=0.329) too globally competitive, entered Temp/Soil top-5 as ABSENT violation (-1 absent), displaced Aromatic from Med/Soil (-1 dominant)
- **Cypress classifier** hgt*0.25 + root*0.25 + long*0.20 + (1-leaf)*0.15 + (1-seed)*0.15: new genome too strong globally, created Cypress ABSENT in Temp/Soil, lost Birch dominant
- **Non-peaked (1-leaf)×def×droughtStress/waterlogging** at -0.15/+0.348: too broad — hit Bunchgrass (leaf=0.49) and Aromatic (leaf=0.50), lost 2 dominant entries despite fixing 3 absent
- **peaked(leaf=0.01)×def×droughtStress/soilFertility** at -0.60/+0.715: soilFertility compensator boosted Turfgrass and Cypress too much on fertile soil (Temp/Soil +0.287). Cypress ABSENT violation, lost Birch dominant
- **peaked(leaf=0.01)×def×droughtStress/waterlogging** at -0.60/+1.393: waterlogging compensator coefficient too extreme (1.393 × 0.810 waterlogging = concentrated +1.1 in Trop/Wetl). Created multiple absent violations in wetlands

### Key insights — compensator variable selection
The zero-mean compensator variable choice is critical:
- **Low-mean variables** (waterlogging=0.1125) require huge compensating coefficients (1.4×), creating concentrated spikes in wetlands
- **Correlated variables** (droughtStress/heatStress, droughtStress/windExposure) nearly cancel the penalty because both are high in the same niches
- **Tropicality** (mean=0.161) is the best compensator for drought penalties: concentrated in Tropical niches (0.500) which have different subtype targets, near-zero elsewhere (0.027-0.058)

### Results
- **72.8% → 73.6%** (+0.8%)
- Absent: 92.4% → 94.7% (400→410 of 433, +10 fixes -3 new = net +7)
- Dominant: 37.1% → 37.1% (23 of 62, unchanged — Wildflower gained, Bunchgrass lost in Temp/Hill)
- Common: 89.0% → 89.0% (73 of 82, unchanged)
- Minor: 96.8% → 96.8% (61 of 63, unchanged)

### Remaining gaps (39 missing dominant entries)
Closest to fixing:
- Temp/Hill: Bunchgrass (rank 4, gap 0.002!), Clover (rank 5, gap 0.009) — 4 dominants for 3 slots, Ryegrass (common, rank 2, gap=0.144) blocks
- Des/Wetl: Sedge (rank 11, gap 0.052) — still ALL top-3 are non-dominant
- Med/Wetl: Fern (rank 8, gap 0.079) — Desert Annual (ABSENT, rank 2) blocks
- Med/Hill: Bunchgrass (rank 5, gap 0.122)
- Temp/Arid: Saltbush (gap 0.213), Aromatic (gap 0.238)

Structural blockers remain:
- **Classifier changes backfire**: Making globally-weak subtypes (Mediterranean, Cypress, Palm) competitive creates ABSENT violations in non-target niches. Their genomes, when improved, become too universally strong.
- **4-dominant niches with 3 slots**: Temp/Hill has 4 target dominants but only 3 slots. Even when all 4 are close, one must be excluded. Currently Wildflower is in, Bunchgrass (gap=0.002) barely out.
- **Dominant gate fundamentally limited at ~37%**: 39 missing entries, 15+ have gaps >0.50, most blocked by absent subtypes in top positions or structurally impossible classifier conflicts. Reaching 70% dominant gate likely requires either (a) a fundamentally different approach to classifiers, or (b) adding new environment variables that create stronger climate-zone differentiation.

## Iteration 5
### Hypothesis — What I think the problem is
Mediterranean subtype (mean=0.037) is structurally uncompetitive — never reaches top-3 in any niche. Its genome (hgt=0.99, wood=0.40, wStr=0.54) is forced by classifier (needs hgt=0.99 to beat Aromatic). No existing environment variable provides sufficient Mediterranean climate differentiation. Also, Aromatic barely misses top-3 in Med/Soil (rank 3 at 0.737, Holly at 0.774 blocks).

### Changes — What I did
1. **New environment variable: `mediterraneity`**
   - Formula: `cp.heat × (1-cp.humidity) × (1-cp.coldness) × max(0, 1-2×|cp.aridity-0.5|) × (1-tp.waterlogging)`
   - Values: Med/Hill=0.280, Med/Soil=0.252, Med/Wetl=0.028, Med/Arid=0.280
   - Non-Med values: Temp≤0.036, Trop≤0.028, Des≤0.113. Mean=0.0857.
   - Key design: (1-waterlogging) suppresses in wetlands to prevent Mediterranean from dominating Med/Wetl where it's only Minor.

2. **Wood×waterStorage×mediterraneity — Mediterranean subtype laser target**
   - `woodiness × waterStorage × mediterraneity × +17.0`
   - `woodiness × waterStorage × tropicality × -9.06`
   - Zero-mean: 17.0×0.0857 = 9.06×0.161 → 1.457 = 1.458 ✓
   - Key design: wood×wStr is uniquely high for Mediterranean (0.40×0.54=0.216). All other subtypes ≤0.007. 30× selectivity ratio. This is possible because Mediterranean sits at the exact boundary: max shrub waterStorage (0.54) × min shrub woodiness (0.40).
   - Effect: Mediterranean enters top-3 in Med/Soil (rank 2 at 0.830, up from rank 39 at 0.018). +1 dominant. Fern drops out of Med/Soil top-5 (+1 absent fix). Ryegrass drops out of Med/Arid top-5 (+1 absent fix).

3. **Peaked(leaf=0.50)×defense×(1-seed)×mediterraneity — Aromatic boost**
   - `peaked(leafSize, 0.50) × defense × (1-seedInvestment) × mediterraneity × +0.20`
   - `peaked(leafSize, 0.50) × defense × (1-seedInvestment) × extremeAridity × -0.292`
   - Zero-mean: 0.20×0.0857 = 0.292×0.0588 → 0.017 = 0.017 ✓
   - Key design: peaked(0.50) targets Aromatic (leaf=0.50, peaked=1.0) while ignoring Holly (leaf=0.99, peaked=0.02). (1-seed) excludes Ryegrass (seed=0.99). extremeAridity compensator avoids Tropical/Temperate collateral (extremeAridity=0 in all Temp/Trop niches).
   - Effect: Aromatic boosted to 0.802 in Med/Soil, above Holly (0.790). Med/Soil now has 3 dominants in top-3 (Mediterranean, Oak, Aromatic). Also swapped Bunchgrass for Wildflower in Temp/Hill (rank 3 at 0.603 vs Wildflower rank 4 at 0.598) — net zero on dominant gate but Bunchgrass was the closer target.

### Failed approaches this iteration
- **mediterraneity without (1-waterlogging)**: Mediterranean jumped to rank 1 in Med/Wetl (0.678), displacing Sedge from top-3 (-1 dominant). The wood×wStr boost of +0.877 applied uniformly to all Med niches including wetlands.
- **peaked(0.50)×def×(1-seed) with tropicality compensator**: Tropical Herb (leaf=0.50, peaked=1.0) penalized -0.064 in Trop niches. Caused Clover ABSENT to enter Trop/Arid top-5 (-1 absent). Also Pampas entered Des/Wetl top-3 as ABSENT (-1 absent). Net zero despite gains.
- **Increasing peaked coefficient to 0.50+**: Pampas (leaf=0.49, peaked=0.98) gets nearly identical boost as Bunchgrass/Aromatic, enters Med/Soil top-5 as ABSENT. Saltbush also rises. Coefficient 0.20 is the safe ceiling.

### Key insights
- **Boundary trait products**: wood×wStr is uniquely high for Mediterranean because it sits at the archetype boundary (max shrub wStr × min shrub wood). This creates a laser-targeted trait signature that no other subtype can match, enabling huge coefficients without collateral.
- **Terrain-modulated climate variables**: Multiplying climate-only variables by terrain factors (e.g., 1-waterlogging) creates niche-specific rather than climate-blanket effects. Essential for subtypes that are dominant in one Med terrain but minor/absent in another.
- **extremeAridity as surgical compensator**: extremeAridity is 0 in ALL Temperate and Tropical niches (droughtStress never exceeds 0.35 there). This makes it a zero-collateral compensator for Temp/Trop niches — only penalizes in extreme desert where subtypes are already very strong.

### Results
- **73.6% → 74.3%** (+0.7%)
- Absent: 94.7% → 95.2% (410→412 of 433, +2)
- Dominant: 37.1% → 38.7% (23→24 of 62, +1)
- Common: 89.0% → 89.0% (73 of 82, unchanged)
- Minor: 96.8% → 96.8% (61 of 63, unchanged)

### Remaining gaps (38 missing dominant entries)
Closest to fixing:
- Temp/Hill: Wildflower (rank 4, gap 0.005) — swapped with Bunchgrass (now rank 3)
- Med/Hill: Bunchgrass (rank 5, gap 0.069) — Caudiciform ABSENT at rank 1 blocks
- Med/Wetl: Fern (rank 8, gap 0.084) — Desert Annual ABSENT at rank 2 blocks
- Des/Wetl: Sedge (rank 11, gap 0.040) — ALL top-3 still non-dominant
- Med/Soil: Cypress (rank 21, gap 0.300) — only remaining missing dominant in Med/Soil

Structural blockers:
- **Temp/Hill 4-dominant ceiling**: 4 dominants for 3 slots. Bunchgrass now in (was Wildflower). Ryegrass (common, rank 2) blocks both from being top-3 simultaneously.
- **Med/Hill dominated by ABSENT subtypes**: Caudiciform (rank 1), Tropical Herb (rank 4) both ABSENT. Any Caudiciform suppression term spills into other hill niches via shallowSoil compensator.
- **Des/Wetl fundamentally broken**: All env values near-zero. No lever to differentiate dominants from absent subtypes. All modifiers clustered 0.10-0.21.

## Iteration 6
### Hypothesis — What I think the problem is
Two surgical interventions possible using peaked(hgt=0.50) trait signatures:
1. **Cypress missing from all wetland targets** — Cypress (hgt=0.50, leaf=0.01, wood=0.71) has peaked(hgt=0.50)×(1-leaf)×wood = 0.703. No other subtype exceeds 0.014. Boosting this in waterlogging niches should get Cypress into Temp/Wetl and Med/Wetl top-3.
2. **Saguaro missing from Med/Arid top-3** — Saguaro is rank 7 (mod=1.022, gap=0.074). The existing extremeAridity coefficient (+5.00) only contributes 0.238 in Med/Arid (extremeAridity=0.100). Increasing it to +15.00 should bridge the gap. Key: extremeAridity=0 in Med/Hill and Trop/Hill, so no ABSENT violations in those niches.

### Changes — What I did
1. **Cypress wetland term — peaked(hgt=0.50) × (1-leaf) × wood × waterlogging**
   - `peaked(hgt, 0.50) × (1-leafSize) × woodiness × waterlogging × +3.50`
   - `peaked(hgt, 0.50) × (1-leafSize) × woodiness × shallowSoil × -0.926`
   - Zero-mean: 3.50×0.1125 = 0.926×0.425 → 0.394 = 0.394 ✓
   - Cypress product = 0.703. Conifer/Acacia (peaked=0.02) → 0.014. 50× selectivity.
   - **Effect:** Cypress enters top-3 in Temp/Wetl (+1 dominant). New Cypress ABSENT in Trop/Wetl (-1 absent) — waterlogging=0.810 in Trop/Wetl too strong.

2. **Saguaro extremeAridity boost — +5.00 → +15.00**
   - Increased existing peaked(hgt=0.50)×def×wStr×extremeAridity from +5.00 to +15.00
   - Adjusted soilFertility compensator from -1.343 to -4.027
   - Zero-mean: 15.00×0.0588 = 4.027×0.219 → 0.882 = 0.882 ✓
   - **Effect:** Saguaro enters Med/Arid top-3 (+1 dominant). No new ABSENT violations — extremeAridity=0 in all Temp/Trop/Med-Hill niches.

### Failed approaches this iteration
- **Saguaro shallowSoil/soilFertility term** (+3.0/-5.823): Saguaro entered Med/Hill (ABSENT) and Trop/Hill (ABSENT) because shallowSoil is high in hills (0.700) regardless of climate. soilFertility compensator too weak in Med/Hill (soilFert=0.054). Replaced with boosting existing extremeAridity coefficient which is 0 in all Hill niches.
- **Saguaro extremeAridity +12.0**: Not quite enough — Saguaro rank 7 in Med/Arid (gap 0.074). Needed +15.0 for margin.

### Key insights
- **extremeAridity as zero-collateral boost variable**: It's 0 in ALL Temperate, Tropical, and Mediterranean Hill niches. Only nonzero in Arid terrain (Med/Arid=0.100, Des/Arid=0.460, Des/Hill=0.280). Combined with peaked trait targeting, allows huge coefficients without any Hill/Temp/Trop collateral.
- **shallowSoil is dangerous for arid boosting**: shallowSoil doesn't distinguish Hill from Arid terrain well (Hill=0.700, Arid=0.600). Any shallowSoil-based boost spills equally into hill niches.
- **Waterlogging tropical overflow**: Trop/Wetl has waterlogging=0.810 (highest of all niches), so any waterlogging-based boost inevitably leaks there. Would need a (1-tropicality) modulation to prevent.

### Results
- **74.3% → 75.4%** (+1.1%)
- Absent: 95.2% → 94.9% (412→411 of 433, -1)
- Dominant: 38.7% → 41.9% (24→26 of 62, +2)
- Common: 89.0% → 89.0% (73 of 82, unchanged)
- Minor: 96.8% → 96.8% (61 of 63, unchanged)

### Remaining gaps (36 missing dominant entries)
Closest to fixing:
- Temp/Hill: Wildflower (rank 4, gap ~0.005), Clover (rank 5-6)
- Med/Hill: Bunchgrass (rank 5), Mediterranean, Aromatic
- Med/Wetl: Cypress (still missing), Fern
- Des/Wetl: Palm, Acacia, Sedge, Tallgrass — all 4 dominants missing
- Trop/Soil: Palm, Magnolia, Tropical Herb, Fern — all 5 dominants missing (3 slots)

Structural blockers:
- **Trop/Wetl Cypress ABSENT violation**: waterlogging=0.810 creates massive boost. Need (1-tropicality) or similar modulation to suppress in tropical wetlands specifically.
- **36 missing dominants**: Many are structurally blocked (trees with globally weak profiles, 4-dominant niches with 3 slots, ABSENT subtypes occupying top positions). Approaching limits of coefficient tuning alone.
- **Des/Wetl still broken**: All env values near-zero, all modifiers clustered.

## Iteration 7
### Hypothesis — What I think the problem is
Three issues with surgical fixes:
1. **Caudiciform (ABS) at #1 in Med/Hill** — seed=0.99 × wStr=0.55 (product 0.545) is uniquely high. A wind-exposed penalty for heavy-seeded succulents would push it down.
2. **Turfgrass (ABS) dominates wind-exposed niches** — The (1-leafSize)×windExposure term at +0.25 is below where narrow-leaved grasses could differentiate from mid-leaf subtypes. A small bump helps.
3. **Bunchgrass/Saltbush just below top-3** — Bunchgrass in Med/Hill (gap 0.056), Saltbush in Temp/Arid (gap 0.003). Deep-rooted and woody plants should get slightly more drought benefit.

### Changes — What I did
1. **Succulent seed dispersal wind penalty — seed×wStr×windExposure**
   - `seedInvestment × waterStorage × windExposure × -1.00`
   - `seedInvestment × waterStorage × soilFertility × +1.46`
   - Zero-mean: 1.00×0.320 = 1.46×0.219 → 0.320 = 0.320 ✓
   - Key design: Caudiciform (seed=0.99, wStr=0.55, product=0.545) uniquely high. Saguaro (seed=0.01): product ~0. Turfgrass (wStr=0.01): product ~0.
   - **Effect:** Caudiciform drops from #1 to #6-7 in Med/Hill. Bunchgrass approaches top-3.

2. **Narrow-leaf wind resistance bump — (1-leafSize)×windExposure: +0.25 → +0.30**
   - Small coefficient increase (+0.05) to give narrow-leaved plants (Bunchgrass leaf=0.49, Saltbush leaf=0.01) more advantage on windy terrain.
   - **Effect:** Bunchgrass enters top-3 in Med/Hill (#3 at +0.798). +1 dominant hit.

3. **Deep root drought access bump — rootPriority×droughtStress: +0.65 → +0.69**
   - Rewards deep-rooted plants (root=0.99) more in drought conditions. Differentiates Bunchgrass (root=0.99) from Tropical Herb (root=0.50) in Med/Hill.
   - **Effect:** Combined with Proposals 1+3, closed the 0.004 gap between Bunchgrass and Tropical Herb in Med/Hill. +1 dominant (Bunchgrass in Med/Hill confirmed in top-3).

4. **Woody drought penalty reduction — woodiness×droughtStress: -0.55 → -0.52**
   - Reduced penalty for shrubs in drought. Differentiates Saltbush (wood=0.40) from Ryegrass (wood=0.01) in Temp/Arid.
   - **Effect:** Closed 0.003 gap for Saltbush in Temp/Arid. Saltbush enters top-3. +1 dominant.

### Failed approaches this iteration
- **tropicalFertility composite env var**: Added tropicalFertility = pow(heat×humidity, 1.5) × soilDepth × humidity × (1 - exposure×0.5). Two paired terms targeting Tropical canopy tree (+8.0) and understory fern (+3.0). **Crashed to 70.6%** — coefficients way too aggressive. Lost 8 dominant hits, gained 26 absent violations. Reverted.
- **(1-root)×(1-wood)×shallowSoil penalty (-0.30)**: Intended to penalize TropicalHerb (ABS in multiple niches). But TropicalHerb genome has root=0.50 (half effect) while Saguaro root=0.01 (full effect). Saguaro collateral: dropped from Med/Arid top-3 (-1 DOM). Architect analysis used wrong genome data.
- **Height bump: (1-height)×windExposure +0.50→+0.55**: No effect on gaps because competitors in top-3 have similar height profiles. Gaps stayed at 0.003-0.004 regardless of coefficient.
- **(1-leafSize)×windExposure +0.30→+0.32**: Genome selection cascade — crashed to 74.9% (lost 2 DOM). Even +0.02 more was enough to change which genome the optimizer selects for some subtype.

### Key insights
- **Genome selection is a cliff**: Coefficients have "safe zones" and "cascade zones". +0.05 bump (0.25→0.30) was fine; +0.07 (0.25→0.32) cascaded. The boundary is unpredictable.
- **Trait products as subtype signatures**: seed×wStr uniquely identifies Caudiciform because no other subtype has BOTH seed=0.99 AND wStr≥0.55. Using this as a penalty term is surgical.
- **Small coefficient bumps on existing terms**: Lower cascade risk than new term pairs. The +0.04 to rootPriority×droughtStress and -0.03 to woodiness×droughtStress were both safe because they're tiny adjustments to existing terms.
- **Architect genome assumptions were wrong**: The subagent assumed TropicalHerb root=0.01 but it's actually root=0.50. Always verify representative genomes from balance-matrix before designing terms.

### Results
- **75.3% → 76.6%** (+1.3%)
- Absent: 94.7% → 94.5% (410→409 of 433, -1)
- Dominant: 41.9% → 45.2% (26→28 of 62, +2)
- Common: 89.0% → 90.2% (73→74 of 82, +1)
- Minor: 96.8% → 96.8% (61 of 63, unchanged)

### Remaining gaps (34 missing dominant entries)
Closest to fixing:
- Temp/Hill: Wildflower (rank 4, gap 0.011) — swap with Bunchgrass (both DOM), net 0
- Des/Wetl: Sedge (rank 11, gap 0.051) — all top-3 still non-dominant
- Med/Wetl: Fern (rank 8, gap 0.081), Cypress (rank 9, gap 0.087)
- Trop/Arid: Pampas (rank 12, gap 0.144)

Structural blockers:
- **Temp/Hill 4-dominant ceiling**: Still 4 DOMs for 3 slots. Ryegrass (common) at rank 2 blocks.
- **Med/Wetl Desert Annual blocker**: rank 2 (ABS). Fern and Cypress far below.
- **Des/Wetl broken**: All env values near-zero. All modifiers clustered 0.08-0.21.
- **Trop/Soil Mangrove/Oak block**: Both ABS, ranks 1-3. Only Tropical (DOM) in top-3.
- **Remaining 34 missing DOMs**: Most have gaps >0.1. Approaching limits of coefficient tuning.

## Iteration 8
### Hypothesis — What I think the problem is
Dominant gate at 45.2% is the critical bottleneck (28/62). Closest misses: Temp/Hill Wildflower (gap 0.011), Med/Wetl Fern (gap 0.081), Med/Wetl Cypress (gap 0.087). Hypothesis: the Saguaro soilFertility compensator (peaked(hgt=0.50)×def×wStr×soilFertility -4.027) is collaterally crushing Cypress (-0.407) and Sedge (-0.136) in wetland niches because they share Saguaro's trait signature.

### Changes — What I did
No changes committed. All attempts reverted to baseline after testing.

### Failed approaches this iteration

**1. Cypress waterlogging boost + split compensator (Part A)**
Changed Cypress wetland pair from waterlogging +3.50 / shallowSoil -0.926 to waterlogging +4.50 / shallowSoil -0.50 / tropicality -1.827. Result: 76.6% — identical to baseline. Cypress entered Med/Wetl top-3 but displaced Sedge (also DOM). Net 0 DOM.

**2. Desert Annual wetland suppression — seed×(1-long)×waterlogging -0.50 / heatStress +0.181**
Collateral: Birch (seed=0.99, long=0.01) got -0.221 in Temp/Wetl, dropping from top-3. Ryegrass boosted above Saltbush in Temp/Arid. Clover boosted above Aloe in Trop/Arid. Score crashed to 74.9% (25 DOM, -3 net).

**3. Targeted DesAnn suppression — seed×(1-long)×defense×waterlogging -0.22 / heatStress +0.080**
Avoided Birch (def=0.01) but heatStress compensator still boosted Ryegrass above Saltbush in Temp/Arid (-1 DOM) and Clover above Aloe in Trop/Arid (-1 DOM). Also created new Ryegrass ABS violation in Med/Arid. Score: 76.0% (27 DOM).

**4. seed×leaf×long×shallowSoil +0.26 / tropicality -0.687 (Wildflower boost)**
Wildflower entered Temp/Hill top-3 but: (a) Bunchgrass exited Temp/Hill (swap), (b) Wildflower rose to +0.903 in Temp/Arid, displacing Saltbush from top-3 (-1 DOM). Score: 76.1% (27 DOM).

**5. seedInvestment×leafSize×winterHarshness +1.25 → +1.28 (+0.03)**
Score dropped to 76.1% (27 DOM). Genome cascade.

**6. seedInvestment×leafSize×winterHarshness +1.25 → +1.26 (+0.01)**
Even +0.01 cascaded. Score: 76.0% (27 DOM). This coefficient pair is at the cascade boundary.

**7. Saguaro compensator variable switch analysis**
Computed alternative compensators for the Saguaro soilFertility -4.027 term. All alternatives (seasonality -2.765, winterHarshness -6.415, droughtStress -3.376) produce LARGER penalties for Cypress/Sedge in wetlands because those variables are higher in wetland niches than soilFertility is. soilFertility is actually the BEST compensator choice for minimizing wetland collateral.

### Key insights
- **Coefficient tuning has hit a hard ceiling at ~76.6%**: Every near-miss DOM fix causes equal-or-greater DOM losses elsewhere through zero-sum swaps or genome selection cascades.
- **Saguaro compensator collateral is structural**: peaked(hgt=0.50)×def×wStr is shared by Cypress (0.535) and Sedge (0.535) — both DOM targets in wetlands. The -4.027×soilFertility penalty can't be switched to any alternative variable without making things worse.
- **Ryegrass is the universal blocker**: With leaf=0.49 (moderate), seed=0.99, def=0.99, root=0.99, Ryegrass is a balanced generalist that occupies top-3 in Temp/Hill (COM), Temp/Arid (COM), Med/Hill (MIN). Any boost to other subtypes must be large enough to surpass Ryegrass, which triggers cascades.
- **4-DOM-for-3-slot ceiling**: Temp/Hill, Med/Wetl, Des/Wetl all have 4+ DOMs needing 3 slots. Even perfect coefficient tuning can only seat 3 — the rest are structural misses.
- **ABS violations are densely packed**: Suppressing one ABS subtype from top-5 reveals another (e.g., Turfgrass exits Temp/Arid top-5 but Pampas enters at same rank).
- **+0.01 coefficient changes can cascade**: The seed×leaf×winterHarshness pair is so tightly balanced that even ±0.01 triggers genome selection changes.
- **Mean shift vs zero-mean is crucial**: Non-zero-mean changes cascade because they shift the grid-search optimum for genome selection. Zero-mean changes avoid this but still cascade if they change the relative ranking between genomes at the margin.

### Results
- **76.6% → 76.6%** (no change — all attempts reverted)
- This iteration confirms the coefficient tuning ceiling. Further progress requires structural changes: new environment variables, classifier modifications, terrain/climate physics adjustments, or genome grid resolution increases.

### Recommended structural changes for future iterations
1. **New env var for tropical soil differentiation**: Something like `canopyDensity = tropicality × soilFertility` that sharply separates Trop/Soil from other niches.
2. **Classifier adjustments**: Aromatic genome has leaf=0.01 (should be ~0.50 for a Mediterranean shrub). Fixing this enables peaked(leaf=0.50)×mediterraneity terms to work.
3. **Genome grid refinement**: 3^9 grid may miss critical genomes at intermediate values (e.g., 0.50). Increasing to 5^4 × 3^5 for key traits could find better representatives.
4. **Terrain physics tuning**: Adjusting Hill/Wetland/Arid base physics could shift the landscape enough to unstick structural blockers.

---

## Iteration 9
### Hypothesis — Structural physics changes can break past the coefficient ceiling
Iteration 8 proved that coefficient tuning alone hits a ceiling at 76.6%. The dominant gate (45.2%, 28/62) needs structural changes to the environment physics layer, not just new trait×env table rows. Three specific structural approaches:

1. **Waterlogging humidity floor**: Desert/Mediterranean wetlands have almost no waterlogging character (Des/Wetl=0.090 vs Trop/Wetl=0.810) because `waterlogging = tp.waterlogging × cp.humidity`. Real oases and spring-fed marshes retain standing water regardless of climate humidity. A `Math.max(humidity, 0.45)` floor would give these niches proper wetland character.

2. **Hill exposure reduction**: Reducing Hill exposure from 0.80→0.75 slightly eases wind penalties that crush large-leaved forbs (Wildflower/Clover), improving their hill competitiveness without cascading as badly as coefficient changes.

3. **Pioneer tree wetland boost**: Birch (seed=0.99, def=0.01, wood=0.71) is a pioneer tree that uniquely colonizes wetland margins. A `seed × (1-def) × wood × waterlogging` term targets Birch specifically without collateral (all other trees have high defense or low seed).

### Approach
Three changes applied sequentially, each tested independently:

1. **Waterlogging floor** (`deriveCellEnv` line 66):
   - Changed `tp.waterlogging * cp.humidity` → `tp.waterlogging * Math.max(cp.humidity, 0.45)`
   - Effect: Med/Wetl waterlogging 0.270→0.405, Des/Wetl 0.090→0.405
   - Result: 77.3% (+0.7pp), DOM 28→29, ABS 409→411
   - Gained: Trop/Wetl Palm, Med/Wetl Cypress, Des/Wetl Sedge+Tallgrass (+4 DOM)
   - Lost: Temp/Wetl Birch, Temp/Arid Saltbush, Med/Wetl Sedge (-3 DOM, net +1)
   - Side effect: broke Cypress zero-mean pair (waterlogging mean shifted 0.113→0.144), but the resulting +0.077 Cypress mean bias was beneficial — "fixing" it dropped score to 74.8%

2. **Hill exposure** (terrain physics):
   - Changed Hill exposure 0.80→0.75
   - Result: 77.6% (+0.3pp), ABS 412 (+1 fix)
   - Removed Pampas ABS violation in Temp/Hill
   - Wildflower gap narrowed from 0.011 to 0.003 but still 4-for-3 slot blocked

3. **Pioneer tree wetland boost** (new TRAIT_EFFECTS entry):
   - Added `seed × (1-def) × wood × waterlogging +0.08 / shallowSoil -0.027`
   - Birch product: 0.696 (2x next largest collateral: Flowering Shrub 0.198)
   - Result: 78.2% (+0.6pp), DOM 29→30 (Birch enters Temp/Wetl top-3)

### Failed approaches within iteration 9
- **Hill exposure 0.70**: Too aggressive, DOM crashed to 26/62 (cascaded through all Hill niches)
- **Hill soilDepth 0.30→0.32**: Massive cascade through soilFertility, dropped to 75.5%
- **Broadleaf hill boost 0.08→0.09/0.10**: Flipped Wildflower in but Bunchgrass out (4-for-3 zero-sum swap)
- **Mediterranean term + (1-leaf) filter**: Theoretically should help Tropical tree by removing wood×wStr×tropicality collateral. In practice: exactly neutral (same 77.6%, same DOMs). The genome cascade absorbed the change.
- **Cypress compensator "fix"**: Correcting the broken zero-mean (shallowSoil -0.926→-1.184) HURT because the imbalance was beneficial. Score dropped 77.6%→74.8%.

### Key insights
- **Waterlogging floor is botanically motivated**: Wetlands retain groundwater from terrain regardless of climate humidity — oases, spring-fed marshes, etc.
- **Broken zero-mean can be beneficial**: When the waterlogging mean shifted, it created a positive Cypress bias that helped wetland DOMs. "Fixing" it removed the benefit.
- **4-for-3 slot is a hard ceiling**: Temp/Hill has 4 DOMs (Bunchgrass, Turfgrass, Wildflower, Clover) for 3 slots. ANY term that helps one trades another out because the DOM subtypes have orthogonal trait profiles (short vs tall, perennial vs annual, broad vs narrow leaf).
- **Surgical new terms work**: The pioneer tree boost (seed × (1-def) × wood) was extremely selective — only Birch gets meaningful effect among trees.

### Results
- **76.6% → 78.2%** (+1.6pp)
- DOM: 28→30 (+2: Des/Wetl Sedge+Tallgrass, Trop/Wetl Palm, Med/Wetl Cypress, Temp/Wetl Birch gained; Temp/Arid Saltbush, Med/Wetl Sedge lost)
- ABS: 409→412 (+3)
- COM: 74→75 (+1)
- Closest remaining DOM misses: Temp/Hill Wildflower (0.003), Med/Wetl Sedge (0.036), Temp/Hill Clover (0.039)

### Remaining blockers
- **Tropical niches** (11 missing DOMs): Holly/Oak/Mangrove dominate Trop/Soil instead of Palm/Magnolia/Tropical Herb/Fern. The Mediterranean wood×wStr×tropicality compensator crushes Tropical tree (product=0.383) — it gets -1.737 in Trop/Soil. Structural fix needed but (1-leaf) filter proved neutral.
- **Temp/Arid** (3 missing): Saltbush, Aromatic, Desert Grass all need to be in top-3 but Bunchgrass/Clover/Ryegrass dominate.
- **Med/Hill** (2 missing): Mediterranean and Aromatic subtypes can't break through grass dominance.
- **Med/Arid** (2 missing): Mediterranean gap=0.584 — needs significant structural change.
