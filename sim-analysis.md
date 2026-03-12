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
  drought/fire/          nutrients decay        (2-cell radius
  disease spawn                                  for tall plants)
         │
         └──> phaseTierAssignment ──> phaseTierLight ──> phaseUpdatePlants ──> phaseHerbivores
                      │                     │                    │                    │
                      v                     v                    v                    v
               sort by height        cascade light        absorb water          graze leaves
               claim tier slots      through tiers        draw/fill tank*       move & breed
               no slot → death       canopy→under→gnd     photosynthesize**     metabolize
                                                          trait modifier***
                                                          facilitation****
                                                          pay maintenance
                                                          grow + seed (FDS)

         ──> phaseDeath ──> phaseDecomposition ──> phaseGermination
                  │                  │                     │
                  v                  v                     v
             energy<=0?        dead plants            seeds sprout
             age>=max?         return water            best-energy wins
             stress mort.      return nutrients         vigor scaling
                               free cell               JC density filter

    * stored water drawn when transpiration short, filled when surplus
   ** seedlings skip photosynthesis during establishment (terrain-dependent ticks)
  *** trait tradeoff engine: genome × environment → production modifier (Section 5)
 **** archetype facilitation: different archetypes in neighborhood boost photosynthesis
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

  Shade tolerance (short plants in shade):
    isShaded = effectiveLight < BASE_LIGHT × 0.8
    heightFactor = max(0, 1 - height / 5.0)
    shadeStrength = max(0.3, 1.0 - droughtStress × 0.8)
    shadeTolerance = isShaded ? 1.0 + heightFactor × 0.5 × shadeStrength : 1.0

  Leaf efficiency (broad leaves in shade):
    leafEfficiency = isShaded ? 1.0 + leafSize × heightFactor × 1.5 × shadeStrength : 1.0

  rawEnergy = (effectiveLight + heightLightBonus) × effectiveLeaf × 0.5 × shadeTolerance × leafEfficiency
  rootAccess = 0.3 + 0.7 × (rootDepth / MAX_ROOT_DEPTH)
  nutrientBonus = 1 + nutrients × rootAccess × 0.20
  energyProduced = rawEnergy × waterFraction × nutrientBonus

  Trait tradeoff modifier (Section 5):
    traitMod = computeTraitModifier(genome, cellEnvironment)
    energyProduced *= max(0.15, 1.0 + traitMod)

  Facilitation (Section 5b):
    energyProduced *= 1.0 + neighborArchetypeCount × 0.25

  Disease penalty:
    if diseased: energyProduced *= (0.70 + defense × 0.15)
```

Root access uses absolute depth (rootDepth / MAX_ROOT_DEPTH=10), not relative to archetype max. Shade tolerance benefits short plants in shaded cells — groundcover and forbs get the most benefit, trees get nothing. Suppressed in drought-stressed environments where open canopy makes shade adaptation irrelevant.

### Water absorption:
```
  waterNeeded = effectiveLeaf × 0.55
  waterCanAbsorb = rootDepth × 0.4
  waterAbsorbed = min(needed, canAbsorb, cellWater)

  Root competition: if demand remains, drain neighbors at (rootDepth/MAX_ROOT) × 0.06
  Groundwater: if rootDepth > waterTable, access saturated zone at 0.3/depth
  Draw: if waterAbsorbed < waterNeeded, draw deficit from storedWater
  Fill: if transpiration fully met, fill tank at rootDepth × 0.5 from cell water

  waterFraction = waterAbsorbed / waterNeeded   (0-1, scales photosynthesis)
```

### Maintenance:
```
  structuralCost = base + height×perHeight + rootDepth×perRoot + effectiveLeaf×perLeaf
  traitCost = defense×0.05 + waterStorage×0.04 + seedInvestment×0.04 + longevity×0.08
  maturity = min(1, height / maxHeight)
  cost = structuralCost + maturity × traitCost
```

Trait maintenance scales with maturity — seedlings haven't built defense structures, water storage tissue, reproductive organs, or longevity adaptations yet. Small seedlings pay near-zero trait overhead, ramping up as they grow. Structural costs (height/root/leaf) scale naturally with plant size.

All base/per-trait maintenance constants are interpolated by woodiness (see Section 7). Terrain/climate differentiation of maintenance is handled entirely by the trait tradeoff engine (Section 5) — there are no per-terrain maintenance multipliers.

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

  Groundwater: roots below water table depth access saturated zone (0.3/depth).
  Water tables: Soil 4.0, Hill 5.0, Wetland 0.5, Arid 3.0
  River seepage: +0.4 water, +0.1 nutrients to all 8 neighbors/tick
```

Arid terrain also has periodic dry spells (summer only, 0.8%/tick chance, 15-35 ticks duration) that zero out recharge and evaporate 0.05 water/tick across all arid cells. These are separate from localized drought events.

Water genuinely limits growth on Soil and especially Arid. Wetland is rarely limiting.

---

## 3. LIGHT & SHADOWS

```
  Base light: Soil 1.0, Hill 1.35, Wetland 1.0, Arid 1.20

  Shadow from taller neighbors (2-cell radius for tall plants ≥3.0 height):
    for each neighbor within radius 2:
      if dist > 1 and neighborHeight < 3.0: skip (only tall plants shade at distance 2)
      shade += (shadowReduction / dist) × min(1, heightDiff / shadowHeightScale)
    finalLight = max(0.1, baseLight × zoneLightMult - totalShade)

  Height light bonus: height/maxHeight × heightLightBonus
    (both shadowReduction and heightLightBonus are continuous by woodiness)
```

