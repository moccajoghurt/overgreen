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

### All experiments re-validated with woodiness gene (3000-5000 ticks):

#### Experiment 1: Monoculture Baseline
Single species survives fine. Woodiness drifted up steadily: **w: 0.22→0.70** — on well-watered flat soil, higher woodiness pays off (bigger caps, better shading, longer lifespan). Population healthy at 3500-4900.

**vs pre-woodiness:** Same outcome (survival confirmed). New finding: woodiness naturally increases on resource-rich soil.

#### Experiment 2: Water Competition
**Winner:** Broad Leaf Fern 64%, Deep Root Fern 36%. Shannon 0.65 — stable coexistence. Both evolved toward higher woodiness (0.80→0.89-0.92). Both converged on balanced genomes.

**vs pre-woodiness:** Consistent (was 67/33%). Leaf strategy still wins on well-watered soil.

#### Experiment 3: Light Competition
**Winner:** Tall Pine 71%, Spread Fern 29%. Shannon 0.61. Both trend toward higher woodiness (0.78→0.85-0.89). Spread Fern converging toward Tall Pine's strategy (h: 0.26→0.38).

**vs pre-woodiness:** Nearly identical (was 70/30%). Shading remains the decisive advantage.

#### Experiment 4: Seed Tradeoff
**Winner:** High Seed Birch 74%, Mid Seed Elm 26%, Low Seed Oak extinct. Both survivors converge to seedInvestment ~0.64-0.66. Both evolved higher woodiness (0.78→0.87-0.92).

**vs pre-woodiness:** Consistent (was 67/33%). Optimal seed investment ~0.65 confirmed.

#### Experiment 5: Allelopathy Duel
**Winner:** Peaceful Maple 72%, Toxic Walnut 28%. Allelopathy evolving away (0.50→0.37). Both converge on high woodiness (~0.90). **Shifted from near-even to passive winning decisively.**

**vs pre-woodiness:** Was 52/48%. Allelopathy even less effective now — higher woodiness means more energy surplus to absorb chemical damage.

#### Experiment 6: Defense vs Herbivores
**Winner:** Soft Willow 65%, Thorny Holly 35%. Defense holding at 0.42 for Holly but Willow wins via faster reproduction. Both evolve toward woodiness 0.87-0.89. **Winner flipped.**

**vs pre-woodiness:** Was Holly 63/37%. Defense is now a net negative on flat soil — higher woodiness provides enough energy surplus that herbivore damage is absorbed without defense investment.

#### Experiment 10: Grass vs Trees
**OBSOLETE — binary archetypes removed.**

#### Experiment 7: Hill Specialist
**Winner:** Deep Root Pine 91%, Tall Spruce 9%. Broad Leaf Holly extinct by ~tick 1000.

Woodiness is the new story: Deep Root Pine evolved **w: 0.80→0.46** — dramatic shift toward herbaceous. Lower woodiness = cheaper maintenance + faster growth, critical on resource-scarce hills. Tall Spruce also declined (w: 0.80→0.63). Root priority remained dominant (r: 0.64), with rising allelopathy (0.18) and defense (0.22).

**vs pre-woodiness:** Same winner (root specialist). New finding: hills strongly select for lower woodiness.

#### Experiment 8: Arid Specialist
**Winner:** Broad Leaf Agave 72%, Deep Root Mesquite 28%. Tall Saguaro extinct by ~tick 1250. **Result flipped from pre-woodiness** (was Mesquite 97%).

Agave evolved herbaceous (w: 0.80→0.59) while growing deep roots (r: 0.57) and keeping large leaves (l: 0.49) — a strategy impossible under the old binary archetype. Cheaper herbaceous costs + deep roots for water = best of both worlds. Mesquite stayed woody (w: 0.76), relying on height/shading but at higher cost.

**vs pre-woodiness:** Winner flipped. Continuous woodiness opened a new "herbaceous deep-root" strategy that outcompetes the old woody root specialist.

#### Experiment 9: Wetland Specialist
**Winner:** Broad Leaf Lotus 64%, Tall Mangrove 32%, Deep Root Cypress 4%. All 3 species survive — best diversity.

