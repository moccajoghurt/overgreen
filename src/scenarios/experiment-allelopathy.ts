import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Allelopathy Duel
 * Two tree species with identical base genomes — one with high allelopathy, one with none.
 * Tests whether chemical warfare's damage to neighbors justifies its maintenance cost.
 */
export const experimentAllelopathy: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-allelopathy',
    name: '[Exp] Allelopathy Duel',
    description: 'Aggressive (high allelopathy) vs passive (none) on flat soil. Tests whether chemical warfare pays for itself.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Toxic Walnut',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.33,
          seedInvestment: 0.5,
          allelopathy: 0.5,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.6, g: 0.1, b: 0.6 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 2,
        name: 'Peaceful Maple',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.33,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.2, g: 0.7, b: 0.3 },
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
