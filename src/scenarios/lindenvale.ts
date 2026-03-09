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
// Main brook born from a spring on the western slope BELOW the Hochmoor saddle,
// meandering through the valley with proper sinuosity, past clearings and fen,
// into a forest lake, then continuing SE out of the valley.
// Eastern tributary descends from heights with a slight S-curve.

const mainBrook = buildSegs([
  { x: 18, y: 14 },   // spring — emerges from western hillside, below the saddle
  { x: 22, y: 17 },
  { x: 26, y: 19 },   // first bend — deflected by slope
  { x: 28, y: 22 },
  { x: 30, y: 26 },   // curves around clearing
  { x: 28, y: 30 },   // westward meander
  { x: 31, y: 34 },
  { x: 35, y: 37 },   // bends back east
  { x: 33, y: 41 },   // another meander
  { x: 36, y: 45 },
  { x: 38, y: 47 },   // approaches the fen
  { x: 39, y: 51 },   // enters lake through fen
]);

const outflow = buildSegs([
  { x: 43, y: 57 },   // exits lake south side
  { x: 46, y: 61 },
  { x: 50, y: 64 },   // bend before leaving
  { x: 53, y: 67 },
  { x: 58, y: 71 },
  { x: 64, y: 75 },
  { x: 70, y: 78 },   // leaves map SE
]);

const eastTrib = buildSegs([
  { x: 60, y: 10 },   // descends from eastern heights
  { x: 56, y: 15 },
  { x: 52, y: 19 },   // curves west
  { x: 49, y: 24 },
  { x: 51, y: 28 },   // S-curve: kicks east briefly
  { x: 48, y: 33 },   // then back west
  { x: 44, y: 38 },
  { x: 42, y: 43 },
  { x: 40, y: 48 },   // joins main brook in fen above lake
]);

const allStreams = [mainBrook, outflow, eastTrib];

// ── Forest lake (Waldsee) — elongated, oriented NW-SE ──
// Two overlapping circles to create an oblong shape
const lakeCenters = [
  { cx: 39, cy: 53, r: 3.8 },
  { cx: 43, cy: 55, r: 3.5 },
];

function lakeDist(x: number, y: number): number {
  let min = Infinity;
  for (const c of lakeCenters) {
    const d = Math.hypot(x - c.cx, y - c.cy) - c.r;
    if (d < min) min = d;
  }
  return min;
}

// ── The Moor (Hochmoor) — raised bog on the northern saddle/plateau ──
// Elongated E-W along the saddle axis connecting west and east ridges
const moor = { cx: 38, cy: 7, rx: 7.0, ry: 4.0 };

// ── Fen (Niedermoor) — valley-bottom wetland at brook confluence above lake ──
// Reduced size to avoid merging with lake fringe
const fen = { cx: 40, cy: 47, rx: 4, ry: 3 };

// ── Forest clearings (Lichtungen) — elongated, following terrain ──
// Elliptical clearings oriented along slope contours
const clearings = [
  { cx: 30, cy: 24, rx: 5.0, ry: 3.0, angle: 0.3 },   // main meadow near brook, elongated E-W
  { cx: 50, cy: 35, rx: 3.5, ry: 2.5, angle: -0.2 },   // eastern glade on slope
  { cx: 32, cy: 62, rx: 4.0, ry: 2.5, angle: 0.1 },    // southern clearing near valley exit
];

function inEllipse(x: number, y: number, cx: number, cy: number,
                   rx: number, ry: number, angle: number): boolean {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = x - cx, dy = y - cy;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1.0;
}

// ── Rock outcrops — granite tors on ridge crests ──
const rockClusters = [
  { cx: 10, cy: 18, r: 3.0 },    // western ridge summit tor
  { cx: 8, cy: 35, r: 2.5 },     // western ridge second peak
  { cx: 62, cy: 14, r: 3.5 },    // eastern crag — high on the ridge
  { cx: 58, cy: 30, r: 2.0 },    // eastern ridge spur outcrop
  { cx: 38, cy: 2, r: 2.0 },     // northern saddle — boulder field at ridge crest, above moor
];

// ── Helper functions ──

function distToAllStreams(x: number, y: number): number {
  let min = Infinity;
  for (const s of allStreams) { const d = distStream(x, y, s); if (d < min) min = d; }
  return min;
}

// Stream elevation: interpolated from source to outflow based on Y position
// Source (y=10) at ~0.45, valley floor around y=50 at ~0.20, exit (y=78) at ~0.16
function streamElevation(y: number): number {
  const t = Math.max(0, Math.min(1, (y - 10) / 68));
  return 0.45 - t * 0.29; // 0.45 at source, 0.16 at exit
}

