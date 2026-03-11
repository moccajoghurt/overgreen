# Ralph Loop Progress

## Iteration 4: Trait Effect Rebalance for Specialist Differentiation

### What was done

Comprehensive rebalance of the TRAIT_EFFECTS table to reduce generalist dominance and reward niche specialists. 11 coefficient changes in `src/simulation/trait-effects.ts`:

1. **leafSize base: +0.30 → +0.22** — Reduces unconditional leaf benefit. Magnolia (leafSize ~0.7) loses ~0.056/tick everywhere.
2. **leafSize × waterlogging × +0.25** — Big leaves rewarded specifically in wetlands.
3. **waterStorage × windExposure × -0.25** — Wind desiccation penalizes succulents on exposed terrain (hills). Pushes succulents off temperate/med hills while preserving desert hill viability.
4. **woodiness × windExposure: -0.25 → -0.35** — Stiffer trunks penalized more in wind.
5. **inverse-woodiness × windExposure: +0.45 → +0.38** — Moderate reduction in grass wind advantage.
6. **rootPriority × droughtStress: +0.45 → +0.55** — Deep roots matter more in drought (helps Desert Grass, Saltbush over Turfgrass).
7. **(1-rootPriority) × waterlogging × +0.30** — Shallow roots advantaged in saturated soil (helps Sedge, Fern, Mangrove).
8. **longevity base: +0.04 → +0.01** — Reduce generalist persistence bonus.
9. **longevity × diseasePressure × +0.08** — Longevity rewarded in disease-rich environments (tropical/wetland).
10. **longevity × droughtStress: -0.08 → +0.05** — Flipped sign: perennial root networks resist drought (was penalizing them, ecologically backwards).
11. **longevity × frostRisk × -0.10** — Frost damages accumulated long-lived tissue (targets Aromatic on cold/exposed hills).

### Performance

| Climate | Iter 3 | Iter 4 |
|---------|--------|--------|
| Temperate | 15 t/s | 31 t/s |
| Tropical | 14 t/s | 32 t/s |
| Mediterranean | 15 t/s | 35 t/s |
| Desert | 23 t/s | 51 t/s |

Significant performance improvement (likely from reduced population density due to trait rebalance).

### Niche Results Summary (tick 5000)

| Niche | Top 5 | H | Target Match |
|-------|-------|---|-------------|
| Soil+Temp | Aromatic:142, Acacia:134, Magnolia:131, Cypress:104, Bramble:102 | 2.79 | Poor: Oak/Birch/Hazel should dominate |
| Soil+Trop | Cypress:113, Magnolia:111, Aromatic:100, Hazel:82, Acacia:74 | 3.02 | Poor: Tropical/Palm/Magnolia should dominate |
| Soil+Med | Aromatic:180, Magnolia:141, Turfgrass:128, Cypress:120, Acacia:77 | 2.86 | Mixed: Aromatic good, Mediterranean shrub needed |
| Soil+Desert | Aromatic:170, Turfgrass:150, Magnolia:124, Cypress:106, Saltbush:105 | 2.10 | Poor: Saltbush/Acacia/Desert Grass should dominate |
| Hill+Temp | Aromatic:217, Magnolia:184, Turfgrass:76, Cypress:62, Acacia:57 | 2.06 | Poor: grasses/forbs should dominate |
| Hill+Trop | Aromatic:135, Turfgrass:109, Saltbush:88, Magnolia:70, Birch:61 | 2.19 | Poor: Bunchgrass/Fern/Conifer should dominate |
| Hill+Med | Aromatic:147, Caudiciform:125, Magnolia:120, Barrel Cactus:111, Saltbush:97 | 2.56 | Poor: Bunchgrass/Mediterranean/Aromatic target |
| Hill+Desert | Caudiciform:116, Aromatic:80, Magnolia:79, Saltbush:73, Iceplant:51 | 2.14 | Mixed: Caudiciform is succulent, Saguaro/Barrel Cactus/Desert Grass target |
| Wetland+Temp | Magnolia:137, Hazel:134, Birch:107, Palm:97, Mangrove:96 | 2.98 | Mixed: Birch/Hazel good! Sedge(65)/Tallgrass(73) emerging |
| Wetland+Trop | Magnolia:143, Hazel:129, Aromatic:99, Mangrove:95, Bunchgrass:93 | 2.98 | Mixed: Mangrove good, needs Tropical/Palm/Fern dominant |
| Wetland+Med | Magnolia:160, Hazel:155, Cypress:128, Palm:106, Birch:106 | 2.96 | Mixed: Cypress/Birch good, needs Sedge/Fern |
| Wetland+Desert | Hazel:122, Magnolia:107, Aromatic:94, Cypress:75, Wildflower:75 | 3.03 | Poor: Palm/Acacia/Sedge/Tallgrass should dominate |
| Arid+Temp | Turfgrass:164, Aromatic:121, Barrel Cactus:89, Caudiciform:88, Magnolia:77 | 2.72 | Poor: Saltbush/Aromatic/Desert Grass/Bunchgrass target |
| Arid+Trop | Turfgrass:114, Barrel Cactus:103, Aromatic:100, Desert Grass:93, Cypress:86 | 2.79 | Mixed: Desert Grass emerging, Acacia/Aloe/Euphorbia needed |
| Arid+Med | Turfgrass:149, Aromatic:132, Caudiciform:115, Desert Grass:105, Barrel Cactus:98 | 2.78 | Mixed: Barrel Cactus/Aromatic present, needs Saguaro/Mediterranean |
| Arid+Desert | Caudiciform:116, Barrel Cactus:82, Aromatic:76, Iceplant:75, Turfgrass:71 | 2.50 | Mixed: Barrel Cactus good, needs Saguaro dominant |

