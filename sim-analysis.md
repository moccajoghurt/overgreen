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
  traitCost = defense×0.05×zoneDefMult + waterStorage×0.04×terrWStorMult×zoneWStorMult
            + seedInvestment×0.04 + longevity×0.08
  maturity = min(1, height / maxHeight)
  cost = structuralCost + maturity × traitCost
  (terrain multipliers per-trait: Section 5; zone multipliers: Section 15)
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

### Maintenance cost multipliers by terrain:
```
  ┌──────────┬───────┬────────┬──────┬──────────┐
  │ Terrain  │ Root  │ Height │ Leaf │ wStorage │
  ├──────────┼───────┼────────┼──────┼──────────┤
  │ Soil     │ 1.0   │ 0.7    │ 1.0  │ 2.5      │
  │ Hill     │ 4.0   │ 2.0    │ 1.2  │ 1.0      │
  │ Wetland  │ 3.5   │ 1.0    │ 0.85 │ 8.0      │
  │ Arid     │ 0.8   │ 1.5    │ 2.5  │ 0.3      │
  └──────────┴───────┴────────┴──────┴──────────┘
```

- **Soil** height 0.7× — ⚠️ BUG: incorrectly favors trees on Soil. Needs ≥1.0 (see Section 17)
- **Soil** wStorage 2.5× — no advantage to succulence in reliable rain
- **Hill** root 4.0× — rock is hard to dig → selects against deep roots
- **Wetland** wStorage 8.0× — succulent tissue rots in waterlogged soil
- **Arid** wStorage 0.3× — succulent tissue strongly advantageous → selects for succulents
- **Arid** leaf 2.5× — transpiration water loss penalizes large leaves

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

Peak leaf stress by zone: Desert summer (2.5×), Temperate winter and Med summer (2.0×), Desert winter (1.8×), Med winter (1.6×). Tropical never exceeds 1.0×. Root insulation (deep roots) reduces leaf maintenance penalty by up to 80%.

---

## 9. DISASTERS

- **Drought:** Summer, local radius, reduces recharge + evaporates 0.3/tick (all terrains)
- **Arid dry spell:** Summer, terrain-wide, zeroes recharge + evaporates 0.05/tick on all arid cells (15-35 ticks)
- **Fire:** Summer, spreads via low-water high-leaf cells. Survival chance = BARK_WEIGHT × woodiness² + MOISTURE_WEIGHT × (storedWater/capacity). Survivors lose 90% leaves and 60% energy. Dead plants are removed. Rivers block spread.
- **Disease:** Targets genetic uniformity >50% — the monoculture punisher. Spread to neighbors reduced by defense × DEFENSE_DISEASE_RESIST (50%). Diseased plants suffer photosynthesis penalty (0.70 base, recoverable to 0.85 at defense=1) and energy drain (0.15/tick, resistible to 0.09/tick at defense=1).

### Fire survival constants:
```
  FIRE_SURVIVAL_BARK_WEIGHT:    0.5   — max 50% survival from woodiness² (quadratic)
  FIRE_SURVIVAL_MOISTURE_WEIGHT: 0.3  — max 30% survival from water reserves
  FIRE_SURVIVAL_ENERGY_LOSS:    0.6   — 60% energy lost when surviving
  FIRE_SURVIVAL_LEAF_LOSS:      0.9   — 90% leaves lost when surviving
```

### Zone-weighted spawn probabilities (relative to Temperate = 1.0):
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

**Defense** has two roles:

1. **Anti-herbivore:** Reduces grazing damage by up to 70%, cost = 0.05/tick. Value depends on herbivore pressure.
2. **Disease resistance:** Three independent effects:
   - Spread reduction: disease spreads to neighbors × (1 - defense × 0.5)
   - Photosynthesis recovery: diseased photo penalty 0.70 + defense × 0.15 → up to 0.85
   - Drain resistance: disease drain 0.15 × (1 - defense × 0.4) → down to 0.09/tick

