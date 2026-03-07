import { Scenario, ScenarioCell, TerrainType } from '../types';
import { ClimateEra } from '../types/environment';

// ── Deterministic noise ──

function hash(a: number, b: number): number {
  let h = (a * 2654435761) ^ (b * 2246822519);
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  return ((h >>> 16) ^ h) & 0x7fffffff;
}

function noise2d(x: number, y: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const n00 = (hash(ix, iy) & 0xffff) / 0xffff;
  const n10 = (hash(ix + 1, iy) & 0xffff) / 0xffff;
  const n01 = (hash(ix, iy + 1) & 0xffff) / 0xffff;
  const n11 = (hash(ix + 1, iy + 1) & 0xffff) / 0xffff;
  return n00 * (1 - u) * (1 - v) + n10 * u * (1 - v) + n01 * (1 - u) * v + n11 * u * v;
}

function fbm(x: number, y: number, scale: number): number {
  return noise2d(x, y, scale) * 0.65 + noise2d(x, y, scale * 0.5) * 0.35;
}

// ── River polylines ──

interface RiverSeg { x0: number; y0: number; x1: number; y1: number }

function buildSegs(pts: { x: number; y: number }[]): RiverSeg[] {
  const s: RiverSeg[] = [];
  for (let i = 0; i < pts.length - 1; i++)
    s.push({ x0: pts[i].x, y0: pts[i].y, x1: pts[i + 1].x, y1: pts[i + 1].y });
  return s;
}

function distSeg(px: number, py: number, s: RiverSeg): number {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - s.x0, py - s.y0);
  const t = Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / lenSq));
  return Math.hypot(px - (s.x0 + t * dx), py - (s.y0 + t * dy));
}

function distRiver(px: number, py: number, segs: RiverSeg[]): number {
  let min = Infinity;
  for (const s of segs) { const d = distSeg(px, py, s); if (d < min) min = d; }
  return min;
}

// ── River network: main channel + tributaries flowing into the sea ──

// Main river: flows from NE highlands down to SW sea
const mainRiver = buildSegs([
  { x: 62, y: 5 },
  { x: 55, y: 15 },
  { x: 48, y: 25 },
  { x: 42, y: 35 },
  { x: 38, y: 45 },
  { x: 34, y: 52 },  // enters sea around here
]);

// East tributary: branches east from mid-river into arid
const eastTrib = buildSegs([
  { x: 48, y: 25 },
  { x: 56, y: 30 },
  { x: 64, y: 36 },
  { x: 72, y: 40 },
  { x: 78, y: 43 },
]);

// West tributary: branches west from lower river
const westTrib = buildSegs([
  { x: 42, y: 35 },
  { x: 34, y: 32 },
  { x: 26, y: 30 },
  { x: 18, y: 29 },
]);

// Small southern branch near the coast
const coastTrib = buildSegs([
  { x: 38, y: 45 },
  { x: 45, y: 50 },
  { x: 52, y: 54 },
]);

const allRivers = [mainRiver, eastTrib, westTrib, coastTrib];

function distToAnyRiver(x: number, y: number): number {
  let min = Infinity;
  for (const r of allRivers) { const d = distRiver(x, y, r); if (d < min) min = d; }
  return min;
}

// ── Sea: curved coastline, SW corner ──
// The coastline runs roughly from (0, 40) to (55, 80) — everything below/left is sea.

function seaDistance(x: number, y: number): number {
  // SW corner sea: coastline runs from ~(0, 45) to ~(50, 80)
  // Sea where y is high and x is low: y - x > threshold
  const coastK = 25;
  const warp = (fbm(x + 200, y + 200, 14) - 0.5) * 7;
  // Signed distance: negative = sea side, positive = land side
  return (-(y - x - coastK) - warp) / Math.SQRT2;
}

function isSea(x: number, y: number): boolean {
  return seaDistance(x, y) < 0;
}

// ── Terrain ──

