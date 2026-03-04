import { Scenario, ScenarioCell, TerrainType } from '../types';

export const experimentGrassVsTrees: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-grass-vs-trees',
    name: '[Exp] Grass vs Trees',
    description:
      'Tests archetype competition on flat soil. Grass is cheap, fast-spreading, and short-lived. Trees are tall, shade-casting, and long-lived. Both use balanced genomes so the test isolates archetype mechanics, not genome strategy.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Prairie Grass',
        archetype: 'grass',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.5, g: 0.8, b: 0.2 },
        placements: scatter(30, 50, 30, 50, 20),
      },
      {
        id: 2,
        name: 'Oak Tree',
        archetype: 'tree',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.2, g: 0.5, b: 0.2 },
        placements: scatter(30, 50, 30, 50, 20),
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
