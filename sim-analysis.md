# Overgreen Simulation — Analysis & Test Reference

> **This file documents the current state of the simulation mechanics and their health. Nothing else.**
> - It is NOT a changelog. Never write "X changed to Y", "X is now Y", "previously X", or any historical comparison.
> - When mechanics change: update the description to reflect the current behavior, clear stale experiment results, and re-run experiments.
> - Only keep the latest results. If results haven't been gathered yet, say "Pending" — don't describe what used to be true.

## Tick Pipeline

```
 phaseEnvironment ──> phaseRechargeWater ──> phaseCalculateLight
         │                    │                       │
         v                    v                       v
  seasons, eras,       water += recharge      light = base - shade
  drought/fire/          nutrients decay
  disease spawn
         │
         └──────────> phaseUpdatePlants ──> phaseHerbivores ──> phaseDeath ──> phaseGermination ──> phaseDecomposition
                             │                    │                  │               │                      │
                             v                    v                  v               v                      v
                      absorb water          graze leaves       energy<=0?      seeds sprout          dead plants
                      draw/fill tank*       move & breed       age>=max?       best-energy wins      return water
                      photosynthesize**     metabolize                         vigor scaling         return nutrients
                      pay maintenance                                          tank provision        free cell
                      grow + seed
                    * stored water drawn when transpiration short, filled when surplus
                   ** seedlings skip photosynthesis for first 5 ticks (establishment delay)
```

---

## 1. ENERGY BUDGET

```
  energy_change = photosynthesis - maintenance

  Surplus > 1.0:
    seedBudget = surplus × seedInvestment × env.seedMult
    growthBudget = surplus × (1 - seedInvestment) × env.growthMult
```

### Photosynthesis:
```
  effectiveLeaf = leafArea ^ 0.7
  heightLightBonus = height/maxHeight × heightLightBonus    (continuous by woodiness)
  rawEnergy = (lightLevel + heightLightBonus) × effectiveLeaf × 0.5
  rootAccess = 0.3 + 0.7 × (rootDepth / maxRoot)
  nutrientBonus = 1 + nutrients × rootAccess × 0.20
  energyProduced = rawEnergy × waterFraction × nutrientBonus
```

### Water absorption:
```
  transpirationReduction = (storedWater / capacity) × 0.3
  waterNeeded = effectiveLeaf × 0.55 × (1 - transpirationReduction)
  waterCanAbsorb = rootDepth × 0.4
  waterAbsorbed = min(needed, canAbsorb, cellWater)
  if waterAbsorbed < waterNeeded: draw from storedWater to cover deficit
  waterFraction = waterAbsorbed / waterNeeded   (0-1, scales photosynthesis)
```

### Maintenance:
```
  structuralCost = base + height×perHeight + rootDepth×perRoot + effectiveLeaf×perLeaf
  traitCost = defense×0.05 + waterStorage×0.04×wStorageMult
            + seedInvestment×0.04 + longevity×0.08
  maturity = min(1, height / maxHeight)
  cost = structuralCost + maturity × traitCost
  (terrain multipliers applied per-trait, see Section 5)
```

Trait maintenance scales with maturity — seedlings haven't built defense structures, water storage tissue, reproductive organs, or longevity adaptations yet. Small seedlings pay near-zero trait overhead, ramping up as they grow. Structural costs (height/root/leaf) scale naturally with plant size.

All base/per-trait maintenance constants are interpolated by woodiness (see Section 7).

---

## 2. WATER CYCLE

```
  Recharge rates by terrain:
  ┌──────────┬──────────┬───────────────────┐
  │ Terrain  │ Recharge │ Notes             │
  ├──────────┼──────────┼───────────────────┤
  │ Soil     │ ~0.4     │ ×(0.7-1.3) random │
  │ River    │ 1.2      │ + seepage to adj  │
  │ Rock     │ 0.08     │ no plants         │
  │ Hill     │ ~0.16    │ 0.4× penalty      │
  │ Wetland  │ 0.7      │ starts at 80%     │
  │ Arid     │ 0.25     │ deep water table  │
  └──────────┴──────────┴───────────────────┘

  Groundwater: roots below water table depth access saturated zone.
  Water tables: Soil 4.0, Hill 5.0, Wetland 0.5, Arid 3.0
  River seepage: +0.4 water, +0.1 nutrients to all 8 neighbors/tick
```

