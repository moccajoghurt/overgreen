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

// ── River network v4 ──
// Dramatic S-curve from mountain through canyon to three-channel delta

const mainRiver = buildSegs([
  { x: 62, y: 12 },   // source: mountain base
  { x: 56, y: 16 },   // canyon narrows
  { x: 48, y: 20 },   // canyon exit
  { x: 34, y: 26 },   // great bend — dramatic westward apex
  { x: 31, y: 34 },   // turning south
  { x: 28, y: 42 },   // delta branching point
]);

// Delta: three channels fanning wide to the map edge
const deltaWest = buildSegs([
  { x: 28, y: 42 },
  { x: 18, y: 50 },
  { x: 10, y: 60 },
  { x: 4, y: 70 },
  { x: 0, y: 79 },
]);

const deltaCenter = buildSegs([
  { x: 28, y: 42 },
  { x: 26, y: 50 },
  { x: 22, y: 58 },
  { x: 18, y: 68 },
  { x: 12, y: 79 },
]);

const deltaEast = buildSegs([
  { x: 28, y: 42 },
  { x: 34, y: 50 },
  { x: 38, y: 60 },
  { x: 35, y: 70 },
  { x: 30, y: 79 },
]);

const allRivers = [mainRiver, deltaWest, deltaCenter, deltaEast];

// Wadis: dry channels — traces of ancient water
const neWadi = buildSegs([
  { x: 76, y: 14 },
  { x: 68, y: 17 },
  { x: 60, y: 18 },
]);

// East wadi reoriented: from SE desert, passing near inselberg chain
const eastWadi = buildSegs([
  { x: 76, y: 40 },
  { x: 65, y: 35 },
  { x: 54, y: 28 },
]);

// NW wadi: drains escarpment toward river
const nwWadi = buildSegs([
  { x: 12, y: 8 },
  { x: 22, y: 14 },
  { x: 34, y: 22 },
]);

// Paleochannel: ancient dry channel connecting stepping stones from river to oasis
const paleochannel = buildSegs([
  { x: 38, y: 34 },
  { x: 46, y: 37 },
  { x: 54, y: 44 },
  { x: 61, y: 50 },
  { x: 64, y: 52 },
]);

const allWadis = [neWadi, eastWadi, nwWadi, paleochannel];

// Stepping stones: soil patches in the lee of inselbergs
const steppingStones = [
  { cx: 46, cy: 37, r: 2.5 },   // lee of first inselberg
  { cx: 54, cy: 44, r: 2.0 },   // lee of second inselberg
  { cx: 61, cy: 50, r: 2.0 },   // lee of third inselberg, near oasis
];

// Meeting ground — the empty throne where lineages will converge
const meetingGround = { cx: 50, cy: 39, r: 3.0 };

// Mid-delta island — land born from water
const deltaIsland = { cx: 22, cy: 54, r: 2.5 };

function distToAnyRiver(x: number, y: number): number {
  let min = Infinity;
  for (const r of allRivers) { const d = distRiver(x, y, r); if (d < min) min = d; }
  return min;
}

function distToAnyWadi(x: number, y: number): number {
  let min = Infinity;
  for (const w of allWadis) { const d = distRiver(x, y, w); if (d < min) min = d; }
  return min;
}

function isSteppingStone(x: number, y: number): boolean {
  for (const s of steppingStones) {
    if (Math.hypot(x - s.cx, y - s.cy) <= s.r) return true;
  }
  return false;
}

// ── Rock outcrops ──

const mtX = 68, mtY = 7;

function isRockOutcrop(x: number, y: number): boolean {
  const clusters = [
    // The Mountain — singular dominant massif, source of the river
    { cx: 68, cy: 7, r: 8 },
    // Canyon walls — tighter, pressing close to the river gorge
    { cx: 57, cy: 15, r: 5.5 },
    { cx: 50, cy: 19, r: 5.5 },
    // Inselbergs — large sentinels forming clear chain from river to oasis
    { cx: 48, cy: 35, r: 4.5 },   // first sentinel, near river
    { cx: 56, cy: 42, r: 4.0 },   // middle sentinel
    { cx: 63, cy: 48, r: 3.5 },   // third sentinel, near oasis
    // NW sentinel — enlarged counterweight to the Mountain
    { cx: 12, cy: 12, r: 5 },
  ];
  for (const c of clusters) {
    const dx = x - c.cx, dy = y - c.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const warp = fbm(x * 3 + c.cx, y * 3 + c.cy, 4) * 2.5;
    if (dist < c.r + warp - 1.5) return true;
  }
  return false;
}

