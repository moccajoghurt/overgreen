import {
  Cell, SIM, TerrainType, World,
  Season, Environment, GRID_WIDTH, GRID_HEIGHT,
} from '../types';

// ── Terrain generation ──

function valueNoise(w: number, h: number, octaves: number, persistence: number): number[][] {
  const result: number[][] = Array.from({ length: h }, () => new Array(w).fill(0));
  let amplitude = 1.0;
  let totalAmplitude = 0;

  for (let oct = 0; oct < octaves; oct++) {
    const gridSize = 8 * Math.pow(2, oct);
    const coarseW = Math.ceil(w / gridSize) + 2;
    const coarseH = Math.ceil(h / gridSize) + 2;
    const coarse: number[][] = Array.from({ length: coarseH }, () =>
      Array.from({ length: coarseW }, () => Math.random()),
    );

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = x / gridSize;
        const gy = y / gridSize;
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        const fx = gx - ix;
        const fy = gy - iy;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);

        const top = coarse[iy][ix] + (coarse[iy][ix + 1] - coarse[iy][ix]) * sx;
        const bot = coarse[iy + 1][ix] + (coarse[iy + 1][ix + 1] - coarse[iy + 1][ix]) * sx;
        result[y][x] += (top + (bot - top) * sy) * amplitude;
      }
    }
    totalAmplitude += amplitude;
    amplitude *= persistence;
  }

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      result[y][x] /= totalAmplitude;

  return result;
}

function generateRiver(
  grid: Cell[][], elevation: number[][], w: number, h: number,
): void {
  const horizontal = Math.random() < 0.5;
  let x: number, y: number;

  if (horizontal) {
    x = 0;
    y = Math.floor(h * 0.2 + Math.random() * h * 0.6);
  } else {
    x = Math.floor(w * 0.2 + Math.random() * w * 0.6);
    y = 0;
  }

  const visited = new Set<number>();

  while (x >= 0 && x < w && y >= 0 && y < h) {
    // Mark 3-cell-wide river
    for (let d = -1; d <= 1; d++) {
      const rx = horizontal ? x : x + d;
      const ry = horizontal ? y + d : y;
      if (rx >= 0 && rx < w && ry >= 0 && ry < h) {
        const cell = grid[ry][rx];
        cell.terrainType = TerrainType.River;
        cell.waterRechargeRate = SIM.RIVER_WATER_RECHARGE;
        cell.waterLevel = SIM.MAX_WATER;
        cell.nutrients = Math.min(SIM.MAX_NUTRIENTS, cell.nutrients + SIM.RIVER_NUTRIENT_BONUS);
        cell.elevation = Math.max(0, cell.elevation - 0.2);
      }
    }

    const key = y * w + x;
    if (visited.has(key)) break;
    visited.add(key);

    if (horizontal) {
      x += 1;
      const drift = Math.random() < 0.6 ? 0 : (Math.random() < 0.5 ? -1 : 1);
      if (y > 0 && y < h - 1 && x < w) {
        const elevUp = elevation[y - 1][x];
        const elevDown = elevation[y + 1][x];
        y += drift + (elevDown < elevUp ? 1 : elevUp < elevDown ? -1 : 0);
      } else {
        y += drift;
      }
      y = Math.max(0, Math.min(h - 1, y));
    } else {
      y += 1;
      const drift = Math.random() < 0.6 ? 0 : (Math.random() < 0.5 ? -1 : 1);
      if (x > 0 && x < w - 1 && y < h) {
        const elevLeft = elevation[y][x - 1];
        const elevRight = elevation[y][x + 1];
        x += drift + (elevRight < elevLeft ? 1 : elevLeft < elevRight ? -1 : 0);
      } else {
        x += drift;
      }
      x = Math.max(0, Math.min(w - 1, x));
    }
  }
}

function generateRocks(grid: Cell[][], w: number, h: number): void {
  const rockNoise = valueNoise(w, h, 2, 0.5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = grid[y][x];
      if (cell.terrainType !== TerrainType.Soil) continue;
      if (rockNoise[y][x] > 0.72) {
        cell.terrainType = TerrainType.Rock;
        cell.waterRechargeRate = SIM.ROCK_WATER_RECHARGE;
        cell.nutrients = Math.min(cell.nutrients, SIM.ROCK_NUTRIENT_MAX);
      }
    }
  }
}

function assignTerrainProperties(
  grid: Cell[][], elevation: number[][], w: number, h: number,
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = grid[y][x];
      if (cell.terrainType === TerrainType.River) continue; // already set
      cell.elevation = elevation[y][x];

      if (cell.terrainType === TerrainType.Soil && cell.elevation > 0.65) {
        cell.terrainType = TerrainType.Hill;
        cell.waterRechargeRate *= SIM.HILL_WATER_PENALTY;
      }

      if (cell.terrainType === TerrainType.Soil) {
        const valleyBonus = 1.0 + (1.0 - cell.elevation) * 0.3;
        cell.waterRechargeRate *= valleyBonus;
        cell.nutrients += (1.0 - cell.elevation) * 1.5;
      }
    }
  }
}

export function createEnvironment(): Environment {
  return {
    season: Season.Spring,
    seasonProgress: 0,
    yearCount: 0,
    waterMult: 1.2,
    lightMult: 1.0,
    leafMaintenanceMult: 1.0,
    droughts: [],
    fires: [],
    scorchedCells: new Map(),
    parchedCells: new Map(),
    weatherOverlay: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
  };
}

export function createWorld(width: number, height: number): World {
  const grid: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        x,
        y,
        elevation: 0.5,
        terrainType: TerrainType.Soil,
        waterLevel: 3 + Math.random() * 4,
        waterRechargeRate: SIM.BASE_WATER_RECHARGE * (0.7 + Math.random() * 0.6),
        nutrients: 1 + Math.random() * 3,
        lightLevel: SIM.BASE_LIGHT,
        plantId: null,
        lastSpeciesId: null,
      });
    }
    grid.push(row);
  }

  // Terrain generation
  const elevation = valueNoise(width, height, 3, 0.5);
  const riverCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < riverCount; i++) {
    generateRiver(grid, elevation, width, height);
  }
  generateRocks(grid, width, height);
  assignTerrainProperties(grid, elevation, width, height);

  return {
    width, height, grid, plants: new Map(), tick: 0,
    nextPlantId: 1, nextSpeciesId: 1,
    speciesColors: new Map(), speciesNames: new Map(),
    seedEvents: [], fireDeathEvents: [], environment: createEnvironment(), environmentEvents: [],
  };
}