Arid terrain also has periodic dry spells (summer only, 0.8%/tick chance, 15-35 ticks duration) that zero out recharge and evaporate 0.05 water/tick across all arid cells. These are separate from localized drought events.

Water genuinely limits growth on Soil and especially Arid. Wetland is rarely limiting.

---

## 3. LIGHT & SHADOWS

```
  Base light: Soil 1.0, Hill 1.35, Wetland 0.75, Arid 1.20

  Shadow from taller neighbors:
    shade += shadowReduction × min(1, heightDiff / shadowHeightScale)
    finalLight = max(0.1, baseLight - totalShade)

  Height light bonus: height/maxHeight × heightLightBonus
    (both shadowReduction and heightLightBonus are continuous by woodiness)
    Wetland: bonus × 1.5
```

Woody plants (high woodiness) cast strong shadows (up to 0.25) and get large height bonuses (up to +0.7). Herbaceous plants (low woodiness) cast negligible shadow (0.05) with minimal height bonus (+0.1).

---

## 4. NUTRIENT CYCLING

```
  Decay: -0.02/tick. Caps: Soil 10, Hill 3, Arid 1.5, Wetland 8, Rock 0.5
  Decomposition returns water + nutrients (scaled by woodiness and height)
  Hill bedrock extraction: roots > 30% depth → extract nutrients (capped at 3.0)
  Nutrient bonus: 1 + nutrients × rootAccess × 0.20 (min 30% access)
```

Nutrients amplify energy but don't hard-gate like water. Decomposition creates long-term enrichment.

---

## 5. TERRAIN SPECIALIZATION

### Maintenance cost multipliers (Soil = 1.0):
```
  ┌──────────┬───────┬────────┬──────┐
  │ Terrain  │ Root  │ Height │ Leaf │
  ├──────────┼───────┼────────┼──────┤
  │ Hill     │ 3.0   │ 1.5    │ 1.0  │
  │ Wetland  │ 2.5   │ 1.0    │ 0.85 │
  │ Arid     │ 0.8   │ 1.2    │ 2.0  │
  └──────────┴───────┴────────┴──────┘
```

---

## 6. GROWTH ALLOCATION & CAPS

```
  Genome: rootPriority, heightPriority, leafSize → normalized to fractions
  Dynamic caps: maxTrait = CAP × (0.3 + 0.7 × traitFrac)
  Growth/tick: growthBudget × fraction × growthEfficiency

  CAP values are interpolated by woodiness (see Section 7).
```

Specialists get big in their niche — genome priorities directly determine morphology.

---

## 7. WOODINESS SPECTRUM

Woodiness is a continuous genome trait (0.01-0.99). Most plant constants are linearly interpolated between herbaceous (w=0) and woody (w=1) endpoints via `getPlantConstants(genome)`. Two properties — maxAge and growthEfficiency — are driven by the `longevity` trait (see Section 15), not woodiness.

### Key endpoints:
```
  ┌─────────────────────┬──────────────┬──────────────┐
  │ Property            │ Herbaceous=0 │ Woody=1      │
  ├─────────────────────┼──────────────┼──────────────┤
  │ Max height          │ 2.0          │ 10.0         │
  │ Max root            │ 3.0          │ 10.0         │
  │ Max leaf            │ 4.0          │ 8.0          │
  │ Maint base          │ 0.02         │ 0.05         │
  │ Maint/height        │ 0.02         │ 0.03         │
  │ Maint/root          │ 0.02         │ 0.03         │
  │ Maint/leaf          │ 0.03         │ 0.04         │
  │ Seed cost           │ 0.4          │ 0.8          │
  │ Seed energy         │ 1.5          │ 2.0          │
  │ Seed range          │ 4+h/4        │ 3+h/2        │
  │ Growth efficiency   │ 0.5 × lonMod │ 0.3 × lonMod │  lonMod = (1.3 - lon×0.6)
  │ Max age             │ 100-1000     │ 200-2500     │  driven by longevity × woodiness (Section 15)
  │ Shadow cast         │ 0.05         │ 0.25         │
  │ Shadow height scale │ 1.0          │ 3.0          │
  │ Height light bonus  │ 0.1          │ 0.7          │
  │ Decomp water        │ 1.0          │ 2.0          │
  │ Decomp nutrients    │ 0.8+h×0.1    │ 1.5+h×0.3   │
  │ Seedling size       │ 0.3/0.3/0.5  │ 1.0/1.0/1.0 │
  │ Seed max age        │ 150          │ 200          │
  │ Seed germ. water    │ 1.5          │ 2.0          │
  └─────────────────────┴──────────────┴──────────────┘
```

