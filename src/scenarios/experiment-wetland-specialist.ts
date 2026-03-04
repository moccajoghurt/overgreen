import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Wetland Specialist
 * Three tree species with different trait priorities on pure wetland terrain.
 * Wetland: 0.7 water recharge, -0.25 light, 1.5x height bonus, 2.5x root maint, 0.85x leaf maint.
 * Height/leaf specialists expected to dominate; root specialist should struggle.
 */
export const experimentWetlandSpecialist: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push({ x, y, terrain: TerrainType.Wetland, elevation: 0.3 });
    }
  }

  return {
    id: 'experiment-wetland-specialist',
    name: '[Exp] Wetland Specialist',
    description: 'Root vs height vs leaf specialists on pure wetland. Tests whether abundant water and height bonus drive tall/leafy specialization.',
    size,
    defaultTerrain: TerrainType.Wetland,
    defaultElevation: 0.3,
    cells,
    species: [
      {
        id: 1,
        name: 'Deep Root Cypress',
        archetype: 'tree',
        genome: {
          rootPriority: 0.6,
          heightPriority: 0.2,
          leafSize: 0.2,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.6, g: 0.3, b: 0.1 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 2,
        name: 'Tall Mangrove',
        archetype: 'tree',
        genome: {
          rootPriority: 0.2,
          heightPriority: 0.6,
          leafSize: 0.2,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.1, g: 0.4, b: 0.6 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 3,
        name: 'Broad Leaf Lotus',
        archetype: 'tree',
        genome: {
          rootPriority: 0.2,
          heightPriority: 0.2,
          leafSize: 0.6,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.2, g: 0.7, b: 0.2 },
        placements: scatter(30, 50, 30, 50, 15),
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