function getTerrain(x: number, y: number): ScenarioCell | null {
  const baseElev = 0.25 + (1 - y / 80) * 0.45 + (x / 80) * 0.15;
  const elev = baseElev + (fbm(x, y, 12) - 0.5) * 0.2;

  // ── Sea ──
  if (isSea(x, y)) {
    return { x, y, terrain: TerrainType.River, elevation: 0.1 };
  }

  // ── Coastal wetland: narrow strip along coastline ──
  const coastDist = seaDistance(x, y);
  if (coastDist < 3.5) {
    const wetNoise = fbm(x + 150, y + 150, 6);
    if (wetNoise > 0.35) {
      return { x, y, terrain: TerrainType.Wetland, elevation: 0.18 + fbm(x, y, 8) * 0.06 };
    }
  }

  // ── Rivers ──
  const riverDist = distToAnyRiver(x, y);
  const bankWarp = (fbm(x + 77, y + 33, 6) - 0.5) * 0.6;

  if (riverDist <= 1.0) {
    return { x, y, terrain: TerrainType.River, elevation: 0.2 };
  }

  // ── Soil banks along rivers ──
  if (riverDist + bankWarp <= 3.5) {
    return null; // soil (default)
  }

  // ── NE highlands ──
  const hillZone = (1 - y / 80) * 0.6 + (x / 80) * 0.4; // higher in NE
  if (hillZone > 0.65) {
    if (isRockOutcrop(x, y)) {
      return { x, y, terrain: TerrainType.Rock, elevation: elev + 0.15 };
    }
    return { x, y, terrain: TerrainType.Hill, elevation: Math.max(0.55, elev) };
  }

  // ── Transition: some soil near rivers, arid further away ──
  if (riverDist < 6) {
    const aridNoise = fbm(x + 100, y + 100, 8);
    if (aridNoise > 0.55) {
      return { x, y, terrain: TerrainType.Arid, elevation: 0.35 + fbm(x, y, 10) * 0.1 };
    }
    return null; // soil
  }

  // ── Arid desert: everything else ──
  return { x, y, terrain: TerrainType.Arid, elevation: 0.35 + fbm(x, y, 10) * 0.1 };
}

function isRockOutcrop(x: number, y: number): boolean {
  const clusters = [
    { cx: 65, cy: 8, r: 5 },
    { cx: 50, cy: 5, r: 4 },
    { cx: 75, cy: 18, r: 4 },
    { cx: 58, cy: 20, r: 4 },
    { cx: 72, cy: 30, r: 4 },
  ];
  for (const c of clusters) {
    const dx = x - c.cx, dy = y - c.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const warp = fbm(x * 3 + c.cx, y * 3 + c.cy, 4) * 2.5;
    if (dist < c.r + warp - 1.5) return true;
  }
  return false;
}

/**
 * Genesis — the curated intro scenario.
 *
 * A river delta flowing from NE highlands into a SW sea. Life spreads along
 * river corridors through arid desert — green streets through brown wasteland.
 * The camera pulls back to reveal the coastline and the full delta pattern.
 *
 * Terrain layout (80×80):
 *   - Sea: SW corner (~30% of map), curved coastline
 *   - Main river: NE highlands → SW sea
 *   - East tributary: branches into eastern desert
 *   - West tributary: branches toward western desert
 *   - Coastal tributary: near the river mouth
 *   - NE highlands: hills and rock outcrops
 *   - Coastal wetlands: narrow strip along the shore
 *   - Seed at (48,25): on the main river, inland
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
      'One seed. One world. A river delta flows from highlands to sea — watch evolution unfold as life colonizes the water corridors through desert and coast.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.45,
    cells,
    species: [
      {
        id: 1,
        name: 'Primordial Shrub',
        genome: {
          rootPriority: 0.30,
          heightPriority: 0.50,
          leafSize: 0.50,
          seedInvestment: 0.60,
          seedSize: 0.45,
          defense: 0.10,
          woodiness: 0.55,
          waterStorage: 0.20,
          longevity: 0.5,
        },
        color: { r: 0.45, g: 0.60, b: 0.20 },
        placements: [{ x: 46, y: 24 }],
      },
    ],
    lockedEra: ClimateEra.Temperate,
  };
})();