### Strategic tradeoffs along the spectrum:
- **Low woodiness (herbaceous):** Cheap maintenance, higher base growth efficiency (0.5), cheap seeds (0.4), wider base seed range, but low caps (h=2, r=3), negligible shading
- **High woodiness (woody):** Tall (h=10), deep roots (r=10), strong shading (+0.25), but expensive maintenance, expensive seeds (0.8), lower base growth efficiency (0.3)
- **Mid woodiness (shrub):** Intermediate everything — moderate caps, costs, and advantages

Lifespan and growth speed are controlled by `longevity` (Section 15), not woodiness.

### Observed woodiness evolution by terrain:

| Terrain | Woodiness direction | Reason |
|---------|-------------------|--------|
| Soil | → 0.29-0.50 | Grass and trees coexist; woodiness converges to mid-range |
| Hill | ↓ 0.17-0.51 | Cheap maintenance favored; some woody holdouts |
| Arid | → 0.46 | Mid-woodiness; water storage matters more than height |
| Wetland | ↑ 0.48 | Resources reward height advantage |
| Mixed | varies 0.23-0.85 | Terrain-dependent; high speciation and niche differentiation |

---

## 8. SEASONS

```
  Year = 500 ticks. Cosine interpolation between seasons.
  ┌─────────┬───────┬───────┬──────────┬────────┬──────┐
  │ Season  │ Water │ Light │ LeafMaint│ Growth │ Seed │
  ├─────────┼───────┼───────┼──────────┼────────┼──────┤
  │ Spring  │ 1.20  │ 1.00  │  1.0     │ 1.30   │ 1.0  │
  │ Summer  │ 0.80  │ 1.15  │  1.0     │ 1.00   │ 1.0  │
  │ Autumn  │ 1.00  │ 0.85  │  1.0     │ 0.50   │ 0.3  │
  │ Winter  │ 0.70  │ 0.60  │  2.0     │ 0.00   │ 0.0  │
  └─────────┴───────┴───────┴──────────┴────────┴──────┘

  Winter: light ×0.6, leaf maintenance ×2 → triggers energy-based leaf drop,
  no growth, no seeds. Plants survive on stored energy.
```

Winter is genuinely lethal for young/weak plants. Root insulation reduces winter leaf penalty.

---

## 9. CLIMATE ERAS

Long-term shifts (2500-5000 ticks) multiplying existing mechanics. Population-responsive selection prevents extinction or runaway growth. Harsh eras never follow each other.

---

## 10. DISASTERS

- **Drought:** Summer, local radius, reduces recharge + evaporates 0.3/tick (all terrains)
- **Arid dry spell:** Summer, terrain-wide, zeroes recharge + evaporates 0.05/tick on all arid cells (15-35 ticks)
- **Fire:** Summer, spreads via low-water high-leaf cells, kills instantly, rivers block
- **Disease:** Targets genetic uniformity >50% — the monoculture punisher

---

## 11. DEFENSE

**Defense:** Reduces grazing by up to 70%, cost = 0.05/tick. Value depends entirely on herbivore pressure.

---

## 12. SEED BANK

Seeds land as dormant objects, germinate when cell water exceeds threshold (interpolated by woodiness: 1.5-2.0). Seeds decay at 0.01 energy/tick with max age 150-200 ticks. Best-energy seed wins per cell. Creates boom/bust dynamics on harsh terrain.

---

## 13. SEED MASS (seedSize genome)

Seed mass (seedSize: 0.01-0.99) controls the tradeoff between many small seeds vs few large seeds.

### Cost curve (how many seeds):
```
  seedSizeMult = 0.3 + seedSize × 1.4    → range 0.3x to 1.7x
  effectiveSeedCost = baseSeedCost × seedSizeMult
  effectiveSeedEnergy = baseSeedEnergy × seedSizeMult
  Small seeds (sz=0.05): cost 0.3x → ~3x more seeds per energy budget
  Large seeds (sz=0.95): cost 1.7x → fewer but better-provisioned seeds
```

