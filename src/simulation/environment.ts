import {
  SIM, TerrainType, World,
  Season, SEASON_LENGTH, YEAR_LENGTH, SEASON_NAMES,
  Environment,
} from '../types';
import { NEIGHBORS } from './neighbors';

// Season target values: [water, light, leafMaint]
const SEASON_TARGETS: Record<Season, [number, number, number]> = {
  [Season.Spring]: [1.2, 1.0, 1.0],
  [Season.Summer]: [0.8, 1.15, 1.0],
  [Season.Autumn]: [1.0, 0.85, 1.0],
  [Season.Winter]: [0.6, 0.5, 3.0],
};

function computeSeasonModifiers(env: Environment): void {
  const cur = SEASON_TARGETS[env.season];
  const next = SEASON_TARGETS[((env.season + 1) % 4) as Season];
  // Cosine interpolation for smooth transitions
  const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;
  env.waterMult = cur[0] + (next[0] - cur[0]) * t;
  env.lightMult = cur[1] + (next[1] - cur[1]) * t;
  env.leafMaintenanceMult = cur[2] + (next[2] - cur[2]) * t;
}

function spawnDrought(world: World): void {
  const centerX = Math.floor(Math.random() * world.width);
  const centerY = Math.floor(Math.random() * world.height);
  const radius = 8 + Math.floor(Math.random() * 13); // 8-20
  const duration = 30 + Math.floor(Math.random() * 41); // 30-70 ticks
  const intensity = 0.6 + Math.random() * 0.35; // 0.6-0.95
  world.environment.droughts.push({ centerX, centerY, radius, intensity, ticksRemaining: duration });
  world.environmentEvents.push({
    type: 'drought_start',
    message: `Drought struck near (${centerX}, ${centerY})`,
  });
}

function advanceDroughts(world: World): void {
  const droughts = world.environment.droughts;
  for (let i = droughts.length - 1; i >= 0; i--) {
    droughts[i].ticksRemaining--;
    if (droughts[i].ticksRemaining <= 0) {
      // Mark affected cells as parched
      const d = droughts[i];
      const r2 = d.radius * d.radius;
      const minY = Math.max(0, d.centerY - d.radius);
      const maxY = Math.min(world.height - 1, d.centerY + d.radius);
      const minX = Math.max(0, d.centerX - d.radius);
      const maxX = Math.min(world.width - 1, d.centerX + d.radius);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - d.centerX;
          const dy = y - d.centerY;
          if (dx * dx + dy * dy < r2) {
            world.environment.parchedCells.set(`${x},${y}`, 60);
          }
        }
      }
      world.environmentEvents.push({
        type: 'drought_end',
        message: `Drought ended near (${d.centerX}, ${d.centerY})`,
      });
      droughts.splice(i, 1);
    }
  }
}

export function spawnFire(world: World): void {
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = Math.floor(Math.random() * world.width);
    const y = Math.floor(Math.random() * world.height);
    const cell = world.grid[y][x];
    if (cell.plantId === null || cell.waterLevel > 2.0) continue;
    if (cell.terrainType === TerrainType.River) continue;

    const fire = { cells: new Map([[`${x},${y}`, 4]]), ticksRemaining: 8 + Math.floor(Math.random() * 9) };
    world.environment.fires.push(fire);
    killPlantByFire(world, x, y);
    world.environmentEvents.push({ type: 'fire_start', message: `Fire ignited near (${x}, ${y})` });
    return;
  }
}

function killPlantByFire(world: World, x: number, y: number): void {
  const cell = world.grid[y][x];
  if (cell.plantId === null) return;
  const plant = world.plants.get(cell.plantId);
  if (plant && plant.alive) {
    world.fireDeathEvents.push({
      id: plant.id,
      x: plant.x, y: plant.y,
      height: plant.height, rootDepth: plant.rootDepth,
      leafArea: plant.leafArea, speciesId: plant.speciesId,
      genome: { ...plant.genome },
    });
    plant.alive = false;
    plant.causeOfDeath = 'fire';
    plant.energy = 0;
    cell.nutrients = Math.min(SIM.MAX_NUTRIENTS, cell.nutrients + 2.0);
    cell.waterLevel = Math.max(0, cell.waterLevel - 1.5);
  }
}

