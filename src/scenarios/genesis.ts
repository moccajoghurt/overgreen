import { Scenario, ScenarioCell, TerrainType } from '../types';
import { ClimateEra } from '../types/environment';

/**
 * Genesis — the curated intro scenario.
 *
 * A single generalist plant at the center of a hand-crafted terrain that
 * reliably produces dramatic speciation, territorial competition, and
 * extinction events as descendants colonize diverse biomes.
 *
 * Terrain layout (80×80):
 *   - Central valley: fertile soil (low elevation) — fast initial boom
 *   - River: runs roughly east-west through rows 35-37, with a bend
 *   - Northern highlands: hills (rows 0-18) with rock outcrops
 *   - Southern badlands: arid (rows 58-79) — selects for succulence
 *   - Eastern wetland: pocket (cols 58-79, rows 20-50) — swamp niche
 *   - Rock barriers: scattered outcrops that fragment populations
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
  // ── Elevation field: high north, low center, medium south ──
  const baseElev = 0.3 + (1 - y / 80) * 0.5; // 0.80 at top, 0.30 at bottom
  const elev = baseElev + (fbm(x, y, 12) - 0.5) * 0.2;

  // ── River: sinuous channel with noise-warped path ──
  const riverWarp = noise2d(x, y, 20) * 6 - 3;
  const riverCenter = 36 + Math.sin(x * 0.1) * 3 + riverWarp;
  const distToRiver = Math.abs(y - riverCenter);
  if (distToRiver <= 1.2) {
    return { x, y, terrain: TerrainType.River, elevation: 0.2 };
  }

  // ── Northern highlands: noisy boundary, not a straight line ──
  const hillEdge = 20 + (fbm(x, y, 15) - 0.5) * 10;
  if (y < hillEdge) {
    // Rock outcrops — irregular blobs using noise threshold
    if (isRockOutcrop(x, y)) {
      return { x, y, terrain: TerrainType.Rock, elevation: elev + 0.15 };
    }
    return { x, y, terrain: TerrainType.Hill, elevation: Math.max(0.55, elev) };
  }

  // ── Hill-to-soil transition: scattered hill cells with noise falloff ──
  const hillFade = hillEdge + 6 + (fbm(x + 50, y, 10) - 0.5) * 4;
  if (y < hillFade) {
    const prob = 1 - (y - hillEdge) / (hillFade - hillEdge);
    if (fbm(x + 100, y + 100, 6) < prob * 0.7) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.52 + fbm(x, y, 8) * 0.08 };
    }
    return null;
  }

  // ── Southern badlands: noisy boundary ──
  const aridEdge = 58 + (fbm(x + 30, y + 30, 14) - 0.5) * 8;
  if (y > aridEdge) {
    // Transition zone: probability ramps up with distance past edge
    const depth = (y - aridEdge) / (80 - aridEdge);
    if (depth > 0.3 || fbm(x + 200, y + 200, 7) < depth * 1.5) {
      return { x, y, terrain: TerrainType.Arid, elevation: 0.35 + fbm(x, y, 10) * 0.1 };
    }
    return null;
  }

  // ── Eastern wetland: organic basin shape following the river downstream ──
  // Wetland center drifts with noise for an irregular pond/marsh shape
  const wetCx = 66;
  const wetCy = 42;
  const dx = (x - wetCx) / 14; // wider east-west
  const dy = (y - wetCy) / 16; // taller north-south
  const wetDist = dx * dx + dy * dy;
  const wetNoise = fbm(x + 77, y + 33, 8) * 0.5;
  if (wetDist + wetNoise < 1.0) {
    // Core wetland
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.22 + fbm(x, y, 10) * 0.08 };
  }
  if (wetDist + wetNoise < 1.4) {
    // Fringe: spotty wetland cells
    if (fbm(x + 150, y + 150, 5) > 0.45) {
      return { x, y, terrain: TerrainType.Wetland, elevation: 0.28 + fbm(x, y, 8) * 0.06 };
    }
    return null;
  }

  // ── Central rock formations: irregular ridges using noise ──
  if (isBarrierRock(x, y)) {
    return { x, y, terrain: TerrainType.Rock, elevation: 0.65 + fbm(x, y, 6) * 0.1 };
  }

  // ── Everything else: fertile soil valley (default) ──
  return null;
}

/** Rock outcrops in northern highlands — noise-shaped blobs */
function isRockOutcrop(x: number, y: number): boolean {
  const clusters = [
    { cx: 15, cy: 8, r: 5 },
    { cx: 48, cy: 6, r: 4 },
    { cx: 72, cy: 13, r: 4 },
  ];
  for (const c of clusters) {
    const dx = x - c.cx;
    const dy = y - c.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Noise warps the radius for irregular shape
    const warp = fbm(x * 3 + c.cx, y * 3 + c.cy, 4) * 2.5;
    if (dist < c.r + warp - 1.5) return true;
  }
  return false;
}

/** Rock ridges in the central zone — curved, irregular */
function isBarrierRock(x: number, y: number): boolean {
  // West ridge: curves using noise
  const westSpine = 25 + (fbm(x + 500, y, 10) - 0.5) * 4;
  if (Math.abs(x - westSpine) < 1.3 && y >= 44 && y <= 53) {
    return fbm(x + 300, y + 300, 5) > 0.35;
  }
  // East ridge: diagonal, noise-warped
  const eastSpine = 49 + (y - 45) * 0.3 + (fbm(x + 600, y, 8) - 0.5) * 3;
  if (Math.abs(x - eastSpine) < 1.3 && y >= 42 && y <= 49) {
    return fbm(x + 400, y + 400, 5) > 0.35;
  }
  return false;
}