### Seedling vigor (how big seedlings start):
```
  seedSizeVigor = 0.2 + seedSize × 1.8    → range 0.2x to 2.0x
  Seedling height/root/leaf = base seedling size × seedSizeVigor
  Small seeds: tiny seedlings (0.2x base size)
  Large seeds: double-sized seedlings (2.0x base size)
```

### Establishment delay:
```
  Seedlings cannot photosynthesize for first 5 ticks (ESTABLISHMENT_TICKS).
  During establishment: zero income, full maintenance costs.
  Large seedlings survive on reserves; tiny seedlings may starve.
  Establishing seedlings can draw from storedWater to offset maintenance.
  Terrain maintenance multipliers make harsh terrain harder to establish on.
```

### Dispersal bonus:
```
  Small seeds disperse further: seedRange += (1 - seedSize) × 3
```

### Observed seed mass evolution by terrain:
| Terrain | sz direction | Reason |
|---------|-------------|--------|
| Soil | ↓ 0.26-0.48 | Many cheap seeds; vigor advantage weak on easy terrain |
| Hill | ↓ 0.31-0.41 | Many cheap seeds hedge bets in scarce environment |
| Arid | → 0.46 | Slightly retained; harsh terrain benefits provisioned seedlings |
| Mixed | ↓ 0.30-0.39 | Downward on all terrains in mosaic/isolated |

Seed mass drifts downward on all terrains. The establishment delay (5 ticks) does not create enough K-selection pressure to sustain large-seed strategies.

---

## 14. WATER STORAGE (waterStorage genome)

Internal water tank for drought tolerance + succulent transpiration reduction. Genome trait `waterStorage: 0.01-0.99`, plant field `storedWater`.

### Mechanics:
```
  Capacity: waterStorage × 5.0
  Fill rate: rootDepth × 0.5 (from cell water, only when transpiration fully met)
  Maintenance: waterStorage × 0.015/tick
  Draw: when waterFraction < 1, draw deficit from tank before scaling photosynthesis
  Transpiration reduction: (storedWater/capacity) × 0.3 → up to 30% less water needed
    Only active when tank has water — empty tank = no benefit
  Seedling provision: seedSizeVigor × waterStorage × 3.0 initial stored water
```

The transpiration reduction is the key mechanic that makes waterStorage an active adaptation rather than just a passive buffer. Plants with full tanks need less water, creating a positive feedback loop: stored water → less demand → higher waterFraction → more photosynthesis. On non-arid terrains where tanks rarely fill (roots solve water needs cheaper), the reduction is negligible.

### Observed waterStorage evolution by terrain:
| Terrain | wst direction | Reason |
|---------|--------------|--------|
| Soil | ↓↓ 0.03-0.26 | Maintenance cost outweighs benefit; tanks rarely fill |
| Hill | ↓ 0.29-0.41 | Some retention; roots alone insufficient for hill water |
| Arid | ↑↑ 0.79 | Strongly selected; tank critical for desert survival |
| Wetland | ↓↓ 0.05 | Water abundant; tank completely unnecessary |
| Mixed | ↓↓ 0.05-0.15 | Collapses on most terrain types |

Water storage is heavily selected against on all non-arid terrains. On arid terrain it provides critical value (0.79 in arid specialist). The 0.015/tick maintenance cost makes it expensive to maintain unused capacity on water-rich terrain.

---

## MECHANICS RANKED BY IMPACT

```
  CRITICAL:
    1. Energy budget (photosynthesis vs maintenance)
    2. Woodiness spectrum (determines most plant constants)
    3. Water absorption & limitation
    4. Growth allocation / genome priorities
    5. Terrain maintenance multipliers

  SIGNIFICANT:
    6. Light & shadow competition (trees shade out grass on soil)
    7. Seasons (winter lethality — can crash tree populations)
    8. Reproduction / seedInvestment
    9. Longevity — growth efficiency modifier has clear selective pressure.
       Senescence provides downward pressure at extreme ages.

  MODERATE:
   10. Climate eras & disasters
   11. Seed bank dynamics
   12. Water storage — critical on arid (0.79), dead trait on non-arid (~70% of map)

  WEAK / BROKEN:
   13. Seed mass — always drifts down. No upward selection pressure exists.
   14. Defense — context-dependent; converges to low values.
   15. Root competition — 6% drain is noise.
```

