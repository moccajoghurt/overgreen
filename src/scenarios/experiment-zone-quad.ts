import { Scenario, ScenarioCell, ScenarioSpecies, TerrainType, ClimateZone } from '../types';

/**
 * Zone Quad: 4 climate zone pockets (Temperate, Tropical, Mediterranean, Desert)
 * in a 2×2 layout, all on Soil terrain. 35×35 pockets separated by 10-cell Rock barriers.
 *
 * Layout:
 *         x:0-34        x:35-44      x:45-79
 * y:0-34   Temperate     Rock          Tropical
 * y:35-44  Rock          Rock          Rock
 * y:45-79  Mediterranean Rock          Desert
 *
 * Each pocket seeded with 5 starter species (one per archetype), 9 plants each.
 * Larger pockets than Niche Matrix (1,225 vs 169 cells) for reliable subtype emergence.
 */
export const experimentZoneQuad: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  const quadrants = [
    { x0: 0,  x1: 34, y0: 0,  y1: 34, zone: ClimateZone.Temperate },
    { x0: 45, x1: 79, y0: 0,  y1: 34, zone: ClimateZone.Tropical },
    { x0: 0,  x1: 34, y0: 45, y1: 79, zone: ClimateZone.Mediterranean },
    { x0: 45, x1: 79, y0: 45, y1: 79, zone: ClimateZone.Desert },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const quad = quadrants.find(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
      if (quad) {
        cells.push({ x, y, terrain: TerrainType.Soil, elevation: 0.5, climateZone: quad.zone });
      } else {
        cells.push({ x, y, terrain: TerrainType.Rock, elevation: 0.5 });
      }
    }
  }

  // Starter species genomes (one per archetype) — same as Niche Matrix
  const starterGenomes: { name: string; genome: ScenarioSpecies['genome']; color: ScenarioSpecies['color'] }[] = [
    {
      name: 'Starter Grass',
      genome: { rootPriority: 0.40, heightPriority: 0.30, leafSize: 0.30, seedInvestment: 0.50, seedSize: 0.40, defense: 0.10, woodiness: 0.15, waterStorage: 0.10, longevity: 0.30 },
      color: { r: 0.3, g: 0.7, b: 0.2 },
    },
    {
      name: 'Starter Forb',
      genome: { rootPriority: 0.30, heightPriority: 0.25, leafSize: 0.60, seedInvestment: 0.50, seedSize: 0.35, defense: 0.25, woodiness: 0.20, waterStorage: 0.20, longevity: 0.35 },
      color: { r: 0.6, g: 0.3, b: 0.6 },
    },
    {
      name: 'Starter Shrub',
      genome: { rootPriority: 0.35, heightPriority: 0.30, leafSize: 0.40, seedInvestment: 0.40, seedSize: 0.45, defense: 0.30, woodiness: 0.55, waterStorage: 0.30, longevity: 0.50 },
      color: { r: 0.5, g: 0.5, b: 0.2 },
    },
    {
      name: 'Starter Tree',
      genome: { rootPriority: 0.35, heightPriority: 0.40, leafSize: 0.90, seedInvestment: 0.40, seedSize: 0.40, defense: 0.25, woodiness: 0.10, waterStorage: 0.02, longevity: 0.45 },
      color: { r: 0.35, g: 0.25, b: 0.10 },
    },
    {
      name: 'Starter Succulent',
      genome: { rootPriority: 0.35, heightPriority: 0.20, leafSize: 0.30, seedInvestment: 0.40, seedSize: 0.55, defense: 0.30, woodiness: 0.50, waterStorage: 0.65, longevity: 0.50 },
      color: { r: 0.4, g: 0.7, b: 0.5 },
    },
  ];

  // Place 4 plants per species per pocket using deterministic spacing
  const species: ScenarioSpecies[] = starterGenomes.map((s, i) => ({
    id: i + 1,
    name: s.name,
    genome: s.genome,
    color: s.color,
    placements: quadrants.flatMap(pocket => {
      const pw = pocket.x1 - pocket.x0 + 1;
      const ph = pocket.y1 - pocket.y0 + 1;
      const pts: { x: number; y: number }[] = [];
      // 3×3 grid per species (9 plants), offset by species index to avoid overlap
      const ox = 2 + (i % 3) * 2;
      const oy = 2 + Math.floor(i / 3) * 2;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const px = pocket.x0 + ((ox + c * Math.floor(pw / 3)) % pw);
          const py = pocket.y0 + ((oy + r * Math.floor(ph / 3)) % ph);
          pts.push({ x: px, y: py });
        }
      }
      return pts;
    }),
  }));

  return {
    id: 'experiment-zone-quad',
    name: '[Exp] Zone Quad',
    description: '2×2 grid of 4 climate zones (Temperate, Tropical, Mediterranean, Desert) on Soil terrain, separated by 10-cell Rock barriers. 35×35 pockets (1,225 cells each) for reliable subtype emergence.',
    size,
    defaultTerrain: TerrainType.Rock,
    defaultElevation: 0.5,
    cells,
    species,
  };
})();