Defense is context-dependent: near-zero cost in low-pressure environments, critical in Tropical zones (disease 1.8×).

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
  Maintenance: waterStorage × 0.04/tick (×terrain wStorageMult ×zone wStorageMult)
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
   14. Defense — anti-herbivore + disease resistance (spread, photo, drain). Context-dependent: critical in Tropical, negligible in Desert.

  WEAK / BROKEN (pending re-validation):
   15. Seed mass — drifted down in pre-zone experiments. Zone stress may create upward pressure.
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
- **Tropical** — Mild year-round (leafMaint never exceeds 1.0×), high water (0.9-1.4×), year-round growth (min 0.3×, never fully shuts down). High disease risk (1.8×). Defense maintenance 0.2× (nearly free).
- **Mediterranean** — Inverted wet/dry: severe summer drought (water 0.3×) with scorching leaf stress (leafMaint 2.0×), wet cold winters (water 1.4×, leafMaint 1.6×). Fire-prone (2.0×). Peak growth and seeding in spring.
- **Desert** — Chronic aridity (water 0.15-0.70×), bright light year-round, extreme summer leaf stress (2.5×), harsh winter (leafMaint 1.8×). Water storage maintenance 0.4× (cheap). Low disaster rates.

### Seasonal modifier tables:

Temperate — see Section 8 baseline table.

Tropical:
```
  ┌─────────┬───────┬───────┬──────────┬────────┬──────┐
  │ Season  │ Water │ Light │ LeafMaint│ Growth │ Seed │
  ├─────────┼───────┼───────┼──────────┼────────┼──────┤
  │ Spring  │ 1.30  │ 1.10  │  0.9     │ 1.20   │ 1.0  │
  │ Summer  │ 1.40  │ 1.20  │  0.9     │ 1.10   │ 0.8  │
  │ Autumn  │ 1.10  │ 0.95  │  0.95    │ 0.80   │ 0.5  │
  │ Winter  │ 0.90  │ 0.85  │  1.0     │ 0.30   │ 0.1  │
  └─────────┴───────┴───────┴──────────┴────────┴──────┘
```

Mediterranean:
```
  ┌─────────┬───────┬───────┬──────────┬────────┬──────┐
  │ Season  │ Water │ Light │ LeafMaint│ Growth │ Seed │
  ├─────────┼───────┼───────┼──────────┼────────┼──────┤
  │ Spring  │ 1.30  │ 1.10  │  1.0     │ 1.40   │ 1.2  │
  │ Summer  │ 0.30  │ 1.25  │  2.0     │ 0.60   │ 0.5  │
  │ Autumn  │ 0.70  │ 0.90  │  1.2     │ 0.40   │ 0.2  │
  │ Winter  │ 1.40  │ 0.65  │  1.6     │ 0.00   │ 0.0  │
  └─────────┴───────┴───────┴──────────┴────────┴──────┘
```

Desert:
```
  ┌─────────┬───────┬───────┬──────────┬────────┬──────┐
  │ Season  │ Water │ Light │ LeafMaint│ Growth │ Seed │
  ├─────────┼───────┼───────┼──────────┼────────┼──────┤
  │ Spring  │ 0.70  │ 1.05  │  1.3     │ 1.00   │ 0.8  │
  │ Summer  │ 0.15  │ 1.30  │  2.5     │ 0.30   │ 0.1  │
  │ Autumn  │ 0.30  │ 1.00  │  1.3     │ 0.30   │ 0.2  │
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

### Zone maintenance multipliers (compound with terrain multipliers):
```
  ┌───────────────┬─────────────┬──────────────┐
  │ Zone          │ defenseMult │ wStorageMult │
  ├───────────────┼─────────────┼──────────────┤
  │ Temperate     │ 1.0         │ 1.0          │
  │ Tropical      │ 0.2         │ 1.0          │
  │ Mediterranean │ 1.0         │ 1.0          │
  │ Desert        │ 1.0         │ 0.4          │
  └───────────────┴─────────────┴──────────────┘