Woody plants (high woodiness) cast strong shadows (up to 0.25) and get large height bonuses (up to +1.0). Herbaceous plants (low woodiness) cast negligible shadow (0.05) with minimal height bonus (+0.1). Tall canopy trees can shade cells up to 2 tiles away.

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

## 5. TRAIT TRADEOFF ENGINE (Layers 1-2)

The primary mechanism for niche differentiation. A two-layer data-driven system replaces any per-terrain maintenance multipliers or archetype-specific logic.

### Layer 1: Environment Variables

Terrain physics × climate physics → 10 continuous cell environment variables, seasonally modulated.

**Terrain physics:**
```
  ┌─────────┬───────────┬──────────┬──────────┬─────────────┐
  │ Terrain │ soilDepth │ drainage │ exposure │ waterlogging│
  ├─────────┼───────────┼──────────┼──────────┼─────────────┤
  │ Soil    │ 0.9       │ 0.5      │ 0.3      │ 0.1         │
  │ Hill    │ 0.3       │ 0.7      │ 0.8      │ 0.0         │
  │ Wetland │ 0.7       │ 0.1      │ 0.2      │ 0.9         │
  │ Arid    │ 0.4       │ 0.9      │ 0.5      │ 0.0         │
  └─────────┴───────────┴──────────┴──────────┴─────────────┘
```

**Climate physics:**
```
  ┌───────────────┬─────────┬──────────┬──────────┬──────┐
  │ Zone          │ aridity │ coldness │ humidity │ heat │
  ├───────────────┼─────────┼──────────┼──────────┼──────┤
  │ Temperate     │ 0.3     │ 0.6      │ 0.5      │ 0.3  │
  │ Tropical      │ 0.2     │ 0.0      │ 0.9      │ 0.7  │
  │ Mediterranean │ 0.5     │ 0.2      │ 0.3      │ 0.5  │
  │ Desert        │ 0.9     │ 0.3      │ 0.1      │ 0.9  │
  └───────────────┴─────────┴──────────┴──────────┴──────┘
```

**Derived environment variables:**
```
  droughtStress   = aridity × drainage
  frostRisk       = coldness × exposure
  diseasePressure = humidity × (1 - exposure)
  windExposure    = exposure × (1 - humidity × 0.3)
  waterlogging    = waterlogging × humidity
  heatStress      = heat × exposure + groundHeat
  soilFertility   = soilDepth × humidity × (1 - exposure × 0.5)
  extremeAridity  = max(0, droughtStress - 0.35)
  tropicality     = heat × humidity       (Trop=0.63, Med=0.15, Temp=0.15, Des=0.09)
  winterHarshness = coldness × (1 - heat) (Temp=0.42, Med=0.10, Des=0.03, Trop=0.00)

  groundHeat = heat × aridity × (1 - exposure) × (1 - waterlogging) × 0.5
```

Seasonal modulation: `droughtStress` and `heatStress` scale with `zm.droughtMult` each tick. `extremeAridity` re-derives from seasonal drought. Other envVars are static.

### Layer 2: Trait × Environment Coefficient Table

Each entry: `traitValue × envVarValue × coefficient` summed into a single `traitModifier`. Applied as `energyProduced *= max(0.15, 1.0 + traitModifier)`. Positive = benefit, negative = cost.

**Single-trait effects (50+ entries):**
```
  Leaf size:
    +0.22 base light capture
    +0.60 × soilFertility    big leaves thrive on fertile soil
    -0.30 × soilFertility    (1-leafSize) small leaves can't capture light on fertile soil
    +0.25 × waterlogging     lush growth in saturated soil
    -0.50 × droughtStress    transpiration loss
    -0.30 × frostRisk        freeze damage
    -0.25 × heatStress       heat scorching
    -0.30 × diseasePressure  large leaves catch disease
    -0.20 × windExposure     wind strips foliage

  Defense:
    +0.70 × diseasePressure  disease resistance
    -0.25 base               metabolic cost
    +0.25 × heatStress       spines provide sun/heat protection
    +0.35 × droughtStress    thorns and thick bark reduce water loss

  Water storage:
    +0.70 × droughtStress    drought buffer
    +0.25 × heatStress       evaporative cooling
    -0.40 × frostRisk        succulent tissue freezes
    -0.50 × waterlogging     redundant in saturated soil
    -0.35 × windExposure     wind desiccation

  Woodiness:
    +0.12 base               structural support
    +0.25 × soilFertility    woody investment pays off on fertile soil
    +0.15 × frostRisk        bark insulates
    -0.70 × windExposure     rigid trunks snap in wind
    -0.30 × heatStress       bark cracking in extreme heat
    +0.20 × windExposure     (1-woodiness) flexible stems resist wind
    -0.40 × waterlogging     root rot
    -0.35 × droughtStress    water-demanding woody tissue
    -1.50 × extremeAridity   xylem cavitation in extreme desert

  Root priority:
    +0.10 base               nutrient mining
    +0.55 × droughtStress    deep water access
    -0.20 × windExposure     taproots wind-levered in thin soil
    -0.40 × waterlogging     root drowning
    +0.30 × waterlogging     (1-rootPriority) shallow roots thrive
    -0.25 × heatStress       root zone overheating

  Height priority:
    +0.06 base               competitive light positioning
    +0.30 × soilFertility    tall plants compete for light
    -0.35 × windExposure     wind damage to tall plants
    +0.30 × waterlogging     flood escape
    +0.50 × heatStress       tall form radiates heat
    +1.30 × extremeAridity   tall plants escape lethal ground-level heat

  Seed investment:
    +0.20 × windExposure     wind seed dispersal
    -0.06 base               reproductive allocation cost

  Longevity:
    +0.01 base               persistence advantage
    +0.08 × diseasePressure  evolved immune system
    +0.05 × droughtStress    established root networks resist drought
    -0.10 × frostRisk        frost damages accumulated tissue
```

