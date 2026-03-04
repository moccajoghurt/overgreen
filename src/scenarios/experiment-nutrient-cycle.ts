import { Scenario, ScenarioCell, TerrainType } from '../types';

export const experimentNutrientCycle: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-nutrient-cycle',
    name: '[Exp] Nutrient Cycle',
    description:
      'Tests decomposition enrichment feedback loop. Deep-rooted species should benefit more from nutrient-rich soil left by dead plants (rootAccess gates nutrient bonus). Tall species produce more nutrients on death (1.5 + height×0.3). If the cycle works, root+height specialists should create a positive feedback loop.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Deep Root Oak',
        archetype: 'tree',
        genome: {
          rootPriority: 0.6,
          heightPriority: 0.3,
          leafSize: 0.1,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.4, g: 0.3, b: 0.1 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 2,
        name: 'Shallow Leaf Fern',
        archetype: 'tree',
        genome: {
          rootPriority: 0.1,
          heightPriority: 0.3,
          leafSize: 0.6,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.2, g: 0.7, b: 0.4 },
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