function isStreamCell(x: number, y: number): boolean {
  // Main brook — widens downstream
  const mainDist = distStream(x, y, mainBrook);
  const mainProg = Math.max(0, Math.min(1, y / 55));
  const mainWidth = 0.5 + mainProg * 0.4; // narrow at spring, wider near lake
  if (mainDist <= mainWidth) return true;

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
  // U-shaped valley: low center around x=38, steep rises to ridges
  // Valley floor ~30 cells wide (x=22 to x=55)
  const cx = 38;
  const distFromCenter = Math.abs(x - cx);

  // Sigmoid-like curve: flat valley floor, steep shoulder, flattening at ridge
  let valleyProfile: number;
  if (distFromCenter < 15) {
    // Valley floor: gentle
    valleyProfile = (distFromCenter / 40) * (distFromCenter / 40) * 0.15;
  } else {
    // Steep slope to ridge: cubic acceleration
    const slope = (distFromCenter - 15) / 25;
    valleyProfile = 0.15 * (15 / 40) * (15 / 40) + slope * slope * 0.35;
  }

  // North-south descent: brook needs gradient (north is higher)
  const nsSlope = (1 - y / 80) * 0.13;

  // Natural variation
  const noise = (fbm(x, y, 14) - 0.5) * 0.10;

  return Math.max(0.15, Math.min(0.85, 0.22 + valleyProfile + nsSlope + noise));
}

// ── Terrain ──

function getTerrain(x: number, y: number): ScenarioCell {
  const elev = baseElevation(x, y);
  const streamDist = distToAllStreams(x, y);

  // ── Spring source: wetland at brook origin ──
  if (Math.hypot(x - 18, y - 14) <= 2.0) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.45 };
  }

  // ── East tributary spring ──
  if (Math.hypot(x - 60, y - 10) <= 1.5) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.50 };
  }

  // ── Forest lake (oblong) ──
  if (lakeDist(x, y) <= 0) {
    return { x, y, terrain: TerrainType.River, elevation: 0.18 };
  }

  // ── Lake wetland fringe (Verlandungszone) — reduced to prevent fen merge ──
  if (lakeDist(x, y) <= 2.5) {
    const fringeNoise = fbm(x + 100, y + 100, 5);
    if (fringeNoise > 0.28) {
      return { x, y, terrain: TerrainType.Wetland, elevation: 0.20, nutrients: 6.0 };
    }
  }

  // ── Streams — with elevation gradient ──
  if (isStreamCell(x, y)) {
    return { x, y, terrain: TerrainType.River, elevation: streamElevation(y) };
  }

  // ── The Hochmoor — raised bog, elliptical along the E-W saddle axis ──
  {
    const dx = x - moor.cx, dy = y - moor.cy;
    const moorDist = Math.sqrt((dx * dx) / (moor.rx * moor.rx) + (dy * dy) / (moor.ry * moor.ry));
    if (moorDist <= 1.0) {
      const moorNoise = fbm(x + 200, y + 200, 6);
      if (moorDist <= 0.7 || moorNoise > 0.35) {
        return { x, y, terrain: TerrainType.Wetland, elevation: 0.46, nutrients: 4.0 };
      }
    }
  }

  // ── Fen (Niedermoor) at brook confluence above lake ──
  {
    const dx = x - fen.cx, dy = y - fen.cy;
    const fenDist = Math.sqrt((dx * dx) / (fen.rx * fen.rx) + (dy * dy) / (fen.ry * fen.ry));
    if (fenDist <= 1.0) {
      const fenNoise = fbm(x + 250, y + 250, 5);
      if (fenDist <= 0.6 || fenNoise > 0.38) {
        return { x, y, terrain: TerrainType.Wetland, elevation: 0.22, nutrients: 5.5 };
      }
    }
  }

  // ── Brook-side wetlands — Auen (riparian floodplain) ──
  // Wider near the lake, narrower upstream
  if (streamDist > 0.7) {
    const floodWidth = 2.5 + Math.max(0, (y - 20) / 60) * 2.5; // 2.5 cells at top, 5 near lake
    if (streamDist <= floodWidth) {
      const bankNoise = fbm(x + 300, y + 300, 5);
      const inValley = x > 18 && x < 58 && y > 8 && y < 70;
      if (inValley && bankNoise > 0.40) {
        return { x, y, terrain: TerrainType.Wetland, elevation: elev - 0.02, nutrients: 5.0 };
      }
    }
  }

  // ── Rock outcrops — on ridge crests ──
  if (isInRock(x, y)) {
    return { x, y, terrain: TerrainType.Rock, elevation: elev + 0.15 };
  }

  // ── Western ridge — wide, enclosing ──
  if (x <= 20 && y >= 5 && y <= 65) {
    const ridgeSpine = 8;
    const ridgeDist = Math.abs(x - ridgeSpine);
    const ridgeNoise = fbm(x + 400, y + 400, 5);
    // Wider zone for convincing ridge
    if (ridgeDist + ridgeNoise * 3 < 9.0) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.58 + ridgeNoise * 0.15 };
    }
  }

  // ── Eastern heights — extends further south ──
  if (x >= 55 && y <= 55) {
    const ridgeSpine = 65;
    const ridgeDist = Math.abs(x - ridgeSpine);
    const ridgeNoise = fbm(x + 500, y + 500, 5);
    if (ridgeDist + ridgeNoise * 3 < 8.0) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.55 + ridgeNoise * 0.12 };
    }
  }

  // ── Northern shoulder — solid arc connecting ridges ──
  if (y <= 12) {
    const shoulderNoise = fbm(x + 600, y + 600, 6);
    const shoulderCenter = 5; // y-center of shoulder
    const yDist = Math.abs(y - shoulderCenter);
    if (x > 18 && x < 56 && yDist + shoulderNoise * 3 < 5.5) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.48 + shoulderNoise * 0.10 };
    }
  }

  // ── Southern ridge spurs — frame the valley exit (widened) ──
  // Western spur curving south
  if (x <= 28 && y >= 60 && y <= 78) {
    const spurSpine = 14 + (y - 60) * 0.3; // spur curves inward toward center
    const spurDist = Math.abs(x - spurSpine);
    const spurNoise = fbm(x + 700, y + 700, 5);
    if (spurDist + spurNoise * 2 < 6.0) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.45 + spurNoise * 0.10 };
    }
  }
  // Eastern spur — wider, extends further
  if (x >= 54 && y >= 52 && y <= 78) {
    const spurSpine = 66 - (y - 52) * 0.25; // curves inward
    const spurDist = Math.abs(x - spurSpine);
    const spurNoise = fbm(x + 800, y + 800, 5);
    if (spurDist + spurNoise * 2 < 5.5) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.45 + spurNoise * 0.08 };
    }
  }

  // ── Forest clearings — elongated meadows with rich soil ──
  for (const c of clearings) {
    if (inEllipse(x, y, c.cx, c.cy, c.rx, c.ry, c.angle)) {
      return { x, y, terrain: TerrainType.Soil, elevation: elev, waterRecharge: 0.45, nutrients: 7.0 };
    }
  }

  // ── Brook-side fertile soil — wider alluvial strip ──
  if (streamDist <= 6.0) {
    const fertNoise = fbm(x + 350, y + 350, 7);
    return { x, y, terrain: TerrainType.Soil, elevation: elev,
             waterRecharge: 0.42, nutrients: 4.0 + fertNoise * 3.0 };
  }

  // ── Slope-foot moisture — where hillside runoff collects ──
  // Transition zone at base of ridges gets extra water
  const westRidgeDist = x <= 25 ? Math.abs(x - 20) : Infinity;
  const eastRidgeDist = x >= 50 ? Math.abs(x - 55) : Infinity;
  const slopeFoot = Math.min(westRidgeDist, eastRidgeDist);
  if (slopeFoot <= 4.0) {
    const footNoise = fbm(x + 450, y + 450, 6);
    if (footNoise > 0.45) {
      return { x, y, terrain: TerrainType.Soil, elevation: elev, waterRecharge: 0.38, nutrients: 4.5 };
    }
  }

  // ── Default: forest floor with natural elevation ──
  return { x, y, terrain: TerrainType.Soil, elevation: elev };
}

