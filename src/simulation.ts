import { Cell, Genome, Plant, SIM, World } from './types';

export function createWorld(width: number, height: number): World {
  const grid: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        x,
        y,
        waterLevel: 3 + Math.random() * 4,
        waterRechargeRate: SIM.BASE_WATER_RECHARGE * (0.7 + Math.random() * 0.6),
        nutrients: 1 + Math.random() * 3,
        lightLevel: SIM.BASE_LIGHT,
        plantId: null,
      });
    }
    grid.push(row);
  }
  return { width, height, grid, plants: new Map(), tick: 0, nextPlantId: 1 };
}

function randomGenome(): Genome {
  return {
    rootPriority: 0.1 + Math.random() * 0.8,
    heightPriority: 0.1 + Math.random() * 0.8,
    leafSize: 0.1 + Math.random() * 0.8,
    seedInvestment: 0.1 + Math.random() * 0.8,
  };
}

function createPlant(id: number, x: number, y: number, genome: Genome): Plant {
  return {
    id, x, y, genome,
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

    const id = world.nextPlantId++;
    const plant = createPlant(id, x, y, randomGenome());
    world.plants.set(id, plant);
    world.grid[y][x].plantId = id;
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

function phaseRechargeWater(world: World): void {
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      cell.waterLevel = Math.min(cell.waterLevel + cell.waterRechargeRate, SIM.MAX_WATER);
      cell.nutrients = Math.max(0, cell.nutrients - SIM.NUTRIENT_DECAY);
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
      cell.lightLevel = Math.max(SIM.MIN_LIGHT, SIM.BASE_LIGHT - shadeCount * SIM.SHADOW_REDUCTION);
    }
  }
}

function phaseUpdatePlants(world: World): void {
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const cell = world.grid[plant.y][plant.x];

    // 3a. Water absorption
    const waterDemand = plant.rootDepth * SIM.WATER_ABSORPTION_PER_ROOT;
    const waterAbsorbed = Math.min(waterDemand, cell.waterLevel);
    cell.waterLevel -= waterAbsorbed;
    const waterFraction = waterDemand > 0.01 ? waterAbsorbed / waterDemand : 0;
    plant.lastWaterAbsorbed = waterAbsorbed;

    // 3b. Photosynthesis
    const rawEnergy = cell.lightLevel * plant.leafArea * SIM.PHOTOSYNTHESIS_RATE;
    const nutrientBonus = 1 + cell.nutrients * SIM.NUTRIENT_GROWTH_BONUS;
    const energyProduced = rawEnergy * waterFraction * nutrientBonus;
    plant.lastLightReceived = cell.lightLevel;
    plant.lastEnergyProduced = energyProduced;

    // 3c. Maintenance cost
    const maintenance = SIM.MAINTENANCE_BASE
      + plant.height * SIM.MAINTENANCE_PER_HEIGHT
      + plant.rootDepth * SIM.MAINTENANCE_PER_ROOT
      + plant.leafArea * SIM.MAINTENANCE_PER_LEAF;
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

        const childId = world.nextPlantId++;
        const child: Plant = {
          id: childId, x: tx, y: ty,
          height: 0.5, rootDepth: 0.5, leafArea: 0.5,
          energy: SIM.SEED_INITIAL_ENERGY, age: 0, alive: true,
          genome: mutateGenome(plant.genome),
          lastLightReceived: 0, lastWaterAbsorbed: 0,
          lastEnergyProduced: 0, lastMaintenanceCost: 0,
        };
        world.plants.set(childId, child);
        world.grid[ty][tx].plantId = childId;
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
  phaseRechargeWater(world);
  phaseCalculateLight(world);
  phaseUpdatePlants(world);
  phaseDeath(world);
  phaseDecomposition(world);
  world.tick++;
}