// ── Terrain ──

function getTerrain(x: number, y: number): ScenarioCell | null {
  const baseElev = 0.25 + (1 - y / 80) * 0.45 + (x / 80) * 0.15;
  const elev = baseElev + (fbm(x, y, 12) - 0.5) * 0.2;
  const mtDist = Math.hypot(x - mtX, y - mtY);

  // ── Rivers (always punch through) ──
  const riverDist = distToAnyRiver(x, y);
  if (riverDist <= 1.0) {
    return { x, y, terrain: TerrainType.River, elevation: 0.2 };
  }

  // ── Mid-delta island: wetland between channels ──
  if (Math.hypot(x - deltaIsland.cx, y - deltaIsland.cy) <= deltaIsland.r) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.15 };
  }

  // ── Oasis: expanded spring in SE desert ──
  const oasisX = 65, oasisY = 52;
  const oDist = Math.hypot(x - oasisX, y - oasisY);
  if (oDist <= 2.0) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.30 };
  }
  if (oDist <= 6) {
    return null; // expanded soil ring
  }
  // Soil finger extending from oasis toward inselberg chain — wider angle, longer reach
  if (oDist <= 14) {
    const angle = Math.atan2(y - oasisY, x - oasisX);
    const fingerAngle = Math.atan2(42 - oasisY, 56 - oasisX); // toward middle inselberg
    const angleDiff = Math.abs(angle - fingerAngle);
    if (angleDiff < 0.5 && oDist > 6) {
      return null; // soil trace reaching toward the sentinels
    }
  }

  // ── Wetlands along lower delta ──
  if (y > 50 && riverDist > 1.0 && riverDist < 5) {
    const wetNoise = fbm(x + 150, y + 150, 6);
    if (wetNoise > 0.35) {
      return { x, y, terrain: TerrainType.Wetland, elevation: 0.18 + fbm(x, y, 8) * 0.06 };
    }
  }

  // ── Variable-width soil banks ──
  const bankWarp = (fbm(x + 77, y + 33, 6) - 0.5) * 0.4;
  const inCanyon = y < 22 && x > 45;
  const atBend = y >= 22 && y <= 30;
  const bankWidth = inCanyon ? 2.0 : atBend ? 4.0 : 2.5;
  if (riverDist + bankWarp <= bankWidth) {
    return null; // soil (default)
  }

  // ── Rock outcrops (mountain, canyon walls, inselbergs, sentinel) ──
  if (isRockOutcrop(x, y)) {
    return { x, y, terrain: TerrainType.Rock, elevation: elev + 0.15 };
  }

  // ── Mountain alluvial fan — soil apron where runoff concentrates ──
  if (mtDist > 8 && mtDist <= 13) {
    const fanNoise = fbm(x + 500, y + 500, 6);
    if (fanNoise > 0.35) {
      return { x, y, terrain: TerrainType.Soil, elevation: elev, waterRecharge: 0.25 };
    }
  }

  // ── NE highlands — excluded near mountain for isolation ──
  const hillZone = (1 - y / 80) * 0.6 + (x / 80) * 0.4;
  if (hillZone > 0.65 && mtDist > 14) {
    return { x, y, terrain: TerrainType.Hill, elevation: Math.max(0.55, elev) };
  }

  // ── Western escarpment — strong ridge wall framing the valley ──
  if (x >= 3 && x <= 20 && y <= 42) {
    const ridgeDist = Math.abs(x - 12);
    const ridgeNoise = fbm(x + 300, y + 300, 5);
    if (ridgeDist + ridgeNoise * 3 < 5.5) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.5 + ridgeNoise * 0.1 };
    }
  }

  // ── Dry playa — closed basin at escarpment foot ──
  const playaDist = Math.hypot(x - 16, y - 30);
  if (playaDist <= 6) {
    return { x, y, terrain: TerrainType.Soil, elevation: 0.28, nutrients: 4.0, waterRecharge: 0.1 };
  }

  // ── Meeting ground — soil depression between first and second inselberg ──
  if (Math.hypot(x - meetingGround.cx, y - meetingGround.cy) <= meetingGround.r) {
    return { x, y, terrain: TerrainType.Soil, elevation: 0.30, waterRecharge: 0.28 };
  }

  // ── Stepping stones: soil patches in inselberg lee ──
  if (isSteppingStone(x, y)) {
    return { x, y, terrain: TerrainType.Soil, elevation: 0.33, waterRecharge: 0.28 };
  }

  // ── Wadis and paleochannel: dry channels with low recharge ──
  const wadiDist = distToAnyWadi(x, y);
  if (wadiDist <= 2.0) {
    return { x, y, terrain: TerrainType.Soil, elevation: elev, waterRecharge: 0.22 };
  }

  // ── Transition: soil/arid mix near rivers ──
  if (riverDist < 5) {
    const aridNoise = fbm(x + 100, y + 100, 8);
    if (aridNoise > 0.55) {
      return { x, y, terrain: TerrainType.Arid, elevation: 0.35 + fbm(x, y, 10) * 0.1 };
    }
    return null; // soil
  }

  // ── Arid desert ──
  return { x, y, terrain: TerrainType.Arid, elevation: 0.35 + fbm(x, y, 10) * 0.1 };
}

