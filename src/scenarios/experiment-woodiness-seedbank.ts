import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT 15: Woodiness × Seed Bank
 * Two species with identical growth genomes but different woodiness (0.2 vs 0.8)
 * on pure arid terrain. Tests whether woodiness affects seed bank strategy —
 * do herbaceous plants build better seed banks on drought-prone terrain?
 */
export const experimentWoodinessSeedbank: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push({ x, y, terrain: TerrainType.Arid, elevation: 0.4 });
    }
  }

  return {
    id: 'experiment-woodiness-seedbank',
    name: '[Exp] Woodiness × Seed Bank',
    description:
      'Herbaceous (w=0.2) vs woody (w=0.8) on pure arid. Same growth genome. Tests whether low woodiness gives a seed bank advantage on drought-prone terrain.',
    size,
    defaultTerrain: TerrainType.Arid,
    defaultElevation: 0.4,
    cells,
    species: [
      {
        id: 1,
        name: 'Arid Herb',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.15,
          leafSize: 0.35,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.2,
      waterStorage: 0.3,
          longevity: 0.5,
        },
        color: { r: 0.7, g: 0.7, b: 0.2 },
        placements: scatter(25, 55, 25, 55, 25),
      },
      {
        id: 2,
        name: 'Arid Tree',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.15,
          leafSize: 0.35,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.8,
      waterStorage: 0.3,
          longevity: 0.5,
        },
        color: { r: 0.4, g: 0.3, b: 0.1 },
        placements: scatter(25, 55, 25, 55, 25),
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