/**
 * Lindenvale — a temperate forest valley.
 *
 * A brook born from a hillside spring winds through ancient woodland, its
 * course tracing meanders around root plates and rock. It passes sunlit
 * clearings, descends through a fen where an eastern tributary joins,
 * and settles into an oblong forest lake. On the northern saddle between
 * the enclosing ridges, a raised bog (Hochmoor) — elongated along the
 * east-west saddle axis — crowns the plateau, fed only by rain.
 * Granite tors break the ridgelines. The south opens between broad
 * converging spurs into deep, unbroken forest.
 *
 * Terrain layout (80x80):
 *   - Western ridge: broad hill chain with granite tors (x=0-20, y=5-65)
 *   - Eastern heights: wooded hills (x=55-79, y<55)
 *   - Northern shoulder: solid connecting arc (y<12)
 *   - Southern spurs: widened ridge extensions framing the valley exit (y>55)
 *   - Main brook: hillside spring (18,14) -> sinuous meanders -> fen -> forest lake
 *   - Eastern tributary: descends with S-curve from heights -> joins at fen
 *   - Forest lake (Waldsee): oblong (39,53)+(43,55) with wetland fringe
 *   - The Hochmoor: raised bog at (38,7), elliptical E-W along saddle
 *   - The Niedermoor: valley-bottom fen at brook confluence (40,47)
 *   - Three elongated clearings: meadows with enriched soil
 *   - Riparian wetlands: wide Auen along streams, widening downstream
 *   - Rock outcrops: five clusters on ridge crests and summits
 *   - Slope-foot moisture zones at base of ridges
 *   - Stream elevation gradient: 0.45 at sources, 0.16 at valley exit
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
      'A forested valley cradled between gentle ridges. A brook born from a hillside spring meanders through ancient woodland to a still forest lake. A raised moor crowns the northern saddle while a broad fen marks the confluence below. Two lineages — one reaching for light, one spreading through shadow — share the rich temperate floor.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.30,
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
        placements: [{ x: 30, y: 24 }],
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
        placements: [{ x: 40, y: 46 }],
      },
    ],
  };
})();
