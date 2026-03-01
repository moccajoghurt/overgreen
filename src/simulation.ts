import {
  Cell, Genome, Plant, SIM, SpeciesColor, TerrainType, World,
  Season, SEASON_LENGTH, YEAR_LENGTH, SEASON_NAMES,
  Environment, GRID_WIDTH, GRID_HEIGHT,
} from './types';
import { generateSpeciesName } from './species-names';

function hsl2rgb(h: number, s: number, l: number): SpeciesColor {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: r + m, g: g + m, b: b + m };
}

function generateSpeciesColor(speciesId: number): SpeciesColor {
  const hue = (speciesId * 137.508) % 360;
  const s = 0.65 + (speciesId % 3) * 0.1;
  const l = 0.45 + (speciesId % 5) * 0.05;
  return hsl2rgb(hue, s, l);
}

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
    seedEvents: [], environment: createEnvironment(), environmentEvents: [],
  };
}

function randomGenome(): Genome {
  return {
    rootPriority: 0.1 + Math.random() * 0.8,
    heightPriority: 0.1 + Math.random() * 0.8,
    leafSize: 0.1 + Math.random() * 0.8,
    seedInvestment: 0.1 + Math.random() * 0.8,
  };
}

function createPlant(id: number, x: number, y: number, genome: Genome, speciesId: number): Plant {
  return {
    id, speciesId, x, y, genome,
    height: 1, rootDepth: 1, leafArea: 1,
    energy: 3.0, age: 0, alive: true,
    lastLightReceived: 0, lastWaterAbsorbed: 0,
    lastEnergyProduced: 0, lastMaintenanceCost: 0,
  };
}

export function seedInitialPlants(world: World, count: number): void {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 10) {
    attempts++;
    const x = Math.floor(Math.random() * world.width);
    const y = Math.floor(Math.random() * world.height);
    if (world.grid[y][x].plantId !== null) continue;
    const t = world.grid[y][x].terrainType;
    if (t === TerrainType.River || t === TerrainType.Rock) continue;

    const speciesId = world.nextSpeciesId++;
    world.speciesColors.set(speciesId, generateSpeciesColor(speciesId));
    const id = world.nextPlantId++;
    const genome = randomGenome();
    world.speciesNames.set(speciesId, generateSpeciesName(genome, speciesId));
    const plant = createPlant(id, x, y, genome, speciesId);
    world.plants.set(id, plant);
    world.grid[y][x].plantId = id;
    world.grid[y][x].lastSpeciesId = speciesId;
    placed++;
  }
}

function mutateGenome(parent: Genome): Genome {
  const mutate = (val: number) =>
    Math.max(0.01, Math.min(0.99, val + (Math.random() * 2 - 1) * SIM.MUTATION_RATE));
  return {
    rootPriority: mutate(parent.rootPriority),
    heightPriority: mutate(parent.heightPriority),
    leafSize: mutate(parent.leafSize),
    seedInvestment: mutate(parent.seedInvestment),
  };
}

// Moore neighborhood offsets
const NEIGHBORS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

// ── Environment / Seasons ──

function createEnvironment(): Environment {
  return {
    season: Season.Spring,
    seasonProgress: 0,
    yearCount: 0,
    waterMult: 1.2,
    lightMult: 1.0,
    leafMaintenanceMult: 1.0,
    droughts: [],
    fires: [],
    weatherOverlay: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
  };
}

// Season target values: [water, light, leafMaint]
const SEASON_TARGETS: Record<Season, [number, number, number]> = {
  [Season.Spring]: [1.2, 1.0, 1.0],
  [Season.Summer]: [0.8, 1.15, 1.0],
  [Season.Autumn]: [1.0, 0.85, 1.0],
  [Season.Winter]: [0.6, 0.7, 2.0],
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
      world.environmentEvents.push({
        type: 'drought_end',
        message: `Drought ended near (${droughts[i].centerX}, ${droughts[i].centerY})`,
      });
      droughts.splice(i, 1);
    }
  }
}

function spawnFire(world: World): void {
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = Math.floor(Math.random() * world.width);
    const y = Math.floor(Math.random() * world.height);
    const cell = world.grid[y][x];
    if (cell.plantId === null || cell.waterLevel > 2.0) continue;
    if (cell.terrainType === TerrainType.River) continue;

    const fire = { cells: new Set([`${x},${y}`]), ticksRemaining: 8 + Math.floor(Math.random() * 9) };
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
    plant.alive = false;
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

    // Spread from current burning cells
    const newCells = new Set<string>();
    for (const key of fire.cells) {
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
          newCells.add(nKey);
          killPlantByFire(world, nx, ny);
        }
      }
    }

    fire.cells = newCells;
    if (fire.ticksRemaining <= 0 || fire.cells.size === 0) {
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
    for (const key of fire.cells) {
      const [fx, fy] = key.split(',').map(Number);
      overlay[fy * world.width + fx] = 2;
    }
  }
}