**Tropicality axis (separates Tropical from other zones):**
```
    leafSize       +0.50 × tropicality   lush foliage in warm humid conditions
    defense        +0.40 × tropicality   chemical defenses against tropical pathogens
    heightPriority +0.35 × tropicality   intense canopy competition
    waterStorage   -0.35 × tropicality   succulence unnecessary in humid tropics
    rootPriority   -0.20 × tropicality   shallow lateral roots outperform taproots
```

**Winter harshness axis (separates Temperate from other zones):**
```
    woodiness      +0.40 × winterHarshness   woody perennials survive winter dormancy
    waterStorage   -0.45 × winterHarshness   succulent tissue destroyed by freeze-thaw
    longevity      +0.25 × winterHarshness   long-lived perennials amortize winter investment
    leafSize       -0.25 × winterHarshness   deciduous leaf loss costly for large leaves
```

### Trait Interactions (trait × trait2 × envVar)

Create multiple competing fitness peaks within the same niche. A linear sum of single-trait effects has at most one peak; trait×trait products create saddle points that split evolution into distinct strategies.

```
  Arid/drought — two competing succulent strategies:
    leafSize × waterStorage    +0.80 × droughtStress   rosette succulent (Aloe)
    defense × waterStorage     +0.80 × droughtStress   armored succulent (Barrel Cactus/Saguaro)

  Tropical forest — two competing tree strategies:
    heightPriority × defense        +0.70 × tropicality   tall defended canopy tree
    heightPriority × seedInvestment +0.50 × tropicality   pioneer gap colonizer

  Arid tree specialization:
    defense × rootPriority          +0.90 × extremeAridity  thorny deep-rooted Acacia
    heightPriority × woodiness      +0.40 × droughtStress   tall columnar form (Cypress)

  Wetland — two competing strategies:
    heightPriority × (1-rootPriority) +0.60 × waterlogging  prop-root shrub (Mangrove)
    leafSize × (1-rootPriority)       +0.50 × waterlogging  leafy shallow-rooted (Sedge)

  Mediterranean — fire-adapted vs drought-tolerant:
    woodiness × waterStorage    +0.50 × heatStress   woody drought-hardy scrub
    defense × longevity         +0.40 × heatStress   aromatic defensive chemistry
```

### 5a. Environmental Stress Mortality

Plants poorly adapted to their environment die from stress. Driven by the trait modifier.

```
  If plant.age > 10:
    stressGap = THRESHOLD (0.05) - traitModifier
    If stressGap > 0:
      deathChance = stressGap × RATE (0.10) per tick
```

This is the main mechanism that prevents poorly-adapted archetypes from persisting in hostile niches. Rather than blocking germination, maladapted plants germinate but die quickly from stress.

### 5b. Facilitation

Different archetypes in a plant's 8-cell neighborhood boost photosynthesis.

```
  Scan 8 neighbors for unique archetype bitmask (5 archetypes: Grass, Forb, Shrub, Tree, Succulent)
  Exclude own archetype — trees among trees get 0 bonus
  energyProduced *= 1.0 + foreignArchetypeCount × 0.25
  Max bonus: 4 foreign archetypes × 0.25 = +100% photosynthesis
```

Models complementary resource use (different root depths, nutrient cycling). Minority archetypes in a pocket benefit most.

### 5c. Frequency-Dependent Selection (FDS)

Per-niche subtype population counts scale seed production. Dominant subtypes are penalized, rare subtypes boosted.

```
  Per tick: count plants per subtype (40 subtypes) per niche (terrain×climate combo)
  If niche population > 10:
    freq = subtypeCount / nicheTotal
    fdsMult = clamp(0.3, 2.0, 1.0 - (freq - 1/40) × FDS_STRENGTH)
    FDS_STRENGTH = 2.5
  totalSeedBudget = (seedBudget + unusedGrowth × 0.5) × fdsMult
```

A subtype at expected frequency (1/40 = 2.5%) gets fdsMult=1.0. A dominant subtype at 25% gets fdsMult≈0.44. A rare subtype at 0% gets fdsMult=2.0 (capped). This maintains multi-subtype coexistence without manual tuning.

### 5d. Janzen-Connell Density Effects

Density-dependent establishment failure prevents monoculture patches.

```
  At germination, scan 5×5 neighborhood around seed:
    Count conspecific adults (same subtype) and archetype conspecifics (same archetype)

  Subtype JC (strong): if conspecificCount > 0:
    establishment fails with probability 1 - 1/(1 + conspecificCount × 3.0)
    1 conspecific: 75% fail, 3: 90% fail, 5: 94% fail

  Archetype JC (weak): if archConspecific > 2:
    establishment fails with probability 1 - 1/(1 + (archConspecific - 2) × 1.0)
    3 same-archetype: 50% fail, 5: 75% fail

  Failed seeds return to the seed bank (not destroyed).
```

---

## 6. GROWTH ALLOCATION & CAPS

