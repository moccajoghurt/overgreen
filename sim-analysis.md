# Overgreen Simulation — Critical Analysis

## Tick Pipeline

Every tick runs 7 phases in order:

```
 phaseEnvironment ──> phaseRechargeWater ──> phaseCalculateLight
         │                    │                       │
         v                    v                       v
  seasons, eras,       water += recharge      light = base - shade
  drought/fire/          nutrients decay
  disease spawn
         │
         └──────────> phaseUpdatePlants ──> phaseHerbivores ──> phaseDeath ──> phaseDecomposition
                             │                    │                  │               │
                             v                    v                  v               v
                      absorb water          graze leaves       energy<=0?      dead plants
                      photosynthesize       move & breed       age>=max?       return water
                      pay maintenance       metabolize                         return nutrients
                      grow + seed                                              free cell
```

---

## 1. ENERGY BUDGET — The Core Loop

Everything revolves around energy. A plant lives or dies by this equation:

```
  energy_change = photosynthesis - maintenance

  If surplus > 1.0:
    seedBudget = surplus × genome.seedInvestment × env.seedMult
    growthBudget = surplus × (1 - genome.seedInvestment) × env.growthMult
    energy -= seedBudget + growthBudget
```

### Photosynthesis formula:

```
  effectiveLeaf = leafArea ^ 0.7          (diminishing returns)
  heightLightBonus = height/maxH × 0.7    (trees get up to +0.7 light)
  rawEnergy = (lightLevel + heightLightBonus) × effectiveLeaf × 0.5

  rootAccess = 0.3 + 0.7 × (rootDepth / maxRoot)
  nutrientBonus = 1 + nutrients × rootAccess × 0.20

  energyProduced = rawEnergy × waterFraction × nutrientBonus
```

### Water absorption:

```
  waterNeeded = effectiveLeaf × 0.55      (transpiration demand)
  waterCanAbsorb = rootDepth × 0.4        (absorption capacity)
  waterAbsorbed = min(needed, canAbsorb, cellWater)

  waterFraction = waterAbsorbed / waterNeeded
  (0 to 1, directly scales photosynthesis)
```

### Maintenance formula:

```
  cost = 0.05                             base
       + height × 0.03                    per height
       + rootDepth × 0.03                 per root
       + effectiveLeaf × 0.04             per leaf
       + allelopathy × 0.06              chem warfare tax
       + defense × 0.05                   defense tax

  (terrain multipliers applied per-trait, see Section 5)
```

### Verdict: CRITICAL
This is the beating heart. Every other mechanic feeds into or drains from this budget.

---

## 2. WATER CYCLE

```
  Each tick per cell:
  ┌─────────────────────────────────────────┐
  │  waterLevel += rechargeRate × waterMult │  (capped at 10)
  │  Drought zones: recharge reduced,       │
  │    + evaporation of 0.3/tick            │
  └─────────────────────────────────────────┘

  Base recharge rates by terrain:
  ┌──────────┬──────────┬───────────────────┐
  │ Terrain  │ Recharge │ Notes             │
  ├──────────┼──────────┼───────────────────┤
  │ Soil     │ ~0.4     │ ×(0.7-1.3) random │
  │ River    │ 1.2      │ + seepage to adj  │
  │ Rock     │ 0.08     │ no plants         │
  │ Hill     │ ~0.16    │ 0.4 × penalty     │
  │ Wetland  │ 0.7      │ starts at 80%     │
  │ Arid     │ 0.12     │ + aquifer for     │
  │          │          │   deep roots      │
  └──────────┴──────────┴───────────────────┘

  River seepage: +0.4 water, +0.1 nutrients to all 8 neighbors every tick

  Root competition: if local cell runs dry, deep-rooted plants
  drain up to 6% × (rootDepth/10) from each neighbor cell
```

### Key question: Does water ever limit growth?

On Soil at steady-state: recharge ~0.4/tick. A mature plant with leafArea=4 needs
effectiveLeaf(4^0.7=2.64) × 0.55 = 1.45 water/tick, can absorb rootDepth×0.4.
With rootDepth=3: absorbs 1.2, needs 1.45 → waterFraction ≈ 0.83. **Water matters.**

On Arid: recharge 0.12/tick. Even rootDepth=3 can only absorb min(1.2, 0.12+aquifer).
**Water is the binding constraint on Arid.** Aquifer kicks in at >40% root fraction.

On Wetland: recharge 0.7 + starts high. Water is abundant. **Rarely limiting.**

### Verdict: SIGNIFICANT
Water genuinely limits growth on Soil and especially Arid. On Wetland it's nearly free.
Root competition (draining neighbors) is weak at 6% rate — probably noise for most scenarios.

---

## 3. LIGHT & SHADOWS

