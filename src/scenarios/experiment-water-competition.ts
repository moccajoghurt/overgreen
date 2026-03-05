import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Water Competition
 * Two tree species on flat soil — one root-leaning, one leaf-leaning.
 * Uses moderate genomes (0.5/0.25/0.25) to stay viable while still
 * testing whether root investment vs leaf investment makes a difference.
 * Run 1 with extreme genomes (0.8/0.1/0.1) → both went extinct at tick 500.
 * Extreme specialists can't generate enough surplus to reproduce.
 */
export const experimentWaterCompetition: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-water-competition',
    name: '[Exp] Water Competition',
    description: 'Root-leaning vs leaf-leaning trees on flat soil. Tests whether root investment pays off via water absorption advantage.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Deep Root Fern',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.25,
          leafSize: 0.25,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.2, g: 0.6, b: 0.2 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 2,
        name: 'Broad Leaf Fern',
        genome: {
          rootPriority: 0.25,
          heightPriority: 0.25,
          leafSize: 0.5,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.2, g: 0.3, b: 0.8 },
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
