import { SIM, TerrainType, WeatherOverlay, Environment, Season } from '../types';
import { RendererState, GRID, lerp } from './state';

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

  // ── Per-vertex grass ground tinting ──
  // Pre-compute which cells have living grass
  const cornerSize = GRID + 1;
  const isGrass = new Uint8Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const cell = world.grid[y][x];
      if (cell.plantId != null) {
        const plant = world.plants.get(cell.plantId);
        if (plant && plant.alive && plant.genome.woodiness < 0.4) {
          isGrass[y * GRID + x] = 1;
        }
      }
    }
  }

  // Compute grass fraction at each terrain corner (shared by up to 4 cells).
  // This creates smooth gradients at grass/soil boundaries.
  const cornerGrass = new Float32Array(cornerSize * cornerSize);
  for (let cy = 0; cy <= GRID; cy++) {
    for (let cx = 0; cx <= GRID; cx++) {
      let grassCount = 0, totalCount = 0;
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 0; dx++) {
          const gx = cx + dx;
          const gy = cy + dy;
          if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
            totalCount++;
            grassCount += isGrass[gy * GRID + gx];
          }
        }
      }
      cornerGrass[cy * cornerSize + cx] = totalCount > 0 ? grassCount / totalCount : 0;
    }
  }

  // Seasonal grass ground color (darker than blade tufts — reads as shaded under-layer)
  const grassGroundColors = [
    [0.22, 0.45, 0.12], // Spring: dark green
    [0.20, 0.38, 0.10], // Summer: deep green
    [0.40, 0.30, 0.10], // Autumn: olive-brown
    [0.35, 0.30, 0.18], // Winter: dull straw
  ];
  const gg0 = grassGroundColors[env.season];
  const gg1 = grassGroundColors[(env.season + 1) % 4];
  const grassR = gg0[0] + (gg1[0] - gg0[0]) * st;
  const grassG = gg0[1] + (gg1[1] - gg0[1]) * st;
  const grassB = gg0[2] + (gg1[2] - gg0[2]) * st;

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

      // ── Per-vertex grass blending (before snow/weather so overlays cover it) ──
      // Look up corner grass fractions for this cell's 4 corners.
      // Vertices: 0=TL, 1=BL, 2=TR, 3=BL(dup), 4=BR, 5=TR(dup)
      const gTL = cornerGrass[row * cornerSize + col];
      const gTR = cornerGrass[row * cornerSize + col + 1];
      const gBL = cornerGrass[(row + 1) * cornerSize + col];
      const gBR = cornerGrass[(row + 1) * cornerSize + col + 1];

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

      // Snow-blended grass color: lerp grass ground color toward snow-white
      const snowGrassR = lerp(grassR, 0.82, cellSnow);
      const snowGrassG = lerp(grassG, 0.85, cellSnow);
      const snowGrassB = lerp(grassB, 0.92, cellSnow);

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

      // vertex 0 — TL
      arr[base]      = lerp(br, snowGrassR, gTL);
      arr[base + 1]  = lerp(bg, snowGrassG, gTL);
      arr[base + 2]  = lerp(bb, snowGrassB, gTL);
      // vertex 1 — BL
      arr[base + 3]  = lerp(br, snowGrassR, gBL);
      arr[base + 4]  = lerp(bg, snowGrassG, gBL);
      arr[base + 5]  = lerp(bb, snowGrassB, gBL);
      // vertex 2 — TR
      arr[base + 6]  = lerp(br, snowGrassR, gTR);
      arr[base + 7]  = lerp(bg, snowGrassG, gTR);
      arr[base + 8]  = lerp(bb, snowGrassB, gTR);
      // vertex 3 — BL (duplicate)
      arr[base + 9]  = arr[base + 3];
      arr[base + 10] = arr[base + 4];
      arr[base + 11] = arr[base + 5];
      // vertex 4 — BR
      arr[base + 12] = lerp(br, snowGrassR, gBR);
      arr[base + 13] = lerp(bg, snowGrassG, gBR);
      arr[base + 14] = lerp(bb, snowGrassB, gBR);
      // vertex 5 — TR (duplicate)
      arr[base + 15] = arr[base + 6];
      arr[base + 16] = arr[base + 7];
      arr[base + 17] = arr[base + 8];
    }
  }

  colorAttr.needsUpdate = true;
}
