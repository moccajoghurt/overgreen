import { Scenario, ScenarioCell, TerrainType, ClimateZone } from '../types';

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

// ── River network v5 ──
// Summit spring → canyon gorge → great bend → four-channel delta (the Pishon dies)

// Summit spring: water born from the mountain's flank
const summitSpring = buildSegs([
  { x: 67, y: 10 },
  { x: 64, y: 11 },
  { x: 62, y: 12 },
]);

const mainRiver = buildSegs([
  { x: 62, y: 12 },   // headwater from summit spring
  { x: 56, y: 16 },   // canyon narrows
  { x: 48, y: 20 },   // canyon exit — between the gateway stones
  { x: 34, y: 26 },   // great bend — dramatic westward apex
  { x: 31, y: 34 },   // turning south
  { x: 28, y: 42 },   // delta branching point
]);

// Three channels reach the map edge — abundance overflowing
const deltaWest = buildSegs([    // dominant channel — widest
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

// The Pishon — the fourth river that reaches toward the desert and dies
// Genesis 2:10-14: four headwaters. One is broken.
const pishon = buildSegs([
  { x: 28, y: 42 },
  { x: 36, y: 46 },
  { x: 42, y: 52 },   // water fails here
  { x: 46, y: 58 },   // dry ghost channel
  { x: 48, y: 62 },   // fades into sand
]);

const deltaChannels = [deltaWest, deltaCenter, deltaEast];
const allWaterRivers = [summitSpring, mainRiver, ...deltaChannels, pishon];

// Wadis: dry channels — traces of ancient water
const neWadi = buildSegs([
  { x: 76, y: 14 },
  { x: 68, y: 17 },
  { x: 60, y: 18 },
]);

const eastWadi = buildSegs([
  { x: 76, y: 40 },
  { x: 65, y: 35 },
  { x: 54, y: 28 },
]);

const nwWadi = buildSegs([
  { x: 12, y: 8 },
  { x: 22, y: 14 },
  { x: 34, y: 22 },
]);

// Paleochannel: the memory of connection — rerouted through the omphalos
const paleochannel = buildSegs([
  { x: 36, y: 32 },
  { x: 42, y: 35 },
  { x: 50, y: 39 },   // through the meeting ground
  { x: 57, y: 44 },
  { x: 62, y: 49 },
  { x: 65, y: 52 },   // to the oasis
]);

const otherWadis = [neWadi, eastWadi, nwWadi];

// Stepping stones: soil patches in the lee of inselbergs
const steppingStones = [
  { cx: 46, cy: 37, r: 2.5 },
  { cx: 54, cy: 44, r: 2.0 },
  { cx: 61, cy: 50, r: 2.0 },
];

// The Omphalos — the navel of the world where lineages converge
const meetingGround = { cx: 50, cy: 39, r: 4.0 };

// Delta islands — land born from water
const deltaIsland = { cx: 22, cy: 54, r: 4.0 };
const deltaIsland2 = { cx: 30, cy: 62, r: 2.5 };

// ── River width: variable per channel ──

function isRiverCell(x: number, y: number): boolean {
  // Summit spring — narrow birth channel
  if (distRiver(x, y, summitSpring) <= 0.6) return true;

  // Main river — width varies by zone
  const mainDist = distRiver(x, y, mainRiver);
  const mainWidth = (y < 22 && x > 45) ? 0.7 : (y >= 22 && y <= 34) ? 1.5 : 1.2;
  if (mainDist <= mainWidth) return true;

  // Delta channels — west dominant, east smallest
  if (distRiver(x, y, deltaWest) <= 1.8) return true;
  if (distRiver(x, y, deltaCenter) <= 1.3) return true;
  if (distRiver(x, y, deltaEast) <= 1.0) return true;

  // Pishon — carries water only to y≈52, narrows as it dies
  const pDist = distRiver(x, y, pishon);
  const pWidth = y <= 52 ? 1.0 : y <= 56 ? 0.5 : 0;
  if (pDist <= pWidth) return true;

  return false;
}

function distToAnyRiver(x: number, y: number): number {
  let min = Infinity;
  for (const r of allWaterRivers) { const d = distRiver(x, y, r); if (d < min) min = d; }
  return min;
}

function distToDeltaChannels(x: number, y: number): number {
  let min = Infinity;
  for (const r of deltaChannels) { const d = distRiver(x, y, r); if (d < min) min = d; }
  return min;
}

function distToAnyWadi(x: number, y: number): number {
  let min = Infinity;
  for (const w of otherWadis) { const d = distRiver(x, y, w); if (d < min) min = d; }
  return min;
}

function isSteppingStone(x: number, y: number): boolean {
  for (const s of steppingStones) {
    if (Math.hypot(x - s.cx, y - s.cy) <= s.r) return true;
  }
  return false;
}

// ── Rock outcrops with elevation hierarchy ──

const mtX = 68, mtY = 7;

const ROCK_MOUNTAIN = 0;
const ROCK_CANYON = 1;
const ROCK_INSELBERG = 2;
const ROCK_GATEWAY = 3;
const ROCK_SENTINEL = 4;
const ROCK_OUTLIER = 5;

interface RockCluster {
  cx: number; cy: number; r: number; type: number;
}

const rockClusters: RockCluster[] = [
  // The Mountain — singular dominant massif, axis mundi
  { cx: 68, cy: 7, r: 8, type: ROCK_MOUNTAIN },
  // Canyon walls — squeezed against the gorge
  { cx: 58, cy: 16, r: 5.0, type: ROCK_CANYON },
  { cx: 50, cy: 20, r: 5.0, type: ROCK_CANYON },
  { cx: 53, cy: 22, r: 3.5, type: ROCK_CANYON },    // south wall — gorge needs two sides
  // Gateway stones — paired pylons at canyon exit (the birth gate)
  { cx: 46, cy: 21, r: 2.5, type: ROCK_GATEWAY },
  { cx: 42, cy: 23, r: 2.5, type: ROCK_GATEWAY },
  // Inselbergs — the via sacra sentinels
  { cx: 48, cy: 35, r: 5.5, type: ROCK_INSELBERG },  // first sentinel
  { cx: 56, cy: 42, r: 5.0, type: ROCK_INSELBERG },  // middle sentinel
  { cx: 63, cy: 48, r: 4.5, type: ROCK_INSELBERG },  // third sentinel
  // NW sentinel — separated from escarpment
  { cx: 8, cy: 8, r: 4.5, type: ROCK_SENTINEL },
  // Desert outlier rocks — break the horizon
  { cx: 72, cy: 38, r: 1.5, type: ROCK_OUTLIER },
  { cx: 60, cy: 65, r: 1.5, type: ROCK_OUTLIER },
  { cx: 75, cy: 58, r: 1.5, type: ROCK_OUTLIER },
];

function findRockOutcrop(x: number, y: number): RockCluster | null {
  for (const c of rockClusters) {
    const dx = x - c.cx, dy = y - c.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const warp = fbm(x * 3 + c.cx, y * 3 + c.cy, 4) * 2.5;
    if (dist < c.r + warp - 1.5) return c;
  }
  return null;
}

function rockElevation(type: number, baseElev: number): number {
  switch (type) {
    case ROCK_MOUNTAIN: return baseElev + 0.35;   // towering above all
    case ROCK_CANYON: return baseElev + 0.25;       // tall gorge walls
    case ROCK_INSELBERG: return 0.85;               // dramatic desert sentinels
    case ROCK_GATEWAY: return baseElev + 0.20;      // pillars at the birth gate
    case ROCK_SENTINEL: return baseElev + 0.20;
    case ROCK_OUTLIER: return baseElev + 0.10;
    default: return baseElev + 0.15;
  }
}

// ── Terrain ──

function getTerrain(x: number, y: number): ScenarioCell | null {
  const baseElev = 0.25 + (1 - y / 80) * 0.45 + (x / 80) * 0.15;
  const elev = baseElev + (fbm(x, y, 12) - 0.5) * 0.2;
  const mtDist = Math.hypot(x - mtX, y - mtY);

  // ── Summit spring: wetland on the mountain's flank ──
  // The primordial spring — water born from sacred height
  const springDist = Math.hypot(x - 66.5, y - 9.5);
  if (springDist <= 1.8) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.55 };
  }

  // ── Rivers (variable width per channel) ──
  if (isRiverCell(x, y)) {
    return { x, y, terrain: TerrainType.River, elevation: 0.2 };
  }

  // ── Pishon dying section: the fourth river that fails ──
  const pishonDist = distRiver(x, y, pishon);
  if (pishonDist <= 2.5 && y > 52) {
    const fade = Math.max(0, 1 - (y - 52) / 12);
    if (fade > 0.1) {
      return { x, y, terrain: TerrainType.Soil, elevation: elev - 0.03, waterRecharge: 0.15 * fade };
    }
  }

  // ── Delta islands — land born from water ──
  if (Math.hypot(x - deltaIsland.cx, y - deltaIsland.cy) <= deltaIsland.r) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.15 };
  }
  if (Math.hypot(x - deltaIsland2.cx, y - deltaIsland2.cy) <= deltaIsland2.r) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.16 };
  }

  // ── Oasis: the hidden spring — Hagar's well ──
  const oasisX = 65, oasisY = 52;
  const oDist = Math.hypot(x - oasisX, y - oasisY);
  if (oDist <= 3.0) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.30 };
  }
  if (oDist <= 4.5) {
    // Wetland fringe — green beacon in the desert
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.28 };
  }
  if (oDist <= 7) {
    return null; // soil ring
  }
  // Soil/wetland finger toward inselberg chain — wider, visible
  if (oDist <= 14) {
    const angle = Math.atan2(y - oasisY, x - oasisX);
    const fingerAngle = Math.atan2(42 - oasisY, 56 - oasisX);
    const angleDiff = Math.abs(angle - fingerAngle);
    if (angleDiff < 0.8 && oDist > 7) {
      if (fbm(x + 200, y + 200, 4) > 0.55) {
        return { x, y, terrain: TerrainType.Wetland, elevation: 0.27 };
      }
      return null; // soil
    }
  }

  // ── The Omphalos — meeting ground ──
  const mgDist = Math.hypot(x - meetingGround.cx, y - meetingGround.cy);
  if (mgDist <= 1.5) {
    // Fertile soil center — the navel of the world
    return { x, y, terrain: TerrainType.Soil, elevation: 0.30, waterRecharge: 0.35, nutrients: 6.0 };
  }
  if (mgDist <= 3.0) {
    // Wetland ring — visible green circle in brown desert
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.32 };
  }
  if (mgDist <= meetingGround.r) {
    // Raised basin lip
    return { x, y, terrain: TerrainType.Soil, elevation: 0.34, waterRecharge: 0.28 };
  }

  // ── Delta wetlands — expanded, lush ──
  const deltaDist = distToDeltaChannels(x, y);
  if (y > 45 && deltaDist > 1.8 && deltaDist < 8) {
    const wetNoise = fbm(x + 150, y + 150, 6);
    if (wetNoise > 0.25) {
      return { x, y, terrain: TerrainType.Wetland, elevation: 0.18 + fbm(x, y, 8) * 0.06 };
    }
  }

  // ── Variable-width soil banks ──
  const riverDist = distToAnyRiver(x, y);
  const bankWarp = (fbm(x + 77, y + 33, 6) - 0.5) * 0.4;
  const inCanyon = y < 22 && x > 45;
  const atBend = y >= 22 && y <= 30;
  const bankWidth = inCanyon ? 0.5 : atBend ? 5.0 : 3.0;
  if (riverDist + bankWarp <= bankWidth) {
    // First garden — fertile soil below the gateway stones
    if (x >= 36 && x <= 48 && y >= 22 && y <= 28) {
      return { x, y, terrain: TerrainType.Soil, elevation: elev, waterRecharge: 0.3, nutrients: 5.0 };
    }
    return null; // soil (default)
  }

  // ── Rock outcrops with typed elevation ──
  const rock = findRockOutcrop(x, y);
  if (rock) {
    return { x, y, terrain: TerrainType.Rock, elevation: rockElevation(rock.type, elev) };
  }

  // ── Inselberg hill pedestals — talus slopes ──
  for (const c of rockClusters) {
    if (c.type !== ROCK_INSELBERG) continue;
    const d = Math.hypot(x - c.cx, y - c.cy);
    if (d > c.r && d <= c.r + 2.5) {
      const pedestalNoise = fbm(x + c.cx, y + c.cy, 5);
      if (pedestalNoise > 0.35) {
        return { x, y, terrain: TerrainType.Hill, elevation: 0.55 + pedestalNoise * 0.1 };
      }
    }
  }

  // ── Mountain alluvial fan ──
  if (mtDist > 8 && mtDist <= 13) {
    const fanNoise = fbm(x + 500, y + 500, 6);
    if (fanNoise > 0.35) {
      return { x, y, terrain: TerrainType.Soil, elevation: elev, waterRecharge: 0.25 };
    }
  }

  // ── NE highlands ──
  const hillZone = (1 - y / 80) * 0.6 + (x / 80) * 0.4;
  if (hillZone > 0.65 && mtDist > 14) {
    return { x, y, terrain: TerrainType.Hill, elevation: Math.max(0.55, elev) };
  }

  // ── Western escarpment — rock-capped ridge ──
  if (x >= 3 && x <= 20 && y <= 42) {
    const ridgeDist = Math.abs(x - 12);
    const ridgeNoise = fbm(x + 300, y + 300, 5);
    // Rock cap on ridge spine — visible grey line
    if (ridgeDist + ridgeNoise * 2 < 2.0) {
      return { x, y, terrain: TerrainType.Rock, elevation: 0.80 };
    }
    // Tall hill flanks
    if (ridgeDist + ridgeNoise * 3 < 5.5) {
      return { x, y, terrain: TerrainType.Hill, elevation: 0.70 + ridgeNoise * 0.1 };
    }
  }

  // ── Escarpment foot — runoff zone ──
  if (x >= 15 && x <= 22 && y >= 5 && y <= 35) {
    const footNoise = fbm(x + 400, y + 400, 6);
    if (footNoise > 0.4) {
      return { x, y, terrain: TerrainType.Soil, elevation: elev, waterRecharge: 0.35 };
    }
  }

  // ── Playa — wetland basin at escarpment foot ──
  const playaDist = Math.hypot(x - 16, y - 30);
  if (playaDist <= 3) {
    return { x, y, terrain: TerrainType.Wetland, elevation: 0.15, nutrients: 4.0 };
  }
  if (playaDist <= 8) {
    return { x, y, terrain: TerrainType.Soil, elevation: 0.18, nutrients: 4.0, waterRecharge: 0.1 };
  }

  // ── Stepping stones ──
  if (isSteppingStone(x, y)) {
    return { x, y, terrain: TerrainType.Soil, elevation: 0.33, waterRecharge: 0.28 };
  }

  // ── Paleochannel — the scar of ancient connection ──
  const paleoDist = distRiver(x, y, paleochannel);
  if (paleoDist <= 1.5) {
    // Center spine — depressed, almost dry
    return { x, y, terrain: TerrainType.Soil, elevation: 0.28, waterRecharge: 0.12 };
  }
  if (paleoDist <= 4.0) {
    // Wide flanks — the scar's visible edges
    return { x, y, terrain: TerrainType.Soil, elevation: 0.33, waterRecharge: 0.18 };
  }

  // ── Other wadis ──
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

  // ── Dune field — directional ridges in SE desert ──
  if (x >= 55 && x <= 75 && y >= 55 && y <= 75) {
    const oDist2 = Math.hypot(x - 65, y - 52);
    if (oDist2 > 8) {
      const duneElev = 0.35 + Math.sin((x * 0.8 + y * 0.4) * 0.5) * 0.08 + fbm(x, y, 10) * 0.06;
      return { x, y, terrain: TerrainType.Arid, elevation: duneElev };
    }
  }

  // ── Arid desert ──
  return { x, y, terrain: TerrainType.Arid, elevation: 0.35 + fbm(x, y, 10) * 0.1 };
}

