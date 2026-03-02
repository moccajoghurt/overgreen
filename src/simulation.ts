import { Cell, Plant, SIM, TerrainType, World } from './types';
import { NEIGHBORS, inBounds } from './simulation/neighbors';
import { mutateGenome } from './simulation/plants';
import { phaseEnvironment } from './simulation/environment';
import { getEffectiveEraMultipliers } from './simulation/eras';

export { createWorld } from './simulation/terrain';
export { seedInitialPlants } from './simulation/plants';
export { spawnFire, spawnDisease } from './simulation/environment';

// ── Simulation phases ──

function phaseRechargeWater(world: World): void {
  const env = world.environment;
  const eraMults = getEffectiveEraMultipliers(env.era);
  const nutrientDecay = SIM.NUTRIENT_DECAY * eraMults.nutrientDecayMult;
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
      cell.nutrients = Math.max(0, cell.nutrients - nutrientDecay);
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
        if (!inBounds(nx, ny, world.width, world.height)) continue;
        const neighbor = world.grid[ny][nx];
        if (neighbor.terrainType === TerrainType.River) continue;
        neighbor.waterLevel = Math.min(SIM.MAX_WATER, neighbor.waterLevel + SIM.RIVER_SEEPAGE);
      }
    }
  }
}

function phaseCalculateLight(world: World): void {
  const eraMults = getEffectiveEraMultipliers(world.environment.era);
  const shadowReduction = SIM.SHADOW_REDUCTION * eraMults.shadowMult;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      const myPlant = cell.plantId !== null ? world.plants.get(cell.plantId) : null;
      const myHeight = myPlant?.alive ? myPlant.height : 0;

      let shadeSum = 0;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, world.width, world.height)) continue;
        const neighbor = world.grid[ny][nx];
        if (neighbor.plantId === null) continue;
        const nPlant = world.plants.get(neighbor.plantId);
        if (nPlant && nPlant.alive && nPlant.height > myHeight) {
          // Shade scales with height difference — towering neighbors shade more
          const diff = nPlant.height - myHeight;
          shadeSum += shadowReduction * Math.min(1, diff / SIM.SHADOW_HEIGHT_SCALE);
        }
      }
      const rawBase = cell.terrainType === TerrainType.Hill
        ? Math.min(1.0, SIM.BASE_LIGHT + SIM.HILL_LIGHT_BONUS)
        : SIM.BASE_LIGHT;
      const baseLight = rawBase * world.environment.lightMult;
      cell.lightLevel = Math.max(SIM.MIN_LIGHT, baseLight - shadeSum);
    }
  }
}

function absorbWater(plant: Plant, cell: Cell, world: World): number {
  const waterNeeded = plant.leafArea * SIM.TRANSPIRATION_PER_LEAF;
  const waterCanAbsorb = plant.rootDepth * SIM.WATER_ABSORPTION_PER_ROOT;
  let waterAbsorbed = Math.min(waterNeeded, waterCanAbsorb, cell.waterLevel);
  cell.waterLevel -= waterAbsorbed;

  // Root competition: deep roots drain water from neighboring cells
  let remainingDemand = Math.min(waterNeeded, waterCanAbsorb) - waterAbsorbed;
  if (remainingDemand > 0.01) {
    const drainRate = plant.rootDepth / SIM.MAX_ROOT_DEPTH * SIM.ROOT_COMPETITION_RATE;
    for (const [dx, dy] of NEIGHBORS) {
      if (remainingDemand <= 0.01) break;
      const nx = plant.x + dx;
      const ny = plant.y + dy;
      if (!inBounds(nx, ny, world.width, world.height)) continue;
      const nc = world.grid[ny][nx];
      const drained = Math.min(remainingDemand, nc.waterLevel * drainRate);
      nc.waterLevel -= drained;
      waterAbsorbed += drained;
      remainingDemand -= drained;
    }
  }

  plant.lastWaterAbsorbed = waterAbsorbed;
  return waterNeeded > 0.01 ? waterAbsorbed / waterNeeded : 0;
}

function photosynthesize(plant: Plant, cell: Cell, waterFraction: number, isDiseased: boolean): number {
  const rawEnergy = cell.lightLevel * plant.leafArea * SIM.PHOTOSYNTHESIS_RATE;
  const nutrientBonus = 1 + cell.nutrients * SIM.NUTRIENT_GROWTH_BONUS;
  let energyProduced = rawEnergy * waterFraction * nutrientBonus;
  plant.lastLightReceived = cell.lightLevel;
  if (isDiseased) energyProduced *= SIM.DISEASE_PHOTO_PENALTY;
  return energyProduced;
}

function calculateMaintenance(plant: Plant, world: World, isDiseased: boolean): number {
  let leafMaint = plant.leafArea * SIM.MAINTENANCE_PER_LEAF * world.environment.leafMaintenanceMult;
  if (world.environment.leafMaintenanceMult > 1.01) {
    const rootInsulation = Math.min(0.8, plant.rootDepth / SIM.MAX_ROOT_DEPTH * 0.8);
    const penalty = leafMaint - plant.leafArea * SIM.MAINTENANCE_PER_LEAF;
    leafMaint -= penalty * rootInsulation;
  }
  let maintenance = SIM.MAINTENANCE_BASE
    + plant.height * SIM.MAINTENANCE_PER_HEIGHT
    + plant.rootDepth * SIM.MAINTENANCE_PER_ROOT
    + leafMaint;
  if (isDiseased) maintenance += SIM.DISEASE_DRAIN_PER_TICK;
  return maintenance;
}