```
  Base light by terrain:
  ┌──────────┬───────┐
  │ Terrain  │ Light │
  ├──────────┼───────┤
  │ Soil     │ 1.00  │
  │ Hill     │ 1.35  │  (+0.35)
  │ Wetland  │ 0.75  │  (-0.25)
  │ Arid     │ 1.20  │  (+0.20)
  └──────────┴───────┘

  Shadow from taller neighbors (8 directions):
    For each taller neighbor:
      heightDiff = neighbor.height - my.height
      shade += 0.25 × min(1, heightDiff / 3.0)

    finalLight = max(0.1, baseLight - totalShade)

  So one neighbor at +3 height = -0.25 light.
  8 tall neighbors = -2.0 light → clamped to 0.1 minimum.
```

### Height light bonus (separate from shadows):
```
  Trees:  height/10 × 0.7 = up to +0.7 at max height
  Grass:  height/2  × 0.1 = up to +0.1 at max height

  On Wetland: bonus × 1.5 (canopy emergence reward)
```

### Key question: Do shadows actually suppress small plants?

A seedling (height=0.5) next to a mature tree (height=5):
- diff = 4.5, shade = 0.25 × min(1, 4.5/3) = 0.25
- With 3 tall neighbors: light drops from 1.0 to 0.25

Meanwhile the tall tree gets +0.35 height light bonus.
**Shadows create real competitive advantage for tall plants.**

### Grass shadows:
Grass SHADOW_REDUCTION = 0.05, SHADOW_HEIGHT_SCALE = 1.0
Even max grass (height=2) only casts 0.05 shadow. **Grass barely shades anything.**

### Verdict: SIGNIFICANT for trees, NOISE for grass
Tree height creates meaningful light competition. Grass shadow is negligible.

---

## 4. NUTRIENT CYCLING

```
  Every tick:
    nutrients -= 0.02 (decay)            [era can multiply this]

  When plant dies → decomposition:
    cell.water += 2.0 (tree) or 1.0 (grass)
    cell.nutrients += 1.5 + height × 0.3 (tree)
                   or 0.8 + height × 0.1 (grass)

  Nutrient bonus to photosynthesis:
    rootAccess = 0.3 + 0.7 × rootFrac   [always at least 30% access]
    bonus = 1 + nutrients × rootAccess × 0.20

  Example: nutrients=5, full roots → bonus = 1 + 5 × 1.0 × 0.2 = 2.0 (double energy!)
  Example: nutrients=2, half roots → bonus = 1 + 2 × 0.65 × 0.2 = 1.26 (+26%)
  Example: nutrients=0, any roots → bonus = 1.0 (no effect)
```

### Nutrient caps by terrain:
```
  Soil:    10.0 (default max)
  Hill:     3.0
  Arid:     1.5
  Wetland:  8.0
  Rock:     0.5
```

### Key question: Do nutrients cycle meaningfully?

Starting nutrients are 1-4 (random). Decay at 0.02/tick = 25 ticks to lose 0.5.
Decomposition of a height-5 tree returns 1.5 + 1.5 = 3.0 nutrients.
On soil, nutrients can accumulate over many death cycles → long-term enrichment.

On Hill (cap 3.0) and Arid (cap 1.5): nutrients are scarce.
**Root-gated access means shallow-rooted plants on nutrient-rich soil still get 30% minimum.**

Hill bedrock extraction: roots > 30% depth → extract 0.15 × rootFrac × rootDepth nutrients.
This is the only way to generate nutrients on hills beyond decomposition.

### Verdict: MODERATE
Nutrients amplify energy but don't hard-gate it like water does. The 0.3 minimum access
floor means even no-root plants get some benefit. The cycling through decomposition creates
interesting long-term dynamics. Hill bedrock extraction is interesting but the 3.0 cap limits it.

---

## 5. TERRAIN SPECIALIZATION

Each terrain applies maintenance multipliers per-trait:

```
  MAINTENANCE COST MULTIPLIERS (Soil = 1.0 baseline):
  ┌──────────┬───────┬────────┬──────┐
  │ Terrain  │ Root  │ Height │ Leaf │
  ├──────────┼───────┼────────┼──────┤
  │ Soil     │ 1.0   │ 1.0    │ 1.0  │
  │ Hill     │ 3.0   │ 1.5    │ 1.0  │  ← roots 3x expensive!
  │ Wetland  │ 2.5   │ 1.0    │ 0.85 │  ← roots 2.5x, leaves cheap
  │ Arid     │ 0.8   │ 1.2    │ 3.0  │  ← leaves 3x expensive!
  └──────────┴───────┴────────┴──────┘
```

### Seed fitness weights (additive on raw genome values 0-1):