```
  Genome: rootPriority, heightPriority, leafSize → normalized to fractions
  Dynamic caps: maxTrait = CAP × (0.3 + 0.7 × traitFrac)
  Growth/tick: growthBudget × fraction × growthEfficiency
  Unused growth budget redirected to seed production at 50% efficiency

  Wind stunting (krummholz effect):
    Height cap: maxHeight × max(0.1, 1 - windExposure × woodiness × 2.0)
    Leaf cap:   maxLeafArea × max(0.15, 1 - windExposure × leafSize × 1.5)
    Rigid woody plants stunted in height; broad-leaved plants lose foliage

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
  │ Max age             │ 100-750      │ 200-2500     │  driven by longevity × woodiness
  │ Shadow cast         │ 0.05         │ 0.25         │
  │ Shadow height scale │ 1.0          │ 3.0          │
  │ Height light bonus  │ 0.1          │ 1.0          │
  │ Decomp water        │ 1.0          │ 2.0          │
  │ Decomp nutrients    │ 0.8+h×0.1    │ 1.5+h×0.3   │
  │ Seedling size       │ 0.3/0.3/0.5  │ 1.0/1.0/1.0 │
  │ Seed max age        │ 150          │ 200          │
  │ Seed germ. water    │ 1.5          │ 2.0          │
  └─────────────────────┴──────────────┴──────────────┘

  Shrub growth efficiency bump: mid-woodiness (w≈0.55) gets up to +0.1 bonus
  to resist drift toward tree or grass extremes.
```

### Strategic tradeoffs along the spectrum:
- **Low woodiness (herbaceous):** Cheap maintenance, higher base growth efficiency (0.5), cheap seeds (0.4), wider base seed range, but low caps (h=2, r=3), negligible shading
- **High woodiness (woody):** Tall (h=10), deep roots (r=10), strong shading (+0.25), but expensive maintenance, expensive seeds (0.8), lower base growth efficiency (0.3)
- **Mid woodiness (shrub):** Intermediate everything + growth efficiency bump — moderate caps, costs, and advantages

Lifespan and growth speed are controlled by `longevity` (Section 14), not woodiness.

### Observed woodiness evolution by terrain × zone:

Pending — re-run experiments with trait engine active.

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
3. **Trait engine bonuses:** Defense also provides heat protection (+0.25 × heatStress) and drought resistance (+0.35 × droughtStress) via the trait tradeoff engine. These make defense valuable in arid/desert environments beyond disease pressure.

Defense is context-dependent: the trait engine drives its adaptation — high defense is rewarded wherever diseasePressure, heatStress, or droughtStress are high.

---

## 11. SEED BANK

