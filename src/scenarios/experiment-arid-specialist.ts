import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Arid Specialist
 * Three tree species with different trait priorities on pure arid terrain.
 * Arid: 0.2 water recharge, water table at depth 3.0 (deep roots tap groundwater), 3x leaf maint, 0.8x root maint.
 * Root specialist expected to dominate via groundwater access and cheap maintenance.
 */
export const experimentAridSpecialist: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push({ x, y, terrain: TerrainType.Arid, elevation: 0.4 });
    }
  }

  return {
    id: 'experiment-arid-specialist',
    name: '[Exp] Arid Specialist',
    description: 'Root vs height vs leaf specialists on pure arid. Tests whether aquifer access and cheap root maintenance drive specialization.',
    size,
    defaultTerrain: TerrainType.Arid,
    defaultElevation: 0.4,
    cells,
    species: [
      {
        id: 1,
        name: 'Deep Root Mesquite',
        genome: {
          rootPriority: 0.7,
          heightPriority: 0.2,
          leafSize: 0.1,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.4,
          waterStorage: 0.5,
          longevity: 0.5,
        },
        color: { r: 0.6, g: 0.4, b: 0.1 },
        placements: scatter(20, 60, 20, 60, 30),
      },
      {
        id: 2,
        name: 'Tall Saguaro',
        genome: {
          rootPriority: 0.3,
          heightPriority: 0.5,
          leafSize: 0.2,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.5,
          waterStorage: 0.6,
          longevity: 0.5,
        },
        color: { r: 0.1, g: 0.5, b: 0.5 },
        placements: scatter(20, 60, 20, 60, 30),
      },
      {
        id: 3,
        name: 'Desert Grass',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.2,
          leafSize: 0.4,
          seedInvestment: 0.6,
          seedSize: 0.4,
          defense: 0.0,
          woodiness: 0.15,
          waterStorage: 0.4,
          longevity: 0.3,
        },
        color: { r: 0.2, g: 0.7, b: 0.2 },
        placements: scatter(20, 60, 20, 60, 30),
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