---

## 15. LONGEVITY (longevity genome)

Longevity (0.01-0.99) creates the r/K selection tradeoff: live fast and grow fast, or live long and grow slow. Lifespan is independent of woodiness — an herbaceous perennial or a woody annual are both viable strategies.

### Mechanics:
```
  maxAge = lerpVal(lerpVal(100, 200, w), lerpVal(1000, 2500, w), lon)
    Both woodiness and longevity influence lifespan:
    - Low woodiness herbs range 100-1000 ticks (0.2-2 years)
    - High woodiness trees range 200-2500 ticks (0.4-5 years)

  growthEfficiency modifier = (1.3 - lon × 0.6)
    lon=0.01: 1.3× base efficiency (fast grower)
    lon=0.50: 1.0× base efficiency (neutral)
    lon=0.99: 0.7× base efficiency (slow grower)

  Base efficiency still comes from woodiness (herb=0.5, woody=0.3).
  Final growthEfficiency = lerpVal(0.5, 0.3, w) × (1.3 - lon × 0.6)

  Senescence: maintenance multiplier that scales quadratically with age.
    onset = SENESCENCE_ONSET (0.3) × maxAge
    After onset: mult = 1 + ((age - onset)/(maxAge - onset))² × (SENESCENCE_MAX_MULT - 1)
    At maxAge: maintenance × 4.0
    Long-lived plants hit senescence later in absolute ticks but still pay eventually.
    Short-lived plants die young before senescence becomes expensive.

  Longevity maintenance: ongoing cost = longevity × 0.08/tick (scaled by maturity)
    Adds per-tick maintenance proportional to longevity gene value.
    Seedlings pay near-zero due to maturity scaling (see Section 1).

  Examples:
    Herbaceous annual  (w=0.1, lon=0.1): 0.48 × 1.24 = 0.60 eff, maxAge ~200
    Herbaceous perennial (w=0.1, lon=0.8): 0.48 × 0.82 = 0.39 eff, maxAge ~830
    Woody annual (w=0.9, lon=0.1): 0.32 × 1.24 = 0.40 eff, maxAge ~360
    Woody perennial (w=0.9, lon=0.8): 0.32 × 0.82 = 0.26 eff, maxAge ~2060
```

### Strategic tradeoffs:
- **Low longevity (annual/ephemeral):** Die young but grow fast (1.3× efficiency). Must reproduce quickly before death. Pairs naturally with high seedInvestment.
- **High longevity (perennial):** Live long but grow slowly (0.7× efficiency). Can accumulate height/roots over time. Pairs naturally with competitive traits (height, shading).
- **Interaction with woodiness:** Woodiness controls morphological potential (caps, costs, shadow); longevity controls tempo. A low-woodiness, low-longevity plant is an annual wildflower. A high-woodiness, high-longevity plant is an oak tree.

### Observed longevity evolution by terrain:
| Terrain | lon direction | Reason |
|---------|--------------|--------|
| Soil | ↑↑ 0.56-0.68 | Longer-lived plants hold territory and accumulate reproductive energy |
| Hill | ↓ 0.42-0.50 | Rapid turnover matters more; slight downward pressure |
| Wetland | ↑ 0.46-0.59 | Abundant resources reward persistence |
| Arid | → 0.51 | Neutral; boom/bust dynamics make longevity irrelevant |
| Mixed | ↑↑ 0.52-0.70 | Strong upward in long runs; dominant species converge to 0.6-0.7 |

Longevity drifts upward in most environments but is now partially checked by senescence (maintenance multiplier that scales with age/maxAge). Short-lived plants avoid senescence costs entirely. The growth efficiency modifier remains the primary selective component; maxAge matters more now via senescence onset timing.

---

## TEST SCENARIOS

Experiments run at 1000 ticks (short) or 5000 ticks (long-term dynamics), snapshot every 250 ticks.

