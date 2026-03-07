import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Light Competition
 * Two tree species on flat soil — one height-leaning, one leaf-leaning.
 * Tests whether growing tall (shading others) beats spreading leaves (more photosynthesis).
 * Both have moderate root to stay viable.
 * Both species intermixed in the same central area so they directly compete for light.
 */
export const experimentLightCompetition: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-light-competition',
    name: '[Exp] Light Competition',
    description: 'Tall trees vs short leafy trees on flat soil. Tests whether height investment (shading) beats leaf investment (photosynthesis).',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Tall Pine',
        genome: {
          rootPriority: 0.25,
          heightPriority: 0.5,
          leafSize: 0.25,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.8,
      waterStorage: 0.3,
          longevity: 0.5,
        },
        color: { r: 0.1, g: 0.5, b: 0.1 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 2,
        name: 'Spread Fern',
        genome: {
          rootPriority: 0.25,
          heightPriority: 0.25,
          leafSize: 0.5,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.8,
      waterStorage: 0.3,
          longevity: 0.5,
        },
        color: { r: 0.7, g: 0.5, b: 0.1 },
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
