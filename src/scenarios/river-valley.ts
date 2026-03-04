import { Scenario, ScenarioCell, TerrainType } from '../types';

/** Wide river with wetlands on one side, hills on the other. 3 species. */
export const riverValley: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Horizontal river through the middle (y = 38-41), 4 cells wide
  for (let x = 0; x < size; x++) {
    for (let ry = 38; ry <= 41; ry++) {
      cells.push({ x, y: ry, terrain: TerrainType.River, elevation: 0.3 });
    }
  }

  // Wetlands on the south side of the river (y = 42-58)
  for (let y = 42; y <= 58; y++) {
    for (let x = 0; x < size; x++) {
      const distFromRiver = y - 41;
      if (distFromRiver <= 12 && Math.random() < 0.7 - distFromRiver * 0.04) {
        cells.push({ x, y, terrain: TerrainType.Wetland, elevation: 0.35 + distFromRiver * 0.01 });
      }
    }
  }

  // Hills on the north side (y = 5-30)
  for (let y = 5; y <= 30; y++) {
    for (let x = 0; x < size; x++) {
      const distFromCenter = Math.abs(y - 17);
      if (distFromCenter < 12) {
        cells.push({
          x, y,
          terrain: TerrainType.Hill,
          elevation: 0.65 + (1 - distFromCenter / 12) * 0.25,
        });
      }
    }
  }

  // Scattered rocks in the hills
  for (let y = 8; y <= 25; y++) {
    for (let x = 5; x < 75; x += 3) {
      if (Math.random() < 0.08) {
        cells.push({ x, y, terrain: TerrainType.Rock, elevation: 0.8 });
      }
    }
  }

  return {
    id: 'river-valley',
    name: 'River Valley',
    description: 'A wide river separates northern highlands from southern wetlands. Three species compete for different niches.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.45,
    cells,
    species: [
      {
        id: 1,
        name: 'Highland Pine',
        archetype: 'tree',
        genome: { rootPriority: 0.4, heightPriority: 0.8, leafSize: 0.3, seedInvestment: 0.3, allelopathy: 0.15, defense: 0.2 },
        color: { r: 0.2, g: 0.5, b: 0.2 },
        placements: scatter(20, 60, 10, 28, 12),
      },
      {
        id: 2,
        name: 'Marsh Reed',
        archetype: 'grass',
        genome: { rootPriority: 0.7, heightPriority: 0.2, leafSize: 0.6, seedInvestment: 0.5, allelopathy: 0.1, defense: 0.1 },
        color: { r: 0.3, g: 0.7, b: 0.4 },
        placements: scatter(15, 65, 45, 55, 15),
      },
      {
        id: 3,
        name: 'Valley Oak',
        archetype: 'tree',
        genome: { rootPriority: 0.5, heightPriority: 0.5, leafSize: 0.6, seedInvestment: 0.4, allelopathy: 0.2, defense: 0.15 },
        color: { r: 0.6, g: 0.4, b: 0.2 },
        placements: scatter(10, 70, 60, 75, 10),
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