| # | Scenario | Ticks | Pop | Spp | Result | Key trait evolution |
|---|----------|-------|-----|-----|--------|-------------------|
| 1 | Monoculture | 3k | 6379 | 18 | Baseline Fern 46%, Shrub 42%. | w: 0.31, SI: 0.59, lon: pending, wst: 0.40, sz: 0.14 ↓↓, def: 0.18 ↑ |
| 2 | Water Comp | 1k | 786 | 9 | Broad Leaf Fern 77%, Deep Root 14%. | w: 0.54 ↓, lon: 0.45-0.47, SI: 0.66-0.69 ↑, wst: 0.21-0.28 ↓ |
| 3 | Light Comp | 1k | 136 | 3 | Spread Fern 60%, Tall Pine 36%. Low pop. | w: 0.76-0.84, lon: 0.46-0.52, wst: 0.19-0.25 ↓, sz: 0.38-0.40 ↓ |
| 4 | Seed Tradeoff | 1k | 1665 | 13 | Birch 61%, Elm 37%. Low Seed extinct. | lon: 0.63-0.67 ↑↑, SI: 0.67-0.69 ↑, w: 0.60-0.77, wst: 0.27-0.28 ↓ |
| 5 | Defense | 1k | 2679 | 10 | Soft Willow 48%, Thorny Holly 35%. | def converges: Holly 0.48 ↑, Willow 0.16 ↑. lon: 0.40-0.50, wst: 0.18-0.34 |
| 6 | Hill | 1k | 2008 | 18 | Tall Spruce 27%, Broad Leaf Holly 25%, Deep Root Pine 24%. | w: 0.17-0.73, lon: 0.42-0.50, wst: 0.29-0.41, high speciation |
| 7 | Arid | 1k | 1025 | 4 | Saguaro 78%, Turfgrass 22%. | wst: 0.50→0.79 ↑↑, w: 0.50→0.46, root: 0.50→0.44, height: ↓↓ 0.09, boom/bust cycles |
| 8 | Shrub Gallery | 1k | 4263 | 21 | Berry Bush 65%, Heavy Turfgrass 13%. | lon: 0.52-0.58, SI: 0.56 ↑, def: 0.14-0.76, high speciation |
| 9 | Succulent Gallery | 1k | 3390 | 18 | Normal Tree 31%, Desert Rose 21%, Jade Tree 17%. | lon: 0.50-0.57, wst: 0.26-0.55, def: 0.14-0.40, diverse |
| 10 | Grass vs Trees | 3k | 6379 | 18 | Grass 61%, Oak 28%. Coexistence. | w: 0.29-0.50 (converging), SI: 0.55-0.57, wst: 0.41-0.54, def: 0.18-0.20 ↑, sz: 0.10 ↓↓ |
| 11 | Nutrient Cycle | 1k | 149 | 4 | Deep Root Oak 74%, Shallow Fern 21%. Low pop. | lon: 0.47-0.50, SI: 0.50-0.62 ↑, niche differentiation preserved |
| 12 | Terrain Isolated | 5k | 3588 | 20 | Beta Spruce 34%, Gamma Willow 32%, Alpha Fern 23%. | lon: 0.58-0.63 ↑↑, wst: 0.05-0.17 ↓↓, sz: 0.30-0.39 ↓, SI: 0.63-0.69 ↑ |
| 13 | Terrain Mosaic | 5k | 5783 | 20 | Feathery Turfgrass 40%, Gamma Willow 22%, Alpha Fern 21%. | lon: 0.46-0.70 ↑↑, def: 0.03-0.21 ↑, wst: 0.05-0.15 ↓↓, SI: 0.59-0.70 ↑ |
| 14 | Seed Bank | 1k | 4953 | 6 | Seedbank Grass 97%. | lon: 0.52-0.61 ↑, SI: 0.67-0.73 ↑, wst: 0.42-0.54, w: 0.15-0.23 |
| 15 | Woodiness Evo | 5k | 0-2891 | 0-6 | Tree 93%, Shrub 5%. Herb extinct. Stochastic extinction risk (~50%). | w: 0.91-0.94 (stable), SI: 0.59-0.67, wst: 0.15-0.32, def: 0.15-0.22 ↑ |
| 16 | Woodiness×Seed | 1k | 2862 | 4 | Arid Herb 97%. Tree extinct. | lon: 0.46-0.51, SI: 0.63-0.69 ↑, wst: 0.38 ↑ (arid), w: 0.17-0.46 |

### Experiment details

#### 7: Arid Specialist
Healthy desert ecosystem with dramatic boom/bust cycles. Water storage strongly selected FOR (0.50→0.79), confirming it's the key arid adaptation. Height collapses to near-zero — plants stay low. Population oscillates 103-1271 with seasons. Tall Saguaro species (#2) dominates despite name — evolved into short, high-water-storage phenotype (w=0.46, wst=0.79). Desert Grass provides a fast-reproducing secondary strategy.

