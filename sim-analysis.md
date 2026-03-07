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
| Soil | ↑ 0.18-0.88 | Height/shadow advantage on resource-rich terrain; varies by experiment |
| Hill | ↓↓ 0.03 | Ultra-herbaceous wins; cheap maintenance critical in resource-scarce hills |
| Arid | ↓↓ 0.02-0.07 | Water-scarce; herbaceous r-strategy dominates |
| Wetland | ↑↑ 0.92-0.93 | Abundant water + 1.5× height bonus strongly rewards woodiness |

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
| Soil | ↓ 0.32-0.49 | Many cheap seeds; vigor advantage weak on easy terrain |
| Wetland | ↓ 0.19-0.28 | Even wetland selects small seeds; K-selection pressure minimal |
| Hill | ↓ 0.36 | Many cheap seeds hedge bets in scarce environment |
| Arid | ↓ 0.33-0.52 | r-strategy dominates |

Seed mass drifts downward on all terrains. The establishment delay does not create enough K-selection pressure to sustain large-seed strategies.

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
| Soil | ↓↓ 0.04-0.07 | Maintenance cost outweighs benefit; tanks rarely fill |
| Hill | ↓ 0.25-0.31 | Some retention but declining; roots solve water needs |
| Arid | mixed 0.11-0.51 | Pure arid specialist retains 0.51; seedbank/mixed arid goes lower |
| Wetland | ↓↓ 0.07-0.11 | Water abundant; tank completely unnecessary |

Water storage is heavily selected against on all non-arid terrains. On pure arid terrain (exp 7) it stabilizes around 0.51, but on mixed/seedbank arid scenarios it drops further. The 0.015/tick maintenance cost + soil/wetland maintenance multipliers (2.5×/8.0×) make it expensive to maintain unused capacity.

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
    8. Reproduction / seedInvestment (always selected upward — may be broken)

  MODERATE:
    9. Climate eras & disasters
   10. Seed bank dynamics

  WEAK / BROKEN:
   11. Longevity — controls maxAge but plants rarely reach maxAge (starvation kills first).
       Growth efficiency modifier may be the only part that matters.
   12. Water storage — selected against on all non-arid terrain. Dead trait for ~80% of map.
   13. Seed mass — always drifts down. No upward selection pressure exists.
   14. Defense — undefended wins 63/25%. Net negative without sustained herbivore pressure.
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
Cannot track — `longevity` is missing from the stats snapshot `avgGenome` (see Known Issues). Longevity evolution is invisible in experiment results.

---

## TEST SCENARIOS

All experiments: 5000 ticks, snapshot every 250 ticks.