function advanceFires(world: World): void {
  const fires = world.environment.fires;
  for (let i = fires.length - 1; i >= 0; i--) {
    const fire = fires[i];
    fire.ticksRemaining--;

    // Decay existing burning cells and spread to neighbors
    const toScorch: string[] = [];
    for (const [key, remaining] of fire.cells) {
      if (remaining <= 1) {
        toScorch.push(key);
        fire.cells.delete(key);
        continue;
      }
      fire.cells.set(key, remaining - 1);

      // Spread from this cell
      if (fire.ticksRemaining > 0) {
        const [fx, fy] = key.split(',').map(Number);
        for (const [dx, dy] of NEIGHBORS) {
          const nx = fx + dx;
          const ny = fy + dy;
          if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
          const nKey = `${nx},${ny}`;
          if (fire.cells.has(nKey)) continue;

          const cell = world.grid[ny][nx];
          if (cell.terrainType === TerrainType.River) continue;
          if (cell.plantId === null) continue;
          const plant = world.plants.get(cell.plantId);
          if (!plant || !plant.alive) continue;

          const waterResist = cell.waterLevel / SIM.MAX_WATER;
          const leafFuel = plant.leafArea / SIM.MAX_LEAF_AREA;
          const spreadChance = 0.35 * (1 - waterResist * 0.7) * (0.4 + leafFuel * 0.6);
          if (Math.random() < spreadChance) {
            fire.cells.set(nKey, 3 + Math.floor(Math.random() * 3)); // burn 3-5 ticks
            killPlantByFire(world, nx, ny);
          }
        }
      }
    }

    // Mark burned-out cells as scorched
    for (const key of toScorch) {
      world.environment.scorchedCells.set(key, 80);
    }

    if (fire.cells.size === 0) {
      world.environmentEvents.push({ type: 'fire_end', message: 'Fire extinguished' });
      fires.splice(i, 1);
    }
  }
}

function rebuildWeatherOverlay(world: World): void {
  const overlay = world.environment.weatherOverlay;
  overlay.fill(0);
  for (const d of world.environment.droughts) {
    const r2 = d.radius * d.radius;
    const minY = Math.max(0, d.centerY - d.radius);
    const maxY = Math.min(world.height - 1, d.centerY + d.radius);
    const minX = Math.max(0, d.centerX - d.radius);
    const maxX = Math.min(world.width - 1, d.centerX + d.radius);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - d.centerX;
        const dy = y - d.centerY;
        if (dx * dx + dy * dy < r2) {
          overlay[y * world.width + x] = 1;
        }
      }
    }
  }
  for (const fire of world.environment.fires) {
    for (const [key] of fire.cells) {
      const [fx, fy] = key.split(',').map(Number);
      overlay[fy * world.width + fx] = 2;
    }
  }
  // Scorched ground (only if not already burning or drought)
  for (const [key] of world.environment.scorchedCells) {
    const [sx, sy] = key.split(',').map(Number);
    const idx = sy * world.width + sx;
    if (overlay[idx] === 0) overlay[idx] = 3;
  }
  // Parched ground (only if not already occupied)
  for (const [key] of world.environment.parchedCells) {
    const [px, py] = key.split(',').map(Number);
    const idx = py * world.width + px;
    if (overlay[idx] === 0) overlay[idx] = 4;
  }
}

export function phaseEnvironment(world: World): void {
  const env = world.environment;
  const tickInYear = world.tick % YEAR_LENGTH;
  const newSeason = Math.floor(tickInYear / SEASON_LENGTH) as Season;

  if (newSeason !== env.season) {
    env.season = newSeason;
    if (tickInYear === 0 && world.tick > 0) env.yearCount++;
    world.environmentEvents.push({
      type: 'season_change',
      message: `${SEASON_NAMES[newSeason]} has arrived (Year ${env.yearCount + 1})`,
    });
  }
  env.seasonProgress = (tickInYear % SEASON_LENGTH) / SEASON_LENGTH;
  computeSeasonModifiers(env);

  // Drought spawning (summer only)
  if (env.season === Season.Summer && Math.random() < 0.008) {
    spawnDrought(world);
  }

  // Fire spawning (summer, after 30% progress)
  if (env.season === Season.Summer && env.seasonProgress > 0.3 && Math.random() < 0.005) {
    spawnFire(world);
  }

  advanceDroughts(world);
  advanceFires(world);

  // Decay scorched and parched cells
  for (const [key, remaining] of world.environment.scorchedCells) {
    if (remaining <= 1) world.environment.scorchedCells.delete(key);
    else world.environment.scorchedCells.set(key, remaining - 1);
  }
  for (const [key, remaining] of world.environment.parchedCells) {
    if (remaining <= 1) world.environment.parchedCells.delete(key);
    else world.environment.parchedCells.set(key, remaining - 1);
  }

  rebuildWeatherOverlay(world);
}
