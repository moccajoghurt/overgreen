import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Monoculture baseline
 * One species with balanced genome on uniform soil terrain.
 * Tests: carrying capacity, seasonal cycles, growth/death balance.
 */
export const experimentMonoculture: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];
  // No cell overrides — all default soil at 0.5 elevation

  return {
    id: 'experiment-monoculture',
    name: '[Exp] Monoculture Baseline',
    description: 'Single balanced species on uniform soil. Tests carrying capacity and seasonal dynamics without competition.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Baseline Fern',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.5,
          leafSize: 0.5,
          seedInvestment: 0.5,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.15,
      waterStorage: 0.3,
          longevity: 0.5,
        },
        color: { r: 0.3, g: 0.7, b: 0.3 },
        placements: scatter(35, 45, 35, 45, 20),
      },
    ],
  };
})();

function scatter(x0: number, x1: number, y0: number, y1: number, count: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({
      x: x0 + Math.floor(Math.random() * (x1 - x0)),
      y: y0 + Math.floor(Math.random() * (y1 - y0)),
    });
  }
  return pts;
}