```
  TERRAIN SEED FITNESS (genome value × weight, added to base 1.0):
  ┌──────────┬───────┬────────┬──────┐
  │ Terrain  │ Root  │ Height │ Leaf │
  ├──────────┼───────┼────────┼──────┤
  │ Soil     │  0    │  0     │  0   │  (no bias)
  │ Hill     │ -0.8  │ -0.5   │ +0.3 │  ← punish root/height genes
  │ Wetland  │ -0.8  │ +0.25  │ +0.4 │  ← punish root, reward leaf
  │ Arid     │ +0.6  │ -0.4   │ -0.8 │  ← reward root, punish leaf
  └──────────┴───────┴────────┴──────┘

  fitness = 1.0 + (root×wR + height×wH + leaf×wL)
  Capped at [0, 2.0]. Multiplies seedling energy.

  Example: high-root genome (root=0.8) on Arid:
    fitness = 1.0 + 0.8×0.6 + 0.2×(-0.4) + 0.2×(-0.8)
            = 1.0 + 0.48 - 0.08 - 0.16 = 1.24  (24% bonus energy)

  Example: high-root genome (root=0.8) on Hill:
    fitness = 1.0 + 0.8×(-0.8) + 0.2×(-0.5) + 0.2×(0.3)
            = 1.0 - 0.64 - 0.10 + 0.06 = 0.32  (68% penalty!)
```

### What does each terrain "want"?

```
  Hill:     Low-root, low-height, high-leaf  (shrub strategy)
            But: height gives +0.35 light, and Hill nutrient max is only 3.0
            Tension: roots expensive + punished in seeds, but needed for nutrients

  Wetland:  Low-root, tall, leafy  (canopy emergent)
            Water abundant, height bonus ×1.5, leaves cheap maintenance
            Root maint 2.5x and seed-punished

  Arid:     Deep-root, short, small-leaf  (desert specialist)
            Water scarce, leaves 3x maint, aquifer needs deep roots
            Root maint only 0.8x (easy digging)

  Soil:     Balanced — no penalties or bonuses, neutral playing field
```

### Verdict: SIGNIFICANT
The maintenance multipliers are strong (3x!). Seed fitness creates evolutionary pressure.
But the question is: **does the sim run long enough for these pressures to actually
differentiate species?** That's what the experiments need to test.

---

## 6. GROWTH ALLOCATION & CAPS

```
  Genome has: rootPriority, heightPriority, leafSize (each 0.01-0.99)
  Normalized to fractions: rFrac + hFrac + lFrac = 1.0

  Growth caps (dynamically computed from genome!):
    maxRoot   = CAP × (0.3 + 0.7 × rFrac)
    maxHeight = CAP × (0.3 + 0.7 × hFrac)
    maxLeaf   = CAP × (0.3 + 0.7 × lFrac)

  Tree caps:   root=10, height=10, leaf=8
  Grass caps:  root=3,  height=2,  leaf=4

  Example: genome {root:0.8, height:0.1, leaf:0.1} normalized → rFrac=0.8
    maxRoot   = 10 × (0.3 + 0.7×0.8) = 10 × 0.86 = 8.6
    maxHeight = 10 × (0.3 + 0.7×0.1) = 10 × 0.37 = 3.7
    maxLeaf   = 8  × (0.3 + 0.7×0.1) = 8  × 0.37 = 2.96

  Growth per tick:
    growthBudget × fraction × 0.3 (efficiency)

  With surplus=2, growthMult=1.0:
    rootGrowth = 2 × 0.5 (non-seed) × 0.8 (rFrac) × 0.3 = 0.24/tick
    Time to reach maxRoot 8.6 from 0.5 start: ~34 ticks
```

### Key insight: Dynamic caps mean specialists get big in their niche
A root-specialist can reach rootDepth=8.6 but max height only 3.7.
A height-specialist can reach height=8.6 but max root only 3.7.
**This is the main evolutionary lever — genome priorities directly determine morphology.**

### Verdict: CRITICAL
This, combined with terrain multipliers, is where strategies diverge.

---

## 7. REPRODUCTION

```
  seedBudget = surplus × genome.seedInvestment × env.seedMult
  seedsToSpawn = floor(seedBudget / SEED_COST)

  Tree: SEED_COST=0.8, seedling gets 2.0 energy
  Grass: SEED_COST=0.4, seedling gets 1.5 energy

  Seed range = SEED_RANGE_MAX + floor(height / DIVISOR)
  Tree: 3 + height/2    (max ~8 at height 10)
  Grass: 4 + height/4   (max ~4-5)

  Must land on empty, non-river, non-rock cell.

  Sexual reproduction: finds same-species mate within radius 4
    If mate found → crossover (50/50 per gene) then mutate
    If no mate → mutate parent genome only

  Mutation: each gene ± random × 0.1 (clamped 0.01-0.99)
```

### Seed investment tradeoff:
```
  High seedInvestment (0.8): 80% of surplus to seeds, 20% to growth
    → Many seeds but plant stays small
    → Small plant = less photosynthesis = less surplus = fewer seeds long-term

  Low seedInvestment (0.2): 20% to seeds, 80% to growth
    → Plant grows big = more photosynthesis
    → But fewer seeds = slower spread

  Sweet spot should be around 0.4-0.6 depending on terrain.
```

