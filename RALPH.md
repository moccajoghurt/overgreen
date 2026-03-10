## Goal

Build a plant ecosystem sim that realistically models how diverse environments form. This is an educational tool — the sim should teach people why temperate forests look different from deserts, why wetlands have different species than hilltops.

Achieve the 16-niche target matrix below: 4 terrains (Soil, Hill, Wetland, Arid) × 4 climates (Temperate, Tropical, Mediterranean, Desert). Each niche should produce its realistic community of coexisting plant subtypes.

## What you can do

- Add new systems or mechanics
- Remove or rework existing systems
- Tweak constants and tuning values

## Rules

- **Performance: target ≥150 ticks/sec.** The experiment runner reports `perfStats.ticksPerSecond` in every JSON output. Log it. If a change tanks perf below 200, optimize or revert — the sim must stay fast enough for rapid iteration.

## Experiments

4 experiments, each 80×80 with 35×35 pockets (1,225 cells). Run at 10,000 ticks, snapshot every 1000.

```
npx tsx scripts/run-experiment.ts <id> --ticks 10000 --interval 1000
```

| Experiment                              | Climate       | Niches                        |
| --------------------------------------- | ------------- | ----------------------------- |
| `experiment-terrain-quad`               | Temperate     | Soil/Hill/Wetland/Arid × Temp |
| `experiment-terrain-quad-tropical`      | Tropical      | Soil/Hill/Wetland/Arid × Trop |
| `experiment-terrain-quad-mediterranean` | Mediterranean | Soil/Hill/Wetland/Arid × Med  |
| `experiment-terrain-quad-desert`        | Desert        | Soil/Hill/Wetland/Arid × Des  |

Success = dominant subtypes match the target matrix per niche, ≥8 subtypes coexist per niche (Shannon H ≥ 2.5).

---

## Target Matrix

40 subtypes: Grasses — Turfgrass, Tallgrass, Bunchgrass, Bamboo, Ryegrass, Sedge, Pampas, Desert Grass. Trees — Oak, Magnolia, Conifer, Tropical, Palm, Birch, Cypress, Acacia. Shrubs — Holly, Hazel, Mediterranean, Bramble, Saltbush, Mangrove, Flowering Shrub, Aromatic. Succulents — Saguaro, Aloe, Caudiciform, Euphorbia, Iceplant, Epiphytic, Barrel Cactus, Jade. Forbs — Wildflower, Tall Herb, Fern, Vine, Clover, Moss, Tropical Herb, Desert Annual.

Each niche: **Dominant** (most abundant), **Common** (reliably present), **Minor** (sparse), **Absent** (ecologically impossible).

### Soil

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

### Hill

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

### Wetland

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

### Arid

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
