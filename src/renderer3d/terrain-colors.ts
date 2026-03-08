import { SIM, TerrainType, WeatherOverlay, Environment, Season } from '../types';
import { RendererState, GRID, lerp } from './state';

// Pre-computed terrain base colors (RGB, from HSL constants)
const TERRAIN_RGB: Record<number, [number, number, number]> = {
  [TerrainType.Soil]:    [0.4480, 0.3200, 0.1920],
  [TerrainType.River]:   [0.4480, 0.3200, 0.1920],
  [TerrainType.Rock]:    [0.4028, 0.3800, 0.3572], // + elevation * [0.0636, 0.06, 0.0564]
  [TerrainType.Hill]:    [0.5130, 0.3889, 0.2470],
  [TerrainType.Wetland]: [0.1540, 0.2860, 0.2420],
  [TerrainType.Arid]:    [0.6480, 0.5360, 0.3120],
};

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
  const { world, colorArray, colorAttr } = state;

  if (world.tick === state.lastTerrainTick
    && state.colorMode === state.lastTerrainColorMode) return;
  state.lastTerrainTick = world.tick;
  state.lastTerrainColorMode = state.colorMode;

  const arr = colorArray;
  const env = world.environment;
  const snowCov = computeSnowCoverage(env);

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

  // ── Per-cell base terrain color ──
  const cellBaseR = new Float32Array(cellCount);
  const cellBaseG = new Float32Array(cellCount);
  const cellBaseB = new Float32Array(cellCount);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const cell = world.grid[y][x];
      const idx = y * GRID + x;
      const rgb = TERRAIN_RGB[cell.terrainType] ?? TERRAIN_RGB[TerrainType.Soil];
      if (cell.terrainType === TerrainType.Rock) {
        const e = cell.elevation;
        cellBaseR[idx] = rgb[0] + e * 0.0636;
        cellBaseG[idx] = rgb[1] + e * 0.06;
        cellBaseB[idx] = rgb[2] + e * 0.0564;
      } else {
        cellBaseR[idx] = rgb[0];
        cellBaseG[idx] = rgb[1];
        cellBaseB[idx] = rgb[2];
      }
    }
  }

  // ── Corner-averaging for smooth terrain boundaries ──
  const cornerSize = GRID + 1;
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
            count++;
            sumR += cellBaseR[idx];
            sumG += cellBaseG[idx];
            sumB += cellBaseB[idx];
          }
        }
      }
      const ci = cy * cornerSize + cx;
      cornerBaseR[ci] = sumR / count;
      cornerBaseG[ci] = sumG / count;
      cornerBaseB[ci] = sumB / count;
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
      if (overlayVal !== WeatherOverlay.None) {
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
      }

      const base = cellIdx * 18;
      const corners = [cTL, cBL, cTR, cBL, cBR, cTR];
      for (let v = 0; v < 6; v++) {
        const ci = corners[v];
        let vr = cornerBaseR[ci], vg = cornerBaseG[ci], vb = cornerBaseB[ci];

        if (cellSnow > 0) {
          vr = lerp(vr, 0.82, cellSnow);
          vg = lerp(vg, 0.85, cellSnow);
          vb = lerp(vb, 0.92, cellSnow);
        }

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

        arr[base + v * 3] = vr;
        arr[base + v * 3 + 1] = vg;
        arr[base + v * 3 + 2] = vb;
      }
    }
  }

  colorAttr.needsUpdate = true;
}