### Verdict: SIGNIFICANT
Reproduction drives population dynamics. The seedInvestment tradeoff is real.
Grass has a massive advantage in reproduction rate (half cost, wider base range).

---

## 8. SEASONS

```
  Year = 500 ticks (4 seasons × 125 ticks each)
  Cosine interpolation between season values.

  ┌─────────┬───────┬───────┬──────────┬────────┬──────┐
  │ Season  │ Water │ Light │ LeafMaint│ Growth │ Seed │
  ├─────────┼───────┼───────┼──────────┼────────┼──────┤
  │ Spring  │ 1.20  │ 1.00  │  1.0     │ 1.30   │ 1.0  │
  │ Summer  │ 0.80  │ 1.15  │  1.0     │ 1.00   │ 1.0  │
  │ Autumn  │ 1.00  │ 0.85  │  1.0     │ 0.50   │ 0.3  │
  │ Winter  │ 0.60  │ 0.50  │  3.0     │ 0.00   │ 0.0  │
  └─────────┴───────┴───────┴──────────┴────────┴──────┘

  Energy-based leaf drop: when production < maintenance AND leafMaintenanceMult > 1.0,
  plants instantly shed leaves to 0.1. This replaces the old gradual leaf decay system.

  Winter effects:
    - Light halved → photosynthesis ~50%
    - Leaf maintenance 3x → triggers leaf drop in mid-autumn
    - Deep-rooted plants insulate (up to 80% of winter leaf penalty)
    - Growth = 0 → no size increase
    - Seeds = 0 → no reproduction
    - Plants survive on stored energy + tiny photosynthesis from 0.1 leaf area
```

### Key question: Is winter actually lethal?

Maintenance at minimum (height=1, root=1, leaf=0.25, no allelo/defense):
  0.05 + 0.03 + 0.03 + 0.04×0.25^0.7×3.0 ≈ 0.05 + 0.03 + 0.03 + 0.04 = 0.15/tick
  (with root insulation reducing the leaf penalty)

Photosynthesis at winter minimum:
  light=0.5, effectiveLeaf=0.25^0.7=0.33, heightBonus=0.07
  raw = (0.5+0.07) × 0.33 × 0.5 = 0.094
  With water and nutrients: ~0.12

**Net energy: 0.12 - 0.15 = -0.03/tick. Over 125 ticks = -3.75 energy.**
Seedlings with 2.0 starting energy die in ~65 ticks of winter.
Mature plants with 5+ energy can survive one winter.

### Verdict: SIGNIFICANT
Seasons create real selection pressure. Winter is genuinely lethal for young/weak plants.
Root insulation against leaf maintenance is a subtle but meaningful mechanic.

---

## 9. CLIMATE ERAS

```
  Long-term shifts lasting 2500-5000 ticks (5-10 years):

  ┌────────────┬───────┬───────┬──────┬───────┬─────────┬──────────┐
  │ Era        │ Water │ Light │ Grow │ Mut   │ Drought │ Fire     │
  ├────────────┼───────┼───────┼──────┼───────┼─────────┼──────────┤
  │ Temperate  │ 1.0   │ 1.0   │ 1.0  │ 1.3   │ 1.0     │ 1.0      │
  │ Arid       │ 0.65  │ 1.15  │ 1.0  │ 1.0   │ 2.5     │ 2.0      │
  │ Lush       │ 1.4   │ 0.9   │ 1.0  │ 1.0   │ 0.2     │ 0.1      │
  │ Ice Age    │ 0.85  │ 0.7   │ 0.5  │ 0.7   │ 0.5     │ 0.3      │
  │ Volatile   │ 1.0   │ 1.0   │ 1.0  │ 1.5   │ 2.0     │ 2.5      │
  │ Fertile    │ 1.3   │ 1.1   │ 1.3  │ 1.0   │ 0.2     │ 0.1      │
  └────────────┴───────┴───────┴──────┴───────┴─────────┴──────────┘

  Era selection biased by population:
    <200 plants → favors Fertile/Temperate (recovery)
    >800 plants → favors Volatile/Arid (culling)
    >50% monoculture → favors Lush (disease punishes uniformity)

  Harsh eras (Arid, IceAge, Volatile) never follow each other.
  200-tick cosine transition between eras.
```

### Verdict: MODERATE
Eras multiply existing mechanics. They don't introduce new dynamics, they amplify
or suppress existing ones. The population-responsive selection is interesting for
preventing total extinction or runaway growth.

---

## 10. DISASTERS

### Drought:
```
  Summer only. Radius 8-20, duration 30-70 ticks, intensity 0.6-0.95.
  Effect: reduce water recharge + evaporate 0.3/tick in affected area.
  Impact: local water crisis → plants dependent on stored water or deep roots.
```