| # | Scenario | Pop | Spp | Shannon | Result | Key trait evolution |
|---|----------|-----|-----|---------|--------|-------------------|
| 1 | Monoculture | 6392 | 12 | 0.34 | Baseline Fern 90%. Stable oscillation. | w: 0.14→0.18, wst: 0.35→0.05 ↓↓, sz: 0.43→0.36 ↓, SI: 0.63→0.71 ↑ |
| 2 | Water Comp | 6116 | 14 | 0.66 | Deep Root 76%, Broad Leaf 22%. Root species won. | w: 0.81→0.89 ↑, wst: 0.29→0.19 ↓, sz: 0.50→0.67 ↑ |
| 3 | Light Comp | 5108 | 21 | 0.62 | Spread Fern 80%, Tall Pine 18%. Leaf species won. | w: 0.80→0.88 ↑, wst: 0.30→0.17 ↓, def: 0.02→0.12 ↑↑ |
| 4 | Seed Tradeoff | 6105 | 20 | 1.20 | Birch 43%, Elm 43%. Perfect coexistence, Oak extinct. | w: 0.77→0.56/0.83, wst→0.05 ↓↓, sz: 0.50→0.35 ↓, SI converged 0.63 |
| 5 | Defense | 5514 | 26 | 1.06 | Soft Willow 63%, Thorny Holly 25%. Undefended wins. | Holly: def 0.42→0.07 ↓↓↓ (abandoned defense), Willow: def 0.04→0.14 ↑ |
| 6 | Hill | 5330 | 2 | 0.48 | Speciated shrub 81%, Deep Root Pine 19%. | w: 0.81→0.03 ↓↓↓ (collapse), R=0.65, H=0.12 (short+deep) |
| 7 | Arid | 6104 | 6 | 0.22 | Speciated turfgrass 95%. | w→0.07, wst=0.51, SI=0.80, deep roots (0.65), very short (0.15) |
| 8 | Wetland | 6378 | 21 | 0.90 | Broad Leaf 57%, Tall Mangrove 39%. Duopoly. | w: 0.84→0.93 ↑, wst: 0.26→0.11 ↓, H: 0.20→0.64 ↑↑↑ |
| 9 | Grass vs Trees | 6395 | 9 | 0.37 | Prairie Grass 89%. Trees nearly extinct (3 plants). | w: 0.11→0.18 (stable herb), SI: 0.58→0.76 ↑↑, wst→0.05 ↓↓ |
| 10 | Nutrient Cycle | 6387 | 9 | 0.88 | New shrub species 60%, Shallow Fern 34%. | Near-extinction at tick 1000 (pop=15), then recovery. Original oak replaced. |
| 11 | Terrain Isolated | 3849 | 20 | 1.23 | All 3 originals survive. Best diversity. | Alpha(hill): w→0.11, Beta(soil): w=0.55, Gamma(wetland): w=0.57, wst→0.03-0.28 |
| 12 | Seed Bank | 370* | 2 | 0.02 | Seedbank Grass 100%. Extreme boom/bust. | w→0.02, SI=0.81, H=0.05, wst=0.29. Pop swings 236-4985. |
| 13 | Woodiness Evo | 6361 | 10 | 1.03 | All 3 survive: Tree 49%, Shrub 35%, Herb 15%. | All converge upward: Herb w: 0.22→0.32, Shrub 0.50→0.53, Tree 0.80→0.88 |
| 14 | Woodiness×Seed | 4879* | 1 | 0.00 | Arid Herb 100%. Tree extinct. Complete monoculture. | w: 0.18→0.03 ↓↓↓, SI: 0.57→0.82 ↑↑↑, wst: 0.32→0.11 ↓↓ |

\* Snapshot caught mid-cycle; actual population range much wider due to arid boom/bust.

### Experiment details

#### 7: Arid Specialist
Speciated Plush Turfgrass dominates (95%) with deep roots (R=0.65), high water storage (wst=0.51), extreme seed investment (SI=0.80), and very low woodiness (w=0.07). Feathered Spreading Grass occupies a minor niche with extreme water storage (wst=0.93). Population grows slowly (35 plants at tick 250, 55 at tick 750) due to harsh conditions, then reaches 6104. Arid dry spells create boom/bust dynamics.

#### 10: Nutrient Cycle
Near-extinction event: population dropped to 15-21 plants around tick 1000. The original dominant (Deep Root Oak) went completely extinct and was replaced by a speciated Bushy Deciduous Shrub (60%). This is the most dramatic ecological turnover — nutrient-poor early conditions create a harsh bottleneck that only the most adaptable lineages survive.

#### 11: Terrain Isolated (5000 ticks, all start w=0.5, sz=0.5, wst=0.3)
| Species | Terrain | Root | Height | Leaf | Woodiness | Seed Mass | Water Storage |
|---------|---------|------|--------|------|-----------|-----------|---------------|
| Alpha Fern | Hill | 0.44 | 0.34 | 0.24 | 0.11 ↓↓ | 0.35 ↓ | 0.28 ↓ |
| Beta Spruce | Soil | 0.33 | 0.51 | 0.36 | 0.55 ↑ | 0.35 ↓ | 0.06 ↓↓ |
| Gamma Willow | Wetland | 0.28 | 0.47 | 0.45 | 0.57 ↑ | 0.30 ↓ | 0.03 ↓↓ |

Delta Cactus (arid) appears extinct or absorbed. All 4 terrain types occupied. Shannon diversity 1.23 — highest of all experiments. Terrain isolation maintains and promotes diversity. Water storage collapses on soil/wetland but partially retained on hill.

#### 13: Woodiness Evolution
All three original strategies (Herb w=0.20, Shrub w=0.50, Tree w=0.80) coexist stably — Shannon 1.03. All converge upward in woodiness. Tree differentiates via large seed size (sz=0.74). Herb evolves toward woodiness (0.22→0.32). This is stable niche partitioning along the woodiness axis on flat soil.