```

- **Tropical** defense 0.2× — disease-rich environment makes defense tissue nearly free to maintain. Plants reliably evolve high defense (d>0.5).
- **Desert** wStorage 0.4× — extreme drought makes water storage tissue cheap. Compounds with Arid terrain's 0.3× for an effective 0.12× on Arid+Desert.

### Observed climate zone evolution:

Pending — need comprehensive per-pocket analysis.

---

## 16. EXPERIMENTAL VALIDATION

### 16.1 Goals

- **Niche differentiation:** 16 terrain×zone pockets produce distinct archetype/subtype communities
- **Genome soundness:** all 9 traits show environment-dependent selection (no universal drift)
- **System correctness:** energy budget, disasters, defense, water storage all function as designed

### 16.2 Maps

**Niche Matrix** (`experiment-niche-matrix`): 80×80 grid, 4×4 layout of isolated pockets. 9-cell-wide Rock barriers between all pockets (blocks max seed range). Each pocket = unique terrain + climate zone combination. Pockets are 13×13 cells — adequate for archetype-level testing but marginal for reliable subtype emergence.

```
          Soil(13)  Rock(9)  Hill(13)  Rock(9) Wetland(13) Rock(9)  Arid(14)
Temperate ┌───────┐         ┌───────┐          ┌────────┐          ┌────────┐
y:0-12    │S+Temp │  Rock   │H+Temp │   Rock   │W+Temp  │   Rock   │A+Temp  │
          └───────┘         └───────┘          └────────┘          └────────┘
Rock y:13-21  ═══════════════════════════════════════════════════════════════
Tropical  ┌───────┐         ┌───────┐          ┌────────┐          ┌────────┐
y:22-34   │S+Trop │  Rock   │H+Trop │   Rock   │W+Trop  │   Rock   │A+Trop  │
          └───────┘         └───────┘          └────────┘          └────────┘
Rock y:35-43  ═══════════════════════════════════════════════════════════════
Mediterr. ┌───────┐         ┌───────┐          ┌────────┐          ┌────────┐
y:44-56   │S+Med  │  Rock   │H+Med  │   Rock   │W+Med   │   Rock   │A+Med   │
          └───────┘         └───────┘          └────────┘          └────────┘
Rock y:57-65  ═══════════════════════════════════════════════════════════════
Desert    ┌───────┐         ┌───────┐          ┌────────┐          ┌────────┐
y:66-79   │S+Des  │  Rock   │H+Des  │   Rock   │W+Des   │   Rock   │A+Des   │
          └───────┘         └───────┘          └────────┘          └────────┘
