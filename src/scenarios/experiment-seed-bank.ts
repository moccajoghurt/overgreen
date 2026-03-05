import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * EXPERIMENT: Seed Bank Resilience
 * Tests the seed bank system: dormant seeds persist through harsh conditions
 * and germinate when water returns. Two grass species with identical base
 * genomes except seed investment, on drought-prone arid terrain.
 *
 * Key mechanics tested:
 * - Seeds land dormant, germinate when cell empty + water >= threshold (1.5)
 * - Seeds decay at 0.04 energy/tick, max age 40
 * - Highest-energy seed wins germination slot per cell
 * - Drought kills adults → larger seed bank enables faster recolonization
 *
 * Both species are grass with same root/height/leaf priorities.
 * Only variable: seedInvestment (0.75 vs 0.30).
 * Hypothesis: Heavy seeder builds larger seed bank, recolonizes faster
 * after drought crashes. Light seeder grows bigger individually but
 * can't recover from population crashes.
 */
export const experimentSeedBank: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Arid terrain — low water recharge, frequent droughts kill adults,
  // seeds must persist and germinate between drought events
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push({ x, y, terrain: TerrainType.Arid, elevation: 0.4 });
    }
  }

  return {
    id: 'experiment-seed-bank',
    name: '[Exp] Seed Bank Resilience',
    description: 'High-seed grass vs low-seed grass on drought-prone arid. Tests whether larger seed banks buffer population crashes and enable faster recolonization after drought.',
    size,
    defaultTerrain: TerrainType.Arid,
    defaultElevation: 0.4,
    cells,
    species: [
      {
        id: 1,
        name: 'Seedbank Grass',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.15,
          leafSize: 0.35,
          seedInvestment: 0.65,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.15,
        },
        color: { r: 0.7, g: 0.7, b: 0.2 },
        placements: scatter(25, 55, 25, 55, 25),
      },
      {
        id: 2,
        name: 'Holdfast Sedge',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.15,
          leafSize: 0.35,
          seedInvestment: 0.45,
          seedSize: 0.5,
          defense: 0.0,
          woodiness: 0.15,
        },
        color: { r: 0.4, g: 0.5, b: 0.2 },
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
