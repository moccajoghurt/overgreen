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
  seasons,             water += recharge      light = base - shade
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

Woodiness is a continuous genome trait (0.01-0.99). Most plant constants are linearly interpolated between herbaceous (w=0) and woody (w=1) endpoints via `getPlantConstants(genome)`. Two properties — maxAge and growthEfficiency — are driven by the `longevity` trait (see Section 14), not woodiness.

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

Lifespan and growth speed are controlled by `longevity` (Section 14), not woodiness.

### Observed woodiness evolution by terrain × zone:

Pending — re-run with zone-controlled scenarios.

---

## 8. SEASONS

```
  Year = 500 ticks. Cosine interpolation between seasons.
  Seasonal multipliers vary by climate zone — Temperate baseline shown below.
  See Section 15 for Tropical, Mediterranean, and Desert zone tables.
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

Temperate winter is the harshest (leafMaint 2.0×). Tropical winter is mild (1.2×). Desert (1.8×) and Mediterranean (1.6×) are intermediate. Root insulation (deep roots) reduces leaf maintenance penalty by up to 80%.

---

## 9. DISASTERS

- **Drought:** Summer, local radius, reduces recharge + evaporates 0.3/tick (all terrains)
- **Arid dry spell:** Summer, terrain-wide, zeroes recharge + evaporates 0.05/tick on all arid cells (15-35 ticks)
- **Fire:** Summer, spreads via low-water high-leaf cells, kills instantly, rivers block
- **Disease:** Targets genetic uniformity >50% — the monoculture punisher

Zone-weighted spawn probabilities (relative to Temperate = 1.0):
```
  ┌───────────────┬──────┬──────────┬───────────────┬────────┐
  │ Disaster      │ Temp │ Tropical │ Mediterranean │ Desert │
  ├───────────────┼──────┼──────────┼───────────────┼────────┤
  │ Fire          │ 1.0  │ 0.3      │ 2.0           │ 0.5    │
  │ Disease       │ 1.0  │ 1.8      │ 0.5           │ 0.3    │
  │ Drought       │ 1.0  │ 0.5      │ 1.5           │ 0.8    │
  └───────────────┴──────┴──────────┴───────────────┴────────┘
```

---

## 10. DEFENSE

**Defense:** Reduces grazing by up to 70%, cost = 0.05/tick. Value depends entirely on herbivore pressure.

---

## 11. SEED BANK

Seeds land as dormant objects, germinate when cell water exceeds threshold (interpolated by woodiness: 1.5-2.0). Seeds decay at 0.01 energy/tick with max age 150-200 ticks. Best-energy seed wins per cell. Creates boom/bust dynamics on harsh terrain.

---

## 12. SEED MASS (seedSize genome)

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

### Observed seed mass evolution by terrain × zone:

Pending — re-run with zone-controlled scenarios.

---

## 13. WATER STORAGE (waterStorage genome)

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

### Observed waterStorage evolution by terrain × zone:

Pending — re-run with zone-controlled scenarios. Desert zone may create selection pressure for water storage beyond arid terrain.

---

## MECHANICS RANKED BY IMPACT

```
  CRITICAL:
    1. Energy budget (photosynthesis vs maintenance)
    2. Woodiness spectrum (determines most plant constants)
    3. Climate zones (per-zone seasonal modifiers for water, light, growth, seeds, leaf maintenance)
    4. Water absorption & limitation
    5. Growth allocation / genome priorities
    6. Terrain maintenance multipliers

  SIGNIFICANT:
    7. Light & shadow competition (trees shade out grass on soil)
    8. Seasons (winter lethality varies by zone — Temperate harshest, Tropical mildest)
    9. Reproduction / seedInvestment
   10. Longevity — growth efficiency modifier has clear selective pressure.
       Senescence provides downward pressure at extreme ages.

  MODERATE:
   11. Disasters (zone-weighted: fire 2× in Mediterranean, disease 1.8× in Tropical)
   12. Seed bank dynamics
   13. Water storage — expected critical on arid/desert, likely dead on tropical/wetland

  WEAK / BROKEN (pending re-validation):
   14. Seed mass — drifted down in pre-zone experiments. Zone stress may create upward pressure.
   15. Defense — context-dependent; converges to low values.
   16. Root competition — 6% drain is noise.
