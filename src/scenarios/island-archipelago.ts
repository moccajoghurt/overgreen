import { Scenario, ScenarioCell, TerrainType } from '../types';

/** River grid creating isolated "islands". 4 species, one per island. */
export const islandArchipelago: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Create a cross-shaped river system dividing the map into 4 quadrants
  // Horizontal river: y = 38-41
  for (let x = 0; x < size; x++) {
    for (let ry = 38; ry <= 41; ry++) {
      cells.push({ x, y: ry, terrain: TerrainType.River, elevation: 0.25 });
    }
  }

  // Vertical river: x = 38-41
  for (let y = 0; y < size; y++) {
    for (let rx = 38; rx <= 41; rx++) {
      // Don't double-add the intersection
      if (y >= 38 && y <= 41) continue;
      cells.push({ x: rx, y, terrain: TerrainType.River, elevation: 0.25 });
    }
  }

  // Wetlands along rivers
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distH = Math.min(Math.abs(y - 38), Math.abs(y - 41));
      const distV = Math.min(Math.abs(x - 38), Math.abs(x - 41));
      const distRiver = Math.min(distH, distV);
      if (distRiver >= 1 && distRiver <= 3 && Math.random() < 0.4) {
        cells.push({ x, y, terrain: TerrainType.Wetland, elevation: 0.35 });
      }
    }
  }

  // Each quadrant gets some hills
  const quadrants = [
    { x0: 5, x1: 35, y0: 5, y1: 35 },   // NW
    { x0: 44, x1: 75, y0: 5, y1: 35 },   // NE
    { x0: 5, x1: 35, y0: 44, y1: 75 },   // SW
    { x0: 44, x1: 75, y0: 44, y1: 75 },  // SE
  ];

  for (const q of quadrants) {
    const hcx = Math.floor((q.x0 + q.x1) / 2);
    const hcy = Math.floor((q.y0 + q.y1) / 2);
    for (let y = q.y0; y <= q.y1; y++) {
      for (let x = q.x0; x <= q.x1; x++) {
        const dist = Math.sqrt((x - hcx) ** 2 + (y - hcy) ** 2);
        if (dist < 6 && Math.random() < 0.6) {
          cells.push({ x, y, terrain: TerrainType.Hill, elevation: 0.7 + (1 - dist / 6) * 0.2 });
        }
      }
    }
  }

  return {
    id: 'island-archipelago',
    name: 'Island Archipelago',
    description: 'Rivers divide the map into four isolated islands. Each starts with its own species — who will cross the water first?',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.45,
    cells,
    species: [
      {
        id: 1,
        name: 'Northern Elm',
        archetype: 'tree',
        genome: { rootPriority: 0.5, heightPriority: 0.7, leafSize: 0.5, seedInvestment: 0.4, allelopathy: 0.1, defense: 0.15 },
        color: { r: 0.25, g: 0.55, b: 0.2 },
        placements: scatter(10, 30, 10, 30, 8),
      },
      {
        id: 2,
        name: 'Eastern Birch',
        archetype: 'tree',
        genome: { rootPriority: 0.4, heightPriority: 0.5, leafSize: 0.7, seedInvestment: 0.5, allelopathy: 0.2, defense: 0.1 },
        color: { r: 0.5, g: 0.6, b: 0.25 },
        placements: scatter(50, 70, 10, 30, 8),
      },
      {
        id: 3,
        name: 'Southern Fern',
        archetype: 'grass',
        genome: { rootPriority: 0.6, heightPriority: 0.2, leafSize: 0.6, seedInvestment: 0.6, allelopathy: 0.15, defense: 0.1 },
        color: { r: 0.2, g: 0.7, b: 0.5 },
        placements: scatter(10, 30, 50, 70, 10),
      },
      {
        id: 4,
        name: 'Desert Thorn',
        archetype: 'tree',
        genome: { rootPriority: 0.8, heightPriority: 0.3, leafSize: 0.3, seedInvestment: 0.4, allelopathy: 0.4, defense: 0.5 },
        color: { r: 0.7, g: 0.5, b: 0.2 },
        placements: scatter(50, 70, 50, 70, 8),
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