#### 10: Grass vs Trees (3k ticks)
Prairie Grass (61%) and Oak Tree (28%) coexist at 6379 total population with 18 species and Shannon diversity 0.99. Both species converge toward mid-woodiness (grass w=0.29, oak w=0.50). Maturity-scaled trait maintenance benefits r-strategists with many small seedlings, shifting balance toward grass. Defense evolves upward in both species (0.18-0.20). Seed mass collapses to 0.10 in both.

#### 11: Nutrient Cycle (1k ticks)
Low population (149 plants) with clear niche differentiation: Deep Root Oak (high root, low leaf) vs Shallow Leaf Fern (low root, high leaf). Both strategies coexist stably. Population is resource-limited, not competition-limited.

#### 12: Terrain Isolated (5k ticks, all start w=0.5, sz=0.5, wst=0.3, lon=0.5)
| Species | Terrain | Root | Height | Leaf | Wood | Seed Mass | Water Stor | Longevity |
|---------|---------|------|--------|------|------|-----------|------------|-----------|
| Alpha Fern | Hill | 0.55 | 0.28 | 0.28 | 0.25 ↓ | 0.30 ↓ | 0.17 ↓ | 0.63 ↑ |
| Beta Spruce | Soil | 0.38 | 0.44 | 0.33 | 0.48 | 0.39 ↓ | 0.09 ↓↓ | 0.58 ↑ |
| Gamma Willow | Wetland | 0.31 | 0.38 | 0.37 | 0.48 | 0.32 ↓ | 0.05 ↓↓ | 0.59 ↑ |

All 3 originals survive with distinct adaptations. Shannon diversity remains high. Longevity drifts up on all terrains. Water storage collapses on soil/wetland but partially retained on hill. Delta Cactus (arid) extinct.

#### 15: Woodiness Evolution (5k ticks, 2 trials)
Tree species (w=0.80) now dominates when ecosystem survives: 93% at tick 5000 with w=0.91. Herb goes extinct early; Shrub persists as 5% minority (w=0.61). Defense drifts upward (0.03→0.20). However, ~50% stochastic extinction risk: trial 1 crashed to 0 at tick 4000 (tree monoculture fragility — no fast-reproducing safety net after bad winter), trial 2 thrived at 2891 plants.

---

## KNOWN ISSUES & PENDING WORK

### URGENT — Broken / needs immediate fix

1. **Seed mass always drifts downward** — sz decreases on all terrains (0.10-0.48). No experiment produces upward seed mass evolution. The establishment delay (5 ticks) doesn't create enough K-selection pressure to make large seeds viable.

### MODERATE — Concerning patterns

2. **Water storage is selected against on non-arid terrain** — wst collapses to 0.03-0.26 on soil, 0.05 on wetland. The 0.04/tick maintenance cost (×2.5 on soil, ×8.0 on wetland) makes it a net negative when water is available via roots. Only retains value on arid terrain (0.79). This is a dead trait for ~70% of the map.

3. **Tree-dominated ecosystems are fragile** — In woodiness evolution (exp 15), tree monocultures have ~50% stochastic extinction risk. Once trees suppress herbs/shrubs, a bad winter can crash the population with no fast-reproducing safety net to recover.

4. **Nutrient cycle low population (exp 11)** — Only 149 plants at tick 1000 on soil terrain. Nutrient-poor early conditions severely limit carrying capacity.

### Observations (not necessarily bugs)

- **Longevity has real selective pressure** — Clear upward drift, especially in long runs. Growth efficiency modifier is the active component; maxAge is irrelevant since starvation kills first. Senescence provides downward pressure at extreme ages.
- **Grass and trees coexist on flat soil** — Maturity-scaled trait maintenance benefits r-strategists (many small seedlings pay less overhead). Grass edges out trees 61% vs 28% but both converge toward mid-woodiness (0.29-0.50). Shannon diversity 0.99 with 18 species.
- **Arid terrain produces correct adaptations** — Water storage strongly selected FOR (0.50→0.79), height collapses, roots maintained. Boom/bust population cycles (100-1270) are ecologically realistic for desert.
- **Defense converges to low values** — In exp 5, both defended and undefended species converge to def=0.16-0.48. Defense is context-dependent, not universally bad.
- **Terrain isolation drives diversity** — Exp 12 (20 species) and exp 13 (20 species) have the highest speciation counts. Physical separation promotes niche differentiation.
- **Hill speciation is highest per-terrain** — Exp 6 produces 18 species in 1k ticks on hill terrain alone.