All species evolved **toward higher woodiness**: Lotus 0.80→0.93, Mangrove 0.80→0.93, Cypress 0.80→0.97. Wetland's 1.5× height bonus + cheap leaf maintenance + abundant water covers the higher woody maintenance costs. Being maximally woody is the optimal strategy here.

**vs pre-woodiness:** Similar winner order (leaf > height > root). New finding: wetland strongly selects for maximum woodiness.

#### Experiment 11: Nutrient Cycle
**Winner:** Shallow Leaf Fern 100%, Deep Root Oak extinct by ~tick 2000. Leaf Fern evolved upward in woodiness (0.76→0.86) and gained roots organically (0.15→0.40). Nutrient feedback loop still healthy — early bottleneck (pop 30 at tick 500) then exponential growth to 4594.

**vs pre-woodiness:** Consistent (was 86/14%). Same winner, same nutrient dynamics.

#### Experiment 12: Terrain Isolated (5000 ticks)
**All 4 species survive.** Shannon diversity 1.26.

Woodiness diverged by terrain — the key result:

| Species | Terrain | Root | Height | Leaf | Woodiness | Direction |
|---------|---------|------|--------|------|-----------|-----------|
| Alpha Fern | Hill | 0.33→0.57 | 0.33→0.20 | 0.34→0.15 | 0.80→**0.71** | ↓ less woody |
| Beta Spruce | Soil | 0.33→0.33 | 0.33→0.39 | 0.34→0.26 | 0.80→**0.85** | ↑ more woody |
| Gamma Willow | Wetland | 0.33→0.27 | 0.33→0.46 | 0.34→0.43 | 0.80→**0.92** | ↑↑ most woody |
| Delta Cactus | Arid | — | — | — | — | small band (~200 pop) |

Each terrain drives woodiness in a different direction: Hill → less woody (cheap costs), Soil → moderate woody, Wetland → highly woody (height bonus payoff). Growth trait evolution matches previous results. Confirms woodiness adds meaningful terrain-specific adaptation without breaking existing differentiation.

#### Experiment 13: Seed Bank Resilience
**Winner:** Seedbank Grass 86%, Holdfast Sedge 14% — both survive (was 100% vs extinction). Both stay very herbaceous (w: 0.15→0.22) — on arid terrain, low woodiness is optimal. Boom/bust dynamics confirmed. Both evolved deep roots (0.58-0.59) for arid groundwater.

**vs pre-woodiness:** Similar but Sedge now survives. Seed bank mechanics unchanged.

### Woodiness evolution summary across all experiments:

| Terrain | Woodiness direction | Reason |
|---------|-------------------|--------|
| Flat soil | ↑ 0.85-0.92 | Resources cover woody costs; height/shadow/longevity pay off |
| Hill | ↓ 0.46-0.71 | Resource-scarce; cheap costs matter more than high ceilings |
| Arid | ↓ 0.20-0.59 | Water-scarce; herbaceous reproduction speed dominates |
| Wetland | ↑ 0.92-0.97 | Abundant water + 1.5× height bonus strongly rewards woodiness |

### New tests needed (woodiness-specific):

| # | Scenario | Tests | Setup |
|---|----------|-------|-------|
| 14 | Woodiness Evolution | Does woodiness naturally diverge on flat soil? Do herbaceous and woody niches emerge? | Flat soil, 3+ species with different starting woodiness (0.2, 0.5, 0.8), identical growth genomes |
| 15 | Woodiness × Terrain | Does each terrain favor a different woodiness level? | 4 terrain bands (hill/soil/wetland/arid) with rock barriers, all species start at woodiness=0.5 |
| 16 | Woodiness Spectrum Coexistence | Can herbaceous and woody plants coexist through niche differentiation? | Flat soil, 2 species: herbaceous (w=0.2) vs woody (w=0.8), balanced growth genomes |
| 17 | Woodiness × Seed Bank | Does woodiness affect seed bank strategy? (different germination thresholds, seed lifespans) | Pure arid, 2 species same growth genome but w=0.2 vs w=0.8 |