```

---

## 14. LONGEVITY (longevity genome)

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

### Observed longevity evolution by terrain × zone:

Pending — re-run with zone-controlled scenarios.

---

## 15. CLIMATE ZONES

Four climate zones provide spatial variation in seasonal regime. Each cell belongs to one zone, assigned via Voronoi partitioning (2-4 seed points) at world generation. Maps can specify fixed zone assignment for controlled experiments.

### Zones:
- **Temperate** — Strong seasonality: cold lethal winter (leafMaint 2.0×), wet spring, dry summer. The baseline regime.
- **Tropical** — Mild winters (leafMaint 1.2×), high water year-round (0.9-1.4×), year-round growth (min 0.3×, never fully shuts down). High disease risk (1.8×).
- **Mediterranean** — Inverted wet/dry: severe summer drought (water 0.3×) with bright light (1.25×), wet cold winters (water 1.4×, leafMaint 1.6×). Fire-prone (2.0×). Peak growth and seeding in spring.
- **Desert** — Chronic aridity (water 0.15-0.70×), bright light year-round, harsh winter (leafMaint 1.8×). Low disaster rates.

### Seasonal modifier tables:

Temperate — see Section 8 baseline table.

Tropical:
```
  ┌─────────┬───────┬───────┬──────────┬────────┬──────┐
  │ Season  │ Water │ Light │ LeafMaint│ Growth │ Seed │
  ├─────────┼───────┼───────┼──────────┼────────┼──────┤
  │ Spring  │ 1.30  │ 1.10  │  1.0     │ 1.20   │ 1.0  │
  │ Summer  │ 1.40  │ 1.20  │  1.0     │ 1.10   │ 0.8  │
  │ Autumn  │ 1.10  │ 0.95  │  1.1     │ 0.80   │ 0.5  │
  │ Winter  │ 0.90  │ 0.85  │  1.2     │ 0.30   │ 0.1  │
  └─────────┴───────┴───────┴──────────┴────────┴──────┘
```

Mediterranean:
```
  ┌─────────┬───────┬───────┬──────────┬────────┬──────┐
  │ Season  │ Water │ Light │ LeafMaint│ Growth │ Seed │
  ├─────────┼───────┼───────┼──────────┼────────┼──────┤
  │ Spring  │ 1.30  │ 1.10  │  1.0     │ 1.40   │ 1.2  │
  │ Summer  │ 0.30  │ 1.25  │  1.0     │ 0.60   │ 0.5  │
  │ Autumn  │ 0.70  │ 0.90  │  1.0     │ 0.40   │ 0.2  │
  │ Winter  │ 1.40  │ 0.65  │  1.6     │ 0.00   │ 0.0  │
  └─────────┴───────┴───────┴──────────┴────────┴──────┘
```

Desert:
```
  ┌─────────┬───────┬───────┬──────────┬────────┬──────┐
  │ Season  │ Water │ Light │ LeafMaint│ Growth │ Seed │
  ├─────────┼───────┼───────┼──────────┼────────┼──────┤
  │ Spring  │ 0.70  │ 1.05  │  1.0     │ 1.00   │ 0.8  │
  │ Summer  │ 0.15  │ 1.30  │  1.2     │ 0.30   │ 0.1  │
  │ Autumn  │ 0.30  │ 1.00  │  1.0     │ 0.30   │ 0.2  │
  │ Winter  │ 0.50  │ 0.70  │  1.8     │ 0.00   │ 0.0  │
  └─────────┴───────┴───────┴──────────┴────────┴──────┘
```

### Zone × terrain compound effects:

Zone modifiers multiply terrain base recharge/light each tick:
```
  Arid terrain × Desert summer:      0.25 × 0.15 = 0.0375 water/tick (extreme)
  Arid terrain × Tropical summer:    0.25 × 1.40 = 0.350 water/tick (mild)
  Wetland × Mediterranean summer:    0.70 × 0.30 = 0.210 water/tick (drought stress)
  Soil × Temperate spring:           0.40 × 1.20 = 0.480 water/tick (comfortable)
