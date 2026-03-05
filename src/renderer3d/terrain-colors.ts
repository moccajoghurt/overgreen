import { SIM, TerrainType, WeatherOverlay, Environment, Season } from '../types';
import { RendererState, GRID, lerp, computeSucculence, computeShrubiness } from './state';

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

      // Classify plant type (matches rendering pipeline order)
      const succulence = computeSucculence(genome, cell.terrain);
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

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cell = world.grid[row][col];

      // Fixed natural terrain colors (no per-tick water/nutrient dynamics)
      switch (cell.terrainType) {
        case TerrainType.River:  tmpColor.setHSL(210 / 360, 0.30, 0.20); break;
        case TerrainType.Rock:   tmpColor.setHSL(30 / 360, 0.06, 0.38 + cell.elevation * 0.06); break;
        case TerrainType.Hill:   tmpColor.setHSL(32 / 360, 0.35, 0.38); break;
        case TerrainType.Wetland: tmpColor.setHSL(160 / 360, 0.30, 0.22); break;
        case TerrainType.Arid:   tmpColor.setHSL(40 / 360, 0.35, 0.48); break;
        default:                 tmpColor.setHSL(30 / 360, 0.40, 0.32); break; // Soil
      }

      // Species territory tint
      if (state.colorMode === 'species') {
        let speciesId: number | null = null;
        let blendFactor = 0;
        if (cell.plantId !== null) {
          const plant = world.plants.get(cell.plantId);
          if (plant && plant.alive) {
            speciesId = plant.speciesId;
            blendFactor = 0.35;
          }
        }
        if (speciesId === null && cell.lastSpeciesId !== null) {
          speciesId = cell.lastSpeciesId;
          blendFactor = 0.15;
        }
        if (speciesId !== null) {
          const sc = world.speciesColors.get(speciesId);
          if (sc) {
            tmpColor.r = tmpColor.r * (1 - blendFactor) + sc.r * blendFactor;
            tmpColor.g = tmpColor.g * (1 - blendFactor) + sc.g * blendFactor;
            tmpColor.b = tmpColor.b * (1 - blendFactor) + sc.b * blendFactor;
          }
        }
      }

      // Season tint (pre-computed above loop)
      tmpColor.r = tmpColor.r * 0.85 + sr * 0.15;
      tmpColor.g = tmpColor.g * 0.85 + sg * 0.15;
      tmpColor.b = tmpColor.b * 0.85 + sb * 0.15;

      // ── Per-vertex ground tinting (before snow/weather so overlays cover it) ──
      // Look up corner tint colors and blend weights for this cell's 4 corners.
      const cTL = row * cornerSize + col;
      const cTR = row * cornerSize + col + 1;
      const cBL = (row + 1) * cornerSize + col;
      const cBR = (row + 1) * cornerSize + col + 1;

      // Snow coverage — blend toward cold snow-white (snowCov pre-computed above loop)
      let cellSnow = 0;
      if (snowCov > 0 && cell.terrainType !== TerrainType.River) {
        let boost = 1.0;
        if (cell.terrainType === TerrainType.Rock) boost = 1.2;
        else if (cell.terrainType === TerrainType.Wetland) boost = 0.4;
        else if (cell.terrainType === TerrainType.Arid) boost = 0.8;
        cellSnow = Math.min(1, snowCov * boost);
        tmpColor.r = lerp(tmpColor.r, 0.82, cellSnow);
        tmpColor.g = lerp(tmpColor.g, 0.85, cellSnow);
        tmpColor.b = lerp(tmpColor.b, 0.92, cellSnow);
      }

      // Weather overlay
      const overlayVal = env.weatherOverlay[row * GRID + col];
      if (overlayVal === WeatherOverlay.Drought) {
        // Drought: desaturate + warm shift
        const avg = (tmpColor.r + tmpColor.g + tmpColor.b) / 3;
        tmpColor.r = lerp(tmpColor.r, avg + 0.1, 0.4);
        tmpColor.g = lerp(tmpColor.g, avg - 0.02, 0.4);
        tmpColor.b = lerp(tmpColor.b, avg - 0.08, 0.4);
      } else if (overlayVal === WeatherOverlay.Burning) {
        // Burning: bright orange-red
        tmpColor.r = lerp(tmpColor.r, 0.9, 0.7);
        tmpColor.g = lerp(tmpColor.g, 0.3, 0.7);
        tmpColor.b = lerp(tmpColor.b, 0.05, 0.7);
      } else if (overlayVal === WeatherOverlay.Scorched) {
        // Scorched: dark charcoal/ash, fading over time
        const key = `${col},${row}`;
        const remaining = env.scorchedCells.get(key) ?? 0;
        const intensity = Math.min(1, remaining / 40);
        const blend = 0.6 * intensity;
        tmpColor.r = lerp(tmpColor.r, 0.12, blend);
        tmpColor.g = lerp(tmpColor.g, 0.08, blend);
        tmpColor.b = lerp(tmpColor.b, 0.06, blend);
      } else if (overlayVal === WeatherOverlay.Parched) {
        // Parched: pale dry earth, fading over time
        const key = `${col},${row}`;
        const remaining = env.parchedCells.get(key) ?? 0;
        const intensity = Math.min(1, remaining / 30);
        const blend = 0.4 * intensity;
        tmpColor.r = lerp(tmpColor.r, 0.55, blend);
        tmpColor.g = lerp(tmpColor.g, 0.42, blend);
        tmpColor.b = lerp(tmpColor.b, 0.28, blend);
      } else if (overlayVal === WeatherOverlay.Diseased) {
        // Active disease: sickly yellow-green
        tmpColor.r = lerp(tmpColor.r, 0.45, 0.5);
        tmpColor.g = lerp(tmpColor.g, 0.50, 0.5);
        tmpColor.b = lerp(tmpColor.b, 0.08, 0.5);
      } else if (overlayVal === WeatherOverlay.Blighted) {
        // Blight scar: fading pale sickly
        const key = `${col},${row}`;
        const remaining = env.diseasedCells.get(key) ?? 0;
        const intensity = Math.min(1, remaining / SIM.DISEASE_SCAR_DURATION);
        const blend = 0.35 * intensity;
        tmpColor.r = lerp(tmpColor.r, 0.40, blend);
        tmpColor.g = lerp(tmpColor.g, 0.42, blend);
        tmpColor.b = lerp(tmpColor.b, 0.12, blend);
      }

      const base = (row * GRID + col) * 18;
      const br = tmpColor.r, bg = tmpColor.g, bb = tmpColor.b;

      // Per-vertex: lerp(base, lerp(tintColor, snowWhite, cellSnow), weight)
      // vertex 0 — TL
      arr[base]      = lerp(br, lerp(cornerR[cTL], 0.82, cellSnow), cornerW[cTL]);
      arr[base + 1]  = lerp(bg, lerp(cornerG[cTL], 0.85, cellSnow), cornerW[cTL]);
      arr[base + 2]  = lerp(bb, lerp(cornerB[cTL], 0.92, cellSnow), cornerW[cTL]);
      // vertex 1 — BL
      arr[base + 3]  = lerp(br, lerp(cornerR[cBL], 0.82, cellSnow), cornerW[cBL]);
      arr[base + 4]  = lerp(bg, lerp(cornerG[cBL], 0.85, cellSnow), cornerW[cBL]);
      arr[base + 5]  = lerp(bb, lerp(cornerB[cBL], 0.92, cellSnow), cornerW[cBL]);
      // vertex 2 — TR
      arr[base + 6]  = lerp(br, lerp(cornerR[cTR], 0.82, cellSnow), cornerW[cTR]);
      arr[base + 7]  = lerp(bg, lerp(cornerG[cTR], 0.85, cellSnow), cornerW[cTR]);
      arr[base + 8]  = lerp(bb, lerp(cornerB[cTR], 0.92, cellSnow), cornerW[cTR]);
      // vertex 3 — BL (duplicate)
      arr[base + 9]  = arr[base + 3];
      arr[base + 10] = arr[base + 4];
      arr[base + 11] = arr[base + 5];
      // vertex 4 — BR
      arr[base + 12] = lerp(br, lerp(cornerR[cBR], 0.82, cellSnow), cornerW[cBR]);
      arr[base + 13] = lerp(bg, lerp(cornerG[cBR], 0.85, cellSnow), cornerW[cBR]);
      arr[base + 14] = lerp(bb, lerp(cornerB[cBR], 0.92, cellSnow), cornerW[cBR]);
      // vertex 5 — TR (duplicate)
      arr[base + 15] = arr[base + 6];
      arr[base + 16] = arr[base + 7];
      arr[base + 17] = arr[base + 8];
    }
  }

  colorAttr.needsUpdate = true;
}
