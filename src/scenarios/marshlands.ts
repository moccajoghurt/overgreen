import { Scenario, ScenarioCell, TerrainType } from '../types';

/** Mostly wetland with scattered hill outcrops. 3 species. */
export const marshlands: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Fill most of the map with wetland
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push({ x, y, terrain: TerrainType.Wetland, elevation: 0.3 + Math.random() * 0.05 });
    }
  }

  // Winding streams through the marsh
  const streams = [
    { startX: 0, startY: 20, horizontal: true },
    { startX: 0, startY: 55, horizontal: true },
    { startX: 25, startY: 0, horizontal: false },
    { startX: 60, startY: 0, horizontal: false },
  ];

  for (const stream of streams) {
    let x = stream.startX;
    let y = stream.startY;
    while (x >= 0 && x < size && y >= 0 && y < size) {
      for (let d = -1; d <= 0; d++) {
        const rx = stream.horizontal ? x : x + d;
        const ry = stream.horizontal ? y + d : y;
        if (rx >= 0 && rx < size && ry >= 0 && ry < size) {
          cells.push({ x: rx, y: ry, terrain: TerrainType.River, elevation: 0.2 });
        }
      }
      if (stream.horizontal) {
        x++;
        y += Math.random() < 0.3 ? (Math.random() < 0.5 ? 1 : -1) : 0;
        y = Math.max(2, Math.min(size - 3, y));
      } else {
        y++;
        x += Math.random() < 0.3 ? (Math.random() < 0.5 ? 1 : -1) : 0;
        x = Math.max(2, Math.min(size - 3, x));
      }
    }
  }

  // Hill outcrops (small islands of higher ground)
  const outcrops = [
    { cx: 15, cy: 40, r: 6 },
    { cx: 45, cy: 15, r: 5 },
    { cx: 65, cy: 45, r: 7 },
    { cx: 35, cy: 65, r: 5 },
    { cx: 70, cy: 70, r: 4 },
  ];

  for (const oc of outcrops) {
    for (let y = oc.cy - oc.r; y <= oc.cy + oc.r; y++) {
      for (let x = oc.cx - oc.r; x <= oc.cx + oc.r; x++) {
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const dist = Math.sqrt((x - oc.cx) ** 2 + (y - oc.cy) ** 2);
        if (dist <= oc.r) {
          cells.push({
            x, y,
            terrain: TerrainType.Hill,
            elevation: 0.6 + (1 - dist / oc.r) * 0.3,
          });
        }
      }
    }
  }

  return {
    id: 'marshlands',
    name: 'Marshlands',
    description: 'A vast marsh dotted with hill outcrops. Water is plentiful but firm ground is scarce.',
    size,
    defaultTerrain: TerrainType.Wetland,
    defaultElevation: 0.3,
    cells,
    species: [
      {
        id: 1,
        name: 'Bog Willow',
        archetype: 'tree',
        genome: { rootPriority: 0.6, heightPriority: 0.6, leafSize: 0.5, seedInvestment: 0.3, allelopathy: 0.1, defense: 0.1 },
        color: { r: 0.3, g: 0.55, b: 0.3 },
        placements: scatter(5, 75, 5, 75, 12),
      },
      {
        id: 2,
        name: 'Marsh Grass',
        archetype: 'grass',
        genome: { rootPriority: 0.5, heightPriority: 0.2, leafSize: 0.7, seedInvestment: 0.7, allelopathy: 0.1, defense: 0.05 },
        color: { r: 0.4, g: 0.75, b: 0.35 },
        placements: scatter(10, 70, 10, 70, 18),
      },
      {
        id: 3,
        name: 'Outcrop Cedar',
        archetype: 'tree',
        genome: { rootPriority: 0.4, heightPriority: 0.8, leafSize: 0.4, seedInvestment: 0.3, allelopathy: 0.2, defense: 0.3 },
        color: { r: 0.15, g: 0.4, b: 0.15 },
        placements: [
          { x: 15, y: 40 }, { x: 16, y: 41 },
          { x: 45, y: 15 }, { x: 46, y: 16 },
          { x: 65, y: 45 }, { x: 66, y: 46 },
          { x: 35, y: 65 }, { x: 70, y: 70 },
        ],
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
