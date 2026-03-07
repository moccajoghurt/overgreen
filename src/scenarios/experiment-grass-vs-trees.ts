import { Scenario, ScenarioCell, TerrainType } from '../types';

export const experimentGrassVsTrees: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-grass-vs-trees',
    name: '[Exp] Grass vs Trees',
    description:
      'Tests woodiness competition on flat soil. Low-woodiness species are cheap, fast-spreading, and short-lived. High-woodiness species are tall, shade-casting, and long-lived. Both use balanced genomes so the test isolates woodiness mechanics, not genome strategy.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Prairie Grass',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.1,
      waterStorage: 0.3,
          longevity: 0.3,
        },
        color: { r: 0.5, g: 0.8, b: 0.2 },
        placements: scatter(30, 50, 30, 50, 20),
      },
      {
        id: 2,
        name: 'Oak Tree',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.9,
      waterStorage: 0.3,
          longevity: 0.8,
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
