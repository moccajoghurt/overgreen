import { SIM, TerrainType, WeatherOverlay, Environment, Season, World } from '../types';
import { Archetype, archetype } from '../types';
import { RendererState, GRID, lerp } from './state';

// ── Water adjacency cache ──
let waterAdjCache: Float32Array | null = null;
let waterAdjCacheTick = -1;

const WATER_ADJ_RADIUS = 2.5;

function computeWaterAdjacency(world: World): Float32Array {
  if (waterAdjCache && waterAdjCacheTick === 0 && world.tick !== 0) {
    return waterAdjCache;
  }
  if (waterAdjCache && waterAdjCacheTick >= 0 && world.tick > 0) {
    return waterAdjCache;
  }

  const riverCenters: [number, number][] = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (world.grid[row][col].terrainType === TerrainType.River) {
        riverCenters.push([row + 0.5, col + 0.5]);
      }
    }
  }

  const adj = new Float32Array(GRID * GRID);
  if (riverCenters.length === 0) {
    waterAdjCache = adj;
    waterAdjCacheTick = world.tick;
    return adj;
  }

  const searchR = Math.ceil(WATER_ADJ_RADIUS) + 1;

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (world.grid[row][col].terrainType === TerrainType.River) continue;

      const cy = row + 0.5, cx = col + 0.5;
      let minDist2 = WATER_ADJ_RADIUS * WATER_ADJ_RADIUS + 1;

      for (let dr = -searchR; dr <= searchR; dr++) {
        for (let dc = -searchR; dc <= searchR; dc++) {
          const nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID
            && world.grid[nr][nc].terrainType === TerrainType.River) {
            const dy = cy - (nr + 0.5);
            const dx = cx - (nc + 0.5);
            const d2 = dy * dy + dx * dx;
            if (d2 < minDist2) minDist2 = d2;
          }
        }
      }

      const dist = Math.sqrt(minDist2);
      if (dist < WATER_ADJ_RADIUS) {
        const t = dist / WATER_ADJ_RADIUS;
        adj[row * GRID + col] = 1 - t * t * (3 - 2 * t);
      }
    }
  }

  waterAdjCache = adj;
  waterAdjCacheTick = world.tick;
  return adj;
}

/** Invalidate water adjacency cache (call on scenario reload). */
export function invalidateWaterAdjacency(): void {
  waterAdjCache = null;
  waterAdjCacheTick = -1;
}

function computeSnowCoverage(env: Environment): number {
  if (env.season === Season.Autumn && env.seasonProgress > 0.8) {
    return (env.seasonProgress - 0.8) * (0.15 / 0.2);
  }
  if (env.season === Season.Winter) {
    const x = env.seasonProgress;
    return 0.15 + 0.70 * Math.sin(x * Math.PI);
  }
  if (env.season === Season.Spring && env.seasonProgress < 0.2) {
    return 0.15 * (1 - env.seasonProgress / 0.2);
  }
  return 0;
}