Seeds land as dormant objects, germinate when cell water exceeds threshold (interpolated by woodiness: 1.5-2.0). Seeds decay at 0.01 energy/tick with max age 150-200 ticks. Best-energy seed wins per cell (weighted lottery: each seed's chance proportional to energy). Creates boom/bust dynamics on harsh terrain.

No hard archetype germination blocks — any seed can germinate anywhere plantable. Maladapted plants are culled by stress mortality (Section 5a) and Janzen-Connell effects (Section 5d), not germination filtering.

---

## 12. SEED MASS (seedSize genome)

Seed mass (seedSize: 0.01-0.99) controls the tradeoff between many small seeds vs few large seeds.

### Cost curve (how many seeds):
```
  seedSizeMult = 0.6 + seedSize × 0.8    → range 0.6x to 1.4x
  effectiveSeedCost = baseSeedCost × seedSizeMult
  effectiveSeedEnergy = baseSeedEnergy × seedSizeMult
  Small seeds (sz=0.05): cost 0.64x → ~1.6x more seeds per energy budget
  Large seeds (sz=0.95): cost 1.36x → fewer but better-provisioned seeds
```

### Seedling vigor (how big seedlings start):
```
  seedSizeVigor = 0.4 + seedSize × 1.2    → range 0.4x to 1.6x
  Seedling height/root/leaf = base seedling size × seedSizeVigor
  Small seeds: small seedlings (0.4x base size)
  Large seeds: large seedlings (1.6x base size)
  Vigor dampened by terrain: productive terrain compresses toward 1.0,
    harsh terrain amplifies (Hill -0.3, Arid -0.5 = seed size matters MORE)
```

### Establishment delay:
```
  Per-terrain establishment ticks: Wetland 3, Soil 5, Arid 7, Hill 8
  Duration scaled by inverse vigor: estTicks = ceil(baseTicks / seedSizeVigor)
  During establishment: zero income, full maintenance costs.
  Large seedlings establish faster and survive on reserves.
```

### Dispersal bonus:
```
  Small seeds disperse further: seedRange += round((1 - seedSize) × 1)
```

### Observed seed mass evolution by terrain × zone:

Pending — re-run experiments with trait engine active.

---

## 13. WATER STORAGE (waterStorage genome)

Internal water tank for drought tolerance. Genome trait `waterStorage: 0.01-0.99`, plant field `storedWater`.

### Mechanics:
```
  Capacity: waterStorage × 5.0
  Fill rate: rootDepth × 0.5 (from cell water, only when transpiration fully met)
  Maintenance: waterStorage × 0.04/tick (scaled by maturity)
  Draw: when waterFraction < 1, draw deficit from tank before scaling photosynthesis
  Seedling provision: seedSizeVigor × waterStorage × 3.0 initial stored water
```

Water storage acts as a drought buffer — plants with full tanks can maintain photosynthesis during dry spells. The trait engine provides the main selection pressure: waterStorage gets +0.70 × droughtStress benefit but -0.40 × frostRisk and -0.50 × waterlogging penalties, ensuring it evolves high in arid/desert niches and stays low in wetland/tropical niches.

### Observed waterStorage evolution by terrain × zone:

Pending — re-run experiments with trait engine active.

---

## MECHANICS RANKED BY IMPACT

```
  CRITICAL:
    1. Trait tradeoff engine (genome × environment → production modifier)
    2. Energy budget (photosynthesis vs maintenance)
    3. Woodiness spectrum (determines most plant constants)
    4. Frequency-dependent selection (maintains subtype coexistence)
    5. Water absorption & limitation
    6. Growth allocation / genome priorities

  SIGNIFICANT:
    7. Light & shadow competition (2-cell radius, shade tolerance for short plants)
    8. Seasons (winter lethality varies by zone — Temperate harshest, Tropical mildest)
    9. Environmental stress mortality (culls maladapted plants)
   10. Facilitation (archetype diversity bonus)
   11. Janzen-Connell density effects (prevents monoculture patches)

  MODERATE:
   12. Reproduction / seedInvestment + FDS-scaled seed budget
   13. Longevity — growth efficiency modifier + senescence (onset 20%, 6× at maxAge)
   14. Disasters (zone-weighted: fire 2× in Mediterranean, disease 1.8× in Tropical)
   15. Seed bank dynamics + Janzen-Connell establishment filter
   16. Water storage — critical on arid/desert via trait engine, penalized on wetland/tropical
   17. Defense — anti-herbivore + disease + heat/drought bonuses via trait engine
   18. Wind stunting (krummholz) — limits woody/tall plants on exposed terrain

  WEAK:
   19. Seed mass — moderate cost/vigor range (0.6-1.4x / 0.4-1.6x)
   20. Root competition — 6% drain is minor but contributes at margins
```

---

## 14. LONGEVITY (longevity genome)

Longevity (0.01-0.99) creates the r/K selection tradeoff: live fast and grow fast, or live long and grow slow. Lifespan is independent of woodiness — an herbaceous perennial or a woody annual are both viable strategies.

### Mechanics:
```
  maxAge = lerpVal(lerpVal(100, 200, w), lerpVal(750, 2500, w), lon)
    Both woodiness and longevity influence lifespan:
    - Low woodiness herbs range 100-750 ticks (0.2-1.5 years)
    - High woodiness trees range 200-2500 ticks (0.4-5 years)

  growthEfficiency modifier = (1.3 - lon × 0.6)
    lon=0.01: 1.3× base efficiency (fast grower)
    lon=0.50: 1.0× base efficiency (neutral)
    lon=0.99: 0.7× base efficiency (slow grower)

  Base efficiency still comes from woodiness (herb=0.5, woody=0.3).
  Final growthEfficiency = (lerpVal(0.5, 0.3, w) + shrubBump) × (1.3 - lon × 0.6)
    shrubBump = up to +0.1 at w≈0.55 (Gaussian decay)

  Senescence: maintenance multiplier that scales quadratically with age.
    onset = SENESCENCE_ONSET (0.2) × maxAge
    After onset: mult = 1 + ((age - onset)/(maxAge - onset))² × (SENESCENCE_MAX_MULT - 1)
    At maxAge: maintenance × 6.0
    Long-lived plants hit senescence later in absolute ticks but still pay eventually.
    Short-lived plants die young before senescence becomes expensive.

  Longevity maintenance: ongoing cost = longevity × 0.08/tick (scaled by maturity)
    Adds per-tick maintenance proportional to longevity gene value.
    Seedlings pay near-zero due to maturity scaling (see Section 1).

  Examples:
    Herbaceous annual  (w=0.1, lon=0.1): ~0.60 eff, maxAge ~165
    Herbaceous perennial (w=0.1, lon=0.8): ~0.39 eff, maxAge ~620
    Woody annual (w=0.9, lon=0.1): ~0.40 eff, maxAge ~430
    Woody perennial (w=0.9, lon=0.8): ~0.26 eff, maxAge ~2060
```

### Strategic tradeoffs:
- **Low longevity (annual/ephemeral):** Die young but grow fast (1.3× efficiency). Must reproduce quickly before death. Pairs naturally with high seedInvestment.
- **High longevity (perennial):** Live long but grow slowly (0.7× efficiency). Can accumulate height/roots over time. Pairs naturally with competitive traits (height, shading).
- **Interaction with woodiness:** Woodiness controls morphological potential (caps, costs, shadow); longevity controls tempo. A low-woodiness, low-longevity plant is an annual wildflower. A high-woodiness, high-longevity plant is an oak tree.

### Observed longevity evolution by terrain × zone:

Pending — re-run experiments with trait engine active.

---

## 15. CLIMATE ZONES

Four climate zones provide spatial variation in seasonal regime. Each cell belongs to one zone, assigned via Voronoi partitioning (2-4 seed points) at world generation. Maps can specify fixed zone assignment for controlled experiments.

### Zones:
- **Temperate** — Strong seasonality: cold lethal winter (leafMaint 2.0×), wet spring, dry summer. The baseline regime. High winterHarshness (0.42) selects for woodiness and longevity via trait engine.
- **Tropical** — Mild year-round (leafMaint never exceeds 1.0×), high water (0.9-1.4×), year-round growth (min 0.3×, never fully shuts down). High disease risk (1.8×). High tropicality (0.63) selects for large leaves, defense, height, and against succulents.
- **Mediterranean** — Inverted wet/dry: severe summer drought (water 0.3×) with scorching leaf stress (leafMaint 2.0×), wet cold winters (water 1.4×, leafMaint 1.6×). Fire-prone (2.0×). Peak growth and seeding in spring.
- **Desert** — Chronic aridity (water 0.15-0.70×), bright light year-round, extreme summer leaf stress (2.5×), harsh winter (leafMaint 1.8×). High extremeAridity selects for water storage, height priority (heat escape), and against woodiness.

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

4 terrains × 4 zones = 16 distinct environments (24 unique envVar vectors including River and Rock) before accounting for microhabitat variation (river adjacency, hill exposure, etc.).

### Observed climate zone evolution:

Pending — re-run experiments with trait engine active.

---

## 16. EXPERIMENTAL VALIDATION

### 16.1 Goals

- **Niche differentiation:** 16 terrain×zone pockets produce distinct archetype/subtype communities
- **Genome soundness:** all 9 traits show environment-dependent selection (no universal drift)
- **System correctness:** energy budget, trait engine, FDS, facilitation, stress mortality all function as designed

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

No archetype germination restrictions — all species can germinate on any plantable terrain. The trait engine + stress mortality handle niche filtering.

### 16.4 Experiments

| ID | Map | Ticks | Interval | Purpose |
|----|-----|-------|----------|---------|
| 1 | `experiment-niche-matrix` | 5000 | 500 | Niche differentiation, subtype emergence, system correctness |
| 2 | `experiment-neutral-baseline` | 5000 | 500 | Trait drift baseline, competition dynamics |
| 3 | `experiment-terrain-quad` | 5000 | 500 | Terrain archetype/subtype validation (larger pockets) |
| 4 | `experiment-zone-quad` | 5000 | 500 | Zone archetype/subtype validation (larger pockets) |

Run via: `npx tsx --max-semi-space-size=128 --max-old-space-size=4096 scripts/run-experiment.ts <scenario-id> --ticks 5000 --interval 500`

### 16.5 Niche Predictions

See Section 18 for the definitive subtype target matrix. Below are the ecological pressures per niche, driven by the trait engine's environment variables.

| Niche | Key EnvVars (high) | Traits Favored (↑) / Penalized (↓) | Expected Archetype |
|-------|-------------------|-------------------------------------|--------------------|
| Soil+Temp | winterHarshness 0.42, soilFertility 0.34 | wood↑, leaf↑, height↑, wStor↓ | Tree/Shrub/Forb mix |
| Soil+Trop | tropicality 0.63, diseasePressure 0.63 | leaf↑, defense↑, height↑, wStor↓ | Tree > Forb |
| Soil+Med | heatStress 0.33, droughtStress 0.25 | wood↑, defense↑, leaf moderate | Shrub |
| Soil+Des | droughtStress 0.45, heatStress 0.54, extremeAridity 0.10 | wStor↑, defense↑, root↑, wood↓ | Shrub > Succulent |
| Hill+Temp | windExposure 0.68, frostRisk 0.48 | (1-wood)↑, (1-height)↑, root moderate | Grass > Forb |
| Hill+Trop | windExposure 0.63, diseasePressure 0.18 | (1-wood)↑, defense moderate | Grass/Forb |
| Hill+Med | windExposure 0.66, heatStress 0.55 | defense↑, height↑ (heat escape), wStor moderate | Shrub > Succulent |
| Hill+Des | windExposure 0.72, extremeAridity 0.28, heatStress 0.70 | height↑↑ (heat escape), defense↑, wood↓↓ | Succulent |
| Wet+Temp | waterlogging 0.45, soilFertility 0.28 | leaf↑, height↑, (1-root)↑, wStor↓↓ | Tree > Forb |
| Wet+Trop | waterlogging 0.81, tropicality 0.63 | leaf↑, height↑, defense↑, wStor↓↓ | Tree > Forb |
| Wet+Med | waterlogging 0.27, heatStress 0.15 | leaf↑, height↑, wStor↓ | Shrub/Tree |
| Wet+Des | waterlogging 0.09, heatStress 0.24 | leaf↑, height↑, root↓ | Tree/Forb |
| Arid+Temp | droughtStress 0.27, frostRisk 0.30 | wStor↑, root↑, defense↑, leaf↓ | Succulent > Shrub |
| Arid+Trop | droughtStress 0.18, tropicality 0.63 | leaf↑, defense↑, wStor moderate | Shrub > Succulent |
| Arid+Med | droughtStress 0.45, heatStress 0.43 | wStor↑, defense↑, wood↓, leaf↓ | Succulent |
| Arid+Des | droughtStress 0.81, extremeAridity 0.46, heatStress 0.82 | height↑↑, wStor↑, defense↑, wood↓↓↓ | Succulent or **extinct** |

### 16.6 Results

Pending — re-run all experiments with trait engine, FDS, facilitation, and Janzen-Connell active.

### 16.7 Diagnostics

Signals that indicate broken mechanics:

| Signal | Diagnosis | Fix |
|--------|-----------|-----|
| All pockets converge to same genome | Trait engine envVar differentiation too weak | Strengthen trait coefficients or envVar separation |
| Single subtype dominates each niche | FDS_STRENGTH too low or trait interactions too weak | Increase FDS_STRENGTH or add more interaction terms |
| Every niche has all 5 archetypes equally | Facilitation too strong or trait engine too weak | Reduce facilitation bonus or strengthen trait penalties |
| seedSize → 0 everywhere | Vigor/establishment pressure insufficient | Increase harsh terrain establishment ticks or vigor amplification |
| longevity → 1 everywhere | Senescence too weak | Increase SENESCENCE_MAX_MULT or lower SENESCENCE_ONSET |
| waterStorage → 0 even in Arid+Desert | Trait engine drought benefit too weak | Increase waterStorage × droughtStress coefficient |
| defense → 0 even in Tropical | Trait engine disease benefit too weak | Increase defense × diseasePressure coefficient |
| woodiness → 1 everywhere | Trait engine wind/heat/drought penalties too weak | Increase negative woodiness coefficients |

---

## 17. KNOWN ISSUES & TODO

### Pending validation
- **Trait engine niche differentiation** — 16-niche predictions (Section 16.5) need experimental validation. Coefficients tuned via Ralph loop iterations but not yet confirmed with full experiment runs.
- **FDS coexistence quality** — FDS_STRENGTH=2.5 may be too strong (forcing uniform subtype distribution) or too weak (allowing single-subtype dominance). Needs experiment data.
- **Trait interaction emergent strategies** — 10 interaction terms create multiple fitness peaks per niche. Need to verify they actually produce distinct subtype clusters, not just noise.

### Potential issues
- **Facilitation may homogenize** — +25% per foreign archetype strongly rewards mixed-archetype neighborhoods. May prevent any archetype from dominating where it should (e.g., trees in wetland).
- **Janzen-Connell seed recycling** — Failed seeds return to seed bank rather than being destroyed. If JC is too aggressive, seeds may accumulate indefinitely without establishing.

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
4. Adjust simulation values (trait coefficients, envVar derivations, FDS strength, subtype scoring)
5. Re-run and repeat until targets are met

### 18.1 Full 16-niche targets (realistic spectrum)

Each niche lists the full community structure: **Dominant** (most abundant, defines the landscape), **Common** (reliably present, significant population), **Minor** (present but sparse), **Absent** (should not appear — ecologically impossible).

Subtypes available (40): Grasses — Turfgrass, Tallgrass, Bunchgrass, Bamboo, Ryegrass, Sedge, Pampas, Desert Grass. Trees — Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Acacia. Shrubs — Holly, Hazel, Mediterranean, Bramble, Saltbush, Mangrove, Flowering Shrub, Aromatic. Succulents — Saguaro, Aloe, Caudiciform, Euphorbia, Iceplant, Epiphytic, Barrel Cactus, Jade. Forbs — Wildflower, Tall Herb, Fern, Vine, Clover, Moss, Tropical Herb, Desert Annual.

---

**Soil+Temperate** — Central European broadleaf forest
- Dominant: Oak, Birch, Hazel
- Common: Holly, Bramble, Wildflower, Fern, Clover, Moss, Tallgrass
- Minor: Magnolia, Turfgrass, Ryegrass, Tall Herb, Vine
- Absent: Tropical, Palm, Bamboo, Pampas, Desert Grass, Saltbush, Mangrove, Mediterranean, Aromatic, all Succulents, Tropical Herb, Desert Annual

**Soil+Tropical** — Tropical rainforest
- Dominant: Tropical, Palm, Magnolia, Tropical Herb, Fern
- Common: Vine, Bamboo, Flowering Shrub, Tall Herb, Moss, Epiphytic
- Minor: Tallgrass, Bramble, Clover
- Absent: Oak, Birch, Conifer, Cypress, Holly, Mediterranean, Aromatic, Saltbush, Saguaro, Barrel Cactus, Jade, Desert Grass, Desert Annual, Pampas, Turfgrass, Ryegrass

**Soil+Mediterranean** — Maquis/garrigue woodland
- Dominant: Mediterranean, Aromatic, Cypress, Oak
- Common: Holly, Wildflower, Clover, Turfgrass, Ryegrass
- Minor: Aloe, Euphorbia, Bramble, Tall Herb, Bunchgrass, Acacia
- Absent: Tropical, Palm, Birch, Magnolia, Bamboo, Mangrove, Saltbush, Saguaro, Barrel Cactus, Pampas, Fern, Moss, Vine, Tropical Herb, Desert Annual, Desert Grass

**Soil+Desert** — Desert scrubland
- Dominant: Saltbush, Acacia, Desert Grass, Desert Annual
- Common: Saguaro, Barrel Cactus, Aloe, Euphorbia, Jade, Aromatic
- Minor: Bunchgrass, Caudiciform, Pampas
- Absent: Oak, Birch, Magnolia, Conifer, Tropical, Palm, Cypress, Holly, Hazel, Mangrove, Bramble, Flowering Shrub, Iceplant, Epiphytic, Wildflower, Tall Herb, Fern, Vine, Clover, Moss, Tropical Herb, Tallgrass, Turfgrass, Ryegrass, Sedge, Bamboo

---

**Hill+Temperate** — Alpine/rocky meadow
- Dominant: Bunchgrass, Turfgrass, Wildflower, Clover
- Common: Ryegrass, Moss, Tallgrass, Holly
- Minor: Conifer, Aromatic, Fern, Tall Herb
- Absent: Oak, Magnolia, Tropical, Palm, Birch, Cypress, Acacia, Hazel, Mediterranean, Bramble, Saltbush, Mangrove, Flowering Shrub, all Succulents, Bamboo, Pampas, Desert Grass, Sedge, Vine, Tropical Herb, Desert Annual

**Hill+Tropical** — Tropical highland / cloud forest
- Dominant: Bunchgrass, Tropical Herb, Fern, Conifer
- Common: Wildflower, Moss, Flowering Shrub, Epiphytic, Bamboo
- Minor: Tall Herb, Vine, Clover
- Absent: Oak, Magnolia, Palm, Birch, Cypress, Acacia, Holly, Hazel, Mediterranean, Saltbush, Mangrove, Aromatic, Saguaro, Barrel Cactus, Jade, Iceplant, Pampas, Desert Grass, Turfgrass, Ryegrass, Desert Annual

**Hill+Mediterranean** — Mediterranean rocky slopes
- Dominant: Bunchgrass, Mediterranean, Aromatic
- Common: Wildflower, Turfgrass, Clover, Cypress
- Minor: Euphorbia, Barrel Cactus, Holly, Ryegrass
- Absent: Oak, Magnolia, Tropical, Palm, Birch, Acacia, Hazel, Bramble, Saltbush, Mangrove, Flowering Shrub, Saguaro, Aloe, Iceplant, Epiphytic, Jade, Bamboo, Pampas, Desert Grass, Fern, Vine, Moss, Tropical Herb, Desert Annual

**Hill+Desert** — Desert rocky highlands
- Dominant: Saguaro, Barrel Cactus, Desert Grass, Bunchgrass
- Common: Desert Annual, Euphorbia, Saltbush, Aloe
- Minor: Caudiciform, Aromatic, Jade
- Absent: Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Acacia, Holly, Hazel, Mediterranean, Bramble, Mangrove, Flowering Shrub, Iceplant, Epiphytic, Tallgrass, Turfgrass, Ryegrass, Bamboo, Pampas, Sedge, Wildflower, Tall Herb, Fern, Vine, Clover, Moss, Tropical Herb

---

**Wetland+Temperate** — Temperate riparian forest / swamp
- Dominant: Birch, Cypress, Sedge, Fern
- Common: Oak, Mangrove, Hazel, Moss, Tall Herb, Wildflower, Tallgrass
- Minor: Bramble, Clover, Ryegrass, Holly
- Absent: Magnolia, Tropical, Palm, Acacia, Conifer, Mediterranean, Aromatic, Saltbush, Flowering Shrub, all Succulents, Bamboo, Pampas, Desert Grass, Bunchgrass, Turfgrass, Vine, Tropical Herb, Desert Annual

**Wetland+Tropical** — Tropical swamp / mangrove forest
- Dominant: Tropical, Palm, Mangrove, Fern, Bamboo
- Common: Magnolia, Vine, Tropical Herb, Sedge, Moss, Tall Herb
- Minor: Flowering Shrub, Epiphytic, Tallgrass
- Absent: Oak, Birch, Conifer, Cypress, Acacia, Holly, Hazel, Mediterranean, Aromatic, Bramble, Saltbush, Saguaro, Aloe, Barrel Cactus, Jade, Iceplant, Caudiciform, Euphorbia, Turfgrass, Ryegrass, Bunchgrass, Pampas, Desert Grass, Wildflower, Clover, Desert Annual

**Wetland+Mediterranean** — Seasonal Mediterranean wetland
- Dominant: Cypress, Mangrove, Sedge, Fern
- Common: Birch, Wildflower, Ryegrass, Tallgrass, Moss
- Minor: Mediterranean, Holly, Tall Herb, Clover
- Absent: Oak, Magnolia, Tropical, Palm, Acacia, Conifer, Hazel, Aromatic, Bramble, Saltbush, Flowering Shrub, all Succulents, Bamboo, Pampas, Desert Grass, Bunchgrass, Turfgrass, Vine, Tropical Herb, Desert Annual

**Wetland+Desert** — Desert oasis
- Dominant: Palm, Acacia, Sedge, Tallgrass
- Common: Fern, Ryegrass, Mangrove, Moss
- Minor: Saltbush, Wildflower, Clover
- Absent: Oak, Birch, Magnolia, Conifer, Tropical, Cypress, Holly, Hazel, Mediterranean, Aromatic, Bramble, Flowering Shrub, all Succulents, Bamboo, Pampas, Desert Grass, Bunchgrass, Turfgrass, Vine, Tall Herb, Tropical Herb, Desert Annual

---

**Arid+Temperate** — Temperate steppe / dry scrubland
- Dominant: Saltbush, Aromatic, Desert Grass, Bunchgrass
- Common: Aloe, Jade, Euphorbia, Ryegrass, Desert Annual, Holly
- Minor: Acacia, Caudiciform, Saguaro, Wildflower, Clover
- Absent: Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Hazel, Mediterranean, Bramble, Mangrove, Flowering Shrub, Iceplant, Epiphytic, Barrel Cactus, Tallgrass, Turfgrass, Bamboo, Pampas, Sedge, Tall Herb, Fern, Vine, Moss, Tropical Herb

**Arid+Tropical** — Tropical arid savanna
- Dominant: Acacia, Aloe, Euphorbia, Pampas
- Common: Saltbush, Desert Grass, Saguaro, Jade, Desert Annual, Tropical Herb
- Minor: Barrel Cactus, Caudiciform, Bunchgrass, Aromatic
- Absent: Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Holly, Hazel, Mediterranean, Bramble, Mangrove, Flowering Shrub, Iceplant, Epiphytic, Tallgrass, Turfgrass, Ryegrass, Bamboo, Sedge, Wildflower, Tall Herb, Fern, Vine, Clover, Moss

**Arid+Mediterranean** — Hot Mediterranean arid (Sonoran/North African)
- Dominant: Barrel Cactus, Saguaro, Aromatic, Mediterranean
- Common: Aloe, Euphorbia, Desert Grass, Desert Annual, Saltbush
- Minor: Jade, Caudiciform, Bunchgrass, Acacia, Wildflower
- Absent: Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Holly, Hazel, Bramble, Mangrove, Flowering Shrub, Iceplant, Epiphytic, Tallgrass, Turfgrass, Ryegrass, Bamboo, Pampas, Sedge, Tall Herb, Fern, Vine, Clover, Moss, Tropical Herb

**Arid+Desert** — Extreme desert (Sahara/Atacama interior)
- Dominant: Saguaro, Barrel Cactus (sparse)
- Common: Desert Grass (ephemeral), Desert Annual (ephemeral)
- Minor: Saltbush, Euphorbia, Jade, Caudiciform
- Absent: All Trees, all Shrubs except Saltbush, Iceplant, Epiphytic, Aloe, all Grasses except Desert Grass, all Forbs except Desert Annual
- Note: very low total population — near carrying-capacity floor

### 18.4 Tuning Progress

Pending — re-run experiments with full trait engine, FDS, facilitation, Janzen-Connell, and stress mortality active. Ralph loop iterations have tuned individual coefficients but comprehensive experiment results are needed.