```

**Terrain Quad** (`experiment-terrain-quad`): 80×80 grid, 2×2 layout of 4 terrain types (Soil, Hill, Wetland, Arid) all under Temperate climate. 35×35 pockets (1,225 cells each) separated by 10-cell Rock barriers. 9 plants per species per pocket (45 total). For isolating terrain effects without zone confounds.

**Zone Quad** (`experiment-zone-quad`): 80×80 grid, 2×2 layout of 4 climate zones (Temperate, Tropical, Mediterranean, Desert) all on Soil terrain. Same pocket size and seeding as Terrain Quad. For isolating zone effects without terrain confounds.

**Neutral Baseline** (`experiment-neutral-baseline`): 80×80 grid, all Soil terrain, all Temperate zone. No barriers. Same 5 initial species scattered uniformly. Null hypothesis — trait drift here is competition-driven, not environmental.

### 16.3 Initial Species

| # | Name | Archetype | root | height | leaf | seedInv | seedSz | def | wood | wStor | lon |
|---|------|-----------|------|--------|------|---------|--------|-----|------|-------|-----|
| 1 | Starter Grass | Grass | 0.40 | 0.30 | 0.30 | 0.50 | 0.40 | 0.10 | 0.15 | 0.10 | 0.30 |
| 2 | Starter Forb | Forb | 0.30 | 0.25 | 0.60 | 0.50 | 0.35 | 0.25 | 0.20 | 0.20 | 0.35 |
| 3 | Starter Shrub | Shrub | 0.35 | 0.30 | 0.40 | 0.40 | 0.45 | 0.30 | 0.55 | 0.30 | 0.50 |
| 4 | Starter Tree | Tree | 0.40 | 0.45 | 0.45 | 0.30 | 0.60 | 0.20 | 0.85 | 0.20 | 0.65 |
| 5 | Starter Succulent | Succulent | 0.35 | 0.20 | 0.30 | 0.40 | 0.55 | 0.30 | 0.50 | 0.65 | 0.50 |

Placement: 4 plants per species per Matrix pocket (20/pocket, 320 total). 50 per species on Baseline (250 total).

Note: Succulents only germinate on Arid + Hill terrain. In Soil/Wetland pockets, initial succulents live but cannot reproduce.

### 16.4 Experiments

| ID | Map | Ticks | Interval | Purpose |
|----|-----|-------|----------|---------|
| 1 | `experiment-niche-matrix` | 5000 | 500 | Niche differentiation, subtype emergence, system correctness |
| 2 | `experiment-neutral-baseline` | 5000 | 500 | Trait drift baseline, competition dynamics |
| 3 | `experiment-terrain-quad` | 5000 | 500 | Terrain archetype/subtype validation (larger pockets) |
| 4 | `experiment-zone-quad` | 5000 | 500 | Zone archetype/subtype validation (larger pockets) |

Run via: `npx tsx scripts/run-experiment.ts <scenario-id> --ticks 5000 --interval 500`

### 16.5 Niche Predictions

See Section 18 for the definitive subtype target matrix. Below are the ecological pressures per niche.

| Niche | Key Pressure | Traits Favored (↑) / Penalized (↓) | Expected Archetype |
|-------|-------------|-------------------------------------|--------------------|
| Soil+Temp | Winter dormancy, mixed competition | leaf↑, seedInv↑, wStor↓ (2.5×) | Grass/Forb/Shrub mix |
| Soil+Trop | Disease 1.8×, year-round growth | defense↑, leaf↑, wStor↓ | Forb > Shrub |
| Soil+Med | Fire 2.0×, summer drought 0.3× | wood↑ (fire bark), seedInv↑, leaf↓ | Shrub |
| Soil+Des | Extreme drought 0.15×, winter 1.8× leafMaint | wStor↑ (but 2.5× cost), root↑ | Shrub > Grass |
| Hill+Temp | Root 4.0×, height 2.0× | root↓, height↓, seedSz↑ | Grass > Forb |
| Hill+Trop | Root 4.0×/height 2.0× + disease 1.8× | root↓, height↓, defense↑ | Grass/Forb |
| Hill+Med | Root 4.0×/height 2.0× + fire + drought | wood↑ (fire), root↓, wStor moderate | Shrub > Succulent |
| Hill+Des | Root 4.0×/height 2.0× + extreme drought | wStor↑ (no Hill penalty), root↓, seedSz↑ | Succulent |
| Wet+Temp | Root 3.5×, wStor 8.0×, leaf 0.85×, height bonus 1.5× | leaf↑, height↑, root↓, wStor↓↓ | Tree > Forb |
| Wet+Trop | Root/wStor penalty + disease 1.8× | leaf↑, defense↑, wStor↓↓ | Tree > Forb |
| Wet+Med | Root/wStor + fire + drought (0.7×0.3 water) | leaf↑, wood↑ (fire), wStor↓↓ | Shrub/Tree |
| Wet+Des | Oasis: wetland water buffers desert drought | leaf↑, height↑, root↓, wStor↓↓ | Tree/Forb |
| Arid+Temp | Leaf 2.5×, root cheap 0.8× | root↑, wStor↑, leaf↓, seedSz↑ | Succulent > Shrub |
| Arid+Trop | Leaf penalty + disease, tropical water helps | root↑, wStor↑, defense↑ | Shrub > Succulent |
| Arid+Med | Leaf + fire + drought (0.25×0.3 = 0.075) | wood↑, root↑, wStor↑, leaf↓↓ | Succulent |
| Arid+Des | EXTREME (0.0375 summer water) | wStor MAX, root↑, leaf MIN | Succulent or **extinct** |

### 16.6 Results

**Run 1** (after fixing Soil height discount → 1.0 and archetype gate → waterStorage-first):

**Terrain Quad** (5000 ticks, all Temperate):

| Terrain | Pop | Dominant Species | Subtype | Genome Signature | vs Target |
|---------|-----|-----------------|---------|------------------|-----------|
| Soil | 619 | Bulging Hazel (#8) | Shrub (Hazel) | w:0.55, l:0.49, h:0.22 | Partial — shrub present but no trees yet, drifting woody |
| Hill | 744 | Bulbous Iceplant (#7) + Turfgrass (#6) | Succulent + Grass | wst:0.69, w:0.21 / w:0.16, r:0.49 | **WRONG** — Iceplant dominates hill (no wStorage penalty) |
| Wetland | 787 | Fat Palm (#16) + Prolific Cypress (#30) | Tree (Palm, Cypress) | w:0.91, h:0.52 / w:0.94, h:0.61 | **CORRECT** — trees dominate wetland |
| Arid | 227+ | Bulbous Iceplant (#7) | Succulent (Iceplant) | wst:0.69, w:0.21 | Correct archetype, but same species as Hill |

**Zone Quad** (5000 ticks, all Soil):

| Zone | Pop | Dominant Species | Subtype | Genome Signature | vs Target |
|------|-----|-----------------|---------|------------------|-----------|
| Temperate | 835 | Birch (#10) + Hazel (#6) + Cypress (#20) | Tree + Shrub | w:0.88 / w:0.52 / w:0.92 | **Close** — woody dominance matches forest target |
| Tropical | 1059 | Soaring Cypress (#20) + Palm (#13) | Tree | w:0.92, d:0.60 / w:0.84 | Partially right — trees but wrong subtypes (Cypress not Tropical) |
| Mediterranean | 1220 | Plump Hazel (#6) | Shrub (Hazel) | w:0.52, l:0.38 | **Partial** — shrub correct but should be Mediterranean/Aromatic subtype |
| Desert | 1002 | Plump Hazel (#6) + Palm (#13) | Shrub + Tree | w:0.52 / w:0.84 | **WRONG** — should be Saltbush/Desert Grass/succulents |

Key observations:
- Woodiness drifts up everywhere (0.34 → 0.71 on Soil over 5000 ticks) — no cost to woodiness
- Hill has no wStorage penalty → succulents thrive there incorrectly
- Zone pressures too weak to differentiate Mediterranean from Temperate or push Desert toward succulents
- Wetland fix confirmed working — trees reliably dominate

### 16.7 Diagnostics

Signals that indicate broken mechanics:

| Signal | Diagnosis | Fix |
|--------|-----------|-----|
| seedSize → 0 everywhere (Matrix + Baseline) | No upward selection pressure | Add competitive establishment mortality |
| longevity → 1 everywhere | Senescence too weak | Stronger/earlier senescence onset |
| waterStorage → 0 even in Arid+Desert | Drought buffer not worth maintenance cost | Adjust capacity or costs |
| defense → 0 even in Tropical pockets | Disease resistance too weak | Increase DEFENSE_DISEASE_RESIST |
| No woodiness selection in Mediterranean | Fire survival too rare/weak | Increase FIRE_SURVIVAL_BARK_WEIGHT |
| Mediterranean Shrub absent from Mediterranean pockets | Subtype scoring misaligned | Fix scoring formula |
| All pockets converge to same genome | Environmental pressure too weak | Strengthen terrain multipliers or zone modifiers |

---

## 17. KNOWN ISSUES & TODO

### Tuning bugs (blocking accurate results)
- ~~**Soil height discount (0.7×)**~~ — FIXED: `SOIL_MAINT_HEIGHT_MULT` set to 1.0
- ~~**Archetype gate order**~~ — FIXED: waterStorage≥0.55 checked before woodiness<0.4
- ~~**Wetland produces Forb instead of Tree**~~ — RESOLVED: trees dominate Wetland after Soil height fix
- **Hill has no wStorage penalty** — `maintWStorageMult` defaults to 1.0 on Hill, so succulents (Iceplant) dominate Hill instead of grasses. Needs `HILL_MAINT_WSTORAGE_MULT: ~2.0+`.
- **Woodiness drifts up everywhere** — No maintenance cost for woodiness itself. Everything evolves toward trees/shrubs over time. May need a woodiness maintenance term or stronger zone differentiation.
- **Zone pressures too weak** — Desert on Soil still produces Hazel (shrub), not succulents. Mediterranean indistinguishable from Temperate. Zone multipliers need strengthening.

### Trait drift issues
- **seedSize drifts down** — Needs competitive establishment mortality (seedlings in shaded cells face survival pressure proportional to seedSizeVigor)
- **longevity may drift up** — Senescence onset at 30% maxAge, 4× maintenance at maxAge, 0.08/tick scaled by maturity. May need stronger/earlier onset.

### Missing mechanics
- **Shelter from shade** — Tall neighbors shade + shelter. Shelter reduces leaf maintenance by up to 30%, creating understory niche and nurse-plant dynamics.
- **Litter mulch on death** — Dead plants leave mulch reducing drought evaporation. Pioneer succession emerges naturally.

---

## 18. SUBTYPE TARGET MATRIX

**Goal:** Define which subtypes should appear in each terrain×zone niche. Run experiments, compare results to targets, adjust simulation constants until results match. Iterate until realistic.

**Process:**
1. Define target subtypes per niche (this section)
2. Run quad experiments (`experiment-terrain-quad`, `experiment-zone-quad`)
3. Compare dominant subtypes in each pocket against targets
4. Adjust simulation values (terrain multipliers, zone modifiers, archetype gate, subtype scoring)
5. Re-run and repeat until targets are met

### 18.1 Terrain × Temperate (isolated terrain effects)

| Terrain | Target Archetype | Target Subtypes (dominant → secondary) | Ecological Rationale |
|---------|-----------------|----------------------------------------|---------------------|
| Soil | Tree > Shrub | Oak, Birch, Hazel | Temperate broadleaf forest — climax community on deep fertile soil |
| Hill | Grass > Forb | Bunchgrass, Wildflower, Turfgrass | Alpine/rocky grassland — shallow soil limits trees, natural meadow |
| Wetland | Tree > Forb | Birch, Sedge, Fern, Mangrove | Riparian forest — birch/alder-type trees, sedges and ferns underneath |
| Arid | Succulent > Shrub | Saltbush, Saguaro, Aloe, Desert Grass | Scrubland — succulents and drought-hardy shrubs |

### 18.2 Soil × Zone (isolated zone effects)

| Zone | Target Archetype | Target Subtypes (dominant → secondary) | Ecological Rationale |
|------|-----------------|----------------------------------------|---------------------|
| Temperate | Tree > Shrub | Oak, Birch, Hazel | Temperate broadleaf forest — succession endpoint without disturbance |
| Tropical | Forb > Tree | Tropical Herb, Fern, Tropical Tree | Lush broadleaf understory, some canopy trees |
| Mediterranean | Shrub | Mediterranean, Aromatic, Wildflower | Garrigue/maquis — small-leaved drought-adapted shrubs |
| Desert | Shrub > Grass | Saltbush, Desert Grass, Desert Annual | Sparse scrub, ephemeral grasses after rain |

### 18.3 Full 16-niche targets

| Niche | Primary Subtypes | Secondary Subtypes |
|-------|------------------|--------------------|
| **Soil+Temp** | Oak, Birch | Hazel, Wildflower |
| **Soil+Trop** | Tropical Herb, Fern | Tropical Tree, Vine |
| **Soil+Med** | Mediterranean, Aromatic | Wildflower, Cypress |
| **Soil+Des** | Saltbush, Desert Grass | Desert Annual, Aromatic |
| **Hill+Temp** | Bunchgrass, Wildflower | Turfgrass, Tallgrass |
| **Hill+Trop** | Bunchgrass, Tropical Herb | Wildflower |
| **Hill+Med** | Bunchgrass, Aromatic | Mediterranean, Barrel Cactus |
| **Hill+Des** | Saguaro, Barrel Cactus | Desert Grass |
| **Wet+Temp** | Birch, Sedge | Fern, Mangrove |
| **Wet+Trop** | Tropical Tree, Mangrove | Fern, Palm |
| **Wet+Med** | Mangrove, Sedge | Fern |
| **Wet+Des** | Palm, Sedge | Fern |
| **Arid+Temp** | Saltbush, Saguaro | Aloe, Desert Grass |
| **Arid+Trop** | Acacia, Aloe | Saltbush |
| **Arid+Med** | Barrel Cactus, Saguaro | Aromatic |
| **Arid+Des** | Saguaro, Barrel Cactus | (sparse / near-extinction) |

### 18.4 Tuning Progress

**Round 1**: Fixed Soil height discount (0.7→1.0) and archetype gate order (waterStorage-first).
- Wetland → Trees: **PASS**
- Arid → Succulents: **PASS** (correct archetype)
- Soil+Temp → Forest: **Partial** (Hazel shrub drifting woody, on track)
- Hill → Grasses: **FAIL** (Iceplant dominates — needs Hill wStorage penalty)
- Zone differentiation: **FAIL** (Mediterranean ≈ Temperate, Desert → Hazel not succulents)

**Next**: Add Hill wStorage penalty, investigate woodiness drift, strengthen zone pressures.

