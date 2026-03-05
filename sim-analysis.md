# Overgreen Simulation — Analysis & Test Reference

> This file documents the **current state** of the simulation mechanics and their health. It is not a changelog — when mechanics change, update the analysis and re-run experiments. Only keep the latest results.

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

### Observed woodiness evolution by terrain:

| Terrain | Woodiness direction | Reason |
|---------|-------------------|--------|
| Flat soil | ↑ 0.85-0.92 | Resources cover woody costs; height/shadow/longevity pay off |
| Hill | ↓ 0.46-0.71 | Resource-scarce; cheap costs matter more than high ceilings |
| Arid | ↓ 0.20-0.59 | Water-scarce; herbaceous reproduction speed dominates |
| Wetland | ↑ 0.92-0.97 | Abundant water + 1.5× height bonus strongly rewards woodiness |

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

  WEAK:
   13. Allelopathy — passive wins 72/28%, trait evolves away
   14. Defense — undefended wins 65/35%, net negative on flat soil
   15. Root competition — 6% drain is noise
```

---

## TEST SCENARIOS

| # | Scenario | Result | Woodiness evolution |
|---|----------|--------|-------------------|
| 1 | Monoculture Baseline | Single species survives. Pop 3500-4900. | w: 0.22→0.70 ↑ |
| 2 | Water Competition | Leaf wins 64/36%. Shannon 0.65, stable coexistence. | w: 0.80→0.89-0.92 ↑ |
| 3 | Light Competition | Tall wins 71/29%. Shading is decisive advantage. | w: 0.78→0.85-0.89 ↑ |
| 4 | Seed Tradeoff | High seed 74%, mid 26%, low extinct. Optimal seedInvestment ~0.65. | w: 0.78→0.87-0.92 ↑ |
| 5 | Allelopathy Duel | Passive wins 72/28%. Allelopathy evolving away (0.50→0.37). | w: →0.90 ↑ |
| 6 | Defense vs Herbivores | Undefended wins 65/35%. Defense is net negative on flat soil. | w: →0.87-0.89 ↑ |
| 7 | Hill Specialist | Root specialist 91%. Leaf specialist extinct. | w: 0.80→0.46 ↓↓ |
| 8 | Arid Specialist | Leaf-root hybrid 72%. Height specialist extinct. Herbaceous + deep roots = best strategy. | w: 0.80→0.59 ↓ |
| 9 | Wetland Specialist | Leaf 64%, height 32%, root 4%. All 3 survive — best diversity. | w: 0.80→0.93-0.97 ↑↑ |
| 11 | Nutrient Cycle | Leaf fern 100%. Nutrient feedback healthy. Early bottleneck then exponential growth. | w: 0.76→0.86 ↑ |
| 12 | Terrain Isolated | All 4 survive. Shannon 1.29. Starting w=0.5, each terrain drives woodiness differently. | Hill 0.46↓, Soil 0.71↑, Wetland 0.91↑↑ |
| 13 | Seed Bank | High seeder 86%, low seeder 14%. Both survive. Boom/bust dynamics on arid. | w: 0.15→0.22 (stays low) |
| 14 | Woodiness Evolution | All 3 survive (Shannon 0.99). No niche divergence — all converge upward. Shade advantage dominates. | w: 0.20→0.60, 0.50→0.77, 0.80→0.84 |

### Experiment details

#### 7: Hill Specialist
Deep Root Pine evolved w: 0.80→0.46 — dramatic shift toward herbaceous. Cheaper maintenance + faster growth is critical on resource-scarce hills. Root priority dominant (r: 0.64), rising allelopathy (0.18) and defense (0.22).

#### 8: Arid Specialist
Broad Leaf Agave went herbaceous (w: 0.80→0.59) while growing deep roots (r: 0.57) and keeping large leaves (l: 0.49). Cheaper herbaceous costs + deep roots for water = best of both worlds. Mesquite stayed woody (w: 0.76) and lost.

#### 9: Wetland Specialist
All species evolved toward maximum woodiness (0.93-0.97). Wetland's 1.5× height bonus + cheap leaf maintenance + abundant water covers the higher woody costs. Being maximally woody is optimal here.

#### 12: Terrain Isolated (5000 ticks, all start w=0.5)
| Species | Terrain | Root | Height | Leaf | Woodiness |
|---------|---------|------|--------|------|-----------|
| Alpha Fern | Hill | 0.33→0.54 | 0.33→0.28 | 0.34→0.20 | 0.50→0.46 ↓ |
| Beta Spruce | Soil | 0.33→0.42 | 0.33→0.42 | 0.34→0.28 | 0.50→0.71 ↑ |
| Gamma Willow | Wetland | 0.33→0.25 | 0.33→0.46 | 0.34→0.37 | 0.50→0.91 ↑↑ |
| Delta Cactus | Arid | — | — | — | small band (pop not shown separately) |

#### 14: Woodiness Evolution
All 3 species survived but converged upward — no herbaceous niche emerged on flat soil. Herb (w:0.20→0.60) compensated with heavy roots (r:0.63) and leaves (l:0.42) but still lost population share. Shade advantage of higher woodiness dominates on flat soil. Acceptable: trees win open ground, harsher terrains push woodiness down.

### Open tests:

| # | Scenario | Question | Setup |
|---|----------|----------|-------|
| 16 | Woodiness Coexistence | Can w=0.2 vs w=0.8 coexist on flat soil? | Flat soil, 2 species with balanced growth genomes |
| 17 | Woodiness × Seed Bank | Does woodiness affect seed bank strategy on arid? | Pure arid, same growth genome, w=0.2 vs w=0.8 |
