import { Scenario, ScenarioCell, TerrainType } from '../types';
import { ClimateEra } from '../types/environment';

/**
 * Genesis — the curated intro scenario.
 *
 * A single generalist plant at the center of a hand-crafted terrain that
 * reliably produces dramatic speciation, territorial competition, and
 * extinction events as descendants colonize diverse biomes.
 *
 * Terrain layout (80×80) — "The Convergence":
 *   Three biomes converge near the spawn for maximum speciation contrast.
 *   - River: east-west at row ~37, gentle curves
 *   - Northern hills: descend to within ~8 cells of the river
 *   - South of river: a diagonal boundary splits the land:
 *     - Southwest: wetlands (river-fed marshlands)
 *     - Southeast: arid desert
 *   - Spawn at (40,40): soil at the triple point where hill, wetland, and arid meet
 *   - Oasis: wetland pocket deep in the arid southeast
 */
export const genesis: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const terrain = getTerrain(x, y);
      if (terrain !== null) {
        cells.push(terrain);
      }
    }
  }

  return {
    id: 'genesis',
    name: 'Genesis',
    description:
      'One seed. One world. Watch evolution unfold as a single plant colonizes hills, rivers, wetlands, and deserts — speciating into diverse lineages shaped by the land.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.45,
    cells,
    species: [
      {
        id: 1,
        name: 'Primordial Fern',
        genome: {
          rootPriority: 0.35,
          heightPriority: 0.35,
          leafSize: 0.30,
          seedInvestment: 0.55,
          seedSize: 0.45,
          defense: 0.1,
          woodiness: 0.5,
          waterStorage: 0.3,
        },
        color: { r: 0.25, g: 0.65, b: 0.20 },
        placements: [{ x: 40, y: 40 }],
      },
    ],
    lockedEra: ClimateEra.Temperate,
  };
})();

// ── Deterministic noise for natural-looking boundaries ──
// Simple hash-based noise so the map is identical every load (no Math.random).

function hash(a: number, b: number): number {
  let h = (a * 2654435761) ^ (b * 2246822519);
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  return ((h >>> 16) ^ h) & 0x7fffffff;
}

/** Smooth deterministic noise in [0,1], sampled at grid scale */
function noise2d(x: number, y: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  // Smoothstep
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const n00 = (hash(ix, iy) & 0xffff) / 0xffff;
  const n10 = (hash(ix + 1, iy) & 0xffff) / 0xffff;
  const n01 = (hash(ix, iy + 1) & 0xffff) / 0xffff;
  const n11 = (hash(ix + 1, iy + 1) & 0xffff) / 0xffff;
  return n00 * (1 - u) * (1 - v) + n10 * u * (1 - v) + n01 * (1 - u) * v + n11 * u * v;
}

/** Two octaves of noise for richer texture */
function fbm(x: number, y: number, scale: number): number {
  return noise2d(x, y, scale) * 0.65 + noise2d(x, y, scale * 0.5) * 0.35;
}

function getTerrain(x: number, y: number): ScenarioCell | null {
  const baseElev = 0.3 + (1 - y / 80) * 0.5;
  const elev = baseElev + (fbm(x, y, 12) - 0.5) * 0.2;

  // ── River: gentle east-west channel at row ~37 ──
  const riverWarp = noise2d(x, y, 20) * 2 - 1;
  const riverCenter = 37 + Math.sin(x * 0.08) * 1.5 + riverWarp;
  const distToRiver = Math.abs(y - riverCenter);
  if (distToRiver <= 1.2) {
    return { x, y, terrain: TerrainType.River, elevation: 0.2 };
  }

  // ── North of river ──
  if (y < riverCenter) {
    // Soil buffer: ~5-6 cells between river and hills
    const hillEdge = riverCenter - 6 - (fbm(x, y, 12) - 0.5) * 4;
    if (y > hillEdge) {
      return null; // soil
    }
    // Hills with rock outcrops
    if (isRockOutcrop(x, y)) {
      return { x, y, terrain: TerrainType.Rock, elevation: elev + 0.15 };
    }
    return { x, y, terrain: TerrainType.Hill, elevation: Math.max(0.55, elev) };
  }

  // ── South of river ──
  // Soil buffer: ~5-6 cells south of river before biomes start
  const biomeEdge = riverCenter + 6 + (fbm(x + 50, y + 50, 10) - 0.5) * 3;
  if (y < biomeEdge) {
    return null; // soil — spawn lives here
  }

  // ── Diagonal boundary: wetland in SW, arid in SE ──
  // Line runs from roughly (60, river+6) to (15, 79)
  // x < boundaryX → wetland, x > boundaryX → arid
  const boundaryX = 58 - (y - biomeEdge) * 0.8 + (fbm(x + 200, y + 200, 12) - 0.5) * 10;

  if (x < boundaryX) {
    // ── Southwest wetlands ──
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.22 + fbm(x, y, 10) * 0.08 };
  }

  // ── Southeast arid ──

  // Oasis: wetland pocket deep in the arid zone
  const oasisCx = 60;
  const oasisCy = 65;
  const odx = (x - oasisCx) / 8;
  const ody = (y - oasisCy) / 7;
  const oasisDist = odx * odx + ody * ody;
  const oasisNoise = fbm(x + 55, y + 99, 6) * 0.4;
  if (oasisDist + oasisNoise < 1.0) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.25 + fbm(x, y, 8) * 0.06 };
  }
  if (oasisDist + oasisNoise < 1.3) {
    if (fbm(x + 180, y + 180, 5) > 0.5) {
      return { x, y, terrain: TerrainType.Wetland, elevation: 0.30 + fbm(x, y, 8) * 0.05 };
    }
  }

  return { x, y, terrain: TerrainType.Arid, elevation: 0.35 + fbm(x, y, 10) * 0.1 };
}

/** Rock outcrops scattered across the northern highlands */
function isRockOutcrop(x: number, y: number): boolean {
  const clusters = [
    { cx: 15, cy: 8, r: 5 },
    { cx: 48, cy: 6, r: 4 },
    { cx: 72, cy: 13, r: 4 },
    { cx: 30, cy: 20, r: 4 },
    { cx: 60, cy: 24, r: 5 },
  ];
  for (const c of clusters) {
    const dx = x - c.cx;
    const dy = y - c.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const warp = fbm(x * 3 + c.cx, y * 3 + c.cy, 4) * 2.5;
    if (dist < c.r + warp - 1.5) return true;
  }
  return false;
}
