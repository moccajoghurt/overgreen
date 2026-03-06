import { Cell, Genome, Plant, Seed, SIM, TerrainType, World, getPlantConstants } from './types';
import { NEIGHBORS, inBounds } from './simulation/neighbors';
import {
  mutateGenome, crossoverGenome, genomeDistance, getCentroidGenome,
  woodinessBracket, createSpeciesCentroid, addToCentroid, removeFromCentroid,
  generateSpeciesColor,
} from './simulation/plants';
import { generateSpeciesName } from './species-names';
import { phaseEnvironment } from './simulation/environment';
import { getEffectiveEraMultipliers } from './simulation/eras';
import { phaseHerbivores } from './simulation/herbivores';

export { createWorld } from './simulation/terrain';
export { seedInitialPlants, seedSinglePlant } from './simulation/plants';
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

      // Arid dry spell: zero recharge + mild evaporation for all arid cells
      if (cell.terrainType === TerrainType.Arid && env.aridDrySpell) {
        recharge = 0;
        cell.waterLevel = Math.max(0, cell.waterLevel - SIM.ARID_DRY_SPELL_EVAP);
      }

      cell.waterLevel = Math.min(cell.waterLevel + recharge, SIM.MAX_WATER);
      cell.nutrients = Math.max(0, cell.nutrients - nutrientDecay);
      if (cell.terrainType === TerrainType.Hill) {
        // Bedrock nutrient extraction: deep roots weather minerals
        if (cell.plantId !== null) {
          const hillPlant = world.plants.get(cell.plantId);
          if (hillPlant && hillPlant.alive) {
            const hillMaxRoot = getPlantConstants(hillPlant.genome.woodiness).maxRootDepth;
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
          const npc = getPlantConstants(nPlant.genome.woodiness);
          const nShadow = npc.shadowReduction * eraMults.shadowMult;
          shadeSum += nShadow * Math.min(1, diff / npc.shadowHeightScale);
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
  const capacity = plant.genome.waterStorage * SIM.WATER_STORAGE_CAPACITY;
  const waterNeeded = effectiveLeaf * SIM.TRANSPIRATION_PER_LEAF;

  // Surface absorption: full rootDepth, draws from cell water
  const waterCanAbsorb = plant.rootDepth * SIM.WATER_ABSORPTION_PER_ROOT;
  let waterAbsorbed = Math.min(waterNeeded, waterCanAbsorb, cell.waterLevel);
  cell.waterLevel -= waterAbsorbed;

  // Root competition: drain water from neighboring cells
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

  // Groundwater: roots below water table access saturated zone (all terrains)
  let waterTable: number = SIM.SOIL_WATER_TABLE;
  if (cell.terrainType === TerrainType.Hill) waterTable = SIM.HILL_WATER_TABLE;
  else if (cell.terrainType === TerrainType.Wetland) waterTable = SIM.WETLAND_WATER_TABLE;
  else if (cell.terrainType === TerrainType.Arid) waterTable = SIM.ARID_WATER_TABLE;

  if (plant.rootDepth > waterTable) {
    const saturatedDepth = plant.rootDepth - waterTable;
    const groundwaterAvail = saturatedDepth * SIM.GROUNDWATER_ABSORPTION_RATE;
    const deficit = waterNeeded - waterAbsorbed;
    if (deficit > 0.01) {
      waterAbsorbed += Math.min(deficit, groundwaterAvail);
    }
  }

  // DRAW: if transpiration not fully met, draw from stored water
  if (waterAbsorbed < waterNeeded && plant.storedWater > 0) {
    const deficit = waterNeeded - waterAbsorbed;
    const drawn = Math.min(deficit, plant.storedWater);
    plant.storedWater -= drawn;
    waterAbsorbed += drawn;
  }

  // FILL: if transpiration fully met, absorb extra cell water into tank
  if (waterAbsorbed >= waterNeeded) {
    const space = capacity - plant.storedWater;
    if (space > 0.01) {
      const fillRate = plant.rootDepth * SIM.WATER_STORAGE_FILL_RATE;
      const filled = Math.min(space, fillRate, cell.waterLevel);
      cell.waterLevel -= filled;
      plant.storedWater += filled;
    }
  }

  plant.lastWaterAbsorbed = waterAbsorbed;
  return waterNeeded > 0.01 ? waterAbsorbed / waterNeeded : 0;
}

function photosynthesize(plant: Plant, cell: Cell, waterFraction: number, isDiseased: boolean): number {
  const effectiveLeaf = Math.pow(plant.leafArea, SIM.LEAF_EFFICIENCY_EXPONENT);
  const pc = getPlantConstants(plant.genome.woodiness);
  let heightLightBonus = plant.height / pc.maxHeight * pc.heightLightBonus;

  // Wetland: amplified height bonus (canopy emergence)
  if (cell.terrainType === TerrainType.Wetland) {
    heightLightBonus *= SIM.WETLAND_HEIGHT_BONUS_MULT;
  }

  const rawEnergy = (cell.lightLevel + heightLightBonus) * effectiveLeaf * SIM.PHOTOSYNTHESIS_RATE;

  // Root-gated nutrient access: absolute depth determines access (not relative to archetype max)
  const rootAccess = SIM.NUTRIENT_ROOT_ACCESS_MIN
    + (1 - SIM.NUTRIENT_ROOT_ACCESS_MIN) * (plant.rootDepth / SIM.MAX_ROOT_DEPTH);
  const nutrientBonus = 1 + cell.nutrients * rootAccess * SIM.NUTRIENT_GROWTH_BONUS;

  let energyProduced = rawEnergy * waterFraction * nutrientBonus;
  plant.lastLightReceived = cell.lightLevel;

  if (isDiseased) energyProduced *= SIM.DISEASE_PHOTO_PENALTY;
  return energyProduced;
}

function calculateMaintenance(plant: Plant, world: World, isDiseased: boolean): number {
  const pc = getPlantConstants(plant.genome.woodiness);
  const mBase = pc.maintenanceBase;
  const mHeight = pc.maintenancePerHeight;
  const mRoot = pc.maintenancePerRoot;
  const mLeaf = pc.maintenancePerLeaf;
  const maxRoot = pc.maxRootDepth;

  // Terrain-specific per-trait multipliers (Soil = 1.0)
  const cell = world.grid[plant.y][plant.x];
  let rootMult = 1.0, heightMult = 1.0, leafMult = 1.0, wStorageMult = 1.0;
  if (cell.terrainType === TerrainType.Hill) {
    rootMult = SIM.HILL_MAINT_ROOT_MULT;
    heightMult = SIM.HILL_MAINT_HEIGHT_MULT;
    leafMult = SIM.HILL_MAINT_LEAF_MULT;
  } else if (cell.terrainType === TerrainType.Wetland) {
    rootMult = SIM.WETLAND_MAINT_ROOT_MULT;
    heightMult = SIM.WETLAND_MAINT_HEIGHT_MULT;
    leafMult = SIM.WETLAND_MAINT_LEAF_MULT;
    wStorageMult = SIM.WETLAND_MAINT_WSTORAGE_MULT;
  } else if (cell.terrainType === TerrainType.Arid) {
    rootMult = SIM.ARID_MAINT_ROOT_MULT;
    heightMult = SIM.ARID_MAINT_HEIGHT_MULT;
    leafMult = SIM.ARID_MAINT_LEAF_MULT;
  } else {
    // Soil (default terrain)
    wStorageMult = SIM.SOIL_MAINT_WSTORAGE_MULT;
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
    + plant.genome.defense * SIM.DEFENSE_MAINTENANCE_RATE
    + plant.genome.waterStorage * SIM.WATER_STORAGE_MAINTENANCE * wStorageMult;
  if (isDiseased) maintenance += SIM.DISEASE_DRAIN_PER_TICK;
  return maintenance;
}

function allocateGrowthAndSeeds(plant: Plant, surplus: number, world: World, eraMutationRate: number, eraSeedEnergyMult: number): void {
  const env = world.environment;
  const pc = getPlantConstants(plant.genome.woodiness);
  const growthEff = pc.growthEfficiency;
  const capRoot = pc.maxRootDepth;
  const capHeight = pc.maxHeight;
  const capLeaf = pc.maxLeafArea;
  const seedCost = pc.seedEnergyCost;
  const seedRangeMax = pc.seedRangeMax;
  const seedRangeDiv = pc.seedRangeHeightDivisor;
  const seedEnergy = pc.seedInitialEnergy;

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

  // Seed size scaling — small seeds: cheap & far, large seeds: expensive & close
  const seedSizeMult = SIM.SEED_SIZE_MULT_MIN + plant.genome.seedSize * SIM.SEED_SIZE_MULT_RANGE;
  const effectiveSeedCost = seedCost * seedSizeMult;
  const effectiveSeedEnergy = seedEnergy * seedSizeMult;
  const dispersalBonus = Math.round((1 - plant.genome.seedSize) * SIM.SEED_SIZE_DISPERSAL_BONUS);

  // Seed spawning — taller plants disperse further
  const seedRange = Math.round(seedRangeMax) + Math.floor(plant.height / seedRangeDiv) + dispersalBonus;
  const seedsToSpawn = Math.floor(seedBudget / effectiveSeedCost);
  for (let i = 0; i < seedsToSpawn; i++) {
    world.seedsAttempted++;
    const dx = Math.floor(Math.random() * (seedRange * 2 + 1)) - seedRange;
    const dy = Math.floor(Math.random() * (seedRange * 2 + 1)) - seedRange;
    if (dx === 0 && dy === 0) continue;
    const tx = plant.x + dx;
    const ty = plant.y + dy;
    if (!inBounds(tx, ty, world.width, world.height)) continue;
    const targetCell = world.grid[ty][tx];
    const tt = targetCell.terrainType;
    if (tt === TerrainType.River || tt === TerrainType.Rock) continue;
    if (targetCell.seeds.length >= SIM.SEED_MAX_PER_CELL) continue;

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

    // Create dormant seed instead of a live plant
    const seed: Seed = {
      speciesId: plant.speciesId,
      genome: childGenome,
      energy: effectiveSeedEnergy * eraSeedEnergyMult,
      age: 0,
      generation: plant.generation + 1,
    };
    plant.offspringCount++;
    targetCell.seeds.push(seed);

    // Track seed population per species
    world.seedPopulations.set(seed.speciesId,
      (world.seedPopulations.get(seed.speciesId) ?? 0) + 1);

    world.seedLandingEvents.push({
      parentX: plant.x, parentY: plant.y,
      childX: tx, childY: ty,
      speciesId: plant.speciesId,
      woodiness: childGenome.woodiness,
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

    // Establishment delay — seedlings can't photosynthesize until roots/leaves are built
    // Harsh terrains take longer, rewarding large seeds with more energy reserves
    let estTicks = SIM.SOIL_ESTABLISHMENT_TICKS;
    if (cell.terrainType === TerrainType.Hill) estTicks = SIM.HILL_ESTABLISHMENT_TICKS;
    else if (cell.terrainType === TerrainType.Wetland) estTicks = SIM.WETLAND_ESTABLISHMENT_TICKS;
    else if (cell.terrainType === TerrainType.Arid) estTicks = SIM.ARID_ESTABLISHMENT_TICKS;
    const establishing = plant.age < estTicks;
    const waterFraction = establishing ? 0 : absorbWater(plant, cell, world);
    const energyProduced = establishing ? 0 : photosynthesize(plant, cell, waterFraction, isDiseased);
    const maintenance = calculateMaintenance(plant, world, isDiseased);

    plant.lastEnergyProduced = energyProduced;
    plant.lastMaintenanceCost = maintenance;

    // Establishing seedlings can offset maintenance with stored water
    if (establishing && plant.storedWater > 0) {
      const offset = Math.min(maintenance, plant.storedWater);
      plant.storedWater -= offset;
      plant.energy += energyProduced - (maintenance - offset);
    } else {
      plant.energy += energyProduced - maintenance;
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
    const maxAge = getPlantConstants(plant.genome.woodiness).maxAge;
    if (plant.energy <= SIM.STARVATION_THRESHOLD || plant.age >= maxAge) {
      plant.alive = false;

      // Remove from species centroid
      const centroid = world.speciesCentroids.get(plant.speciesId);
      if (centroid) {
        removeFromCentroid(centroid, plant.genome);
        if (centroid.count <= 0) world.speciesCentroids.delete(plant.speciesId);
      }

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
        cause,
        age: plant.age,
        offspringCount: plant.offspringCount,
        generation: plant.generation,
      });
    }
  }
}

function phaseGermination(world: World): void {
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      if (cell.seeds.length === 0) continue;

      // Age and decay all seeds; remove dead ones
      for (let i = cell.seeds.length - 1; i >= 0; i--) {
        const seed = cell.seeds[i];
        seed.age++;
        seed.energy -= SIM.SEED_DECAY_RATE;
        const maxAge = getPlantConstants(seed.genome.woodiness).seedMaxAge;
        if (seed.energy <= 0 || seed.age >= maxAge) {
          // Decrement seed population tracking
          const count = world.seedPopulations.get(seed.speciesId) ?? 1;
          if (count <= 1) world.seedPopulations.delete(seed.speciesId);
          else world.seedPopulations.set(seed.speciesId, count - 1);
          cell.seeds.splice(i, 1);
        }
      }

      // Germinate if cell is empty and has enough water
      if (cell.plantId !== null || cell.seeds.length === 0) continue;

      // Weighted lottery — each qualifying seed's chance proportional to energy
      let totalEnergy = 0;
      const qualifying: number[] = [];
      for (let i = 0; i < cell.seeds.length; i++) {
        const seed = cell.seeds[i];
        const waterThreshold = getPlantConstants(seed.genome.woodiness).seedGerminationWater;
        if (cell.waterLevel >= waterThreshold) {
          qualifying.push(i);
          totalEnergy += seed.energy;
        }
      }
      let bestIdx = -1;
      if (qualifying.length === 1) {
        bestIdx = qualifying[0];
      } else if (qualifying.length > 1) {
        let roll = Math.random() * totalEnergy;
        for (const idx of qualifying) {
          roll -= cell.seeds[idx].energy;
          if (roll <= 0) { bestIdx = idx; break; }
        }
        if (bestIdx < 0) bestIdx = qualifying[qualifying.length - 1];
      }

      if (bestIdx < 0) continue;
      const winner = cell.seeds[bestIdx];
      cell.seeds.splice(bestIdx, 1);

      // Decrement seed population tracking
      const count = world.seedPopulations.get(winner.speciesId) ?? 1;
      if (count <= 1) world.seedPopulations.delete(winner.speciesId);
      else world.seedPopulations.set(winner.speciesId, count - 1);

      // Create plant from seed — large seeds produce larger seedlings
      // On productive terrain, dampen vigor toward 1.0 (resources equalize seedling size)
      const wpc = getPlantConstants(winner.genome.woodiness);
      const rawVigor = SIM.SEED_SIZE_VIGOR_MIN + winner.genome.seedSize * SIM.SEED_SIZE_VIGOR_RANGE;
      let dampen = SIM.SOIL_VIGOR_DAMPEN;
      if (cell.terrainType === TerrainType.Wetland) dampen = SIM.WETLAND_VIGOR_DAMPEN;
      else if (cell.terrainType === TerrainType.Hill) dampen = SIM.HILL_VIGOR_DAMPEN;
      else if (cell.terrainType === TerrainType.Arid) dampen = SIM.ARID_VIGOR_DAMPEN;
      const seedSizeVigor = Math.max(0.1, rawVigor + (1.0 - rawVigor) * dampen);

      // Speciation check: compare child genome to parent species centroid
      let finalSpeciesId = winner.speciesId;
      const parentCentroid = world.speciesCentroids.get(winner.speciesId);
      if (parentCentroid) {
        const centroidGenome = getCentroidGenome(parentCentroid);
        const dist = genomeDistance(winner.genome, centroidGenome);
        let threshold = SIM.SPECIATION_DISTANCE_THRESHOLD;
        if (woodinessBracket(centroidGenome.woodiness) !== woodinessBracket(winner.genome.woodiness)) {
          threshold *= SIM.SPECIATION_ARCHETYPE_MULT;
        }
        if (dist > threshold) {
          finalSpeciesId = world.nextSpeciesId++;
          world.speciesColors.set(finalSpeciesId, generateSpeciesColor(finalSpeciesId));
          world.speciesNames.set(finalSpeciesId, generateSpeciesName(winner.genome, finalSpeciesId, winner.genome.woodiness));
          world.speciesCentroids.set(finalSpeciesId, createSpeciesCentroid(winner.genome));
        } else {
          addToCentroid(parentCentroid, winner.genome);
        }
      } else {
        world.speciesCentroids.set(winner.speciesId, createSpeciesCentroid(winner.genome));
      }

      const childId = world.nextPlantId++;
      const child: Plant = {
        id: childId, speciesId: finalSpeciesId,
        x, y,
        height: wpc.seedlingHeight * seedSizeVigor, rootDepth: wpc.seedlingRoot * seedSizeVigor, leafArea: wpc.seedlingLeaf * seedSizeVigor,
        energy: winner.energy, age: 0, alive: true,
        genome: winner.genome,
        lastLightReceived: 0, lastWaterAbsorbed: 0,
        lastEnergyProduced: 0, lastMaintenanceCost: 0, isDiseased: false,
        storedWater: seedSizeVigor * winner.genome.waterStorage * SIM.WATER_STORAGE_SEEDLING_PROVISION,
        generation: winner.generation, parentId: null, offspringCount: 0,
      };
      world.plants.set(childId, child);
      cell.plantId = childId;
      cell.lastSpeciesId = finalSpeciesId;

      world.germinationEvents.push({
        x, y,
        plantId: childId,
        speciesId: finalSpeciesId,
        woodiness: winner.genome.woodiness,
      });
    }
  }
}

function phaseDecomposition(world: World): void {
  const toRemove: number[] = [];
  for (const plant of world.plants.values()) {
    if (plant.alive) continue;
    const dpc = getPlantConstants(plant.genome.woodiness);
    const dWater = dpc.decompWaterBoost;
    const dNutrient = dpc.decompNutrientBoost;
    const dNutrientH = dpc.decompNutrientPerHeight;
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
  world.seedLandingEvents.length = 0;
  world.germinationEvents.length = 0;
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
  phaseGermination(world);
  world.tick++;
}
