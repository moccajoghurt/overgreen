import { Scenario, ScenarioCell, TerrainType, ClimateZone } from '../types';

// ── Deterministic noise (seeded distinct from Genesis) ──

function hash(a: number, b: number): number {
  let h = (a * 2654435761) ^ (b * 2246822519);
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  return ((h >>> 16) ^ h) & 0x7fffffff;
}

const SX = 7919, SY = 6271;

function noise2d(x: number, y: number, scale: number): number {
  const sx = (x + SX) / scale;
  const sy = (y + SY) / scale;
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

// ── Stream polylines ──

interface Seg { x0: number; y0: number; x1: number; y1: number }

function buildSegs(pts: { x: number; y: number }[]): Seg[] {
  const s: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++)
    s.push({ x0: pts[i].x, y0: pts[i].y, x1: pts[i + 1].x, y1: pts[i + 1].y });
  return s;
}

function distSeg(px: number, py: number, s: Seg): number {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - s.x0, py - s.y0);
  const t = Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / lenSq));
  return Math.hypot(px - (s.x0 + t * dx), py - (s.y0 + t * dy));
}

function distStream(px: number, py: number, segs: Seg[]): number {
  let min = Infinity;
  for (const s of segs) { const d = distSeg(px, py, s); if (d < min) min = d; }
  return min;
}

// ── Stream network ──
// A forest brook born from a spring in the NW hills, meandering through the
// valley to a forest lake, then continuing SE to the map edge. An eastern
// tributary descends from the heights to join at the lake.

const mainBrook = buildSegs([
  { x: 10, y: 3 },    // spring — emerges from NW hillside
  { x: 15, y: 9 },
  { x: 22, y: 14 },
  { x: 28, y: 18 },
  { x: 34, y: 24 },   // passes the main clearing
  { x: 30, y: 30 },   // westward meander
  { x: 33, y: 36 },
  { x: 38, y: 42 },
  { x: 40, y: 50 },   // approaches the lake
]);

const outflow = buildSegs([
  { x: 44, y: 58 },   // exits lake south side
  { x: 50, y: 63 },
  { x: 56, y: 67 },
  { x: 62, y: 72 },
  { x: 70, y: 78 },   // leaves map SE
]);

const eastTrib = buildSegs([
  { x: 65, y: 12 },   // descends from eastern heights
  { x: 60, y: 18 },
  { x: 54, y: 24 },
  { x: 48, y: 30 },
  { x: 44, y: 36 },
  { x: 42, y: 42 },
  { x: 40, y: 50 },   // joins main brook near lake
]);

const allStreams = [mainBrook, outflow, eastTrib];

// ── Forest lake (Waldsee) ──
const lake = { cx: 42, cy: 54, r: 4.5 };

// ── The Moor (Hochmoor) — raised bog in the western valley ──
const moor = { cx: 18, cy: 40, r: 5.0 };

// ── Forest clearings (Lichtungen) ──
const clearings = [
  { cx: 34, cy: 24, r: 4.0 },   // main meadow near brook bend
  { cx: 54, cy: 40, r: 3.0 },   // eastern glade
  { cx: 26, cy: 60, r: 3.5 },   // southern clearing
];

// ── Rock outcrops — modest granite tors on ridges ──
const rockClusters = [
  { cx: 7, cy: 20, r: 3.0 },    // western ridge tor
  { cx: 5, cy: 48, r: 2.5 },    // second western outcrop
  { cx: 68, cy: 18, r: 3.5 },   // eastern crag
  { cx: 48, cy: 5, r: 2.0 },    // northern boulder field
];

// ── Helper functions ──

function distToAllStreams(x: number, y: number): number {
  let min = Infinity;
  for (const s of allStreams) { const d = distStream(x, y, s); if (d < min) min = d; }
  return min;
}

function isStreamCell(x: number, y: number): boolean {
  if (distStream(x, y, mainBrook) <= 0.6) return true;
  if (distStream(x, y, outflow) <= 0.7) return true;
  if (distStream(x, y, eastTrib) <= 0.5) return true;
  return false;
}

function isInRock(x: number, y: number): boolean {
  for (const c of rockClusters) {
    const d = Math.hypot(x - c.cx, y - c.cy);
    const warp = fbm(x * 3 + c.cx, y * 3 + c.cy, 4) * 2.0;
    if (d < c.r + warp - 1.5) return true;
  }
  return false;
}

// ── Elevation ──

function baseElevation(x: number, y: number): number {
  // U-shaped valley: low center (x≈38), higher at edges
  const distFromCenter = Math.abs(x - 38) / 40;
  const valleyU = distFromCenter * distFromCenter * 0.30;
  // Gentle north-to-south descent
  const nsSlope = (1 - y / 80) * 0.08;
  const noise = (fbm(x, y, 14) - 0.5) * 0.12;
  return Math.max(0.15, Math.min(0.85, 0.35 + valleyU + nsSlope + noise));
}

// ── Terrain ──

