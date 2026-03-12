import { GRID_WIDTH, SIM, TERRAIN_PROPS, World } from '../types';

// Flat arrays for light calculation — allocated once, reused every tick.
// Replaces per-neighbor Map.get() lookups with direct Float32Array indexing.
const _gridSize = GRID_WIDTH * GRID_WIDTH;
const _heightGrid = new Float32Array(_gridSize);
const _srGrid = new Float32Array(_gridSize);
const _shsGrid = new Float32Array(_gridSize);

export function phaseCalculateLight(world: World): void {
  const W = world.width;
  const H = world.height;

  // Build flat grids from live plants (dead/absent → 0)
  // With multi-plant cells, use tallest plant's height and woodiness for shadow params
  _heightGrid.fill(0);
  _srGrid.fill(0);
  _shsGrid.fill(0);
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const idx = plant.y * W + plant.x;
    if (plant.height > _heightGrid[idx]) {
      _heightGrid[idx] = plant.height;
      const w = Math.max(0, Math.min(1, plant.genome.woodiness));
      _srGrid[idx] = 0.05 + 0.20 * w;
      _shsGrid[idx] = 1.0 + 2.0 * w;
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const myIdx = y * W + x;
      const myHeight = _heightGrid[myIdx];

      let shadeSum = 0;
      // Extended shade radius: tall plants shade up to 2 cells away
      for (let sdy = -2; sdy <= 2; sdy++) {
        const ny = y + sdy;
        if (ny < 0 || ny >= H) continue;
        for (let sdx = -2; sdx <= 2; sdx++) {
          if (sdx === 0 && sdy === 0) continue;
          const nx = x + sdx;
          if (nx < 0 || nx >= W) continue;
          const nIdx = ny * W + nx;
          const nHeight = _heightGrid[nIdx];
          if (nHeight <= myHeight) continue;
          const dist = Math.max(Math.abs(sdx), Math.abs(sdy));
          // Only tall plants cast shade at distance 2 (canopy reach)
          if (dist > 1 && nHeight < 3.0) continue;
          const diff = nHeight - myHeight;
          const nShadow = _srGrid[nIdx] / dist;
          shadeSum += nShadow * Math.min(1, diff / _shsGrid[nIdx]);
        }
      }

      const cell = world.grid[y][x];
      const rawBase = SIM.BASE_LIGHT + TERRAIN_PROPS[cell.terrainType].lightBonus;
      const zm = world.environment.zoneModifiers[cell.climateZone];
      const baseLight = rawBase * zm.lightMult;
      cell.lightLevel = Math.max(SIM.MIN_LIGHT, baseLight - shadeSum);
    }
  }
}
