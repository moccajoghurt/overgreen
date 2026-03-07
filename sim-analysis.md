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
  cost = base + height×perHeight + rootDepth×perRoot + effectiveLeaf×perLeaf
       + defense×0.05 + waterStorage×0.015
  (terrain multipliers applied per-trait, see Section 5)
```

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
  │ Arid     │ 0.2      │ deep water table  │
  └──────────┴──────────┴───────────────────┘

  Groundwater: roots below water table depth access saturated zone.
  Water tables: Soil 4.0, Hill 5.0, Wetland 0.5, Arid 5.0
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
  │ Arid     │ 0.8   │ 1.2    │ 3.0  │
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
  │ Max age             │ lerpVal(120, 2500, lon)      │  driven by longevity (Section 15)
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
| Soil | → 0.21-0.54 | Varies widely; mid-woodiness often dominates |
| Hill | ↓ 0.17-0.51 | Cheap maintenance favored; some woody holdouts |
| Arid | ↓↓ 0.17 | Herbaceous strategy dominates |
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
  │ Winter  │ 0.60  │ 0.50  │  3.0     │ 0.00   │ 0.0  │
  └─────────┴───────┴───────┴──────────┴────────┴──────┘

  Winter: light halved, leaf maintenance 3x → triggers energy-based leaf drop,
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
| Arid | ↑ 0.38 | Retained on arid terrain; tank actually useful |
| Wetland | ↓↓ 0.05 | Water abundant; tank completely unnecessary |
| Mixed | ↓↓ 0.05-0.15 | Collapses on most terrain types |

Water storage is heavily selected against on all non-arid terrains. On arid terrain it provides genuine value (0.38 in woodiness×seedbank). The 0.015/tick maintenance cost makes it expensive to maintain unused capacity on water-rich terrain.

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
    6. Light & shadow competition
    7. Seasons (winter lethality)
    8. Reproduction / seedInvestment (always selected upward — tradeoff broken)
    9. Longevity — growth efficiency modifier has clear selective pressure (upward drift in 14/15 experiments).
       maxAge component is irrelevant (starvation kills before age does).

  MODERATE:
   10. Climate eras & disasters
   11. Seed bank dynamics

  WEAK / BROKEN:
   12. Water storage — selected against on non-arid terrain. Dead trait for ~70% of map.
   13. Seed mass — always drifts down. No upward selection pressure exists.
   14. Defense — context-dependent; converges to low values.
   15. Root competition — 6% drain is noise.
```

---

## 15. LONGEVITY (longevity genome)

Longevity (0.01-0.99) creates the r/K selection tradeoff: live fast and grow fast, or live long and grow slow. Lifespan is independent of woodiness — an herbaceous perennial or a woody annual are both viable strategies.

