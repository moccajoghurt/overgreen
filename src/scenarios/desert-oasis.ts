import { Scenario, ScenarioCell, TerrainType } from '../types';

/** Arid terrain with a small fertile oasis in the center. 2 species. */
export const desertOasis: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];
  const cx = 40, cy = 40;

  // Most of the map is arid
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist > 12) {
        cells.push({ x, y, terrain: TerrainType.Arid, elevation: 0.5 + Math.random() * 0.1 });
      }
    }
  }

  // Central oasis: small pond (river cells)
  for (let y = cy - 2; y <= cy + 2; y++) {
    for (let x = cx - 2; x <= cx + 2; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= 2.5) {
        cells.push({ x, y, terrain: TerrainType.River, elevation: 0.25 });
      }
    }
  }

  // Wetland ring around the oasis
  for (let y = cy - 8; y <= cy + 8; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist > 2.5 && dist <= 8) {
        cells.push({ x, y, terrain: TerrainType.Wetland, elevation: 0.3 + dist * 0.02 });
      }
    }
  }

  // Transition soil ring
  for (let y = cy - 12; y <= cy + 12; y++) {
    for (let x = cx - 12; x <= cx + 12; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist > 8 && dist <= 12) {
        cells.push({ x, y, terrain: TerrainType.Soil, elevation: 0.4 });
      }
    }
  }

  // Scattered rocks in the desert
  for (let y = 5; y < 75; y += 4) {
    for (let x = 5; x < 75; x += 4) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist > 15 && Math.random() < 0.15) {
        cells.push({ x, y, terrain: TerrainType.Rock, elevation: 0.6 });
      }
    }
  }

  return {
    id: 'desert-oasis',
    name: 'Desert Oasis',
    description: 'A vast desert surrounds a small fertile oasis. Only the hardiest species survive the arid expanse.',
    size,
    defaultTerrain: TerrainType.Arid,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Oasis Palm',
        archetype: 'tree',
        genome: { rootPriority: 0.8, heightPriority: 0.6, leafSize: 0.5, seedInvestment: 0.3, allelopathy: 0.1, defense: 0.2 },
        color: { r: 0.3, g: 0.65, b: 0.2 },
        placements: scatterCircle(cx, cy, 4, 10, 12),
      },
      {
        id: 2,
        name: 'Desert Sage',
        archetype: 'grass',
        genome: { rootPriority: 0.9, heightPriority: 0.15, leafSize: 0.3, seedInvestment: 0.6, allelopathy: 0.3, defense: 0.4 },
        color: { r: 0.6, g: 0.6, b: 0.3 },
        placements: scatterCircle(cx, cy, 10, 18, 15),
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
      x: Math.round(cx + Math.cos(angle) * r),
      y: Math.round(cy + Math.sin(angle) * r),
    });
  }
  return pts;
}