### Improvements from iteration 3

- Wetland specialists emerging: Sedge 65, Tallgrass 73 on Wetland+Temperate (were absent)
- Iceplant reduced on Hill+Med: 127→49
- Desert Grass appearing in arid niches: 93 (Arid+Trop), 105 (Arid+Med), 70 (Wetland+Desert)
- Performance doubled (likely from lower population pressure)
- Arid+Desert H improved: 2.40→2.50

### Core problem identified: Longevity persistence advantage

**This is the #1 blocker.** Aromatic and Magnolia dominate because they live 3× longer than grasses:
- Aromatic (woodiness 0.5, longevity 0.7): maxAge ≈ 1270 ticks
- Turfgrass (woodiness 0.05, longevity 0.3): maxAge ≈ 396 ticks

Even when grasses have BETTER per-tick production modifiers (+0.36 vs +0.20 for Aromatic on hills), the 3× lifespan means Aromatic holds cells for much longer. Per-tick coefficient tuning alone cannot overcome this structural advantage.

The trait effects table is now well-differentiated — the production modifiers are correctly favoring specialists in their niches. But the LIFESPAN dimension is not captured by production modifiers.

### Suggested Next Focus (pick ONE)

- **Option A: Add wind mortality mechanic** — Periodic wind damage events on high-exposure cells that kill plants based on woodiness × windExposure. Similar to disease events but triggered by wind. Would directly kill Aromatic/Magnolia on hills over time, creating turnover for grasses.

- **Option B: Scale senescence with wind exposure** — Make `maxAge` decrease based on the plant's lifetime wind exposure. Aromatic on hills would senesce faster (e.g., 60% of base maxAge), while grasses with low woodiness are less affected. This narrows the lifespan gap.

- **Option C: Increase grass growth efficiency** — Currently grasses grow faster (GRASS.GROWTH_EFFICIENCY=0.5 vs SIM.GROWTH_EFFICIENCY=0.3) but Aromatic gets a shrub growth efficiency bump. Increasing the grass advantage (0.5→0.6) would let them reach maturity faster and out-reproduce.

- **Option D: Fix Tropical tree classification** — Tropical tree never appears because its genome (defense, height, leaf, low root) overlaps with Magnolia/Cypress/Acacia. Adjusting classification weights or adding a humidity-dependent bonus could help.

- **Option E: Add terrain-specific germination filters** — Currently all archetypes can germinate on all terrain (except succulent gate). Adding climate-aware germination (e.g., succulents blocked on Hill+Temperate/Tropical, tropical trees blocked outside tropical climate) would directly enforce absent-list constraints.

**Recommendation: Option A or B.** The lifespan advantage is structural and needs a structural fix. Coefficient tuning is exhausted for hills. Option A (wind mortality) is more ecologically realistic — exposed hilltop shrubs DO die from wind damage in reality.
