import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT 14: Woodiness Evolution
 * Three species with identical growth genomes but different starting woodiness (0.2/0.5/0.8).
 * Tests: Does woodiness diverge or converge on flat soil? Do distinct niches emerge?
 */
export const experimentWoodinessEvolution: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-woodiness-evolution',
    name: '[Exp] Woodiness Evolution',
    description:
      'Three species with identical growth genomes but woodiness 0.2/0.5/0.8 on flat soil. Tests whether woodiness diverges into niches or converges to one optimum.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Herb',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.2,
      waterStorage: 0.3,
          longevity: 0.5,
        },
        color: { r: 0.6, g: 0.9, b: 0.3 },
        placements: scatter(30, 50, 30, 50, 20),
      },
      {
        id: 2,
        name: 'Shrub',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.5,
      waterStorage: 0.3,
          longevity: 0.5,
        },
        color: { r: 0.3, g: 0.7, b: 0.3 },
        placements: scatter(30, 50, 30, 50, 20),
      },
      {
        id: 3,
        name: 'Tree',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.34,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.8,
      waterStorage: 0.3,
          longevity: 0.5,
        },
        color: { r: 0.1, g: 0.4, b: 0.1 },
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
