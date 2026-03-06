# Plant Subtypes — Visual Diversity System

## Background

Overgreen currently renders plants in 3 visual categories (tree, grass, succulent) with continuous genome-driven variation. While this produces variety, the plants don't look like recognizable real-world plant forms. We want players to see oaks, palms, cacti, bamboo — not just "generic tree #47".

We identified 24 real-world plant subtypes (6 per archetype) that represent the most important growth forms in nature. A photo reference sheet (`plant_reference_sheet.png`) was created with real images of each subtype for visual comparison.

The goal: every plant in the simulation grows into one of these 24 recognizable forms, determined by its genome. This system is coupled with speciation — when a speciation event occurs, the new species' genome gets classified into one of the 24 subtypes, and that subtype becomes a permanent part of the species identity. All members of a species render as their assigned subtype (with minor individual variation from genome drift). If drift is extreme enough to trigger another speciation event, the daughter species gets reclassified into a potentially different subtype. This makes evolution visually obvious — you can literally watch new plant forms emerge and diverge.

## The 24 Subtypes

| # | Archetype | Subtype | Representative Species |
|---|-----------|---------|----------------------|
| 1.1 | Grass | Turfgrass | Poa pratensis |
| 1.2 | Grass | Tallgrass | Andropogon gerardii |
| 1.3 | Grass | Bunch grass | Festuca idahoensis |
| 1.4 | Grass | Bamboo | Phyllostachys edulis |
| 1.5 | Grass | Spreading grass | Cynodon dactylon |
| 1.6 | Grass | Sedge/Rush | Cyperus papyrus |
| 2.1 | Tree | Broadleaf deciduous | Quercus robur |
| 2.2 | Tree | Broadleaf evergreen | Magnolia grandiflora |
| 2.3 | Tree | Conifer | Pinus sylvestris |
| 2.4 | Tree | Tropical hardwood | Swietenia mahagoni |
| 2.5 | Tree | Palm | Cocos nucifera |
| 2.6 | Tree | Pioneer/fast-growth | Betula pendula |
| 3.1 | Shrub | Evergreen shrub | Buxus sempervirens |
| 3.2 | Shrub | Deciduous shrub | Sambucus nigra |
| 3.3 | Shrub | Mediterranean | Rosmarinus officinalis |
| 3.4 | Shrub | Thorny/Armed | Ulex europaeus |
| 3.5 | Shrub | Desert shrub | Larrea tridentata |
| 3.6 | Shrub | Mangrove | Rhizophora mangle |
| 4.1 | Succulent | Stem succulent (Cactus) | Carnegiea gigantea |
| 4.2 | Succulent | Leaf succulent | Aloe vera |
| 4.3 | Succulent | Caudiciform | Adenium obesum |
| 4.4 | Succulent | Euphorbia | Euphorbia ingens |
| 4.5 | Succulent | Ice plant/Mesemb | Lithops |
| 4.6 | Succulent | Epiphytic succulent | Schlumbergera |

## Reference Material

- `plant_reference_sheet.png` — real photos of all 24 subtypes
- `scripts/plant_reference_sheet.py` — script that generated it from Wikimedia Commons
- `scripts/plant-gallery.html` — Three.js gallery for iterating on 3D plant models

## TODO

- [ ] **Phase 1: Nail the 3D silhouettes** — Review `plant-gallery.html`, iterate on each plant's geometry until all 24 are recognizable when compared to the photo reference sheet.

- [ ] **Phase 2: Subtype rendering module** — Extract finalized geometry into `src/renderer3d/plant-subtypes.ts`. Each subtype gets a builder function that produces the right mesh, replacing the current 3-category renderer.

- [ ] **Phase 3: Genome → subtype classification** — Add `classifySubtype(genome)` that maps genome traits to a subtype ID. Couple this with the speciation system so each species gets locked into a subtype at birth.

- [ ] **Phase 4: Starting species** — Assign deliberate subtypes to founding species so early gameplay shows visual variety from the start.
