import { Cell, Genome, GRASS, Plant, SIM, TerrainType, World } from './types';
import { NEIGHBORS, inBounds } from './simulation/neighbors';
import { mutateGenome, crossoverGenome } from './simulation/plants';
import { phaseEnvironment } from './simulation/environment';
import { getEffectiveEraMultipliers } from './simulation/eras';
import { phaseHerbivores } from './simulation/herbivores';

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
          cell.waterLevel = Math.max(0, cell.waterLevel - falloff * SIM.DROUGHT_EVAPORATION_RATE);
        }
      }

      cell.waterLevel = Math.min(cell.waterLevel + recharge, SIM.MAX_WATER);
      cell.nutrients = Math.max(0, cell.nutrients - nutrientDecay);
      if (cell.terrainType === TerrainType.Hill) {
        // Bedrock nutrient extraction: deep roots weather minerals
        if (cell.plantId !== null) {
          const hillPlant = world.plants.get(cell.plantId);
          if (hillPlant && hillPlant.alive) {
            const hillMaxRoot = hillPlant.archetype === 'grass' ? GRASS.MAX_ROOT_DEPTH : SIM.MAX_ROOT_DEPTH;
            const hillRootFrac = hillPlant.rootDepth / hillMaxRoot;
            if (hillRootFrac > SIM.HILL_ROOT_NUTRIENT_THRESHOLD) {
              const extraction = (hillRootFrac - SIM.HILL_ROOT_NUTRIENT_THRESHOLD)
                * SIM.HILL_ROOT_NUTRIENT_BONUS * hillPlant.rootDepth;
              cell.nutrients = Math.min(SIM.HILL_NUTRIENT_MAX, cell.nutrients + extraction);
            }
          }
        }
        cell.nutrients = Math.min(SIM.HILL_NUTRIENT_MAX, cell.nutrients);
      } else if (cell.terrainType === TerrainType.Arid) {
        cell.nutrients = Math.min(SIM.ARID_NUTRIENT_MAX, cell.nutrients);
      }
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
        neighbor.nutrients = Math.min(SIM.MAX_NUTRIENTS, neighbor.nutrients + SIM.RIVER_NUTRIENT_SEEPAGE);
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
          const nGrass = nPlant.archetype === 'grass';
          const nShadow = nGrass ? GRASS.SHADOW_REDUCTION * eraMults.shadowMult : shadowReduction;
          const nScale = nGrass ? GRASS.SHADOW_HEIGHT_SCALE : SIM.SHADOW_HEIGHT_SCALE;
          shadeSum += nShadow * Math.min(1, diff / nScale);
        }
      }
      let rawBase = SIM.BASE_LIGHT;
      if (cell.terrainType === TerrainType.Hill) {
        rawBase += SIM.HILL_LIGHT_BONUS;
      } else if (cell.terrainType === TerrainType.Arid) {
        rawBase += SIM.ARID_LIGHT_BONUS;
      }
      const baseLight = rawBase * world.environment.lightMult;
      cell.lightLevel = Math.max(SIM.MIN_LIGHT, baseLight - shadeSum);
    }
  }
}