### Fire:
```
  Summer only (after 30% progress). Starts on cell with plant + low water (<2.0).
  Spread: 35% base × (1 - waterResist×0.7) × (0.4 + leafFuel×0.6)
  Duration: 8-16 ticks. Burns 3-5 ticks per cell.
  Kills plants instantly, +2 nutrients, -1.5 water.
  Rivers block fire spread.
```

### Disease (Blight):
```
  Not in winter. After tick 300. Requires genetic uniformity >50% in radius 5.
  Targets genetically similar plants (distance < 0.25).
  Spread: 30% × susceptibility² per tick.
  Effect: -0.15 energy/tick + 30% photosynthesis penalty.
  Duration: 40-80 ticks overall, 15-25 ticks per cell.

  This is the monoculture punisher — diverse populations are resistant.
```

### Verdict: MODERATE (individually), SIGNIFICANT (collectively)
Each disaster is localized and temporary. But they create selection pressure over time:
- Drought rewards deep roots
- Fire rewards high water areas and small leaf area
- Disease rewards genetic diversity

---

## 11. ALLELOPATHY (Chemical Warfare)

```
  If genome.allelopathy > 0.1:
    strength = allelopathy × (0.5 + 0.5 × rootDepth/10)
    damage = strength × 0.15 per neighbor per tick

  Cost: allelopathy × 0.06 maintenance per tick

  Example: allelopathy=0.8, rootDepth=5:
    strength = 0.8 × (0.5 + 0.25) = 0.6
    damage = 0.6 × 0.15 = 0.09 per neighbor per tick
    cost = 0.8 × 0.06 = 0.048 per tick

  With 4 neighbors: total damage dealt = 0.36, personal cost = 0.048
  ROI: 7.5x damage-to-cost ratio. BUT only useful if neighbors exist.
```

### Key question: Is allelopathy OP or useless?

In dense forests: 4+ neighbors → dealing 0.36 total damage for 0.048 cost = very strong.
In sparse areas: 0-1 neighbors → paying 0.048 for 0-0.09 damage = net loss.

**Allelopathy is situationally powerful but self-defeating: it kills neighbors,
which then removes the benefit, leaving only the maintenance cost.**

### Verdict: UNCERTAIN — needs testing
Theory says it should be useful in dense competition then decline. But does the
sim actually produce scenarios where this matters? Need experiment.

---

## 12. DEFENSE (Anti-Herbivore)

```
  Reduces grazing by: defense × 0.7 (70% at max defense)
  Damages herbivore: defense × 0.3 energy per graze
  Minimum leaf after graze: 0.2 × defense (protected reserve)
  Also reduces trample damage by (1 - defense)

  Cost: defense × 0.05 maintenance per tick

  But herbivores don't spawn until tick 200, start with only 12,
  and are capped at 150 population.
```

### Key question: Is the defense tax worth it?

Without herbivores (first 200 ticks): pure waste at 0.05×defense per tick.
With herbivores: depends on herbivore density.
If herbivores are rare: barely matters, you're paying tax for nothing.
If herbivores are swarming: saves your leaves = saves your photosynthesis.

**The problem: defense costs are constant, herbivore pressure is intermittent.**

### Verdict: UNCERTAIN — needs testing
Depends entirely on herbivore population dynamics. If herbivores stay low,
defense is pure noise. If they boom, it becomes critical.

---

## 13. GRASS vs TREE ARCHETYPE

```
  ┌─────────────────┬────────────┬────────────┐
  │ Property        │ Tree       │ Grass      │
  ├─────────────────┼────────────┼────────────┤
  │ Max height      │ 10         │ 2          │
  │ Max root        │ 10         │ 3          │
  │ Max leaf        │ 8          │ 4          │
  │ Maint base      │ 0.05       │ 0.02       │
  │ Maint/height    │ 0.03       │ 0.02       │
  │ Maint/root      │ 0.03       │ 0.02       │
  │ Maint/leaf      │ 0.04       │ 0.03       │
  │ Seed cost       │ 0.8        │ 0.4        │
  │ Seed energy     │ 2.0        │ 1.5        │
  │ Seed range      │ 3+h/2      │ 4+h/4     │
  │ Growth eff      │ 0.3        │ 0.5        │
  │ Max age         │ 2500       │ 750        │
  │ Shadow cast     │ 0.25       │ 0.05       │
  │ Height light    │ up to +0.7 │ up to +0.1 │
  │ Decomp nutr     │ 1.5+h×0.3  │ 0.8+h×0.1 │
  └─────────────────┴────────────┴────────────┘

  Grass strategy: cheap, fast-breeding, short-lived, many seeds
  Tree strategy: expensive, tall, long-lived, shade competitors
```

