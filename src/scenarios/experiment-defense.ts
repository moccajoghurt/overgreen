import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Defense vs Herbivores
 * Two tree species with identical base genomes — one with high defense, one with none.
 * Herbivores auto-spawn at tick 200. Tests whether defense investment pays off
 * against grazing pressure (reduced grazing + thorn damage to herbivores).
 */
export const experimentDefense: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-defense',
    name: '[Exp] Defense vs Herbivores',
    description: 'Defended (defense 0.5) vs undefended trees. Herbivores spawn at tick 200. Tests whether defense investment pays off.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Thorny Holly',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.33,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.5,
          woodiness: 0.8,
        },
        color: { r: 0.2, g: 0.4, b: 0.2 },
        placements: scatter(30, 50, 30, 50, 15),
      },
      {
        id: 2,
        name: 'Soft Willow',
        genome: {
          rootPriority: 0.33,
          heightPriority: 0.33,
          leafSize: 0.33,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.8,
        },
        color: { r: 0.5, g: 0.7, b: 0.2 },
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