### Experiments to re-run after any major mechanic change
Most experiments are STALE — maturity-scaled trait maintenance and raised herb maxAge affect all scenarios. Priority re-runs:
- #1 Monoculture Baseline (re-run done: 6379 pop, healthy)
- #4 Seed Tradeoff (seed mass health)
- #7 Arid Specialist (arid viability — re-run done: 5592 pop, healthy)
- #10 Grass vs Trees (re-run done: grass 61%, coexistence)
- #12 Terrain Isolated (terrain differentiation health)
- #14 Seed Bank (seed dynamics health)
- #15 Woodiness Evolution (woodiness/longevity interaction)

### New experiments needed
- **Longevity Tradeoff** — Low-longevity (0.2) vs high-longevity (0.8) on flat soil, identical genomes otherwise. Core r/K test.
- **Longevity × Terrain** — Same species (lon=0.5) on isolated terrains. Track longevity evolution per biome.
- **Longevity × Woodiness** — Herbaceous perennial vs woody annual vs natural combos. Verify traits are genuinely independent.

---

## TODO — Fundamental Missing Mechanics

### 1. Fix Broken Trait Tradeoffs (highest priority)

Several genome traits drift in one direction regardless of environment, preventing evolutionary diversity. Each needs a specific counter-pressure.

**longevity (always up)** — Senescence implemented (onset at 30% maxAge, 4× maintenance at maxAge, plus 0.08/tick longevity maintenance scaled by maturity). Drift is partially checked but still trends upward in long runs. May need stronger senescence or earlier onset.

**seedSize (always down)** — Add competitive establishment mortality. During establishment, seedlings in cells with tall neighbors face survival pressure: `survivalChance = seedSizeVigor / (seedSizeVigor + neighborShade)`. In open ground (post-fire, gaps): shade ≈ 0, all seeds survive, small seeds win via quantity. In established vegetation: shade is high, only large vigorous seedlings survive. This is exactly how r/K selection works — r-strategists dominate disturbed ground, K-strategists dominate stable communities.

### 2. Add Facilitation (currently all plant interactions are negative)

Every plant-plant interaction is competitive (shade, water stealing). Real ecosystems depend on facilitation for species coexistence.

**Shelter from shade** — When a tall neighbor shades you, also compute a shelter benefit (humidity, wind protection). Store a per-cell `shelterLevel` (0-1) computed during the existing neighbor scan in phaseCalculateLight. Shelter reduces leaf maintenance: `leafMaint *= (1 - shelterLevel × 0.3)`. This converts shade from pure negative into a tradeoff: less light but less water stress. Whether net positive or negative depends on genome — creates the understory niche. Also produces nurse-plant dynamics (desert shrubs sheltering cactus seedlings).

**Litter mulch on death** — Dead plants leave a `mulch` value on the cell that decays over 30-50 ticks. Mulch reduces water evaporation during drought: `evaporation *= 1 / (1 + mulch)`. Pioneer species die, their litter makes the ground more hospitable for the next generation. Succession emerges naturally.

### 3. Climate Zones (spatial climate variation)

The entire 80×80 grid experiences identical seasons. No spatial variation in seasonality, winter severity, or growing season length. This is like simulating the whole planet at one latitude.

Add 2-3 climate zones (e.g. Temperate, Tropical, Mediterranean) as a per-cell property that modifies seasonal multipliers:
- **Tropical**: Mild winter (leafMaint 1.2× not 3×), no growth shutdown, year-round reproduction, higher base rainfall.
- **Mediterranean**: Inverted wet/dry — wet winters, dry summers. Summer drought replaces winter cold as the stress period.
- **Temperate**: Current behavior (default).

Climate × terrain creates a niche matrix: Tropical+Wetland = mangrove swamp, Mediterranean+Hill = maquis/chaparral, Temperate+Soil = deciduous forest. This multiplies 4 terrain niches into 12+ without adding terrain types. Implementation: per-cell climateZone enum, different season target tables per zone (the seasonal system already handles interpolation).