function absorbWater(plant: Plant, cell: Cell, world: World): number {
  const effectiveLeaf = Math.pow(plant.leafArea, SIM.LEAF_EFFICIENCY_EXPONENT);
  const waterNeeded = effectiveLeaf * SIM.TRANSPIRATION_PER_LEAF;
  // Water table limits effective root depth for water absorption
  let waterTable = SIM.SOIL_WATER_TABLE;
  if (cell.terrainType === TerrainType.Hill) waterTable = SIM.HILL_WATER_TABLE;
  else if (cell.terrainType === TerrainType.Wetland) waterTable = SIM.WETLAND_WATER_TABLE;
  else if (cell.terrainType === TerrainType.Arid) waterTable = SIM.ARID_WATER_TABLE;
  const effectiveRoot = Math.min(plant.rootDepth, waterTable);

  const waterCanAbsorb = effectiveRoot * SIM.WATER_ABSORPTION_PER_ROOT;
  let waterAbsorbed = Math.min(waterNeeded, waterCanAbsorb, cell.waterLevel);
  cell.waterLevel -= waterAbsorbed;

  // Root competition: effective roots drain water from neighboring cells
  let remainingDemand = Math.min(waterNeeded, waterCanAbsorb) - waterAbsorbed;
  if (remainingDemand > 0.01) {
    const drainRate = effectiveRoot / SIM.MAX_ROOT_DEPTH * SIM.ROOT_COMPETITION_RATE;
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

  // Arid aquifer: deep roots tap groundwater
  if (cell.terrainType === TerrainType.Arid) {
    const isGrass = plant.archetype === 'grass';
    const maxRoot = isGrass ? GRASS.MAX_ROOT_DEPTH : SIM.MAX_ROOT_DEPTH;
    const rootFrac = plant.rootDepth / maxRoot;
    if (rootFrac > SIM.ARID_AQUIFER_ROOT_THRESHOLD) {
      const aquiferAccess = (rootFrac - SIM.ARID_AQUIFER_ROOT_THRESHOLD)
        / (1 - SIM.ARID_AQUIFER_ROOT_THRESHOLD);
      const deficit = Math.min(waterNeeded, waterCanAbsorb) - waterAbsorbed;
      if (deficit > 0.01) {
        const bonus = Math.min(deficit, aquiferAccess * SIM.ARID_AQUIFER_WATER_BONUS);
        waterAbsorbed += bonus;
      }
    }
  }

  plant.lastWaterAbsorbed = waterAbsorbed;
  return waterNeeded > 0.01 ? waterAbsorbed / waterNeeded : 0;
}

function photosynthesize(plant: Plant, cell: Cell, waterFraction: number, isDiseased: boolean): number {
  const effectiveLeaf = Math.pow(plant.leafArea, SIM.LEAF_EFFICIENCY_EXPONENT);
  const isGrass = plant.archetype === 'grass';
  const maxH = isGrass ? GRASS.MAX_HEIGHT : SIM.MAX_HEIGHT;
  const maxRoot = isGrass ? GRASS.MAX_ROOT_DEPTH : SIM.MAX_ROOT_DEPTH;
  const hBonus = isGrass ? GRASS.HEIGHT_LIGHT_BONUS : SIM.HEIGHT_LIGHT_BONUS;
  let heightLightBonus = plant.height / maxH * hBonus;

  // Wetland: amplified height bonus (canopy emergence)
  if (cell.terrainType === TerrainType.Wetland) {
    heightLightBonus *= SIM.WETLAND_HEIGHT_BONUS_MULT;
  }

  const rawEnergy = (cell.lightLevel + heightLightBonus) * effectiveLeaf * SIM.PHOTOSYNTHESIS_RATE;

  const nutrientBonus = 1 + cell.nutrients * SIM.NUTRIENT_GROWTH_BONUS;

  let energyProduced = rawEnergy * waterFraction * nutrientBonus;
  plant.lastLightReceived = cell.lightLevel;

  if (isDiseased) energyProduced *= SIM.DISEASE_PHOTO_PENALTY;
  return energyProduced;
}

function calculateMaintenance(plant: Plant, world: World, isDiseased: boolean): number {
  const isGrass = plant.archetype === 'grass';
  const mBase = isGrass ? GRASS.MAINTENANCE_BASE : SIM.MAINTENANCE_BASE;
  const mHeight = isGrass ? GRASS.MAINTENANCE_PER_HEIGHT : SIM.MAINTENANCE_PER_HEIGHT;
  const mRoot = isGrass ? GRASS.MAINTENANCE_PER_ROOT : SIM.MAINTENANCE_PER_ROOT;
  const mLeaf = isGrass ? GRASS.MAINTENANCE_PER_LEAF : SIM.MAINTENANCE_PER_LEAF;
  const maxRoot = isGrass ? GRASS.MAX_ROOT_DEPTH : SIM.MAX_ROOT_DEPTH;

  // Terrain-specific per-trait multipliers (Soil = 1.0)
  const cell = world.grid[plant.y][plant.x];
  let rootMult = 1.0, heightMult = 1.0, leafMult = 1.0;
  if (cell.terrainType === TerrainType.Hill) {
    rootMult = SIM.HILL_MAINT_ROOT_MULT;
    heightMult = SIM.HILL_MAINT_HEIGHT_MULT;
    leafMult = SIM.HILL_MAINT_LEAF_MULT;
  } else if (cell.terrainType === TerrainType.Wetland) {
    rootMult = SIM.WETLAND_MAINT_ROOT_MULT;
    heightMult = SIM.WETLAND_MAINT_HEIGHT_MULT;
    leafMult = SIM.WETLAND_MAINT_LEAF_MULT;
  } else if (cell.terrainType === TerrainType.Arid) {
    rootMult = SIM.ARID_MAINT_ROOT_MULT;
    heightMult = SIM.ARID_MAINT_HEIGHT_MULT;
    leafMult = SIM.ARID_MAINT_LEAF_MULT;
  }

  const effectiveLeaf = Math.pow(plant.leafArea, SIM.LEAF_EFFICIENCY_EXPONENT);
  let leafMaint = effectiveLeaf * mLeaf * leafMult * world.environment.leafMaintenanceMult;
  if (world.environment.leafMaintenanceMult > 1.01) {
    const rootInsulation = Math.min(0.8, plant.rootDepth / maxRoot * 0.8);
    const penalty = leafMaint - effectiveLeaf * mLeaf * leafMult;
    leafMaint -= penalty * rootInsulation;
  }
  let maintenance = mBase
    + plant.height * mHeight * heightMult
    + plant.rootDepth * mRoot * rootMult
    + leafMaint
    + plant.genome.allelopathy * SIM.ALLELOPATHY_MAINTENANCE_RATE
    + plant.genome.defense * SIM.DEFENSE_MAINTENANCE_RATE;
  if (isDiseased) maintenance += SIM.DISEASE_DRAIN_PER_TICK;
  return maintenance;
}

function allocateGrowthAndSeeds(plant: Plant, surplus: number, world: World, eraMutationRate: number, eraSeedEnergyMult: number): void {
  const env = world.environment;
  const isGrass = plant.archetype === 'grass';
  const growthEff = isGrass ? GRASS.GROWTH_EFFICIENCY : SIM.GROWTH_EFFICIENCY;
  const capRoot = isGrass ? GRASS.MAX_ROOT_DEPTH : SIM.MAX_ROOT_DEPTH;
  const capHeight = isGrass ? GRASS.MAX_HEIGHT : SIM.MAX_HEIGHT;
  const capLeaf = isGrass ? GRASS.MAX_LEAF_AREA : SIM.MAX_LEAF_AREA;
  const seedCost = isGrass ? GRASS.SEED_ENERGY_COST : SIM.SEED_ENERGY_COST;
  const seedRangeMax = isGrass ? GRASS.SEED_RANGE_MAX : SIM.SEED_RANGE_MAX;
  const seedRangeDiv = isGrass ? GRASS.SEED_RANGE_HEIGHT_DIVISOR : SIM.SEED_RANGE_HEIGHT_DIVISOR;
  const seedEnergy = isGrass ? GRASS.SEED_INITIAL_ENERGY : SIM.SEED_INITIAL_ENERGY;
  const seedlingH = isGrass ? GRASS.SEEDLING_HEIGHT : 0.5;
  const seedlingR = isGrass ? GRASS.SEEDLING_ROOT : 0.5;
  const seedlingL = isGrass ? GRASS.SEEDLING_LEAF : 0.5;

  const seedBudget = surplus * plant.genome.seedInvestment * env.seedMult;
  const growthBudget = surplus * (1 - plant.genome.seedInvestment) * env.growthMult;

  // Normalize genome priorities for growth allocation
  const total = plant.genome.rootPriority + plant.genome.heightPriority + plant.genome.leafSize;
  const rFrac = total > 0 ? plant.genome.rootPriority / total : 0;
  const hFrac = total > 0 ? plant.genome.heightPriority / total : 0;
  const lFrac = total > 0 ? plant.genome.leafSize / total : 0;

  // Growth allocation
  if (total > 0) {
    const rootGrowth = growthBudget * rFrac * growthEff;
    const heightGrowth = growthBudget * hFrac * growthEff;
    const leafGrowth = growthBudget * lFrac * growthEff;

    const maxRoot = capRoot * (0.3 + 0.7 * rFrac);
    const maxHeight = capHeight * (0.3 + 0.7 * hFrac);
    const maxLeaf = capLeaf * (0.3 + 0.7 * lFrac);

    plant.rootDepth = Math.min(maxRoot, plant.rootDepth + rootGrowth);
    plant.height = Math.min(maxHeight, plant.height + heightGrowth);
    plant.leafArea = Math.min(maxLeaf, plant.leafArea + leafGrowth);
  }

  // Seed spawning — taller plants disperse further
  const seedRange = seedRangeMax + Math.floor(plant.height / seedRangeDiv);
  const seedsToSpawn = Math.floor(seedBudget / seedCost);
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

    // Mate search: scan nearby cells for a same-species mate
    let mateGenome: Genome | null = null;
    const mateR = SIM.CROSSOVER_MATE_RADIUS;
    outer:
    for (let my = plant.y - mateR; my <= plant.y + mateR; my++) {
      for (let mx = plant.x - mateR; mx <= plant.x + mateR; mx++) {
        if (!inBounds(mx, my, world.width, world.height)) continue;
        const mc = world.grid[my][mx];
        if (mc.plantId === null || mc.plantId === plant.id) continue;
        const mate = world.plants.get(mc.plantId);
        if (mate && mate.alive && mate.speciesId === plant.speciesId) {
          mateGenome = mate.genome;
          break outer;
        }
      }
    }

    const childGenome = mateGenome
      ? mutateGenome(crossoverGenome(plant.genome, mateGenome), eraMutationRate)
      : mutateGenome(plant.genome, eraMutationRate);

    const childId = world.nextPlantId++;
    const child: Plant = {
      id: childId, speciesId: plant.speciesId, archetype: plant.archetype, x: tx, y: ty,
      height: seedlingH, rootDepth: seedlingR, leafArea: seedlingL,
      energy: seedEnergy * eraSeedEnergyMult, age: 0, alive: true,
      genome: childGenome,
      lastLightReceived: 0, lastWaterAbsorbed: 0,
      lastEnergyProduced: 0, lastMaintenanceCost: 0, isDiseased: false,
      generation: plant.generation + 1, parentId: plant.id, offspringCount: 0,
    };
    plant.offspringCount++;
    world.plants.set(childId, child);
    world.grid[ty][tx].plantId = childId;
    world.grid[ty][tx].lastSpeciesId = plant.speciesId;
    world.seedEvents.push({
      parentX: plant.x, parentY: plant.y,
      childX: tx, childY: ty,
      childId, speciesId: plant.speciesId,
      archetype: plant.archetype,
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

    // Check disease status once and store on plant
    const cellKey = `${plant.x},${plant.y}`;
    let isDiseased = false;
    for (const disease of world.environment.diseases) {
      if (disease.cells.has(cellKey)) { isDiseased = true; break; }
    }
    plant.isDiseased = isDiseased;

    const waterFraction = absorbWater(plant, cell, world);
    const energyProduced = photosynthesize(plant, cell, waterFraction, isDiseased);
    const maintenance = calculateMaintenance(plant, world, isDiseased);

    plant.lastEnergyProduced = energyProduced;
    plant.lastMaintenanceCost = maintenance;
    plant.energy += energyProduced - maintenance;

    // Allelopathy: damage neighboring plants via chemical suppression
    if (plant.genome.allelopathy > 0.1) {
      const allelStrength = plant.genome.allelopathy * (0.5 + 0.5 * plant.rootDepth / SIM.MAX_ROOT_DEPTH);
      const damage = allelStrength * SIM.ALLELOPATHY_DAMAGE_RATE;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = plant.x + dx;
        const ny = plant.y + dy;
        if (!inBounds(nx, ny, world.width, world.height)) continue;
        const nc = world.grid[ny][nx];
        if (nc.plantId === null) continue;
        const neighbor = world.plants.get(nc.plantId);
        if (neighbor && neighbor.alive) {
          neighbor.energy -= damage;
        }
      }
    }

    // Energy-based leaf drop: plant sheds leaves when losing energy in harsh conditions
    if (energyProduced < maintenance && world.environment.leafMaintenanceMult > 1.0) {
      plant.leafArea = 0.1;
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
    const maxAge = plant.archetype === 'grass' ? GRASS.MAX_AGE : SIM.MAX_AGE;
    if (plant.energy <= SIM.STARVATION_THRESHOLD || plant.age >= maxAge) {
      plant.alive = false;

      // Use disease flag computed in phaseUpdatePlants
      let cause: 'starvation' | 'age' | 'disease' = plant.age >= maxAge ? 'age' : 'starvation';
      if (cause === 'starvation' && plant.isDiseased) {
        cause = 'disease';
        plant.causeOfDeath = 'disease';
        for (const disease of world.environment.diseases) {
          if (disease.cells.has(`${plant.x},${plant.y}`)) {
            disease.killCount++;
            break;
          }
        }
      }

      world.deathEvents.push({
        id: plant.id,
        speciesId: plant.speciesId,
        archetype: plant.archetype,
        cause,
        age: plant.age,
        offspringCount: plant.offspringCount,
        generation: plant.generation,
      });
    }
  }
}

function phaseDecomposition(world: World): void {
  const toRemove: number[] = [];
  for (const plant of world.plants.values()) {
    if (plant.alive) continue;
    const isGrass = plant.archetype === 'grass';
    const dWater = isGrass ? GRASS.DECOMP_WATER_BOOST : SIM.DECOMP_WATER_BOOST;
    const dNutrient = isGrass ? GRASS.DECOMP_NUTRIENT_BOOST : SIM.DECOMP_NUTRIENT_BOOST;
    const dNutrientH = isGrass ? GRASS.DECOMP_NUTRIENT_PER_HEIGHT : SIM.DECOMP_NUTRIENT_PER_HEIGHT;
    const cell = world.grid[plant.y][plant.x];
    cell.waterLevel = Math.min(SIM.MAX_WATER, cell.waterLevel + dWater);
    cell.nutrients = Math.min(SIM.MAX_NUTRIENTS,
      cell.nutrients + dNutrient + plant.height * dNutrientH);
    if (cell.terrainType === TerrainType.Hill) {
      cell.nutrients = Math.min(SIM.HILL_NUTRIENT_MAX, cell.nutrients);
    } else if (cell.terrainType === TerrainType.Arid) {
      cell.nutrients = Math.min(SIM.ARID_NUTRIENT_MAX, cell.nutrients);
    }
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
  phaseHerbivores(world);
  phaseDeath(world);
  phaseDecomposition(world);
  world.tick++;
}
