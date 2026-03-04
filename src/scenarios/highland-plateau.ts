import { Scenario, ScenarioCell, TerrainType } from '../types';

/** Central hill plateau, soil ring, arid edges. 3 species. */
export const highlandPlateau: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];
  const cx = 40, cy = 40;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist <= 18) {
        // Central plateau: hills
        cells.push({
          x, y,
          terrain: TerrainType.Hill,
          elevation: 0.7 + (1 - dist / 18) * 0.2,
        });
      } else if (dist <= 30) {
        // Fertile soil ring
        cells.push({
          x, y,
          terrain: TerrainType.Soil,
          elevation: 0.45 + (30 - dist) / 12 * 0.15,
        });
      } else {
        // Arid edges
        cells.push({
          x, y,
          terrain: TerrainType.Arid,
          elevation: 0.4 + Math.random() * 0.1,
        });
      }
    }
  }

  // A stream flowing from the plateau outward (NE direction)
  let sx = cx + 5, sy = cy - 5;
  while (sx < size && sy >= 0) {
    for (let d = 0; d <= 1; d++) {
      if (sx + d < size && sy >= 0) {
        cells.push({ x: sx + d, y: sy, terrain: TerrainType.River, elevation: 0.3 });
      }
    }
    sx += 1;
    sy += Math.random() < 0.6 ? -1 : 0;
    sy = Math.max(0, sy);
  }

  // Another stream flowing SW
  sx = cx - 5;
  sy = cy + 5;
  while (sx >= 0 && sy < size) {
    for (let d = 0; d <= 1; d++) {
      if (sx >= 0 && sy + d < size) {
        cells.push({ x: sx, y: sy + d, terrain: TerrainType.River, elevation: 0.3 });
      }
    }
    sx -= 1;
    sy += Math.random() < 0.6 ? 1 : 0;
    sy = Math.min(size - 1, sy);
  }

  // Rock outcrops on the plateau
  for (let y = cy - 10; y <= cy + 10; y++) {
    for (let x = cx - 10; x <= cx + 10; x++) {
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < 8 && Math.random() < 0.1) {
        cells.push({ x, y, terrain: TerrainType.Rock, elevation: 0.85 });
      }
    }
  }

  return {
    id: 'highland-plateau',
    name: 'Highland Plateau',
    description: 'A raised plateau dominates the center, ringed by fertile soil and bordered by arid wasteland.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.45,
    cells,
    species: [
      {
        id: 1,
        name: 'Plateau Juniper',
        archetype: 'tree',
        genome: { rootPriority: 0.5, heightPriority: 0.6, leafSize: 0.3, seedInvestment: 0.4, allelopathy: 0.2, defense: 0.4 },
        color: { r: 0.25, g: 0.45, b: 0.2 },
        placements: scatterCircle(cx, cy, 3, 15, 10),
      },
      {
        id: 2,
        name: 'Ringland Maple',
        archetype: 'tree',
        genome: { rootPriority: 0.5, heightPriority: 0.5, leafSize: 0.7, seedInvestment: 0.4, allelopathy: 0.1, defense: 0.15 },
        color: { r: 0.6, g: 0.5, b: 0.15 },
        placements: scatterCircle(cx, cy, 20, 28, 10),
      },
      {
        id: 3,
        name: 'Fringe Scrub',
        archetype: 'grass',
        genome: { rootPriority: 0.8, heightPriority: 0.15, leafSize: 0.3, seedInvestment: 0.7, allelopathy: 0.3, defense: 0.3 },
        color: { r: 0.65, g: 0.6, b: 0.3 },
        placements: scatterCircle(cx, cy, 30, 38, 12),
      },
    ],
  };
})();

function scatterCircle(
  cx: number, cy: number, rMin: number, rMax: number, count: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    pts.push({
      x: Math.max(0, Math.min(79, Math.round(cx + Math.cos(angle) * r))),
      y: Math.max(0, Math.min(79, Math.round(cy + Math.sin(angle) * r))),
    });
  }
  return pts;
}
