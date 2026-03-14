import { Scenario, ScenarioCell, ScenarioSpecies, TerrainType, ClimateZone } from '../types';

/**
 * 4×4 Niche Matrix: 16 terrain×zone pockets separated by 9-cell Rock barriers.
 *
 * Layout (columns = terrain, rows = climate zone):
 *          Soil(13)  Rock(9)  Hill(13)  Rock(9) Wetland(13) Rock(9)  Arid(14)
 * Temperate  y:0-12
 * Rock       y:13-21
 * Tropical   y:22-34
 * Rock       y:35-43
 * Mediterr.  y:44-56
 * Rock       y:57-65
 * Desert     y:66-79
 *
 * Each pocket seeded with 5 starter species (one per archetype), 4 plants each.
 */
export const experimentNicheMatrix: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Column boundaries (x ranges) — terrain
  const columns: { x0: number; x1: number; terrain: TerrainType | 'rock' }[] = [
    { x0: 0, x1: 12, terrain: TerrainType.Soil },
    { x0: 13, x1: 21, terrain: 'rock' },
    { x0: 22, x1: 34, terrain: TerrainType.Hill },
    { x0: 35, x1: 43, terrain: 'rock' },
    { x0: 44, x1: 56, terrain: TerrainType.Wetland },
    { x0: 57, x1: 65, terrain: 'rock' },
    { x0: 66, x1: 79, terrain: TerrainType.Arid },
  ];

  // Row boundaries (y ranges) — climate zone
  const rows: { y0: number; y1: number; zone: ClimateZone | 'rock' }[] = [
    { y0: 0, y1: 12, zone: ClimateZone.Temperate },
    { y0: 13, y1: 21, zone: 'rock' },
    { y0: 22, y1: 34, zone: ClimateZone.Tropical },
    { y0: 35, y1: 43, zone: 'rock' },
    { y0: 44, y1: 56, zone: ClimateZone.Mediterranean },
    { y0: 57, y1: 65, zone: 'rock' },
    { y0: 66, y1: 79, zone: ClimateZone.Desert },
  ];

  // Terrain elevations
  const terrainElevation: Record<number, number> = {
    [TerrainType.Soil]: 0.5,
    [TerrainType.Hill]: 0.7,
    [TerrainType.Wetland]: 0.3,
    [TerrainType.Arid]: 0.4,
  };

  // Build grid
  for (let y = 0; y < size; y++) {
    const row = rows.find(r => y >= r.y0 && y <= r.y1)!;
    for (let x = 0; x < size; x++) {
      const col = columns.find(c => x >= c.x0 && x <= c.x1)!;

      if (row.zone === 'rock' || col.terrain === 'rock') {
        cells.push({ x, y, terrain: TerrainType.Rock, elevation: 0.5 });
      } else {
        cells.push({
          x, y,
          terrain: col.terrain,
          elevation: terrainElevation[col.terrain] ?? 0.5,
          climateZone: row.zone,
        });
      }
    }
  }

  // Starter species genomes (one per archetype)
  const starterGenomes: { name: string; genome: ScenarioSpecies['genome']; color: ScenarioSpecies['color'] }[] = [
    {
      name: 'Starter Grass',
      genome: { rootPriority: 0.40, heightPriority: 0.30, leafSize: 0.30, seedInvestment: 0.50, seedSize: 0.40, defense: 0.10, woodiness: 0.15, waterStorage: 0.10, longevity: 0.30 },
      color: { r: 0.3, g: 0.7, b: 0.2 },
    },
    {
      name: 'Starter Forb',
      genome: { rootPriority: 0.30, heightPriority: 0.25, leafSize: 0.60, seedInvestment: 0.50, seedSize: 0.35, defense: 0.25, woodiness: 0.20, waterStorage: 0.20, longevity: 0.35 },
      color: { r: 0.6, g: 0.3, b: 0.6 },
    },
    {
      name: 'Starter Shrub',
      genome: { rootPriority: 0.35, heightPriority: 0.30, leafSize: 0.40, seedInvestment: 0.40, seedSize: 0.45, defense: 0.30, woodiness: 0.55, waterStorage: 0.30, longevity: 0.50 },
      color: { r: 0.5, g: 0.5, b: 0.2 },
    },
    {
      name: 'Starter Tree',
      genome: { rootPriority: 0.35, heightPriority: 0.40, leafSize: 0.90, seedInvestment: 0.40, seedSize: 0.40, defense: 0.25, woodiness: 0.10, waterStorage: 0.02, longevity: 0.45 },
      color: { r: 0.35, g: 0.25, b: 0.10 },
    },
    {
      name: 'Starter Succulent',
      genome: { rootPriority: 0.35, heightPriority: 0.20, leafSize: 0.30, seedInvestment: 0.40, seedSize: 0.55, defense: 0.30, woodiness: 0.50, waterStorage: 0.65, longevity: 0.50 },
      color: { r: 0.4, g: 0.7, b: 0.5 },
    },
  ];

  // Collect pocket regions (non-rock intersections)
  const pockets: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const row of rows) {
    if (row.zone === 'rock') continue;
    for (const col of columns) {
      if (col.terrain === 'rock') continue;
      pockets.push({ x0: col.x0, x1: col.x1, y0: row.y0, y1: row.y1 });
    }
  }

  // Place 4 plants per species per pocket using deterministic spacing
  const species: ScenarioSpecies[] = starterGenomes.map((s, i) => ({
    id: i + 1,
    name: s.name,
    genome: s.genome,
    color: s.color,
    placements: pockets.flatMap(pocket => {
      const pw = pocket.x1 - pocket.x0 + 1;
      const ph = pocket.y1 - pocket.y0 + 1;
      const pts: { x: number; y: number }[] = [];
      // Place in a 2×2 sub-grid offset by species index to avoid overlap
      const ox = 2 + (i % 3) * 3;
      const oy = 2 + Math.floor(i / 3) * 3;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const px = pocket.x0 + ((ox + c * 4) % pw);
          const py = pocket.y0 + ((oy + r * 4) % ph);
          pts.push({ x: px, y: py });
        }
      }
      return pts;
    }),
  }));

  return {
    id: 'experiment-niche-matrix',
    name: '[Exp] Niche Matrix',
    description: '4×4 grid of 16 terrain×zone pockets separated by Rock barriers. Tests niche differentiation and subtype emergence across all environments.',
    size,
    defaultTerrain: TerrainType.Rock,
    defaultElevation: 0.5,
    cells,
    species,
  };
})();
