import { SIM, TerrainType, WeatherOverlay, Environment, Season, World } from '../types';
import { RendererState, GRID, lerp, computeSucculence, computeShrubiness } from './state';

// ── Water adjacency cache ──
let waterAdjCache: Float32Array | null = null;
let waterAdjCacheTick = -1;

/**
 * Compute per-cell water adjacency weight (0→1) using smooth distance falloff.
 * Uses Euclidean distance to nearest river cell with a smooth ramp,
 * so the wet-earth band follows the river organically rather than per-cell.
 */
const WATER_ADJ_RADIUS = 2.5; // cells — falloff distance from river edge

function computeWaterAdjacency(world: World): Float32Array {
  if (waterAdjCache && waterAdjCacheTick === 0 && world.tick !== 0) {
    return waterAdjCache;
  }
  if (waterAdjCache && waterAdjCacheTick >= 0 && world.tick > 0) {
    return waterAdjCache;
  }

  // Collect river cell centers
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

      // Find minimum distance to any river cell (local search)
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
        // Smooth hermite falloff: 1 at river edge → 0 at radius
        const t = dist / WATER_ADJ_RADIUS;
        adj[row * GRID + col] = 1 - t * t * (3 - 2 * t); // smoothstep inverse
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

/**
 * Snow coverage factor (0→1) based on season + progress.
 * Ramps up in late autumn, peaks mid-winter, melts in early spring.
 */
function computeSnowCoverage(env: Environment): number {
  if (env.season === Season.Autumn && env.seasonProgress > 0.8) {
    // Late autumn: snow starts appearing
    return (env.seasonProgress - 0.8) * (0.15 / 0.2);
  }
  if (env.season === Season.Winter) {
    // Bell curve peaking at ~0.85 mid-winter
    const x = env.seasonProgress;
    return 0.15 + 0.70 * Math.sin(x * Math.PI);
  }
  if (env.season === Season.Spring && env.seasonProgress < 0.2) {
    // Early spring: melting remnants
    return 0.15 * (1 - env.seasonProgress / 0.2);
  }
  return 0;
}

export function updateTerrainColors(state: RendererState): void {
  const { world, tmpColor, colorArray, colorAttr } = state;

  // Skip if nothing changed since last update
  if (world.tick === state.lastTerrainTick
    && state.colorMode === state.lastTerrainColorMode) return;
  state.lastTerrainTick = world.tick;
  state.lastTerrainColorMode = state.colorMode;

  const arr = colorArray;
  const env = world.environment;

  // Hoist season-invariant computations out of the per-cell loop
  const seasonColorsData = [
    0.3, 0.6, 0.3,  // Spring: green
    0.6, 0.5, 0.2,  // Summer: golden
    0.5, 0.35, 0.2, // Autumn: orange-brown
    0.3, 0.35, 0.5, // Winter: blue-grey
  ];
  const si0 = env.season * 3;
  const si1 = ((env.season + 1) % 4) * 3;
  const st = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;
  const sr = seasonColorsData[si0] + (seasonColorsData[si1] - seasonColorsData[si0]) * st;
  const sg = seasonColorsData[si0 + 1] + (seasonColorsData[si1 + 1] - seasonColorsData[si0 + 1]) * st;
  const sb = seasonColorsData[si0 + 2] + (seasonColorsData[si1 + 2] - seasonColorsData[si0 + 2]) * st;
  const snowCov = computeSnowCoverage(env);

  // ── Per-plant-type ground tinting ──
  // Each plant type tints the terrain differently with smooth corner blending.
  const cornerSize = GRID + 1;

  // Seasonal ground tint colors: [spring, summer, autumn, winter] × [r, g, b]
  const grassTintColors = [
    0.22, 0.45, 0.12,  // Spring: dark green
    0.20, 0.38, 0.10,  // Summer: deep green
    0.40, 0.30, 0.10,  // Autumn: olive-brown
    0.35, 0.30, 0.18,  // Winter: dull straw
  ];
  const treeTintColors = [
    0.18, 0.28, 0.10,  // Spring: mossy dark brown
    0.15, 0.22, 0.08,  // Summer: deep shade brown
    0.38, 0.22, 0.08,  // Autumn: reddish leaf litter
    0.25, 0.20, 0.15,  // Winter: bare dark soil
  ];
  const shrubTintColors = [
    0.20, 0.35, 0.12,  // Spring: dark green-brown
    0.18, 0.30, 0.10,  // Summer: dark green
    0.38, 0.28, 0.10,  // Autumn: warm brown
    0.30, 0.25, 0.16,  // Winter: muted brown
  ];

  // Interpolate each table by season progress
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

  // ── Water adjacency (wet-earth shoreline blend) ──
  const waterAdj = computeWaterAdjacency(world);

  // Corner-average the water adjacency weights for smooth blending
  const cornerWaterAdj = new Float32Array(cornerSize * cornerSize);
  for (let cy = 0; cy <= GRID; cy++) {
    for (let cx = 0; cx <= GRID; cx++) {
      let sum = 0, count = 0;
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 0; dx++) {
          const gx = cx + dx, gy = cy + dy;
          if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
            sum += waterAdj[gy * GRID + gx];
            count++;
          }
        }
      }
      cornerWaterAdj[cy * cornerSize + cx] = count > 0 ? sum / count : 0;
    }
  }

  // Wet-earth target color (HSL ~200°, 0.25, 0.18 → dark cool brown)
  const wetR = 0.135, wetG = 0.162, wetB = 0.225;
  const WET_BLEND = 0.35;

  // Per-cell: pre-multiplied tint color (r×w, g×w, b×w) and blend weight
  const cellCount = GRID * GRID;
  const cellRW = new Float32Array(cellCount);
  const cellGW = new Float32Array(cellCount);
  const cellBW = new Float32Array(cellCount);
  const cellW = new Float32Array(cellCount);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const cell = world.grid[y][x];
      if (cell.plantId == null) continue;
      const plant = world.plants.get(cell.plantId);
      if (!plant || !plant.alive) continue;

      const genome = plant.genome;
      let tr: number, tg: number, tb: number, tw: number;

      if (state.colorMode === 'species') {
        // Species mode: tint ground with the species color
        const sc = world.speciesColors.get(plant.speciesId);
        if (!sc) continue;
        tr = sc.r; tg = sc.g; tb = sc.b; tw = 0.55;
      } else {
        // Natural mode: tint by plant type
        const succulence = computeSucculence(genome, cell.terrainType);
        if (succulence >= 0.45) {
          continue; // Succulents: no ground tint (keep arid sand)
        } else if (genome.woodiness < 0.4) {
          tr = grassTR; tg = grassTG; tb = grassTB; tw = 1.0;
        } else {
          const shrubiness = computeShrubiness(genome);
          if (shrubiness > 0.15) {
            tr = shrubTR; tg = shrubTG; tb = shrubTB; tw = 0.65;
          } else {
            tr = treeTR; tg = treeTG; tb = treeTB; tw = 0.5;
          }
        }
      }

      const idx = y * GRID + x;
      cellRW[idx] = tr * tw;
      cellGW[idx] = tg * tw;
      cellBW[idx] = tb * tw;
      cellW[idx] = tw;
    }
  }

  // Corner averaging: blend weight = mean(cell weights), tint color = weighted average
  const cornerR = new Float32Array(cornerSize * cornerSize);
  const cornerG = new Float32Array(cornerSize * cornerSize);
  const cornerB = new Float32Array(cornerSize * cornerSize);
  const cornerW = new Float32Array(cornerSize * cornerSize);

  for (let cy = 0; cy <= GRID; cy++) {
    for (let cx = 0; cx <= GRID; cx++) {
      let sumRW = 0, sumGW = 0, sumBW = 0, sumW = 0, count = 0;
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 0; dx++) {
          const gx = cx + dx, gy = cy + dy;
          if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
            const idx = gy * GRID + gx;
            count++;
            sumRW += cellRW[idx];
            sumGW += cellGW[idx];
            sumBW += cellBW[idx];
            sumW += cellW[idx];
          }
        }
      }
      const ci = cy * cornerSize + cx;
      cornerW[ci] = count > 0 ? sumW / count : 0;
      if (sumW > 0) {
        cornerR[ci] = sumRW / sumW;
        cornerG[ci] = sumGW / sumW;
        cornerB[ci] = sumBW / sumW;
      }
    }
  }

  // ── Pre-pass: compute per-cell base terrain color (switch + season tint) ──
  const cellBaseR = new Float32Array(cellCount);
  const cellBaseG = new Float32Array(cellCount);
  const cellBaseB = new Float32Array(cellCount);

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cell = world.grid[row][col];
      switch (cell.terrainType) {
        case TerrainType.River:  tmpColor.setHSL(30 / 360, 0.40, 0.32); break;
        case TerrainType.Rock:   tmpColor.setHSL(30 / 360, 0.06, 0.38 + cell.elevation * 0.06); break;
        case TerrainType.Hill:   tmpColor.setHSL(32 / 360, 0.35, 0.38); break;
        case TerrainType.Wetland: tmpColor.setHSL(160 / 360, 0.30, 0.22); break;
        case TerrainType.Arid:   tmpColor.setHSL(40 / 360, 0.35, 0.48); break;
        default:                 tmpColor.setHSL(30 / 360, 0.40, 0.32); break;
      }
      tmpColor.r = tmpColor.r * 0.85 + sr * 0.15;
      tmpColor.g = tmpColor.g * 0.85 + sg * 0.15;
      tmpColor.b = tmpColor.b * 0.85 + sb * 0.15;
      const idx = row * GRID + col;
      cellBaseR[idx] = tmpColor.r;
      cellBaseG[idx] = tmpColor.g;
      cellBaseB[idx] = tmpColor.b;
    }
  }

  // ── Corner-average base terrain colors for smooth boundaries ──
  const cornerBaseR = new Float32Array(cornerSize * cornerSize);
  const cornerBaseG = new Float32Array(cornerSize * cornerSize);
  const cornerBaseB = new Float32Array(cornerSize * cornerSize);

  for (let cy = 0; cy <= GRID; cy++) {
    for (let cx = 0; cx <= GRID; cx++) {
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 0; dx++) {
          const gx = cx + dx, gy = cy + dy;
          if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
            const idx = gy * GRID + gx;
            sumR += cellBaseR[idx];
            sumG += cellBaseG[idx];
            sumB += cellBaseB[idx];
            count++;
          }
        }
      }
      const ci = cy * cornerSize + cx;
      cornerBaseR[ci] = sumR / count;
      cornerBaseG[ci] = sumG / count;
      cornerBaseB[ci] = sumB / count;
    }
  }

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cell = world.grid[row][col];

      const cTL = row * cornerSize + col;
      const cTR = row * cornerSize + col + 1;
      const cBL = (row + 1) * cornerSize + col;
      const cBR = (row + 1) * cornerSize + col + 1;

      // Snow coverage (per-cell, applied to each vertex below)
      let cellSnow = 0;
      if (snowCov > 0 && cell.terrainType !== TerrainType.River) {
        let boost = 1.0;
        if (cell.terrainType === TerrainType.Rock) boost = 1.2;
        else if (cell.terrainType === TerrainType.Wetland) boost = 0.4;
        else if (cell.terrainType === TerrainType.Arid) boost = 0.8;
        cellSnow = Math.min(1, snowCov * boost);
      }

      // Weather overlay — compute blend target + factor (per-cell, sharp)
      let wxR = 0, wxG = 0, wxB = 0, wxBlend = 0;
      let wxUsesAvg = false;
      const overlayVal = env.weatherOverlay[row * GRID + col];
      if (overlayVal === WeatherOverlay.Drought) {
        wxUsesAvg = true; wxBlend = 0.4;
      } else if (overlayVal === WeatherOverlay.Burning) {
        wxR = 0.9; wxG = 0.3; wxB = 0.05; wxBlend = 0.7;
      } else if (overlayVal === WeatherOverlay.Scorched) {
        const key = `${col},${row}`;
        const remaining = env.scorchedCells.get(key) ?? 0;
        wxR = 0.12; wxG = 0.08; wxB = 0.06;
        wxBlend = 0.6 * Math.min(1, remaining / 40);
      } else if (overlayVal === WeatherOverlay.Parched) {
        const key = `${col},${row}`;
        const remaining = env.parchedCells.get(key) ?? 0;
        wxR = 0.55; wxG = 0.42; wxB = 0.28;
        wxBlend = 0.4 * Math.min(1, remaining / 30);
      } else if (overlayVal === WeatherOverlay.Diseased) {
        wxR = 0.45; wxG = 0.50; wxB = 0.08; wxBlend = 0.5;
      } else if (overlayVal === WeatherOverlay.Blighted) {
        const key = `${col},${row}`;
        const remaining = env.diseasedCells.get(key) ?? 0;
        wxR = 0.40; wxG = 0.42; wxB = 0.12;
        wxBlend = 0.35 * Math.min(1, remaining / SIM.DISEASE_SCAR_DURATION);
      }

      // Water adjacency blend factors per corner
      const waTL = cornerWaterAdj[cTL] * WET_BLEND;
      const waTR = cornerWaterAdj[cTR] * WET_BLEND;
      const waBL = cornerWaterAdj[cBL] * WET_BLEND;
      const waBR = cornerWaterAdj[cBR] * WET_BLEND;

      const base = (row * GRID + col) * 18;

      // Per-vertex: corner-averaged base → snow → weather → wet-earth → plant tint
      const corners = [cTL, cBL, cTR, cBL, cBR, cTR];
      const waFactors = [waTL, waBL, waTR, waBL, waBR, waTR];
      for (let v = 0; v < 6; v++) {
        const ci = corners[v];
        const wa = waFactors[v];
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
