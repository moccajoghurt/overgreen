import { Scenario, ScenarioCell, ScenarioSpecies, TerrainType, ClimateZone } from '../types';

/**
 * Terrain Quad (Desert): 4 terrain pockets (Soil, Hill, Wetland, Arid)
 * in a 2×2 layout, all under Desert climate. 35×35 pockets separated by 10-cell Rock barriers.
 *
 * Layout:
 *         x:0-34        x:35-44      x:45-79
 * y:0-34   Soil          Rock          Hill
 * y:35-44  Rock          Rock          Rock
 * y:45-79  Wetland       Rock          Arid
 *
 * Each pocket seeded with 5 starter species (one per archetype), 9 plants each.
 */
export const experimentTerrainQuadDesert: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  const quadrants = [
    { x0: 0,  x1: 34, y0: 0,  y1: 34, terrain: TerrainType.Soil,    elevation: 0.5 },
    { x0: 45, x1: 79, y0: 0,  y1: 34, terrain: TerrainType.Hill,    elevation: 0.7 },
    { x0: 0,  x1: 34, y0: 45, y1: 79, terrain: TerrainType.Wetland, elevation: 0.3 },
    { x0: 45, x1: 79, y0: 45, y1: 79, terrain: TerrainType.Arid,    elevation: 0.4 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const quad = quadrants.find(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
      if (quad) {
        cells.push({ x, y, terrain: quad.terrain, elevation: quad.elevation, climateZone: ClimateZone.Desert });
      } else {
        cells.push({ x, y, terrain: TerrainType.Rock, elevation: 0.5 });
      }
    }
  }

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

  const species: ScenarioSpecies[] = starterGenomes.map((s, i) => ({
    id: i + 1,
    name: s.name,
    genome: s.genome,
    color: s.color,
    placements: quadrants.flatMap(pocket => {
      const pw = pocket.x1 - pocket.x0 + 1;
      const ph = pocket.y1 - pocket.y0 + 1;
      const pts: { x: number; y: number }[] = [];
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
    id: 'experiment-terrain-quad-desert',
    name: '[Exp] Terrain Quad (Desert)',
    description: '2×2 grid of 4 terrain types (Soil, Hill, Wetland, Arid) under Desert climate, separated by 10-cell Rock barriers. 35×35 pockets (1,225 cells each).',
    size,
    defaultTerrain: TerrainType.Rock,
    defaultElevation: 0.5,
    cells,
    species,
  };
})();