export function updateTerrainColors(state: RendererState): void {
  const { world, tmpColor, colorArray, colorAttr } = state;

  if (world.tick === state.lastTerrainTick
    && state.colorMode === state.lastTerrainColorMode) return;
  state.lastTerrainTick = world.tick;
  state.lastTerrainColorMode = state.colorMode;

  const arr = colorArray;
  const env = world.environment;
  const snowCov = computeSnowCoverage(env);

  // Season progress (smooth cosine interpolation)
  const st = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;

  // ── Plant tint season colors ──
  const grassTintColors = [
    0.22, 0.45, 0.12,
    0.20, 0.38, 0.10,
    0.40, 0.30, 0.10,
    0.35, 0.30, 0.18,
  ];
  const treeTintColors = [
    0.18, 0.28, 0.10,
    0.15, 0.22, 0.08,
    0.38, 0.22, 0.08,
    0.25, 0.20, 0.15,
  ];
  const shrubTintColors = [
    0.20, 0.35, 0.12,
    0.18, 0.30, 0.10,
    0.38, 0.28, 0.10,
    0.30, 0.25, 0.16,
  ];

  const ti0 = env.season * 3, ti1 = ((env.season + 1) % 4) * 3;
  const grassTR = grassTintColors[ti0] + (grassTintColors[ti1] - grassTintColors[ti0]) * st;
  const grassTG = grassTintColors[ti0 + 1] + (grassTintColors[ti1 + 1] - grassTintColors[ti0 + 1]) * st;
  const grassTB = grassTintColors[ti0 + 2] + (grassTintColors[ti1 + 2] - grassTintColors[ti0 + 2]) * st;
  const treeTR = treeTintColors[ti0] + (treeTintColors[ti1] - treeTintColors[ti0]) * st;
  const treeTG = treeTintColors[ti0 + 1] + (treeTintColors[ti1 + 1] - treeTintColors[ti0 + 1]) * st;
  const treeTB = treeTintColors[ti0 + 2] + (treeTintColors[ti1 + 2] - treeTintColors[ti0 + 2]) * st;
  const shrubTR = shrubTintColors[ti0] + (shrubTintColors[ti1] - shrubTintColors[ti0]) * st;
  const shrubTG = shrubTintColors[ti0 + 1] + (shrubTintColors[ti1 + 1] - shrubTintColors[ti0 + 1]) * st;
  const shrubTB = shrubTintColors[ti0 + 2] + (shrubTintColors[ti1 + 2] - shrubTintColors[ti0 + 2]) * st;

  // ── Water adjacency (cached) ──
  const waterAdj = computeWaterAdjacency(world);
  const wetR = 0.135, wetG = 0.162, wetB = 0.225;
  const WET_BLEND = 0.35;

  // ── Pre-build remaining-ticks lookup for weather fade-outs ──
  const cellCount = GRID * GRID;
  const remainingTicks = new Float32Array(cellCount);
  for (const [key, val] of env.scorchedCells) {
    const i = key.indexOf(',');
    const x = +key.slice(0, i), y = +key.slice(i + 1);
    remainingTicks[y * GRID + x] = val;
  }
  for (const [key, val] of env.parchedCells) {
    const i = key.indexOf(',');
    const x = +key.slice(0, i), y = +key.slice(i + 1);
    remainingTicks[y * GRID + x] = val;
  }
  for (const [key, val] of env.diseasedCells) {
    const i = key.indexOf(',');
    const x = +key.slice(0, i), y = +key.slice(i + 1);
    remainingTicks[y * GRID + x] = val;
  }

  // ── Combined per-cell pass: base terrain color + plant tint ──
  const cellBaseR = new Float32Array(cellCount);
  const cellBaseG = new Float32Array(cellCount);
  const cellBaseB = new Float32Array(cellCount);
  const cellRW = new Float32Array(cellCount);
  const cellGW = new Float32Array(cellCount);
  const cellBW = new Float32Array(cellCount);
  const cellW = new Float32Array(cellCount);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const cell = world.grid[y][x];
      const idx = y * GRID + x;

      // Base terrain color (flat HSL, no noise)
      let h: number, s: number, l: number;
      switch (cell.terrainType) {
        case TerrainType.River:  h = 30 / 360; s = 0.40; l = 0.32; break;
        case TerrainType.Rock:   h = 30 / 360; s = 0.06; l = 0.38 + cell.elevation * 0.06; break;
        case TerrainType.Hill:   h = 32 / 360; s = 0.35; l = 0.38; break;
        case TerrainType.Wetland: h = 160 / 360; s = 0.30; l = 0.22; break;
        case TerrainType.Arid:   h = 40 / 360; s = 0.35; l = 0.48; break;
        default:                 h = 30 / 360; s = 0.40; l = 0.32; break;
      }
      tmpColor.setHSL(h, s, l);
      cellBaseR[idx] = tmpColor.r;
      cellBaseG[idx] = tmpColor.g;
      cellBaseB[idx] = tmpColor.b;

      // Plant tint
      if (cell.plantId == null) continue;
      const plant = world.plants.get(cell.plantId);
      if (!plant || !plant.alive) continue;

      const genome = plant.genome;
      let tr: number, tg: number, tb: number, tw: number;

      if (state.colorMode === 'species') {
        const sc = world.speciesColors.get(plant.speciesId);
        if (!sc) continue;
        tr = sc.r; tg = sc.g; tb = sc.b; tw = 0.55;
      } else {
        const arch = archetype(genome);
        if (arch === Archetype.Succulent) {
          continue;
        } else if (arch === Archetype.Grass) {
          tr = grassTR; tg = grassTG; tb = grassTB; tw = 1.0;
        } else {
          const shrubiness = Math.max(0, Math.min(1,
            (1 - genome.heightPriority) * genome.leafSize - genome.seedInvestment * 0.2));
          if (shrubiness > 0.15) {
            tr = shrubTR; tg = shrubTG; tb = shrubTB; tw = 0.65;
          } else {
            tr = treeTR; tg = treeTG; tb = treeTB; tw = 0.5;
          }
        }
      }

      cellRW[idx] = tr * tw;
      cellGW[idx] = tg * tw;
      cellBW[idx] = tb * tw;
      cellW[idx] = tw;
    }
  }

  // ── Single corner-averaging pass (base terrain + plant tint) ──
  const cornerSize = GRID + 1;
  const cornerBaseR = new Float32Array(cornerSize * cornerSize);
  const cornerBaseG = new Float32Array(cornerSize * cornerSize);
  const cornerBaseB = new Float32Array(cornerSize * cornerSize);
  const cornerR = new Float32Array(cornerSize * cornerSize);
  const cornerG = new Float32Array(cornerSize * cornerSize);
  const cornerB = new Float32Array(cornerSize * cornerSize);
  const cornerW = new Float32Array(cornerSize * cornerSize);

  for (let cy = 0; cy <= GRID; cy++) {
    for (let cx = 0; cx <= GRID; cx++) {
      let sumR = 0, sumG = 0, sumB = 0;
      let sumRW = 0, sumGW = 0, sumBW = 0, sumW = 0;
      let count = 0;
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 0; dx++) {
          const gx = cx + dx, gy = cy + dy;
          if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
            const idx = gy * GRID + gx;
            count++;
            sumR += cellBaseR[idx];
            sumG += cellBaseG[idx];
            sumB += cellBaseB[idx];
            sumRW += cellRW[idx];
            sumGW += cellGW[idx];
            sumBW += cellBW[idx];
            sumW += cellW[idx];
          }
        }
      }
      const ci = cy * cornerSize + cx;
      cornerBaseR[ci] = sumR / count;
      cornerBaseG[ci] = sumG / count;
      cornerBaseB[ci] = sumB / count;
      cornerW[ci] = sumW / count;
      if (sumW > 0) {
        cornerR[ci] = sumRW / sumW;
        cornerG[ci] = sumGW / sumW;
        cornerB[ci] = sumBW / sumW;
      }
    }
  }

  // ── Per-cell vertex writing ──
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cell = world.grid[row][col];
      const cellIdx = row * GRID + col;

      const cTL = row * cornerSize + col;
      const cTR = row * cornerSize + col + 1;
      const cBL = (row + 1) * cornerSize + col;
      const cBR = (row + 1) * cornerSize + col + 1;

      // Snow
      let cellSnow = 0;
      if (snowCov > 0 && cell.terrainType !== TerrainType.River) {
        let boost = 1.0;
        if (cell.terrainType === TerrainType.Rock) boost = 1.2;
        else if (cell.terrainType === TerrainType.Wetland) boost = 0.4;
        else if (cell.terrainType === TerrainType.Arid) boost = 0.8;
        cellSnow = Math.min(1, snowCov * boost);
      }

      // Weather overlay
      let wxR = 0, wxG = 0, wxB = 0, wxBlend = 0;
      let wxUsesAvg = false;
      const overlayVal = env.weatherOverlay[cellIdx];
      if (overlayVal === WeatherOverlay.Drought) {
        wxUsesAvg = true; wxBlend = 0.4;
      } else if (overlayVal === WeatherOverlay.Burning) {
        wxR = 0.9; wxG = 0.3; wxB = 0.05; wxBlend = 0.7;
      } else if (overlayVal === WeatherOverlay.Scorched) {
        const remaining = remainingTicks[cellIdx];
        wxR = 0.12; wxG = 0.08; wxB = 0.06;
        wxBlend = 0.6 * Math.min(1, remaining / 40);
      } else if (overlayVal === WeatherOverlay.Parched) {
        const remaining = remainingTicks[cellIdx];
        wxR = 0.55; wxG = 0.42; wxB = 0.28;
        wxBlend = 0.4 * Math.min(1, remaining / 30);
      } else if (overlayVal === WeatherOverlay.Diseased) {
        wxR = 0.45; wxG = 0.50; wxB = 0.08; wxBlend = 0.5;
      } else if (overlayVal === WeatherOverlay.Blighted) {
        const remaining = remainingTicks[cellIdx];
        wxR = 0.40; wxG = 0.42; wxB = 0.12;
        wxBlend = 0.35 * Math.min(1, remaining / SIM.DISEASE_SCAR_DURATION);
      }

      // Water adjacency (use per-cell value directly, already smooth)
      const wa = waterAdj[cellIdx] * WET_BLEND;

      const base = cellIdx * 18;

      const corners = [cTL, cBL, cTR, cBL, cBR, cTR];
      for (let v = 0; v < 6; v++) {
        const ci = corners[v];
        let vr = cornerBaseR[ci], vg = cornerBaseG[ci], vb = cornerBaseB[ci];

        // Snow
        if (cellSnow > 0) {
          vr = lerp(vr, 0.82, cellSnow);
          vg = lerp(vg, 0.85, cellSnow);
          vb = lerp(vb, 0.92, cellSnow);
        }

        // Weather overlay
        if (wxBlend > 0) {
          if (wxUsesAvg) {
            const avg = (vr + vg + vb) / 3;
            vr = lerp(vr, avg + 0.1, wxBlend);
            vg = lerp(vg, avg - 0.02, wxBlend);
            vb = lerp(vb, avg - 0.08, wxBlend);
          } else {
            vr = lerp(vr, wxR, wxBlend);
            vg = lerp(vg, wxG, wxBlend);
            vb = lerp(vb, wxB, wxBlend);
          }
        }

        // Wet-earth blend
        vr = lerp(vr, wetR, wa);
        vg = lerp(vg, wetG, wa);
        vb = lerp(vb, wetB, wa);

        // Plant tint
        const cw = cornerW[ci];
        if (cw > 0) {
          vr = lerp(vr, lerp(cornerR[ci], 0.82, cellSnow), cw);
          vg = lerp(vg, lerp(cornerG[ci], 0.85, cellSnow), cw);
          vb = lerp(vb, lerp(cornerB[ci], 0.92, cellSnow), cw);
        }

        arr[base + v * 3] = vr;
        arr[base + v * 3 + 1] = vg;
        arr[base + v * 3 + 2] = vb;
      }
    }
  }

  colorAttr.needsUpdate = true;
}