### Competition dynamics:
- Trees shade grass (0.25 per tall neighbor)
- Grass barely shades trees (0.05)
- Grass reproduces 2x cheaper → colonizes empty space faster
- Trees live 2.5x longer → hold territory once established

**Expected: grass colonizes first, trees gradually displace through shading.**

### Verdict: SIGNIFICANT
The two archetypes create fundamentally different strategies.

---

## MECHANICS RANKED BY IMPACT

```
  CRITICAL (drives everything):
    1. Energy budget (photosynthesis vs maintenance)
    2. Growth allocation / genome priorities
    3. Water absorption & limitation

  SIGNIFICANT (meaningfully affects outcomes):
    4. Terrain maintenance multipliers
    5. Light & shadow competition (trees only)
    6. Seasons (especially winter lethality)
    7. Reproduction / seedInvestment tradeoff
    8. Grass vs tree archetype differences
    9. Terrain seed fitness (evolutionary pressure)

  MODERATE (amplifies other mechanics):
   10. Nutrient cycling
   11. Climate eras
   12. Disasters (drought, fire, disease)

  UNCERTAIN (may be noise):
   13. Allelopathy — powerful in theory, self-defeating in practice?
   14. Defense — depends on herbivore pressure
   15. Root competition — 6% drain rate seems too weak
   16. Hill bedrock nutrient extraction — narrow niche
   17. Arid aquifer access — important on Arid, irrelevant elsewhere
```

---

## TEST SCENARIOS NEEDED

Each scenario isolates one or two mechanics to verify they work as expected.
Run each for 2000-3000 ticks and observe population/genome trends.

| # | Scenario | Tests | Terrain | Species |
|---|----------|-------|---------|---------|
| 1 | Monoculture Baseline | Carrying capacity, seasons | Flat soil | 1 balanced |
| 2 | Water Competition | Root depth vs leaf size | Flat soil | 2: root-heavy vs leaf-heavy |
| 3 | Light Competition | Height vs spread | Flat soil | 2: tall vs short-leafy |
| 4 | Seed Tradeoff | seedInvestment optimization | Flat soil | 3: low/mid/high seed investment |
| 5 | Allelopathy Duel | Chemical warfare value | Flat soil | 2: aggressive vs passive |
| 6 | Defense vs Herbivores | Defense gene value | Flat soil | 2: defended vs undefended |
| 7 | Hill Specialist | Terrain adaptation | Pure hills | 3: root/height/leaf specialists |
| 8 | Arid Specialist | Aquifer & water stress | Pure arid | 3: root/height/leaf specialists |
| 9 | Wetland Specialist | Height emergence | Pure wetland | 3: root/height/leaf specialists |
| 10 | Grass vs Trees | Archetype competition | Flat soil | 2: grass vs tree (same genome) |
| 11 | Nutrient Cycle | Decomposition enrichment | Flat soil, low nutrients | 1 species, sparse start |
| 12 | Terrain Mosaic | Multi-terrain adaptation | Mixed all types | 4 specialists |

---

## EXPERIMENT RESULTS

### Experiment 1: Monoculture Baseline
**Goal:** Can a single balanced grass species sustain itself on flat soil?
**Result:** NO — all grass dies in winter.

**Root cause:** Gradual leaf decay (0.01-0.03/tick) too slow. Plants bleed energy paying 3x leaf maintenance on slowly-shrinking leaves for 50+ ticks. Isolated plant survives with 0.096 energy margin, but any neighbor root competition (~3.8% water drain) pushes it over the edge. Also GRASS.MAX_AGE=200 means grass can't live through one 500-tick year.

**Fixes applied:**
1. Replaced gradual leaf decay with energy-based leaf drop — plants instantly shed leaves to 0.1 when losing energy and leafMaintenanceMult > 1.0
2. GRASS.MAX_AGE: 200 → 750 (1.5 years)
3. SIM.MAX_AGE (trees): 500 → 2500 (5 years)

**Verified:** Re-ran with 4 grass species varying leaf/root. All survived winter. Healthy seasonal cycle, population oscillating ~1100-3100.

### Experiment 2: Water Competition
**Goal:** Does deep roots or big leaves win when two tree species compete on flat soil?
**Result:** Broad Leaf wins 67/33%. Stable coexistence, Shannon 0.64.

Groundwater system changes made water less scarce on flat soil — water stress only 1-14% (previously cells dropped to 0.4-1.5). Deep Root's advantage is blunted when water isn't limiting. Shading (34-48%) is the real differentiator: Broad Leaf's larger leaf area → more photosynthesis → more seeds → more territory. Species spatially segregate (cross-species contact 5-13%). Both converge toward balanced genomes: Deep Root gains leaf (0.25→0.43), Broad Leaf gains root (0.31→0.39). Seed investment optimizes to 0.64-0.69 in both.

**Conclusion:** Leaf strategy wins on well-watered soil — realistic. Root advantage would show on drier terrain. No sim changes needed.

