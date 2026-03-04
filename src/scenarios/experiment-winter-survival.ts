import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Winter Survival
 * Four grass species on flat soil, each in their own quadrant (no competition).
 * Varies leaf vs root investment to find what survives winter.
 *
 * Key question: the 3x leaf maintenance in winter — does low-leaf survive better?
 */
export const experimentWinterSurvival: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-winter-survival',
    name: '[Exp] Winter Survival',
    description: 'Four grass species in separate quadrants varying leaf vs root. Which genome survives winter on flat soil?',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Balanced',
        archetype: 'grass',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.33,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.3, g: 0.7, b: 0.3 },
        placements: scatter(10, 30, 10, 30, 15),
      },
      {
        id: 2,
        name: 'Root Heavy',
        archetype: 'grass',
        genome: {
          rootPriority: 0.6,
          heightPriority: 0.2,
          leafSize: 0.2,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.6, g: 0.4, b: 0.2 },
        placements: scatter(50, 70, 10, 30, 15),
      },
      {
        id: 3,
        name: 'Leaf Heavy',
        archetype: 'grass',
        genome: {
          rootPriority: 0.2,
          heightPriority: 0.2,
          leafSize: 0.6,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.2, g: 0.3, b: 0.8 },
        placements: scatter(10, 30, 50, 70, 15),
      },
      {
        id: 4,
        name: 'Minimal Leaf',
        archetype: 'grass',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.4,
          leafSize: 0.2,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.8, g: 0.6, b: 0.2 },
        placements: scatter(50, 70, 50, 70, 15),
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