function phaseEnvironment(world: World): void {
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
  rebuildWeatherOverlay(world);
}

// ── Simulation phases ──

function phaseRechargeWater(world: World): void {
  const env = world.environment;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      let recharge = cell.waterRechargeRate * env.waterMult;

      // Drought: reduce recharge + evaporate water
      for (const d of env.droughts) {
        const dx = x - d.centerX;
        const dy = y - d.centerY;
        const dist2 = dx * dx + dy * dy;
        const r2 = d.radius * d.radius;
        if (dist2 < r2) {
          const falloff = 1 - Math.sqrt(dist2) / d.radius;
          recharge *= 1 - falloff * d.intensity;
          cell.waterLevel = Math.max(0, cell.waterLevel - falloff * 0.3);
        }
      }

      cell.waterLevel = Math.min(cell.waterLevel + recharge, SIM.MAX_WATER);
      cell.nutrients = Math.max(0, cell.nutrients - SIM.NUTRIENT_DECAY);
    }
  }

  // River seepage: river cells share water with neighbors
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      if (cell.terrainType !== TerrainType.River) continue;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
        const neighbor = world.grid[ny][nx];
        if (neighbor.terrainType === TerrainType.River) continue;
        neighbor.waterLevel = Math.min(SIM.MAX_WATER, neighbor.waterLevel + SIM.RIVER_SEEPAGE);
      }
    }
  }
}

function phaseCalculateLight(world: World): void {
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      const myPlant = cell.plantId !== null ? world.plants.get(cell.plantId) : null;
      const myHeight = myPlant?.alive ? myPlant.height : 0;

      let shadeCount = 0;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
        const neighbor = world.grid[ny][nx];
        if (neighbor.plantId === null) continue;
        const nPlant = world.plants.get(neighbor.plantId);
        if (nPlant && nPlant.alive && nPlant.height > myHeight) {
          shadeCount++;
        }
      }
      const rawBase = cell.terrainType === TerrainType.Hill
        ? Math.min(1.0, SIM.BASE_LIGHT + SIM.HILL_LIGHT_BONUS)
        : SIM.BASE_LIGHT;
      const baseLight = rawBase * world.environment.lightMult;
      cell.lightLevel = Math.max(SIM.MIN_LIGHT, baseLight - shadeCount * SIM.SHADOW_REDUCTION);
    }
  }
}

