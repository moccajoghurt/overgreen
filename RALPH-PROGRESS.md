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
