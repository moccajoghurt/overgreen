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
Pending — re-run experiments.

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
Pending — re-run experiments.

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
Pending — re-run experiments.

---

## MECHANICS RANKED BY IMPACT

```
  CRITICAL:
    1. Energy budget (photosynthesis vs maintenance)
    2. Growth allocation / genome priorities
    3. Water absorption & limitation
    4. Woodiness spectrum (determines most plant constants)
    5. Longevity (controls lifespan + growth efficiency modifier)

  SIGNIFICANT:
    6. Terrain maintenance multipliers
    7. Light & shadow competition
    8. Seasons (winter lethality)
    9. Reproduction / seedInvestment tradeoff
   10. Water storage (drought tolerance, seedling provisioning)

  MODERATE:
   11. Seed mass / establishment delay (terrain-dependent seedling survival)
   12. Nutrient cycling
   13. Climate eras & disasters
   14. Seed bank dynamics

  WEAK:
   15. Defense — undefended wins 65/35%, net negative on flat soil
   16. Root competition — 6% drain is noise
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
Pending — run experiments to populate.

---

## TEST SCENARIOS

Pending — re-run all experiments with longevity trait active.

<!--
Previous results (pre-longevity, for reference only):

| # | Scenario | Result | Key trait evolution |
|---|----------|--------|-------------------|
| 1 | Monoculture Baseline | Single species survives. Pop 3300-6400, seasonal oscillation. | w: 0.16→0.28 ↑, wst: 0.33→0.38 stable, sz: 0.46→0.33 ↓ |
| 2 | Water Competition | Leaf wins 64/36%. Shannon 0.65, stable coexistence. | w: 0.80→0.89-0.92 ↑ |
| 3 | Light Competition | Tall wins 71/29%. Shading is decisive advantage. | w: 0.78→0.85-0.89 ↑ |
| 4 | Seed Tradeoff | Birch 64%, Elm 36%, Oak extinct. Stable coexistence. | w: 0.82 stable, wst: 0.30→0.34 stable, sz: 0.52→0.46 slight ↓ |
| 5 | Defense vs Herbivores | Undefended wins 65/35%. Defense is net negative on flat soil. | w: →0.87-0.89 ↑ |
| 6 | Hill Specialist | Root specialist 91%. Leaf specialist extinct. | w: 0.80→0.46 ↓↓ |
| 7 | Arid Specialist | Mesquite 71%, Agave 29%. Deep roots + large tank + many small seeds. Dry spells cause dramatic boom/bust. | w: 0.81→0.08-0.10 ↓↓, wst: 0.30→0.53-0.63 ↑↑↑, sz: 0.50→0.22-0.26 ↓ |
| 8 | Wetland Specialist | Leaf 64%, height 32%, root 4%. All 3 survive — best diversity. | w: 0.80→0.93-0.97 ↑↑ |
| 9 | Nutrient Cycle | Leaf fern 100%. Nutrient feedback healthy. Early bottleneck then exponential growth. | w: 0.76→0.86 ↑ |
| 10 | Terrain Isolated | All 4 survive. Shannon 1.36. Strong trait divergence by terrain. wst diverges: arid 0.37-0.40, others ~0.35. | See detail below |
| 11 | Seed Bank | High seeder 88%, sedge 12%. Pop oscillates 800-5600 seasonally on arid. | w: 0.12→0.04, wst: 0.38→0.37 stable, sz: 0.45→0.29 ↓ |
| 12 | Woodiness Evolution | All 3 survive (Shannon 0.99). No niche divergence — all converge upward. Shade advantage dominates. | w: 0.20→0.60, 0.50→0.77, 0.80→0.84 |
| 13 | Woodiness × Seed Bank | Herb 97%, woody collapsed to 3%. Woody species evolved down to w=0.22 to survive. | w: 0.20→0.21 (stable), 0.80→0.22 ↓↓↓ |

### Experiment details

#### 7: Arid Specialist
Deep Root Mesquite dominates (71%) with succulent strategy: deep roots (r: 0.48), large water tank (wst: 0.63), low woodiness (w: 0.10), many small seeds (sz: 0.26). Arid dry spells (terrain-wide zero-recharge, 15-35 ticks) create dramatic boom/bust cycles — population swings from 5676 to 350 and back. Water storage with transpiration reduction is the primary drought adaptation: full tanks reduce water demand by up to 30%, enabling photosynthesis during dry spells. The transpiration benefit only activates when the tank has water, making it an arid-specific advantage (other terrains rarely fill tanks). Seed mass drifts down — r-strategy dominates when waterStorage provides seedling survival via tank provisioning.

#### 10: Terrain Isolated (5000 ticks, all start w=0.5, sz=0.5, wst=0.3)
| Species | Terrain | Root | Height | Leaf | Woodiness | Seed Mass | Water Storage |
|---------|---------|------|--------|------|-----------|-----------|---------------|
| Alpha Fern | Hill | 0.50 | 0.32 | 0.22 | 0.04 ↓↓ | 0.14 ↓↓ | 0.35 stable |
| Beta Spruce | Soil | 0.30 | 0.47 | 0.31 | 0.48 ↓ | 0.42 ↓ | 0.36 stable |
| Gamma Willow | Wetland | 0.20 | 0.45 | 0.44 | 0.70 ↑↑ | 0.67 ↑↑ | 0.35 stable |
| Delta Cactus | Arid | — | — | — | ↓↓ | ↓↓ | 0.37-0.40 ↑ |

Water storage now differentiates by terrain: neutral drift on hill/soil/wetland (~0.35), mild upward on arid (0.37-0.40). The small arid zone (640 cells, 8 rows) limits selective pressure — pure arid experiments show much stronger wst evolution (0.53-0.63). Seed mass diverges: up on wetland (large-seeded tree strategy), down on hill/arid (many cheap seeds).

#### 11: Seed Bank
On all-arid terrain, Seedbank Grass dominates with ultra-herbaceous strategy (w→0.04). Water storage holds steady at 0.37. High seed investment (0.75) + small seeds (0.29) = maximum reproductive throughput. Broad leaves (0.58) maximize photosynthesis during brief wet windows.
-->

---

## KNOWN ISSUES & PENDING WORK

### Observations (not necessarily bugs)
- **Arid dry spells cause dramatic population crashes**: Pop can swing from 5000+ to 350 in a single dry spell. This is ecologically realistic (desert boom/bust) but may look alarming in the UI.
- **Speciation distance is 9-dimensional**: Genome has 9 traits (rootPriority, heightPriority, leafSize, seedInvestment, seedSize, defense, woodiness, waterStorage, longevity). Threshold is 1.2 — may need adjustment if speciation is too aggressive.

### Experiments to re-run after any major mechanic change
- #1 Monoculture Baseline (sanity check)
- #4 Seed Tradeoff (seed mass health)
- #7 Arid Specialist (drought adaptation health)
- #10 Terrain Isolated (terrain differentiation health)
- #11 Seed Bank (arid seed dynamics health)
- #12 Woodiness Evolution (woodiness/longevity interaction)

### New experiments needed
- **Longevity Tradeoff** — Low-longevity (0.2) vs high-longevity (0.8) on flat soil, identical genomes otherwise. Core r/K test.
- **Longevity × Terrain** — Same species (lon=0.5) on isolated terrains. Track longevity evolution per biome. Does arid select annuals? Does wetland select perennials?
- **Longevity × Woodiness** — Herbaceous perennial (low w, high lon) vs woody annual (high w, low lon) vs natural combos. Verify traits are genuinely independent.
