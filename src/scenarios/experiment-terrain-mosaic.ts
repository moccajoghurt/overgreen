import { Scenario, ScenarioCell, TerrainType } from '../types';

export const experimentTerrainMosaic: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Horizontal terrain bands:
  // Rows 0-19:  Hill (elevation 0.7)
  // Rows 20-39: Soil (default, no override needed)
  // Rows 40-59: Wetland (elevation 0.3)
  // Rows 60-79: Arid (elevation 0.4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (y < 20) {
        cells.push({ x, y, terrain: TerrainType.Hill, elevation: 0.7 });
      } else if (y >= 40 && y < 60) {
        cells.push({ x, y, terrain: TerrainType.Wetland, elevation: 0.3 });
      } else if (y >= 60) {
        cells.push({ x, y, terrain: TerrainType.Arid, elevation: 0.4 });
      }
    }
  }

  return {
    id: 'experiment-terrain-mosaic',
    name: '[Exp] Terrain Mosaic',
    description:
      'Tests multi-terrain adaptation. Four terrain bands (hill, soil, wetland, arid) with 4 generalist species scattered across the whole map. Do terrain pressures cause divergent evolution? Does the ecosystem maintain higher biodiversity than single-terrain experiments?',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Alpha Fern',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.2, g: 0.6, b: 0.2 },
        placements: scatter(10, 70, 5, 75, 10),
      },
      {
        id: 2,
        name: 'Beta Spruce',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.6, g: 0.4, b: 0.1 },
        placements: scatter(10, 70, 5, 75, 10),
      },
      {
        id: 3,
        name: 'Gamma Willow',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.3, g: 0.3, b: 0.7 },
        placements: scatter(10, 70, 5, 75, 10),
      },
      {
        id: 4,
        name: 'Delta Cactus',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.7, g: 0.2, b: 0.4 },
        placements: scatter(10, 70, 5, 75, 10),
      },
    ],
  };
})();

function scatter(x0: number, x1: number, y0: number, y1: number, count: number) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({
      x: x0 + Math.floor(Math.random() * (x1 - x0)),
      y: y0 + Math.floor(Math.random() * (y1 - y0)),
    });
  }
  return pts;
}