/**
 * Genesis v4 — the opening scenario.
 *
 * A river descends from a lone mountain through a tight canyon and across the
 * desert in a dramatic S-curve, fanning into a three-channel delta that flows
 * off the SW corner of the map. Deep in the eastern desert, a hidden oasis
 * holds a second seed. Three great inselbergs mark the path between them —
 * the via sacra where two lineages will one day meet.
 *
 * Terrain layout (80×80):
 *   - The Mountain: dominant rock massif in NE (68,7), isolated from hills
 *   - Alluvial fan: soil apron around mountain base
 *   - Canyon gorge: tight rock walls squeezing the upper river
 *   - Main river: dramatic westward S-curve, then south to delta
 *   - Delta: three channels fanning wide off the SW corner, mid-delta island
 *   - Wadis: NE, reoriented east (through inselberg zone), NW from escarpment
 *   - Paleochannel: ancient dry channel connecting stepping stones
 *   - Oasis: expanded spring at (65,52) with wide soil ring and long finger
 *   - Inselbergs: three large sentinels (48,35)→(56,42)→(63,48), decreasing
 *   - Stepping stones: soil patches in lee of each inselberg
 *   - Meeting ground: soil depression at (50,39) — the empty throne
 *   - NW sentinel: large rock counterweight at (12,12)
 *   - Western escarpment: strong hill ridge framing the valley
 *   - Dry playa: closed basin at escarpment foot (16,30)
 *   - Seed 1 (Primordial Shrub): inside the great bend's floodplain
 *   - Seed 2 (Desert Survivor): at the oasis
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
      'Two seeds. Two worlds. A river descends from a lone mountain through canyon and desert, fanning into a great delta. At a hidden oasis, a second lineage clings to life. Three stone sentinels mark the path between them. Watch them evolve — and one day, meet.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.45,
    cells,
    species: [
      {
        id: 1,
        name: 'Primordial Shrub',
        genome: {
          rootPriority: 0.50,
          heightPriority: 0.25,
          leafSize: 0.45,
          seedInvestment: 0.70,
          seedSize: 0.40,
          defense: 0.05,
          woodiness: 0.35,
          waterStorage: 0.20,
          longevity: 0.4,
        },
        color: { r: 0.35, g: 0.65, b: 0.20 },
        placements: [{ x: 36, y: 28 }],
      },
      {
        id: 2,
        name: 'Desert Survivor',
        genome: {
          rootPriority: 0.55,
          heightPriority: 0.20,
          leafSize: 0.25,
          seedInvestment: 0.50,
          seedSize: 0.55,
          defense: 0.15,
          woodiness: 0.40,
          waterStorage: 0.70,
          longevity: 0.65,
        },
        color: { r: 0.70, g: 0.55, b: 0.15 },
        placements: [{ x: 65, y: 52 }],
      },
    ],
    lockedEra: ClimateEra.Temperate,
  };
})();