```

4 terrains × 4 zones = 16 distinct environments before accounting for microhabitat variation (river adjacency, hill exposure, etc.).

### Observed climate zone evolution:

Pending — no zone-controlled experiments run yet.

---

## TEST SCENARIOS

Experiments run at 1000 ticks (short) or 5000 ticks (long-term dynamics), snapshot every 250 ticks.

All scenarios should specify a fixed climate zone (typically Temperate) to isolate terrain effects, unless specifically testing zone interactions.

| # | Scenario | Ticks | Status |
|---|----------|-------|--------|
| 1 | Monoculture | 3k | Pending |
| 2 | Water Comp | 1k | Pending |
| 3 | Light Comp | 1k | Pending |
| 4 | Seed Tradeoff | 1k | Pending |
| 5 | Defense | 1k | Pending |
| 6 | Hill | 1k | Pending |
| 7 | Arid | 1k | Pending |
| 8 | Shrub Gallery | 1k | Pending |
| 9 | Succulent Gallery | 1k | Pending |
| 10 | Grass vs Trees | 3k | Pending |
| 11 | Nutrient Cycle | 1k | Pending |
| 12 | Terrain Isolated | 5k | Pending |
| 13 | Terrain Mosaic | 5k | Pending |
| 14 | Seed Bank | 1k | Pending |
| 15 | Woodiness Evo | 5k | Pending |
| 16 | Woodiness×Seed | 1k | Pending |

### Experiment details

Pending — all experiments need re-running with zone-controlled scenarios.

---

## KNOWN ISSUES & PENDING WORK

### URGENT — Broken / needs immediate fix

1. **Seed mass may always drift downward** — The establishment delay (5 ticks) may not create enough K-selection pressure to make large seeds viable. Desert/Mediterranean stress may create new upward pressure. Pending validation with zone-controlled scenarios.

### MODERATE — Concerning patterns

2. **Water storage may be dead on non-arid terrain** — Maintenance cost makes water storage a net negative when water is available via roots. Desert zone may expand the useful niche beyond arid terrain alone. Pending validation.

3. **Tree-dominated ecosystems may be fragile** — Tree monocultures risk stochastic extinction from bad winters with no fast-reproducing safety net. Tropical zone (mild winters) may mitigate. Pending validation.

4. **Nutrient cycle low population** — Nutrient-poor early conditions may severely limit carrying capacity on some terrain × zone combinations. Pending validation.

### Observations (pending re-validation)

All observations need re-validation with zone-controlled scenarios.

- **Longevity has real selective pressure** — Growth efficiency modifier is the active component; senescence provides downward pressure at extreme ages.
- **Grass and trees coexist on flat soil** — Maturity-scaled trait maintenance benefits r-strategists. Specific ratios pending.
- **Arid terrain produces correct adaptations** — Water storage expected to be strongly selected FOR, height to collapse. Zone effects may amplify or moderate.
- **Defense converges to low values** — Defense is context-dependent, not universally bad.
- **Terrain isolation drives diversity** — Physical separation promotes niche differentiation. Zone boundaries may add isolation effects.
- **Hill speciation is high** — Expected to persist across zones.

### Experiments to re-run
All 16 experiments need re-running with zone-controlled maps (fixed Temperate zone) to establish baselines. Priority:
- #1 Monoculture Baseline
- #7 Arid Specialist
- #10 Grass vs Trees
- #12 Terrain Isolated
- #15 Woodiness Evolution

### New experiments needed
- **Longevity Tradeoff** — Low-longevity (0.2) vs high-longevity (0.8) on flat soil (Temperate zone), identical genomes otherwise. Core r/K test.
- **Longevity × Terrain** — Same species (lon=0.5) on isolated terrains (Temperate zone). Track longevity evolution per biome.
- **Longevity × Woodiness** — Herbaceous perennial vs woody annual vs natural combos. Temperate zone. Verify traits are genuinely independent.
- **Zone Isolation** — Same terrain (Soil), 4 runs with one zone each (Temperate/Tropical/Mediterranean/Desert). Track trait divergence driven purely by seasonal regime.
- **Zone × Terrain Matrix** — Soil+Desert vs Arid+Temperate. Untangle terrain effects from zone effects on water storage, woodiness, longevity.
- **Mediterranean Fire Ecology** — Mediterranean zone, mixed terrain. Test fire-adapted strategies (high defense, deep roots, low leaf area).
- **Tropical Diversity** — Tropical zone, mixed terrain. Does year-round growth and mild winter produce higher diversity or competitive exclusion?
- **Desert Survival** — Desert zone + Arid terrain. Extreme stress test for population viability.

#### Subtype × Biome plausibility experiments

These validate that the 40 plant subtypes emerge in and dominate ecologically appropriate environments.

- **Subtype Emergence by Zone** — 4 runs: Soil terrain, one zone each (Temperate/Tropical/Mediterranean/Desert). Start identical mid-range genomes (all traits 0.5). Run 3k ticks. Track which subtypes emerge and dominate per zone. Expected: Tropical zone → Tropical Tree, Palm, Tropical Herb, Fern. Mediterranean → Mediterranean Shrub, Aromatic, Cypress. Desert → Saguaro, Barrel Cactus, Desert Shrub, Desert Grass, Desert Annual, Acacia. Temperate → Oak, Tallgrass, Holly, Wildflower (generalists).
- **Subtype Emergence by Terrain** — 4 runs: Temperate zone, one terrain each (Soil/Hill/Wetland/Arid). Start identical mid-range genomes. Run 3k ticks. Track subtype emergence. Expected: Wetland → Mangrove, Sedge, Moss, Fern. Arid → Desert Shrub, Desert Grass, succulents. Hill → Conifer, Bunchgrass, Holly. Soil → mixed generalists.
- **Specialist Home Advantage** — Place biome-specialist genomes in home biome vs wrong biomes. 3 groups, 1k ticks each:
  - Tropical specialists (Tropical Tree, Palm, Tropical Herb, Mangrove) in Tropical+Soil vs Desert+Soil
  - Desert specialists (Acacia, Desert Shrub, Saguaro, Desert Annual) in Desert+Arid vs Tropical+Wetland
  - Mediterranean specialists (Mediterranean Shrub, Aromatic, Cypress) in Mediterranean+Soil vs Temperate+Soil
  Specialists should have higher population / survival in home biome. If equally fit everywhere, classification is cosmetic not functional.
- **Full Niche Matrix** — Single 80×80 map: 4 terrain strips (Soil/Hill/Wetland/Arid) × 4 zone bands (Temperate/Tropical/Mediterranean/Desert) = 16 niches. Seed diverse genomes uniformly. Run 5k ticks. Track dominant subtype per niche. Comprehensive validation that the full terrain×zone matrix produces ecologically plausible communities.

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

