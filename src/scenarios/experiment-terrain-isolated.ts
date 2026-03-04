import { Scenario, ScenarioCell, TerrainType, ClimateEra } from '../types';

export const experimentTerrainIsolated: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Horizontal terrain bands separated by 9-row rock barriers
  // (max seed range = 3 + floor(10/2) = 8 cells, so need 9 rows to block)
  // Rows 0-14:   Hill (elevation 0.7)        — 15 rows
  // Rows 15-23:  Rock barrier                — 9 rows
  // Rows 24-38:  Soil (default)              — 15 rows
  // Rows 39-47:  Rock barrier                — 9 rows
  // Rows 48-62:  Wetland (elevation 0.3)     — 15 rows
  // Rows 63-71:  Rock barrier                — 9 rows
  // Rows 72-79:  Arid (elevation 0.4)        — 8 rows
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((y >= 15 && y <= 23) || (y >= 39 && y <= 47) || (y >= 63 && y <= 71)) {
        cells.push({ x, y, terrain: TerrainType.Rock, elevation: 0.5 });
      } else if (y < 15) {
        cells.push({ x, y, terrain: TerrainType.Hill, elevation: 0.7 });
      } else if (y >= 48 && y <= 62) {
        cells.push({ x, y, terrain: TerrainType.Wetland, elevation: 0.3 });
      } else if (y >= 72) {
        cells.push({ x, y, terrain: TerrainType.Arid, elevation: 0.4 });
      }
    }
  }

  return {
    id: 'experiment-terrain-isolated',
    name: '[Exp] Terrain Isolated',
    description:
      'Same as Terrain Mosaic but with rock barriers between terrain bands. Tests whether gene flow (cross-terrain seed spread) is preventing local adaptation. If species diverge more here, gene flow is the culprit. Era locked to Temperate to isolate terrain effects.',
    lockedEra: ClimateEra.Temperate,
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Alpha Fern',
        archetype: 'tree',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.2, g: 0.6, b: 0.2 },
        placements: scatter(10, 70, 2, 13, 15),
      },
      {
        id: 2,
        name: 'Beta Spruce',
        archetype: 'tree',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.6, g: 0.4, b: 0.1 },
        placements: scatter(10, 70, 26, 36, 15),
      },
      {
        id: 3,
        name: 'Gamma Willow',
        archetype: 'tree',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.3, g: 0.3, b: 0.7 },
        placements: scatter(10, 70, 50, 60, 15),
      },
      {
        id: 4,
        name: 'Delta Cactus',
        archetype: 'tree',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.7, g: 0.2, b: 0.4 },
        placements: scatter(10, 70, 73, 78, 15),
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