### Mechanics:
```
  maxAge = lerpVal(120, 2500, lon)
    lon=0.01: ~120 ticks (annual — lives ~1 season)
    lon=0.50: ~1310 ticks (mid-lived)
    lon=0.99: ~2500 ticks (perennial — lives 5 years)

  growthEfficiency modifier = (1.3 - lon × 0.6)
    lon=0.01: 1.3× base efficiency (fast grower)
    lon=0.50: 1.0× base efficiency (neutral)
    lon=0.99: 0.7× base efficiency (slow grower)

  Base efficiency still comes from woodiness (herb=0.5, woody=0.3).
  Final growthEfficiency = lerpVal(0.5, 0.3, w) × (1.3 - lon × 0.6)

  Examples:
    Herbaceous annual  (w=0.1, lon=0.1): 0.48 × 1.24 = 0.60 eff, maxAge ~358
    Herbaceous perennial (w=0.1, lon=0.8): 0.48 × 0.82 = 0.39 eff, maxAge ~2024
    Woody annual (w=0.9, lon=0.1): 0.32 × 1.24 = 0.40 eff, maxAge ~358
    Woody perennial (w=0.9, lon=0.8): 0.32 × 0.82 = 0.26 eff, maxAge ~2024
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

Longevity drifts upward in most environments, especially in long (5000-tick) runs. The growth efficiency penalty (0.7× at lon=0.99) is too weak to counterbalance the reproductive advantage of living longer. Plants die of starvation before reaching maxAge in all experiments, so the maxAge component has near-zero selective effect — the growth efficiency modifier is the only part of longevity with real impact.

---

## TEST SCENARIOS

Experiments run at 1000 ticks (short) or 5000 ticks (long-term dynamics), snapshot every 250 ticks.

| # | Scenario | Ticks | Pop | Spp | Result | Key trait evolution |
|---|----------|-------|-----|-----|--------|-------------------|
| 1 | Monoculture | 1k | 5468 | 7 | Baseline Fern 95%. | w: 0.21, SI: 0.63, lon: 0.56 ↑, wst: 0.26 ↓, sz: 0.39 ↓ |
| 2 | Water Comp | 1k | 786 | 9 | Broad Leaf Fern 77%, Deep Root 14%. | w: 0.54 ↓, lon: 0.45-0.47, SI: 0.66-0.69 ↑, wst: 0.21-0.28 ↓ |
| 3 | Light Comp | 1k | 136 | 3 | Spread Fern 60%, Tall Pine 36%. Low pop. | w: 0.76-0.84, lon: 0.46-0.52, wst: 0.19-0.25 ↓, sz: 0.38-0.40 ↓ |
| 4 | Seed Tradeoff | 1k | 1665 | 13 | Birch 61%, Elm 37%. Low Seed extinct. | lon: 0.63-0.67 ↑↑, SI: 0.67-0.69 ↑, w: 0.60-0.77, wst: 0.27-0.28 ↓ |
| 5 | Defense | 1k | 2679 | 10 | Soft Willow 48%, Thorny Holly 35%. | def converges: Holly 0.48 ↑, Willow 0.16 ↑. lon: 0.40-0.50, wst: 0.18-0.34 |
| 6 | Hill | 1k | 2008 | 18 | Tall Spruce 27%, Broad Leaf Holly 25%, Deep Root Pine 24%. | w: 0.17-0.73, lon: 0.42-0.50, wst: 0.29-0.41, high speciation |
| 7 | Arid | 1k | 0 | 0 | **Total extinction** by tick 250. | N/A — all plants starve before reproducing |
| 8 | Shrub Gallery | 1k | 4263 | 21 | Berry Bush 65%, Heavy Turfgrass 13%. | lon: 0.52-0.58, SI: 0.56 ↑, def: 0.14-0.76, high speciation |
| 9 | Succulent Gallery | 1k | 3390 | 18 | Normal Tree 31%, Desert Rose 21%, Jade Tree 17%. | lon: 0.50-0.57, wst: 0.26-0.55, def: 0.14-0.40, diverse |
| 10 | Grass vs Trees | 5k | 6373 | 11 | Prairie Grass 56%, Oak 35%. Grass wins. | lon: 0.62-0.68 ↑↑, SI: 0.65-0.69 ↑, w: 0.28-0.50 (oak collapses), wst: 0.04-0.05 ↓↓ |
| 11 | Nutrient Cycle | 1k | 149 | 4 | Deep Root Oak 74%, Shallow Fern 21%. Low pop. | lon: 0.47-0.50, SI: 0.50-0.62 ↑, niche differentiation preserved |
| 12 | Terrain Isolated | 5k | 3588 | 20 | Beta Spruce 34%, Gamma Willow 32%, Alpha Fern 23%. | lon: 0.58-0.63 ↑↑, wst: 0.05-0.17 ↓↓, sz: 0.30-0.39 ↓, SI: 0.63-0.69 ↑ |
| 13 | Terrain Mosaic | 5k | 5783 | 20 | Feathery Turfgrass 40%, Gamma Willow 22%, Alpha Fern 21%. | lon: 0.46-0.70 ↑↑, def: 0.03-0.21 ↑, wst: 0.05-0.15 ↓↓, SI: 0.59-0.70 ↑ |
| 14 | Seed Bank | 1k | 4953 | 6 | Seedbank Grass 97%. | lon: 0.52-0.61 ↑, SI: 0.67-0.73 ↑, wst: 0.42-0.54, w: 0.15-0.23 |
| 15 | Woodiness Evo | 5k | 4283 | 5 | Herb 70%, Shrub 30%. Tree extinct. | lon: 0.57-0.62 ↑↑, wst: 0.03 ↓↓↓, sz: 0.26 ↓↓, w: 0.28-0.45 (converge mid) |
| 16 | Woodiness×Seed | 1k | 2862 | 4 | Arid Herb 97%. Tree extinct. | lon: 0.46-0.51, SI: 0.63-0.69 ↑, wst: 0.38 ↑ (arid), w: 0.17-0.46 |

### Experiment details

#### 7: Arid Specialist
Total extinction. All 87 plants die of starvation within 250 ticks. The arid-only terrain (0.2 recharge, -0.5 vigor dampening) is too harsh for any strategy to establish. No seeds germinate after the initial wave dies. This is a broken scenario — arid terrain is uninhabitable without adjacent water sources or much higher initial seed energy.

#### 10: Grass vs Trees (5k ticks)
Prairie Grass (w=0.1, lon=0.3) dominates Oak (w=0.9, lon=0.8) at 56/35% but Oak survives as a minority. Both species' longevity converges upward (Grass 0.31→0.68, Oak 0.82→0.62). Oak woodiness collapses from 0.87→0.50. Water storage collapses to 0.04-0.05 in both. Grass's cheap maintenance and fast reproduction outpace tree shading advantage.

#### 11: Nutrient Cycle (1k ticks)
Low population (149 plants) with clear niche differentiation: Deep Root Oak (high root, low leaf) vs Shallow Leaf Fern (low root, high leaf). Both strategies coexist stably. Population is resource-limited, not competition-limited.

#### 12: Terrain Isolated (5k ticks, all start w=0.5, sz=0.5, wst=0.3, lon=0.5)
| Species | Terrain | Root | Height | Leaf | Wood | Seed Mass | Water Stor | Longevity |
|---------|---------|------|--------|------|------|-----------|------------|-----------|
| Alpha Fern | Hill | 0.55 | 0.28 | 0.28 | 0.25 ↓ | 0.30 ↓ | 0.17 ↓ | 0.63 ↑ |
| Beta Spruce | Soil | 0.38 | 0.44 | 0.33 | 0.48 | 0.39 ↓ | 0.09 ↓↓ | 0.58 ↑ |
| Gamma Willow | Wetland | 0.31 | 0.38 | 0.37 | 0.48 | 0.32 ↓ | 0.05 ↓↓ | 0.59 ↑ |

All 3 originals survive with distinct adaptations. Shannon diversity remains high. Longevity drifts up on all terrains. Water storage collapses on soil/wetland but partially retained on hill. Delta Cactus (arid) extinct.

#### 15: Woodiness Evolution (5k ticks)
Tree species (w=0.80) goes fully extinct. Herb (70%) and Shrub (30%) coexist. Both converge toward mid-woodiness (Herb 0.22→0.28, Shrub 0.50→0.45). Water storage collapses to 0.03. Seed size drops to 0.26. Longevity drifts upward (Herb 0.43→0.62, Shrub 0.50→0.57). Rare outlier species reach extreme longevity (0.85-0.95).

---

## KNOWN ISSUES & PENDING WORK

### URGENT — Broken / needs immediate fix

1. **Arid terrain is uninhabitable** — Total extinction in arid-specialist experiment. All plants starve within 250 ticks. The 0.2 recharge + -0.5 vigor dampening + 3.0× leaf maintenance is too harsh for any strategy to establish. Arid cells only support plants when adjacent to water sources (river seepage) or in mixed-terrain scenarios where non-arid neighbors provide a population reservoir.

2. **Seed mass always drifts downward** — sz decreases on all terrains (0.26-0.48). No experiment produces upward seed mass evolution. The establishment delay (5 ticks) doesn't create enough K-selection pressure to make large seeds viable.

3. **Longevity only drifts upward** — lon increases in 14/15 surviving experiments (0.43→0.57-0.68). The growth efficiency penalty (0.7× at lon=0.99) is too weak to counterbalance the advantage of living longer. maxAge has near-zero selective effect since starvation kills before age does.

### MODERATE — Concerning patterns

4. **Water storage is selected against on non-arid terrain** — wst collapses to 0.03-0.26 on soil, 0.05 on wetland. The 0.015/tick maintenance cost makes it a net negative when water is available via roots. Only retains value on arid terrain (0.38). This is a dead trait for ~70% of the map.

5. **Trees lose to grass on flat soil (exp 10)** — Prairie Grass dominates Oak 56/35% with woodiness collapsing (0.87→0.50). Trees should shade out grass via height, but expensive woody maintenance prevents establishment advantage.

6. **Tree extinction in woodiness evolution (exp 15)** — Tree species (w=0.80) goes fully extinct by 5000 ticks. Herb and Shrub coexist. High woodiness is not viable long-term on flat soil without terrain features that reward height.

7. **Nutrient cycle low population (exp 11)** — Only 149 plants at tick 1000 on soil terrain. Nutrient-poor early conditions severely limit carrying capacity.

### Observations (not necessarily bugs)

- **Longevity has real selective pressure** — Clear upward drift, especially in long runs. Growth efficiency modifier is the active component; maxAge is irrelevant since starvation kills first.
- **Defense converges to low values** — In exp 5, both defended and undefended species converge to def=0.16-0.48. Defense is context-dependent, not universally bad.
- **Terrain isolation drives diversity** — Exp 12 (20 species) and exp 13 (20 species) have the highest speciation counts. Physical separation promotes niche differentiation.
- **Hill speciation is highest per-terrain** — Exp 6 produces 18 species in 1k ticks on hill terrain alone.

### Experiments to re-run after any major mechanic change
- #1 Monoculture Baseline (sanity check)
- #4 Seed Tradeoff (seed mass health)
- #7 Arid Specialist (arid viability)
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

**longevity (always up)** — Add senescence. Maintenance cost scales up quadratically with age as a fraction of maxAge: `senescence = 1 + (age/maxAge)² × 0.5`. Young long-lived plants are efficient; old ones become increasingly expensive. Short-lived plants never hit the expensive years. Creates a real r/K tradeoff: short-lived = cheap but brief, long-lived = slow start but extended reproduction IF you can afford escalating maintenance.

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
