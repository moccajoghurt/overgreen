import { SIM, TerrainType, WeatherOverlay, Environment, Season } from '../types';
import { NEIGHBORS, inBounds } from '../simulation/neighbors';
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
    && state.colorMode === state.lastTerrainColorMode
    && state.hoveredSpecies === state.lastHoveredSpecies) return;
  state.lastTerrainTick = world.tick;
  state.lastTerrainColorMode = state.colorMode;
  state.lastHoveredSpecies = state.hoveredSpecies;

  const arr = colorArray;
  const env = world.environment;

  // Pre-compute allelopathy zone buffer (strength per cell from nearby allelopathic plants)
  const allelZone = new Float32Array(GRID * GRID);
  for (const plant of world.plants.values()) {
    if (!plant.alive || plant.genome.allelopathy <= 0.2) continue;
    const strength = Math.min(1, (plant.genome.allelopathy - 0.2) * 1.5);
    // Own cell: full strength
    allelZone[plant.y * GRID + plant.x] = Math.max(allelZone[plant.y * GRID + plant.x], strength);
    // Neighbor cells: half strength
    for (const [dx, dy] of NEIGHBORS) {
      const nx = plant.x + dx;
      const ny = plant.y + dy;
      if (!inBounds(nx, ny, world.width, world.height)) continue;
      const idx = ny * GRID + nx;
      allelZone[idx] = Math.max(allelZone[idx], strength * 0.5);
    }
  }

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

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cell = world.grid[row][col];

      if (state.colorMode === 'terrain') {
        // Bold, fixed-saturation terrain colors for terrain view
        switch (cell.terrainType) {
          case TerrainType.River:  tmpColor.setHSL(210 / 360, 0.65, 0.35); break;
          case TerrainType.Rock:   tmpColor.setHSL(30 / 360, 0.10, 0.45); break;
          case TerrainType.Hill:   tmpColor.setHSL(35 / 360, 0.50, 0.50); break;
          case TerrainType.Wetland: tmpColor.setHSL(160 / 360, 0.55, 0.30); break;
          case TerrainType.Arid:   tmpColor.setHSL(42 / 360, 0.60, 0.55); break;
          default:                 tmpColor.setHSL(30 / 360, 0.55, 0.40); break; // Soil
        }
      } else {
        switch (cell.terrainType) {
          case TerrainType.River: {
            // Riverbed beneath transparent water surface — darker and more muted
            const depth = 0.5 + (cell.waterLevel / SIM.MAX_WATER) * 0.3;
            tmpColor.setHSL(210 / 360, 0.35, 0.18 * depth);
            break;
          }
          case TerrainType.Rock: {
            const rockVar = 0.9 + cell.elevation * 0.2;
            tmpColor.setHSL(30 / 360, 0.08, 0.35 * rockVar);
            break;
          }
          case TerrainType.Hill: {
            const wr = cell.waterLevel / SIM.MAX_WATER;
            const nr = cell.nutrients / SIM.MAX_NUTRIENTS;
            tmpColor.setHSL(
              (lerp(35, 28, wr) - nr * 5) / 360,
              lerp(35, 45, wr) / 100,
              Math.max(10, lerp(60, 30, wr) - nr * 3) / 100,
            );
            break;
          }
          case TerrainType.Wetland: {
            const wr = cell.waterLevel / SIM.MAX_WATER;
            const nr = cell.nutrients / SIM.MAX_NUTRIENTS;
            tmpColor.setHSL(
              (lerp(170, 160, wr) - nr * 3) / 360,
              lerp(30, 45, wr) / 100,
              Math.max(10, lerp(30, 18, wr) - nr * 2) / 100,
            );
            break;
          }
          case TerrainType.Arid: {
            const wr = cell.waterLevel / SIM.MAX_WATER;
            const nr = cell.nutrients / SIM.MAX_NUTRIENTS;
            tmpColor.setHSL(
              (lerp(40, 35, wr) - nr * 2) / 360,
              lerp(35, 50, wr) / 100,
              Math.max(15, lerp(65, 50, wr) - nr * 3) / 100,
            );
            break;
          }
          default: {
            const wr = cell.waterLevel / SIM.MAX_WATER;
            const nr = cell.nutrients / SIM.MAX_NUTRIENTS;
            tmpColor.setHSL(
              (lerp(30, 25, wr) - nr * 5) / 360,
              lerp(40, 50, wr) / 100,
              Math.max(10, lerp(55, 25, wr) - nr * 5) / 100,
            );
            break;
          }
        }
      }

      // Bake shadow into terrain color (subtle — 30% intensity)
      const shadowStr = (1 - cell.lightLevel) * 0.3;
      tmpColor.r *= 1 - shadowStr;
      tmpColor.g *= 1 - shadowStr;
      tmpColor.b *= 1 - shadowStr;

      if (state.colorMode !== 'terrain') {
        // Territory visualization
        if (state.colorMode === 'species') {
          // Species territory tint
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
        } else {
          // Natural mode: subtle root-zone darkening under occupied cells
          if (cell.plantId !== null) {
            const plant = world.plants.get(cell.plantId);
            if (plant && plant.alive) {
              tmpColor.r *= 0.92;
              tmpColor.g = tmpColor.g * 0.95 + 0.02;
              tmpColor.b *= 0.90;
            }
          }

          // Allelopathy zone: purple-brown chemical tint
          const allelStr = allelZone[row * GRID + col];
          if (allelStr > 0) {
            tmpColor.r = lerp(tmpColor.r, 0.28, allelStr * 0.25);
            tmpColor.g = lerp(tmpColor.g, 0.12, allelStr * 0.35);
            tmpColor.b = lerp(tmpColor.b, 0.22, allelStr * 0.2);
          }
        }

        // Hovered species highlight — blend toward white
        if (state.hoveredSpecies !== null) {
          let cellSpecies: number | null = null;
          if (cell.plantId !== null) {
            const p = world.plants.get(cell.plantId);
            if (p?.alive) cellSpecies = p.speciesId;
          }
          if (cellSpecies === null) cellSpecies = cell.lastSpeciesId;
          if (cellSpecies === state.hoveredSpecies) {
            tmpColor.r = lerp(tmpColor.r, 1.0, 0.25);
            tmpColor.g = lerp(tmpColor.g, 1.0, 0.25);
            tmpColor.b = lerp(tmpColor.b, 1.0, 0.25);
          }
        }
      }

      // Season tint (pre-computed above loop)
      tmpColor.r = tmpColor.r * 0.85 + sr * 0.15;
      tmpColor.g = tmpColor.g * 0.85 + sg * 0.15;
      tmpColor.b = tmpColor.b * 0.85 + sb * 0.15;

      // Snow coverage — blend toward cold snow-white (snowCov pre-computed above loop)
      if (snowCov > 0 && cell.terrainType !== TerrainType.River) {
        let boost = 1.0;
        if (cell.terrainType === TerrainType.Rock) boost = 1.2;
        else if (cell.terrainType === TerrainType.Wetland) boost = 0.4;
        else if (cell.terrainType === TerrainType.Arid) boost = 0.8;
        const s = Math.min(1, snowCov * boost);
        tmpColor.r = lerp(tmpColor.r, 0.82, s);
        tmpColor.g = lerp(tmpColor.g, 0.85, s);
        tmpColor.b = lerp(tmpColor.b, 0.92, s);
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

      // 6 vertices per cell, 3 floats per vertex
      const base = (row * GRID + col) * 18;
      for (let v = 0; v < 6; v++) {
        const i = base + v * 3;
        arr[i] = tmpColor.r;
        arr[i + 1] = tmpColor.g;
        arr[i + 2] = tmpColor.b;
      }
    }
  }

  colorAttr.needsUpdate = true;
}
