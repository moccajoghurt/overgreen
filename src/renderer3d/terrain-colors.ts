import { SIM, TerrainType } from '../types';
import { RendererState, GRID, lerp } from './state';

export function updateTerrainColors(state: RendererState): void {
  const { world, tmpColor, colorArray, colorAttr } = state;
  const arr = colorArray;

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cell = world.grid[row][col];

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

      // Bake shadow into terrain color
      const light = cell.lightLevel;
      tmpColor.r *= light;
      tmpColor.g *= light;
      tmpColor.b *= light;

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
      }

      // Season tint
      const env = world.environment;
      const seasonColors = [
        [0.3, 0.6, 0.3],  // Spring: green
        [0.6, 0.5, 0.2],  // Summer: golden
        [0.5, 0.35, 0.2], // Autumn: orange-brown
        [0.3, 0.35, 0.5], // Winter: blue-grey
      ];
      const sc0 = seasonColors[env.season];
      const sc1 = seasonColors[(env.season + 1) % 4];
      const st = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;
      const sr = sc0[0] + (sc1[0] - sc0[0]) * st;
      const sg = sc0[1] + (sc1[1] - sc0[1]) * st;
      const sb = sc0[2] + (sc1[2] - sc0[2]) * st;
      tmpColor.r = tmpColor.r * 0.85 + sr * 0.15;
      tmpColor.g = tmpColor.g * 0.85 + sg * 0.15;
      tmpColor.b = tmpColor.b * 0.85 + sb * 0.15;

      // Weather overlay
      const overlayVal = env.weatherOverlay[row * GRID + col];
      if (overlayVal === 1) {
        // Drought: desaturate + warm shift
        const avg = (tmpColor.r + tmpColor.g + tmpColor.b) / 3;
        tmpColor.r = lerp(tmpColor.r, avg + 0.1, 0.4);
        tmpColor.g = lerp(tmpColor.g, avg - 0.02, 0.4);
        tmpColor.b = lerp(tmpColor.b, avg - 0.08, 0.4);
      } else if (overlayVal === 2) {
        // Burning: bright orange-red
        tmpColor.r = lerp(tmpColor.r, 0.9, 0.7);
        tmpColor.g = lerp(tmpColor.g, 0.3, 0.7);
        tmpColor.b = lerp(tmpColor.b, 0.05, 0.7);
      } else if (overlayVal === 3) {
        // Scorched: dark charcoal/ash, fading over time
        const key = `${col},${row}`;
        const remaining = env.scorchedCells.get(key) ?? 0;
        const intensity = Math.min(1, remaining / 40);
        const blend = 0.6 * intensity;
        tmpColor.r = lerp(tmpColor.r, 0.12, blend);
        tmpColor.g = lerp(tmpColor.g, 0.08, blend);
        tmpColor.b = lerp(tmpColor.b, 0.06, blend);
      } else if (overlayVal === 4) {
        // Parched: pale dry earth, fading over time
        const key = `${col},${row}`;
        const remaining = env.parchedCells.get(key) ?? 0;
        const intensity = Math.min(1, remaining / 30);
        const blend = 0.4 * intensity;
        tmpColor.r = lerp(tmpColor.r, 0.55, blend);
        tmpColor.g = lerp(tmpColor.g, 0.42, blend);
        tmpColor.b = lerp(tmpColor.b, 0.28, blend);
      } else if (overlayVal === 5) {
        // Active disease: sickly yellow-green
        tmpColor.r = lerp(tmpColor.r, 0.45, 0.5);
        tmpColor.g = lerp(tmpColor.g, 0.50, 0.5);
        tmpColor.b = lerp(tmpColor.b, 0.08, 0.5);
      } else if (overlayVal === 6) {
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