### Experiment 3: Light Competition
**Goal:** Does growing tall (shading others) or spreading leaves (more photosynthesis) win?
**Result:** Tall Pine wins 70/30%. Stable coexistence, Shannon 0.61.

Tall Pine leads from tick 250 (68%) and widens the gap to 70% by end. Shading 30-45% in summer creates real competitive pressure — height light bonus (+0.7 at max) gives Tall Pine strictly more energy at high density. Spread Fern survives by producing more raw energy in low-density windows (winter/spring, shading <17%). Population oscillates strongly (244-1473) with seasonal cycles. Spread Fern's leaf priority eroding (0.50→0.32) while height barely moves (0.26→0.25) — it's not adapting toward height, it's losing leaf specialists. Both species gain root (→0.38-0.39) and seed investment (→0.65-0.72). Spread Fern evolving higher allelopathy (0.05→0.18) and defense (0.04→0.22) as desperation traits.

**Conclusion:** Height gives a clear competitive edge on flat soil via shading. Both strategies coexist — matches real forest canopy/understory structure. No sim changes needed.

### Experiment 4: Seed Tradeoff
**Goal:** What's the optimal seed investment? Low (0.3) vs mid (0.5) vs high (0.7), identical base genomes.
**Result:** High Seed Birch wins (67%), Mid Seed Elm second (33%), Low Seed Oak extinct by tick ~2500.

Both High and Mid evolved toward seedInvestment ~0.65, converging from opposite directions. This is the apparent optimum on flat soil. Low Seed Oak survived as 1-15 plants for most of the run — individually healthy (highest energy at 2.06-2.49) but unable to reproduce fast enough. seedInvestment=0.3 is a death sentence.

High beats Mid because raw reproduction rate dominates on well-watered flat soil — with groundwater keeping water stress low (0-9%), the slight growth advantage of lower seed investment doesn't compensate for fewer offspring. Both survivors evolved deeper roots (→0.44-0.45) and bigger leaves (→0.41-0.48) while height stayed flat (~0.29-0.31). Mid Seed Elm compensated with notably larger leaves (0.48 vs 0.41) for more photosynthesis per plant.

**Conclusion:** Optimal seed investment ~0.65 on flat soil. Too little reproduction is fatal regardless of individual fitness. No sim changes needed.

### Experiment 5: Allelopathy Duel
**Goal:** Does chemical warfare (allelopathy 0.5) justify its maintenance cost against a passive competitor?
**Result:** Near-even coexistence — Toxic Walnut 52%, Peaceful Maple 48%. Shannon diversity 0.69 (stable).

With groundwater keeping water stress low (0-6%), both species are resilient enough to absorb allelopathic damage. Cross-species contact remains 7-31% throughout — no spatial segregation collapse like before. Allelopathy provides only a slight territorial edge (52 vs 48%) while costing 0.03/tick maintenance. Toxic Walnut's allelopathy evolving down faster than before (0.49 → 0.33) — stronger selection pressure against the expensive trait when it doesn't cause decisive kills. Peaceful Maple's allelopathy creeping up (0.05 → 0.12). Both converge on seed investment ~0.64.

**Conclusion:** Allelopathy is less effective with groundwater — well-watered plants absorb the damage without dying. Still provides a marginal territorial advantage but the trait is evolving away. No sim changes needed.

### Experiment 6: Defense vs Herbivores
**Goal:** Does defense (0.5) justify its maintenance cost against herbivore grazing?
**Result:** Yes (flipped from previous) — Thorny Holly (defended) wins 63/37%.

With groundwater boosting overall energy surplus, defense's fixed cost (0.025/tick) is a smaller fraction of income. Holly consistently has +0.15-0.30 higher energy than Willow in summer — defense protects leaves from grazing, enabling more photosynthesis and more seeds. Holly's defense evolving down slowly (0.52 → 0.45), Willow's creeping up (0.05 → 0.10). Holly maintains larger leaves (0.37 vs 0.30) because defense preserves them from herbivore damage.

**Conclusion:** Defense is marginally beneficial when plants have enough energy surplus to absorb the maintenance cost. Herbivore pressure is still dilute, but the cost-benefit ratio shifted with groundwater changes. No sim changes needed.

### Experiment 7: Hill Specialist
**Goal:** Do terrain pressures enforce specialization? Root/height/leaf specialists on pure hills.
**Result:** Deep Root Pine (root 0.6) dominates at 69%, Tall Spruce (height 0.6) survives at 31%, Broad Leaf Holly (leaf 0.6) extinct by tick ~1500. Winner flipped from height to roots.

