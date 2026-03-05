# Overgreen Simulation — Analysis & Test Reference

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
                      photosynthesize       move & breed       age>=max?       best-energy wins      return water
                      pay maintenance       metabolize                                               return nutrients
                      grow + seed                                                                    free cell
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
  waterNeeded = effectiveLeaf × 0.55
  waterCanAbsorb = rootDepth × 0.4
  waterAbsorbed = min(needed, canAbsorb, cellWater)
  waterFraction = waterAbsorbed / waterNeeded   (0-1, scales photosynthesis)
```

### Maintenance:
```
  cost = base + height×perHeight + rootDepth×perRoot + effectiveLeaf×perLeaf
       + allelopathy×0.06 + defense×0.05
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

### Seed fitness weights:
```
  ┌──────────┬───────┬────────┬──────┐
  │ Terrain  │ Root  │ Height │ Leaf │
  ├──────────┼───────┼────────┼──────┤
  │ Hill     │ -0.8  │ -0.5   │ +0.3 │
  │ Wetland  │ -0.8  │ +0.25  │ +0.4 │
  │ Arid     │ +0.6  │ -0.4   │ -0.8 │
  └──────────┴───────┴────────┴──────┘
  fitness = 1.0 + (root×wR + height×wH + leaf×wL), capped [0, 2.0]
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

Woodiness is a continuous genome trait (0.01-0.99) that replaces the old binary tree/grass archetype. All plant constants are linearly interpolated between herbaceous (w=0) and woody (w=1) endpoints via `getPlantConstants(woodiness)`.

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
  │ Growth efficiency   │ 0.5          │ 0.3          │
  │ Max age             │ 750          │ 2500         │
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
- **Low woodiness (herbaceous):** Cheap maintenance, fast growth (0.5 eff), cheap seeds (0.4), wider base seed range, but low caps (h=2, r=3), negligible shading, short lifespan (750)
- **High woodiness (woody):** Tall (h=10), deep roots (r=10), strong shading (+0.25), long-lived (2500), but expensive maintenance, expensive seeds (0.8), slow growth (0.3 eff)
- **Mid woodiness (shrub):** Intermediate everything — moderate caps, costs, and advantages

### Key design questions:
1. Does woodiness evolve differently per terrain?
2. Do populations naturally spread across the woodiness spectrum or converge?
3. Does the continuous spectrum produce richer ecology than the binary archetype?

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

- **Drought:** Summer, local radius, reduces recharge + evaporates 0.3/tick
- **Fire:** Summer, spreads via low-water high-leaf cells, kills instantly, rivers block
- **Disease:** Targets genetic uniformity >50% — the monoculture punisher

---

## 11. ALLELOPATHY & DEFENSE

**Allelopathy:** damage = strength × 0.15/neighbor/tick, cost = 0.06/tick. Strong in dense areas, self-defeating (kills neighbors → removes benefit).

**Defense:** Reduces grazing by up to 70%, cost = 0.05/tick. Value depends entirely on herbivore pressure.

---

## 12. SEED BANK

Seeds land as dormant objects, germinate when cell water exceeds threshold (interpolated by woodiness: 1.5-2.0). Seeds decay at 0.01 energy/tick with max age 150-200 ticks. Best-energy seed wins per cell. Creates boom/bust dynamics on harsh terrain.

---

## MECHANICS RANKED BY IMPACT

```
  CRITICAL:
    1. Energy budget (photosynthesis vs maintenance)
    2. Growth allocation / genome priorities
    3. Water absorption & limitation
    4. Woodiness spectrum (determines ALL plant constants)

  SIGNIFICANT:
    5. Terrain maintenance multipliers
    6. Light & shadow competition
    7. Seasons (winter lethality)
    8. Reproduction / seedInvestment tradeoff
    9. Terrain seed fitness

  MODERATE:
   10. Nutrient cycling
   11. Climate eras & disasters
   12. Seed bank dynamics

  UNCERTAIN:
   13. Allelopathy — situational
   14. Defense — depends on herbivore pressure
   15. Root competition — 6% drain seems weak
```

---

## TEST SCENARIOS

### Validated (pre-woodiness, results still informative but may need re-running):

| # | Scenario | What it tested | Key finding |
|---|----------|---------------|-------------|
| 1 | Monoculture Baseline | Carrying capacity, seasons | Winter was lethal → fixed with energy-based leaf drop + increased max ages |
| 2 | Water Competition | Root depth vs leaf size | Leaf wins on well-watered soil (67/33%), water stress only 1-14% |
| 3 | Light Competition | Height vs spread | Tall wins (70/30%) via shading. Stable coexistence |
| 4 | Seed Tradeoff | seedInvestment optimization | Optimal ~0.65 on flat soil. Too little reproduction is fatal |
| 5 | Allelopathy Duel | Chemical warfare value | Near-even (52/48%). Trait evolving away — marginal on well-watered soil |
| 6 | Defense vs Herbivores | Defense gene value | Defense wins marginally (63/37%) when energy surplus absorbs the cost |
| 7 | Hill Specialist | Terrain adaptation | Root specialist dominates (69%). Height specialist survived by evolving roots |
| 8 | Arid Specialist | Water stress adaptation | Root specialist wins 97%. Matches real desert ecology |
| 9 | Wetland Specialist | Terrain adaptation | Leaf specialist dominates (76%). Height coexists at 24% |
| 10 | Grass vs Trees | Archetype competition | **OBSOLETE — binary archetypes removed** |
| 11 | Nutrient Cycle | Decomposition enrichment | Healthy positive feedback. Root-gated access rewards deep roots |
| 12 | Terrain Isolated | Local adaptation | Full divergence at 35k ticks. Each terrain produced distinct species |
| 13 | Seed Bank | Dormancy & germination | High seed investment dominates on arid. Boom/bust dynamics confirmed |

### New tests needed (woodiness-specific):

| # | Scenario | Tests | Setup |
|---|----------|-------|-------|
| 14 | Woodiness Evolution | Does woodiness naturally diverge on flat soil? Do herbaceous and woody niches emerge? | Flat soil, 3+ species with different starting woodiness (0.2, 0.5, 0.8), identical growth genomes |
| 15 | Woodiness × Terrain | Does each terrain favor a different woodiness level? | 4 terrain bands (hill/soil/wetland/arid) with rock barriers, all species start at woodiness=0.5 |
| 16 | Woodiness Spectrum Coexistence | Can herbaceous and woody plants coexist through niche differentiation? | Flat soil, 2 species: herbaceous (w=0.2) vs woody (w=0.8), balanced growth genomes |
| 17 | Woodiness × Seed Bank | Does woodiness affect seed bank strategy? (different germination thresholds, seed lifespans) | Pure arid, 2 species same growth genome but w=0.2 vs w=0.8 |

### Re-run priority for existing tests:

**High priority** (mechanics fundamentally changed):
- Experiments 7-9 (terrain specialists) — caps/maintenance/shadow now continuous, optimal strategies may shift
- Experiment 12 (terrain isolated) — woodiness should now evolve differently per terrain

**Medium priority** (results likely similar but should verify):
- Experiments 2-4 (water/light/seed) — formulas unchanged but constant values now depend on woodiness
- Experiment 1 (monoculture) — verify basic survival still works with continuous woodiness

**Low priority** (mechanics unchanged):
- Experiments 5-6 (allelopathy/defense) — these genes are independent of woodiness
- Experiment 11 (nutrients) — nutrient mechanics unchanged
- Experiment 13 (seed bank) — seed bank still works, just interpolated thresholds
