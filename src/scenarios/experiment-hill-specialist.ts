import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Hill Specialist
 * Three tree species with identical base genomes but different trait priorities.
 * All on pure hill terrain. Tests whether terrain pressure enforces specialization
 * (hills favor leaf-heavy strategies: +0.35 light, 1.0x leaf maint, but 3x root / 1.5x height maint).
 */
export const experimentHillSpecialist: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Fill entire map with hill terrain
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push({ x, y, terrain: TerrainType.Hill, elevation: 0.7 });
    }
  }

  return {
    id: 'experiment-hill-specialist',
    name: '[Exp] Hill Specialist',
    description: 'Root vs height vs leaf specialists on pure hills. Tests whether terrain pressure enforces specialization (hills favor leaves, punish roots/height).',
    size,
    defaultTerrain: TerrainType.Hill,
    defaultElevation: 0.7,
    cells,
    species: [
      {
        id: 1,
        name: 'Deep Root Pine',
        genome: {
          rootPriority: 0.6,
          heightPriority: 0.2,
          leafSize: 0.2,
          seedInvestment: 0.5,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.6, g: 0.3, b: 0.1 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 2,
        name: 'Tall Spruce',
        genome: {
          rootPriority: 0.2,
          heightPriority: 0.6,
          leafSize: 0.2,
          seedInvestment: 0.5,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.1, g: 0.4, b: 0.6 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 3,
        name: 'Broad Leaf Holly',
        genome: {
          rootPriority: 0.2,
          heightPriority: 0.2,
          leafSize: 0.6,
          seedInvestment: 0.5,
          defense: 0.0,
          woodiness: 0.8,
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
