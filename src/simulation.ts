import { Plant, SIM, TerrainType, World } from './types';
import { NEIGHBORS } from './simulation/neighbors';
import { mutateGenome } from './simulation/plants';
import { phaseEnvironment } from './simulation/environment';

export { createWorld } from './simulation/terrain';
export { seedInitialPlants } from './simulation/plants';
export { spawnFire } from './simulation/environment';

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

      let shadeSum = 0;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
        const neighbor = world.grid[ny][nx];
        if (neighbor.plantId === null) continue;
        const nPlant = world.plants.get(neighbor.plantId);
        if (nPlant && nPlant.alive && nPlant.height > myHeight) {
          // Shade scales with height difference — towering neighbors shade more
          const diff = nPlant.height - myHeight;
          shadeSum += SIM.SHADOW_REDUCTION * Math.min(1, diff / SIM.SHADOW_HEIGHT_SCALE);
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

function phaseUpdatePlants(world: World): void {
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const cell = world.grid[plant.y][plant.x];

    // 3a. Water absorption (transpiration model)
    // Leaves create water demand (transpiration), roots determine absorption capacity
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
        if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
        const nc = world.grid[ny][nx];
        const drained = Math.min(remainingDemand, nc.waterLevel * drainRate);
        nc.waterLevel -= drained;
        waterAbsorbed += drained;
        remainingDemand -= drained;
      }
    }

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
        const rFrac = plant.genome.rootPriority / total;
        const hFrac = plant.genome.heightPriority / total;
        const lFrac = plant.genome.leafSize / total;

        const rootGrowth = growthBudget * rFrac * SIM.GROWTH_EFFICIENCY;
        const heightGrowth = growthBudget * hFrac * SIM.GROWTH_EFFICIENCY;
        const leafGrowth = growthBudget * lFrac * SIM.GROWTH_EFFICIENCY;

        // Cap max stats by genome priority — low investment = lower ceiling
        const maxRoot = SIM.MAX_ROOT_DEPTH * (0.3 + 0.7 * rFrac);
        const maxHeight = SIM.MAX_HEIGHT * (0.3 + 0.7 * hFrac);
        const maxLeaf = SIM.MAX_LEAF_AREA * (0.3 + 0.7 * lFrac);

        plant.rootDepth = Math.min(maxRoot, plant.rootDepth + rootGrowth);
        plant.height = Math.min(maxHeight, plant.height + heightGrowth);
        plant.leafArea = Math.min(maxLeaf, plant.leafArea + leafGrowth);
      }

      // 3f. Seed spawning — taller plants disperse further
      const seedRange = SIM.SEED_RANGE_MAX + Math.floor(plant.height / 3);
      const seedsToSpawn = Math.floor(seedBudget / SIM.SEED_ENERGY_COST);
      for (let i = 0; i < seedsToSpawn; i++) {
        world.seedsAttempted++;
        const dx = Math.floor(Math.random() * (seedRange * 2 + 1)) - seedRange;
        const dy = Math.floor(Math.random() * (seedRange * 2 + 1)) - seedRange;
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
      world.deathEvents.push({
        id: plant.id,
        speciesId: plant.speciesId,
        cause: plant.age >= SIM.MAX_AGE ? 'age' : 'starvation',
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