Groundwater system gives deep-rooted plants direct subsurface water access — on hills with only 0.4x recharge, this is the decisive advantage. Water stress 5-19% in summer (higher than flat soil's 0-9%), confirming hills remain water-limited. Deep Root Pine leads from tick 1 (270 vs 55 vs 8). Tall Spruce survived only by massively evolving roots (0.20 → 0.62) while shedding height (0.64 → 0.33) — essentially becoming a root-height hybrid. Broad Leaf Holly died fast (3x leaf maintenance + high water demand). Population volatile with wild seasonal swings (peak 4203, trough 333).

**Conclusion:** Hill terrain still enforces specialization away from leaves, but groundwater shifted the winning strategy from height to roots. Deep root access to subsurface water now trumps height's shading advantage on water-scarce terrain. No sim changes needed.

### Experiment 8: Arid Specialist
**Goal:** Do arid terrain pressures enforce root specialization?
**Tuning required:** Arid water table was 3.0 (shallower than soil at 4.0!), making groundwater too accessible — even height specialists could tap the aquifer with moderate roots. Deepened to 5.0 so only root-dominant plants can reach groundwater.
**Result:** Deep Root Mesquite wins 97%. Broad Leaf Agave survives at 3%, Tall Saguaro extinct by tick ~2500.

Water stress back as meaningful constraint (6-22% in summer). Mesquite dominates from tick 1 via groundwater access (root priority 0.58→0.66). Saguaro collapsed to 1 plant by tick 750 — height advantage irrelevant without water. Agave survived only by evolving deep roots (0.20→0.56), essentially becoming a root specialist itself. Population grew healthily to 1350, no near-extinction bottleneck. Matches real desert ecology — deep-taprooted species (mesquite, acacia) dominate.

**Conclusion:** Arid terrain working correctly after deepening water table to 5.0. Root specialization is the winning strategy as expected.

### Experiment 9: Wetland Specialist
**Goal:** Do wetland terrain pressures enforce tall/leafy specialization?
**Result:** Broad Leaf Lotus (leaf 0.6) dominates at 76%, Tall Mangrove (height 0.6) coexists at 24%, Deep Root Cypress (root 0.6) extinct by tick ~2750. Winner flipped from height to leaves.

Lush ecosystem with peak pop 4528 (highest of all terrains). With groundwater ensuring water is never limiting (0-4% stress), cheap leaf maintenance (0.85x) becomes the dominant advantage. Lotus maintained leaf dominance (0.66→0.68) while evolving moderate roots (0.35→0.47) and height (0.29→0.40). Mangrove coexists at 24% via 1.5x height bonus — held steady at ~900-1100 plants throughout. Root specialist extinct due to 2.5x anoxic soil maintenance. More ecologically realistic than previous 99/1% result — real wetlands have both canopy trees and dense ground cover.

**Conclusion:** Wetland terrain correctly rewards cheap leaves when water is abundant. Height and leaf strategies coexist, matching real wetland ecology. No sim changes needed.

### Experiment 10: Grass vs Trees
**Goal:** Do archetype mechanics produce realistic ecological succession on flat soil?
**Result:** Prairie Grass wins 100%. Oak Tree extinct by tick ~3000. Complete reversal from previous.

Grass dominates from tick 1 (684 vs 281) via cheaper seeds (0.4 vs 0.8), faster growth (0.5 vs 0.3 efficiency), and high seed investment (0.55→0.71). Grass fills the grid before trees can establish height for shading — shading collapsed to 0-4% by mid-run. Grass evolved extreme root priority (0.33→0.65) for groundwater access. Oak slowly declined (281→83→5→0) despite evolving bigger leaves (0.30→0.44). Water stress significant (14-35%) unlike other flat-soil experiments, suggesting grass density is consuming water faster than trees can benefit from it.

**Concern:** Previous result showed textbook ecological succession (grass→forest). Now grass permanently dominates, which is less realistic on undisturbed flat soil — forests should eventually overtop grasslands via shading. Grass's reproduction advantage may be too strong relative to tree shading payoff. Worth investigating.

### Experiment 11: Nutrient Cycle
**Goal:** Does decomposition enrichment create a meaningful nutrient feedback loop? Do deep-rooted species benefit more from nutrient-rich soil?
**Result:** Shallow Leaf Fern dominates at 86%, Deep Root Oak survives at 14%. Both coexist through 3000 ticks.

Nutrient feedback loop still working: early population flat at ~64 (low soil nutrients, 31-65% water stress), then exponential growth as decomposition enriches soil — peak 2379 plants. Root-gated nutrient access now uses absolute depth (rootDepth/10), narrowing the gap between species (Oak rootAccess 0.64 vs Fern's 0.55). Fern wins via reproduction speed — more leaf area → more energy → more seeds. Both species converge toward balanced genomes: Fern gains root (0.10→0.36), Oak gains leaf (0.12→0.44). Oak maintains higher per-plant energy (1.67 vs 1.53) but is outnumbered 6:1.

**Conclusion:** Nutrient cycle creates healthy positive feedback without runaway growth. Root-gated access still rewards deep roots but the gap is narrower with absolute scaling. No tuning needed.