---

## KNOWN ISSUES & PENDING WORK

### URGENT — Broken / needs immediate fix

1. **`longevity` missing from stats snapshot** — `stats.ts:computeSnapshot()` tracks avgGenome with 8 traits (root, height, leaf, seed, sz, def, wood, wst) but does NOT include longevity. Longevity evolution is completely invisible in experiment results. This makes it impossible to verify the core r/K tradeoff is functioning.

2. **Water storage is universally selected against** — wst collapses to 0.03-0.11 on soil, wetland, and hill. Even on arid terrain, results are inconsistent (0.51 in pure arid specialist, but 0.11-0.29 in seedbank/mixed arid). The 0.015/tick maintenance cost + terrain multipliers (soil 2.5×, wetland 8.0×) effectively tax waterStorage out of existence on all non-arid terrains. This is a dead trait for ~80% of the map.

3. **Seed mass always drifts downward** — sz decreases on ALL terrains (0.19-0.52). No experiment produces upward seed mass evolution. The establishment delay (5 ticks) doesn't create enough K-selection pressure to make large seeds viable. Seed mass is functionally a "minimize me" trait.

4. **SeedInvestment always drifts upward** — SI increases in every experiment (0.50→0.63-0.82). There is no meaningful tradeoff against growth — investing in reproduction always wins. This suggests the growth vs reproduction balance is broken: surplus energy is always better spent on seeds.

### MODERATE — Concerning patterns

5. **Defense inversion in exp 5** — The defended species (Thorny Holly, def=0.42) evolved defense DOWN to 0.07, while the undefended species (Soft Willow, def=0.04) evolved it UP to 0.14. Defense converges to a low value regardless of starting point. Undefended still wins 63/25%. Defense remains net-negative on flat soil without sustained herbivore pressure.

6. **Grass always beats trees on flat soil (exp 9)** — Prairie Grass (w=0.1, lon=0.3) crushes Oak Tree (w=0.9, lon=0.8) to near-extinction (3 plants). Trees should be able to shade out grass via height advantage, but the longevity growth penalty (0.82× for lon=0.8) combined with expensive woody maintenance means trees can't establish. This may be a longevity tuning issue — the growth efficiency penalty for high longevity may be too harsh.

7. **Nutrient cycle near-extinction (exp 10)** — Population drops to 15 plants around tick 1000 before recovering. The original dominant species goes fully extinct. Nutrient-poor early conditions create a lethal bottleneck that may be too harsh.

8. **Hill woodiness collapse** — Both species in exp 6 evolved from w=0.80 to w=0.03. Hills strongly select for ultra-herbaceous plants. There is no viable woody strategy on hills.

### Observations (not necessarily bugs)

- **Arid boom/bust** — Arid populations swing from 5000+ to 236 between snapshots. Ecologically realistic but visually alarming.
- **Speciation count varies widely** — From 1 species (arid monoculture) to 26 (defense experiment). Defense experiment has highest speciation, likely because herbivore pressure creates niche variation.
- **Terrain isolation is the strongest diversity driver** — Exp 11 (Shannon 1.23) and exp 4 (Shannon 1.20) are the only experiments with high sustained diversity.
- **Starvation dominates death** — Starvation kills 10-60× more than age-based death in all experiments. Age death is negligible (19-751 age deaths vs 1,369-125,509 starvation deaths). This questions whether longevity's maxAge has any effect — plants die of starvation long before reaching maxAge.

### Experiments to re-run after any major mechanic change
- #1 Monoculture Baseline (sanity check)
- #4 Seed Tradeoff (seed mass health)
- #7 Arid Specialist (drought adaptation health)
- #11 Terrain Isolated (terrain differentiation health)
- #12 Seed Bank (arid seed dynamics health)
- #13 Woodiness Evolution (woodiness/longevity interaction)

### New experiments needed
- **Longevity Tradeoff** — Low-longevity (0.2) vs high-longevity (0.8) on flat soil, identical genomes otherwise. Core r/K test. (Blocked by issue #1: longevity not tracked in stats.)
- **Longevity × Terrain** — Same species (lon=0.5) on isolated terrains. Track longevity evolution per biome.
- **Longevity × Woodiness** — Herbaceous perennial vs woody annual vs natural combos. Verify traits are genuinely independent.