function allocateGrowthAndSeeds(plant: Plant, surplus: number, world: World, eraMutationRate: number, eraSeedEnergyMult: number): void {
  const env = world.environment;
  const seedBudget = surplus * plant.genome.seedInvestment * env.seedMult;
  const growthBudget = surplus * (1 - plant.genome.seedInvestment) * env.growthMult;

  // Growth: normalize priorities
  const total = plant.genome.rootPriority + plant.genome.heightPriority + plant.genome.leafSize;
  if (total > 0) {
    const rFrac = plant.genome.rootPriority / total;
    const hFrac = plant.genome.heightPriority / total;
    const lFrac = plant.genome.leafSize / total;

    const rootGrowth = growthBudget * rFrac * SIM.GROWTH_EFFICIENCY;
    const heightGrowth = growthBudget * hFrac * SIM.GROWTH_EFFICIENCY;
    const leafGrowth = growthBudget * lFrac * SIM.GROWTH_EFFICIENCY;

    const maxRoot = SIM.MAX_ROOT_DEPTH * (0.3 + 0.7 * rFrac);
    const maxHeight = SIM.MAX_HEIGHT * (0.3 + 0.7 * hFrac);
    const maxLeaf = SIM.MAX_LEAF_AREA * (0.3 + 0.7 * lFrac);

    plant.rootDepth = Math.min(maxRoot, plant.rootDepth + rootGrowth);
    plant.height = Math.min(maxHeight, plant.height + heightGrowth);
    plant.leafArea = Math.min(maxLeaf, plant.leafArea + leafGrowth);
  }

  // Seed spawning — taller plants disperse further
  const seedRange = SIM.SEED_RANGE_MAX + Math.floor(plant.height / 3);
  const seedsToSpawn = Math.floor(seedBudget / SIM.SEED_ENERGY_COST);
  for (let i = 0; i < seedsToSpawn; i++) {
    world.seedsAttempted++;
    const dx = Math.floor(Math.random() * (seedRange * 2 + 1)) - seedRange;
    const dy = Math.floor(Math.random() * (seedRange * 2 + 1)) - seedRange;
    if (dx === 0 && dy === 0) continue;
    const tx = plant.x + dx;
    const ty = plant.y + dy;
    if (!inBounds(tx, ty, world.width, world.height)) continue;
    if (world.grid[ty][tx].plantId !== null) continue;
    const tt = world.grid[ty][tx].terrainType;
    if (tt === TerrainType.River || tt === TerrainType.Rock) continue;

    const childId = world.nextPlantId++;
    const child: Plant = {
      id: childId, speciesId: plant.speciesId, x: tx, y: ty,
      height: 0.5, rootDepth: 0.5, leafArea: 0.5,
      energy: SIM.SEED_INITIAL_ENERGY * eraSeedEnergyMult, age: 0, alive: true,
      genome: mutateGenome(plant.genome, eraMutationRate),
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

  plant.energy -= (seedBudget + growthBudget);
}

function phaseUpdatePlants(world: World): void {
  const eraMults = getEffectiveEraMultipliers(world.environment.era);
  const eraMutationRate = SIM.MUTATION_RATE * eraMults.mutationMult;
  const eraSeedEnergyMult = eraMults.seedEnergyMult;

  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const cell = world.grid[plant.y][plant.x];

    // Check disease status once
    const cellKey = `${plant.x},${plant.y}`;
    let isDiseased = false;
    for (const disease of world.environment.diseases) {
      if (disease.cells.has(cellKey)) { isDiseased = true; break; }
    }

    const waterFraction = absorbWater(plant, cell, world);
    const energyProduced = photosynthesize(plant, cell, waterFraction, isDiseased);
    const maintenance = calculateMaintenance(plant, world, isDiseased);

    plant.lastEnergyProduced = energyProduced;
    plant.lastMaintenanceCost = maintenance;
    plant.energy += energyProduced - maintenance;

    // Seasonal leaf decay (autumn/winter leaf loss)
    if (world.environment.leafDecayRate > 0) {
      plant.leafArea = Math.max(0.1, plant.leafArea - world.environment.leafDecayRate);
    }

    if (plant.energy > 1.0) {
      allocateGrowthAndSeeds(plant, plant.energy - 1.0, world, eraMutationRate, eraSeedEnergyMult);
    }

    plant.age++;
  }
}

function phaseDeath(world: World): void {
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    if (plant.energy <= SIM.STARVATION_THRESHOLD || plant.age >= SIM.MAX_AGE) {
      plant.alive = false;

      // Check if this plant is in a diseased cell
      let cause: 'starvation' | 'age' | 'disease' = plant.age >= SIM.MAX_AGE ? 'age' : 'starvation';
      if (cause === 'starvation') {
        const cellKey = `${plant.x},${plant.y}`;
        for (const disease of world.environment.diseases) {
          if (disease.cells.has(cellKey)) {
            cause = 'disease';
            plant.causeOfDeath = 'disease';
            disease.killCount++;
            break;
          }
        }
      }

      world.deathEvents.push({
        id: plant.id,
        speciesId: plant.speciesId,
        cause,
        age: plant.age,
      });
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
  world.deathEvents.length = 0;
  world.seedsAttempted = 0;
  world.environmentEvents.length = 0;
  phaseEnvironment(world);
  phaseRechargeWater(world);
  phaseCalculateLight(world);
  phaseUpdatePlants(world);
  phaseDeath(world);
  phaseDecomposition(world);
  world.tick++;
}