function phaseUpdatePlants(world: World): void {
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const cell = world.grid[plant.y][plant.x];

    // 3a. Water absorption (transpiration model)
    // Leaves create water demand (transpiration), roots determine absorption capacity
    const waterNeeded = plant.leafArea * SIM.TRANSPIRATION_PER_LEAF;
    const waterCanAbsorb = plant.rootDepth * SIM.WATER_ABSORPTION_PER_ROOT;
    const waterAbsorbed = Math.min(waterNeeded, waterCanAbsorb, cell.waterLevel);
    cell.waterLevel -= waterAbsorbed;
    const waterFraction = waterNeeded > 0.01 ? waterAbsorbed / waterNeeded : 0;
    plant.lastWaterAbsorbed = waterAbsorbed;

    // 3b. Photosynthesis
    const rawEnergy = cell.lightLevel * plant.leafArea * SIM.PHOTOSYNTHESIS_RATE;
    const nutrientBonus = 1 + cell.nutrients * SIM.NUTRIENT_GROWTH_BONUS;
    const energyProduced = rawEnergy * waterFraction * nutrientBonus;
    plant.lastLightReceived = cell.lightLevel;
    plant.lastEnergyProduced = energyProduced;

    // 3c. Maintenance cost (with seasonal leaf penalty + root insulation)
    let leafMaint = plant.leafArea * SIM.MAINTENANCE_PER_LEAF * world.environment.leafMaintenanceMult;
    if (world.environment.leafMaintenanceMult > 1.01) {
      // Root insulation: deep roots reduce winter leaf penalty (up to 80%)
      const rootInsulation = Math.min(0.8, plant.rootDepth / SIM.MAX_ROOT_DEPTH * 0.8);
      const penalty = leafMaint - plant.leafArea * SIM.MAINTENANCE_PER_LEAF;
      leafMaint -= penalty * rootInsulation;
    }
    const maintenance = SIM.MAINTENANCE_BASE
      + plant.height * SIM.MAINTENANCE_PER_HEIGHT
      + plant.rootDepth * SIM.MAINTENANCE_PER_ROOT
      + leafMaint;
    plant.lastMaintenanceCost = maintenance;

    // 3d. Energy budget
    plant.energy += energyProduced - maintenance;

    // 3e. Growth & reproduction allocation
    if (plant.energy > 1.0) {
      const surplus = plant.energy - 1.0;
      const seedBudget = surplus * plant.genome.seedInvestment;
      const growthBudget = surplus - seedBudget;

      // Growth: normalize priorities
      const total = plant.genome.rootPriority + plant.genome.heightPriority + plant.genome.leafSize;
      if (total > 0) {
        const rootGrowth = growthBudget * (plant.genome.rootPriority / total) * SIM.GROWTH_EFFICIENCY;
        const heightGrowth = growthBudget * (plant.genome.heightPriority / total) * SIM.GROWTH_EFFICIENCY;
        const leafGrowth = growthBudget * (plant.genome.leafSize / total) * SIM.GROWTH_EFFICIENCY;

        plant.rootDepth = Math.min(SIM.MAX_ROOT_DEPTH, plant.rootDepth + rootGrowth);
        plant.height = Math.min(SIM.MAX_HEIGHT, plant.height + heightGrowth);
        plant.leafArea = Math.min(SIM.MAX_LEAF_AREA, plant.leafArea + leafGrowth);
      }

      // 3f. Seed spawning
      const seedsToSpawn = Math.floor(seedBudget / SIM.SEED_ENERGY_COST);
      for (let i = 0; i < seedsToSpawn; i++) {
        const dx = Math.floor(Math.random() * (SIM.SEED_RANGE_MAX * 2 + 1)) - SIM.SEED_RANGE_MAX;
        const dy = Math.floor(Math.random() * (SIM.SEED_RANGE_MAX * 2 + 1)) - SIM.SEED_RANGE_MAX;
        if (dx === 0 && dy === 0) continue;
        const tx = plant.x + dx;
        const ty = plant.y + dy;
        if (tx < 0 || tx >= world.width || ty < 0 || ty >= world.height) continue;
        if (world.grid[ty][tx].plantId !== null) continue;
        const tt = world.grid[ty][tx].terrainType;
        if (tt === TerrainType.River || tt === TerrainType.Rock) continue;

        const childId = world.nextPlantId++;
        const child: Plant = {
          id: childId, speciesId: plant.speciesId, x: tx, y: ty,
          height: 0.5, rootDepth: 0.5, leafArea: 0.5,
          energy: SIM.SEED_INITIAL_ENERGY, age: 0, alive: true,
          genome: mutateGenome(plant.genome),
          lastLightReceived: 0, lastWaterAbsorbed: 0,
          lastEnergyProduced: 0, lastMaintenanceCost: 0,
        };
        world.plants.set(childId, child);
        world.grid[ty][tx].plantId = childId;
        world.grid[ty][tx].lastSpeciesId = plant.speciesId;
        world.seedEvents.push({
          parentX: plant.x, parentY: plant.y,
          childX: tx, childY: ty,
          childId, speciesId: plant.speciesId,
        });
      }

      plant.energy -= surplus; // back to ~1.0 reserve
    }

    // 3g. Age
    plant.age++;
  }
}

function phaseDeath(world: World): void {
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    if (plant.energy <= SIM.STARVATION_THRESHOLD || plant.age >= SIM.MAX_AGE) {
      plant.alive = false;
    }
  }
}

function phaseDecomposition(world: World): void {
  const toRemove: number[] = [];
  for (const plant of world.plants.values()) {
    if (plant.alive) continue;
    const cell = world.grid[plant.y][plant.x];
    cell.waterLevel = Math.min(SIM.MAX_WATER, cell.waterLevel + SIM.DECOMP_WATER_BOOST);
    cell.nutrients = Math.min(SIM.MAX_NUTRIENTS,
      cell.nutrients + SIM.DECOMP_NUTRIENT_BOOST + plant.height * SIM.DECOMP_NUTRIENT_PER_HEIGHT);
    cell.plantId = null;
    toRemove.push(plant.id);
  }
  for (const id of toRemove) {
    world.plants.delete(id);
  }
}

export function tickWorld(world: World): void {
  world.seedEvents.length = 0;
  world.environmentEvents.length = 0;
  phaseEnvironment(world);
  phaseRechargeWater(world);
  phaseCalculateLight(world);
  phaseUpdatePlants(world);
  phaseDeath(world);
  phaseDecomposition(world);
  world.tick++;
}
