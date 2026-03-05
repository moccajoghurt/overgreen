import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Seed Tradeoff
 * Three tree species with identical base genomes but different seed investment.
 * Tests r/K selection: do many small offspring beat fewer large ones?
 */
export const experimentSeedTradeoff: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-seed-tradeoff',
    name: '[Exp] Seed Tradeoff',
    description: 'Low vs mid vs high seed investment on flat soil. Tests whether investing in reproduction or growth wins.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Low Seed Oak',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.33,
          seedInvestment: 0.3,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.8,
      waterStorage: 0.3,
        },
        color: { r: 0.6, g: 0.2, b: 0.2 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 2,
        name: 'Mid Seed Elm',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.33,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.8,
      waterStorage: 0.3,
        },
        color: { r: 0.2, g: 0.6, b: 0.2 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 3,
        name: 'High Seed Birch',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.33,
          seedInvestment: 0.7,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.8,
      waterStorage: 0.3,
        },
        color: { r: 0.2, g: 0.2, b: 0.6 },
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