function getTerrain(x: number, y: number): ScenarioCell {
  const elev = baseElevation(x, y);
  const streamDist = distToAllStreams(x, y);

  // ── Spring source: wetland at brook origin ──
  if (Math.hypot(x - 10, y - 3) <= 2.0) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.50 };
  }

  // ── East tributary spring ──
  if (Math.hypot(x - 65, y - 12) <= 1.5) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.52 };
  }

  // ── Forest lake ──
  const lakeDist = Math.hypot(x - lake.cx, y - lake.cy);
  if (lakeDist <= lake.r) {
    return { x, y, terrain: TerrainType.River, elevation: 0.18 };
  }

  // ── Lake wetland fringe ──
  if (lakeDist <= lake.r + 3.0) {
    const fringeNoise = fbm(x + 100, y + 100, 5);
    if (fringeNoise > 0.30) {
      return { x, y, terrain: TerrainType.Wetland, elevation: 0.20, nutrients: 6.0 };
    }
  }

  // ── Streams ──
  if (isStreamCell(x, y)) {
    return { x, y, terrain: TerrainType.River, elevation: 0.22 };
  }

  // ── The Moor ──
  const moorDist = Math.hypot(x - moor.cx, y - moor.cy);
  if (moorDist <= moor.r) {
    const moorNoise = fbm(x + 200, y + 200, 6);
    if (moorDist <= moor.r - 1.5 || moorNoise > 0.35) {
      return { x, y, terrain: TerrainType.Wetland, elevation: 0.30, nutrients: 5.0 };
    }
  }

  // ── Brook-side wetlands — marshy banks in the valley floor ──
  if (streamDist > 0.7 && streamDist <= 3.0) {
    const bankNoise = fbm(x + 300, y + 300, 5);
    const inValley = Math.abs(x - 38) < 20 && y > 12 && y < 68;
    if (inValley && bankNoise > 0.52) {
      return { x, y, terrain: TerrainType.Wetland, elevation: elev - 0.02 };
    }
  }

  // ── Rock outcrops ──
  if (isInRock(x, y)) {
    return { x, y, terrain: TerrainType.Rock, elevation: elev + 0.15 };
  }

  // ── Western ridge ──
  if (x <= 15 && y >= 3 && y <= 60) {
    const ridgeSpine = 8;
    const ridgeDist = Math.abs(x - ridgeSpine);
    const ridgeNoise = fbm(x + 400, y + 400, 5);
    if (ridgeDist + ridgeNoise * 3 < 6.0) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.55 + ridgeNoise * 0.15 };
    }
  }

  // ── Eastern heights ──
  if (x >= 58 && y <= 45) {
    const ridgeSpine = 68;
    const ridgeDist = Math.abs(x - ridgeSpine);
    const ridgeNoise = fbm(x + 500, y + 500, 5);
    if (ridgeDist + ridgeNoise * 3 < 7.0) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.50 + ridgeNoise * 0.12 };
    }
  }

  // ── Northern shoulder — connects the two ridges ──
  if (y <= 8) {
    const shoulderNoise = fbm(x + 600, y + 600, 6);
    if (shoulderNoise > 0.35 && x > 15 && x < 58) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.48 + shoulderNoise * 0.10 };
    }
  }

  // ── Forest clearings — sunlit meadows with rich soil ──
  for (const c of clearings) {
    if (Math.hypot(x - c.cx, y - c.cy) <= c.r) {
      return { x, y, terrain: TerrainType.Soil, elevation: elev, waterRecharge: 0.45, nutrients: 7.0 };
    }
  }

  // ── Brook-side fertile soil ──
  if (streamDist <= 5.0) {
    return { x, y, terrain: TerrainType.Soil, elevation: elev, waterRecharge: 0.42 };
  }

  // ── Default: forest floor with natural elevation ──
  return { x, y, terrain: TerrainType.Soil, elevation: elev };
}

/**
 * Lindenvale — a temperate forest valley.
 *
 * A brook born from a hillside spring winds through ancient woodland, passing
 * sunlit clearings and a raised moor, before settling into a still forest
 * lake. An eastern tributary descends from wooded heights to join at the
 * water. Gentle ridges frame the valley on three sides; the south opens
 * into deep, unbroken forest.
 *
 * Terrain layout (80x80):
 *   - Western ridge: hill chain with granite tors (x=3-15)
 *   - Eastern heights: wooded hills (x=58-72, y<45)
 *   - Northern shoulder: connecting hills (y<8)
 *   - Main brook: NW spring → S-curve through valley → forest lake
 *   - Eastern tributary: descends from heights → joins at lake
 *   - Forest lake (Waldsee): (42,54), r=4.5 with wetland fringe
 *   - The Moor (Hochmoor): raised bog at (18,40), r=5
 *   - Three forest clearings: meadows with enriched soil
 *   - Brook-side wetlands: marshy patches along stream banks
 *   - Rock outcrops: four modest clusters on ridges
 */
export const lindenvale: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push(getTerrain(x, y));
    }
  }

  return {
    id: 'lindenvale',
    name: 'Lindenvale',
    description:
      'A forested valley cradled between gentle ridges. A brook born from a hillside spring meanders through ancient woodland to a still forest lake. A raised moor and moss-covered boulders break the canopy. Two lineages — one reaching for light, one spreading through shadow — share the rich temperate floor.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.40,
    defaultZone: ClimateZone.Temperate,
    cells,
    species: [
      {
        id: 1,
        name: 'Forest Beech',
        genome: {
          rootPriority: 0.40,
          heightPriority: 0.55,
          leafSize: 0.50,
          seedInvestment: 0.50,
          seedSize: 0.45,
          defense: 0.10,
          woodiness: 0.65,
          waterStorage: 0.10,
          longevity: 0.65,
        },
        color: { r: 0.25, g: 0.55, b: 0.15 },
        placements: [{ x: 34, y: 24 }],
      },
      {
        id: 2,
        name: 'Brook Fern',
        genome: {
          rootPriority: 0.35,
          heightPriority: 0.12,
          leafSize: 0.60,
          seedInvestment: 0.75,
          seedSize: 0.25,
          defense: 0.05,
          woodiness: 0.08,
          waterStorage: 0.20,
          longevity: 0.30,
        },
        color: { r: 0.35, g: 0.70, b: 0.20 },
        placements: [{ x: 40, y: 48 }],
      },
    ],
  };
})();