/**
 * Genesis v5 — the opening scenario.
 *
 * A river is born from a spring on a lone mountain's flank, forced through a
 * narrow canyon between stone walls, and released through paired gateway stones
 * into the open desert. It curves in a great S-bend — where the first seed is
 * planted — then fans into four channels. Three reach the map edge as a lush
 * delta. The fourth, the Pishon, reaches east toward the desert and dies in
 * sand — the broken river, the failed connection.
 *
 * Deep in the eastern desert, a hidden oasis holds a second seed. Three great
 * inselberg sentinels mark the via sacra between them. At the center, the
 * Omphalos — a wetland ring around fertile soil — waits as the destined
 * meeting ground. An ancient paleochannel, the scar of a river that once
 * connected both worlds, traces the pilgrim's path through the omphalos
 * from river to oasis.
 *
 * Terrain layout (80×80):
 *   - The Mountain: axis mundi at (68,7), summit spring on its flank
 *   - Canyon gorge: tight rock walls, south wall added, banks narrowed
 *   - Gateway stones: paired rock pylons at canyon exit (~46,21 / ~42,23)
 *   - Main river: variable width (0.7 canyon → 1.5 bend → 1.2 approach)
 *   - Delta: four channels — west (1.8), center (1.3), east (1.0), Pishon (dies)
 *   - Delta islands: expanded (22,54) r=4 and new (30,62) r=2.5
 *   - Oasis: expanded wetland core r=3, fringe r=4.5, wider soil finger
 *   - Inselbergs: tall sentinels (elev 0.85) with hill pedestal talus slopes
 *   - Omphalos: wetland ring + soil center at (50,39) — the meeting ground
 *   - Paleochannel: widened scar (4 cells) routed through the omphalos
 *   - Western escarpment: rock-capped ridge (elev 0.80), green foot zone
 *   - NW sentinel: separated to (8,8)
 *   - Playa: wetland basin at escarpment foot
 *   - Dune field: directional ridges in SE desert
 *   - Desert outlier rocks at (72,38), (60,65), (75,58)
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
      'Two seeds. Two worlds. A river born from a mountain spring descends through canyon and desert, fanning into four channels — three reach the delta, one dies in sand. At a hidden oasis, a second lineage clings to life. Three stone sentinels and an ancient dry riverbed mark the path between them. At the center, the omphalos waits.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.45,
    defaultZone: ClimateZone.Desert,
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
  };
})();
