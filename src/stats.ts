import { SIM, TerrainType, World } from './types';

// ── Types ──

export interface TickAccumulator {
  births: number;
  deathsByStarvation: number;
  deathsByAge: number;
  deathsByFire: number;
  deathsByDisease: number;
  seedsAttempted: number;
  seedsLanded: number;
  totalEnergyProduced: number;
  totalMaintenanceCost: number;
}

export interface TerrainSummary {
  soilCells: number;
  riverCells: number;
  rockCells: number;
  hillCells: number;
  wetlandCells: number;
  aridCells: number;
  plantableCells: number;
}

export interface Snapshot {
  tick: number;
  season: number;
  yearCount: number;
  era: number;

  population: number;
  speciesCount: number;
  birthsInPeriod: number;
  deathsInPeriod: {
    starvation: number;
    age: number;
    fire: number;
    disease: number;
    total: number;
  };

  energy: {
    avg: number;
    min: number;
    max: number;
    avgProduction: number;
    avgMaintenance: number;
    avgNetEnergy: number;
    pctEnergyPositive: number;
  };

  resources: {
    avgWater: number;
    avgNutrients: number;
    pctCellsOccupied: number;
    avgWaterOnOccupied: number;
    avgWaterOnEmpty: number;
  };

  diversity: {
    traitVariance: { root: number; height: number; leaf: number; seed: number };
    strategyCount: number;
    shannonIndex: number;
  };

  competition: {
    avgLightReceived: number;
    pctShaded: number;
    avgRootDepth: number;
    pctWaterStressed: number;
    crossSpeciesNeighborPct: number;
  };

  spatial: {
    plantsBySoil: number;
    plantsByHill: number;
    plantsByWetland: number;
    plantsByArid: number;
    plantsNearRiver: number;
    avgEnergyByTerrain: { soil: number; hill: number; wetland: number; arid: number };
  };

  reproduction: {
    seedsAttempted: number;
    seedsLanded: number;
    seedSuccessRate: number;
  };

  topSpecies: Array<{
    speciesId: number;
    name: string;
    count: number;
    avgGenome: { root: number; height: number; leaf: number; seed: number; allelo: number; def: number };
    avgEnergy: number;
    maxGeneration: number;
    terrain: { soil: number; hill: number; wetland: number; arid: number };
  }>;
}

// ── Helpers ──

export function createAccumulator(): TickAccumulator {
  return {
    births: 0,
    deathsByStarvation: 0,
    deathsByAge: 0,
    deathsByFire: 0,
    deathsByDisease: 0,
    seedsAttempted: 0,
    seedsLanded: 0,
    totalEnergyProduced: 0,
    totalMaintenanceCost: 0,
  };
}

export function accumulateTick(accum: TickAccumulator, world: World): void {
  accum.births += world.seedEvents.length;
  accum.seedsLanded += world.seedEvents.length;
  accum.seedsAttempted += world.seedsAttempted;
  for (const evt of world.deathEvents) {
    switch (evt.cause) {
      case 'starvation': accum.deathsByStarvation++; break;
      case 'age': accum.deathsByAge++; break;
      case 'fire': accum.deathsByFire++; break;
      case 'disease': accum.deathsByDisease++; break;
    }
  }
}

export function computeTerrainSummary(world: World): TerrainSummary {
  let soil = 0, river = 0, rock = 0, hill = 0, wetland = 0, arid = 0;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      switch (world.grid[y][x].terrainType) {
        case TerrainType.Soil: soil++; break;
        case TerrainType.River: river++; break;
        case TerrainType.Rock: rock++; break;
        case TerrainType.Hill: hill++; break;
        case TerrainType.Wetland: wetland++; break;
        case TerrainType.Arid: arid++; break;
      }
    }
  }
  return {
    soilCells: soil, riverCells: river, rockCells: rock, hillCells: hill,
    wetlandCells: wetland, aridCells: arid,
    plantableCells: soil + hill + wetland + arid,
  };
}

export function computeNearRiverSet(world: World): Set<number> {
  const set = new Set<number>();
  const dist = 3;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.grid[y][x].terrainType !== TerrainType.River) continue;
      for (let dy = -dist; dy <= dist; dy++) {
        for (let dx = -dist; dx <= dist; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < world.width && ny >= 0 && ny < world.height) {
            set.add(ny * world.width + nx);
          }
        }
      }
    }
  }
  return set;
}

export function variance(sumSq: number, sum: number, count: number): number {
  return count > 1 ? (sumSq - sum * sum / count) / (count - 1) : 0;
}

export function computeSnapshot(
  world: World,
  accum: TickAccumulator,
  terrain: TerrainSummary,
  nearRiver: Set<number>,
): Snapshot {
  // PASS 1: Iterate all alive plants
  let totalAlive = 0;
  let sumEnergy = 0, minEnergy = Infinity, maxEnergy = -Infinity;
  let sumProduction = 0, sumMaintenance = 0;
  let energyPositiveCount = 0;
  let sumLight = 0, shadedCount = 0, crossSpeciesCount = 0;
  let sumRootDepth = 0, waterStressedCount = 0;
  let sumRoot = 0, sumHeight = 0, sumLeaf = 0, sumSeed = 0;
  let sumRootSq = 0, sumHeightSq = 0, sumLeafSq = 0, sumSeedSq = 0;
  let plantsSoil = 0, plantsHill = 0, plantsWetland = 0, plantsArid = 0, plantsNearRiver = 0;
  let energySoil = 0, energyHill = 0, energyWetland = 0, energyArid = 0;
  let countSoil = 0, countHill = 0, countWetland = 0, countArid = 0;

  const speciesBuckets = new Map<number, {
    count: number; sumEnergy: number;
    sumRoot: number; sumHeight: number; sumLeaf: number; sumSeed: number;
    sumAllelo: number; sumDef: number;
    maxGeneration: number;
    soil: number; hill: number; wetland: number; arid: number;
  }>();
  const strategySet = new Set<string>();

  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    totalAlive++;

    sumEnergy += plant.energy;
    if (plant.energy < minEnergy) minEnergy = plant.energy;
    if (plant.energy > maxEnergy) maxEnergy = plant.energy;
    sumProduction += plant.lastEnergyProduced;
    sumMaintenance += plant.lastMaintenanceCost;
    if (plant.lastEnergyProduced > plant.lastMaintenanceCost) energyPositiveCount++;

    const cell = world.grid[plant.y][plant.x];

    sumLight += plant.lastLightReceived;
    // Compare against terrain+season base to detect actual neighbor shading (not seasonal darkness)
    let unshadedBase = SIM.BASE_LIGHT;
    if (cell.terrainType === TerrainType.Hill) unshadedBase += SIM.HILL_LIGHT_BONUS;
    else if (cell.terrainType === TerrainType.Arid) unshadedBase += SIM.ARID_LIGHT_BONUS;
    if (plant.lastLightReceived < unshadedBase * world.environment.lightMult * 0.9) shadedCount++;
    sumRootDepth += plant.rootDepth;
    const waterNeeded = plant.leafArea * SIM.TRANSPIRATION_PER_LEAF;
    if (waterNeeded > 0.01 && plant.lastWaterAbsorbed / waterNeeded < 0.5) {
      waterStressedCount++;
    }

    // Check if any adjacent cell has a plant of a different species
    let hasCrossSpeciesNeighbor = false;
    for (let dy = -1; dy <= 1 && !hasCrossSpeciesNeighbor; dy++) {
      for (let dx = -1; dx <= 1 && !hasCrossSpeciesNeighbor; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = plant.x + dx, ny = plant.y + dy;
        if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
        const nc = world.grid[ny][nx];
        if (nc.plantId !== null) {
          const neighbor = world.plants.get(nc.plantId);
          if (neighbor && neighbor.alive && neighbor.speciesId !== plant.speciesId) {
            hasCrossSpeciesNeighbor = true;
          }
        }
      }
    }
    if (hasCrossSpeciesNeighbor) crossSpeciesCount++;

    const r = plant.genome.rootPriority;
    const h = plant.genome.heightPriority;
    const l = plant.genome.leafSize;
    const s = plant.genome.seedInvestment;
    const a = plant.genome.allelopathy;
    const d = plant.genome.defense;
    sumRoot += r; sumHeight += h; sumLeaf += l; sumSeed += s;
    sumRootSq += r * r; sumHeightSq += h * h;
    sumLeafSq += l * l; sumSeedSq += s * s;

    const stratKey = `${Math.round(r * 10)},${Math.round(h * 10)},${Math.round(l * 10)},${Math.round(s * 10)},${Math.round(a * 10)},${Math.round(d * 10)}`;
    strategySet.add(stratKey);
    if (cell.terrainType === TerrainType.Soil) {
      plantsSoil++; energySoil += plant.energy; countSoil++;
    } else if (cell.terrainType === TerrainType.Hill) {
      plantsHill++; energyHill += plant.energy; countHill++;
    } else if (cell.terrainType === TerrainType.Wetland) {
      plantsWetland++; energyWetland += plant.energy; countWetland++;
    } else if (cell.terrainType === TerrainType.Arid) {
      plantsArid++; energyArid += plant.energy; countArid++;
    }
    if (nearRiver.has(plant.y * world.width + plant.x)) plantsNearRiver++;

    let bucket = speciesBuckets.get(plant.speciesId);
    if (!bucket) {
      bucket = { count: 0, sumEnergy: 0, sumRoot: 0, sumHeight: 0, sumLeaf: 0, sumSeed: 0, sumAllelo: 0, sumDef: 0, maxGeneration: 0, soil: 0, hill: 0, wetland: 0, arid: 0 };
      speciesBuckets.set(plant.speciesId, bucket);
    }
    bucket.count++;
    bucket.sumEnergy += plant.energy;
    bucket.sumRoot += r; bucket.sumHeight += h; bucket.sumLeaf += l; bucket.sumSeed += s;
    bucket.sumAllelo += a; bucket.sumDef += d;
    if (plant.generation > bucket.maxGeneration) bucket.maxGeneration = plant.generation;
    if (cell.terrainType === TerrainType.Soil) bucket.soil++;
    else if (cell.terrainType === TerrainType.Hill) bucket.hill++;
    else if (cell.terrainType === TerrainType.Wetland) bucket.wetland++;
    else if (cell.terrainType === TerrainType.Arid) bucket.arid++;
  }

  // PASS 2: Grid scan for resource state
  let occupiedCells = 0;
  let sumWater = 0, sumNutrients = 0;
  let sumWaterOccupied = 0, countOccupied = 0;
  let sumWaterEmpty = 0, countEmpty = 0;

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      if (cell.terrainType === TerrainType.River || cell.terrainType === TerrainType.Rock) continue;
      sumWater += cell.waterLevel;
      sumNutrients += cell.nutrients;
      if (cell.plantId !== null) {
        occupiedCells++;
        sumWaterOccupied += cell.waterLevel;
        countOccupied++;
      } else {
        sumWaterEmpty += cell.waterLevel;
        countEmpty++;
      }
    }
  }

  const n = totalAlive || 1;
  const pc = terrain.plantableCells || 1;

  // Shannon diversity
  let shannonIndex = 0;
  if (totalAlive > 0) {
    for (const bucket of speciesBuckets.values()) {
      const p = bucket.count / totalAlive;
      if (p > 0) shannonIndex -= p * Math.log(p);
    }
  }

  // Top 5 species
  const topSpecies = [...speciesBuckets.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([speciesId, b]) => ({
      speciesId,
      name: world.speciesNames.get(speciesId) ?? `Sp ${speciesId}`,
      count: b.count,
      avgGenome: {
        root: b.sumRoot / b.count,
        height: b.sumHeight / b.count,
        leaf: b.sumLeaf / b.count,
        seed: b.sumSeed / b.count,
        allelo: b.sumAllelo / b.count,
        def: b.sumDef / b.count,
      },
      avgEnergy: b.sumEnergy / b.count,
      maxGeneration: b.maxGeneration,
      terrain: { soil: b.soil, hill: b.hill, wetland: b.wetland, arid: b.arid },
    }));

  const totalDeaths = accum.deathsByStarvation + accum.deathsByAge + accum.deathsByFire + accum.deathsByDisease;

  return {
    tick: world.tick,
    season: world.environment.season,
    yearCount: world.environment.yearCount,
    era: world.environment.era.current,
    population: totalAlive,
    speciesCount: speciesBuckets.size,
    birthsInPeriod: accum.births,
    deathsInPeriod: {
      starvation: accum.deathsByStarvation,
      age: accum.deathsByAge,
      fire: accum.deathsByFire,
      disease: accum.deathsByDisease,
      total: totalDeaths,
    },
    energy: {
      avg: sumEnergy / n,
      min: totalAlive > 0 ? minEnergy : 0,
      max: totalAlive > 0 ? maxEnergy : 0,
      avgProduction: sumProduction / n,
      avgMaintenance: sumMaintenance / n,
      avgNetEnergy: (sumProduction - sumMaintenance) / n,
      pctEnergyPositive: totalAlive > 0 ? (energyPositiveCount / totalAlive) * 100 : 0,
    },
    resources: {
      avgWater: sumWater / pc,
      avgNutrients: sumNutrients / pc,
      pctCellsOccupied: (occupiedCells / pc) * 100,
      avgWaterOnOccupied: countOccupied > 0 ? sumWaterOccupied / countOccupied : 0,
      avgWaterOnEmpty: countEmpty > 0 ? sumWaterEmpty / countEmpty : 0,
    },
    diversity: {
      traitVariance: {
        root: variance(sumRootSq, sumRoot, totalAlive),
        height: variance(sumHeightSq, sumHeight, totalAlive),
        leaf: variance(sumLeafSq, sumLeaf, totalAlive),
        seed: variance(sumSeedSq, sumSeed, totalAlive),
      },
      strategyCount: strategySet.size,
      shannonIndex,
    },
    competition: {
      avgLightReceived: sumLight / n,
      pctShaded: totalAlive > 0 ? (shadedCount / totalAlive) * 100 : 0,
      avgRootDepth: sumRootDepth / n,
      pctWaterStressed: totalAlive > 0 ? (waterStressedCount / totalAlive) * 100 : 0,
      crossSpeciesNeighborPct: totalAlive > 0 ? (crossSpeciesCount / totalAlive) * 100 : 0,
    },
    spatial: {
      plantsBySoil: plantsSoil,
      plantsByHill: plantsHill,
      plantsByWetland: plantsWetland,
      plantsByArid: plantsArid,
      plantsNearRiver,
      avgEnergyByTerrain: {
        soil: countSoil > 0 ? energySoil / countSoil : 0,
        hill: countHill > 0 ? energyHill / countHill : 0,
        wetland: countWetland > 0 ? energyWetland / countWetland : 0,
        arid: countArid > 0 ? energyArid / countArid : 0,
      },
    },
    reproduction: {
      seedsAttempted: accum.seedsAttempted,
      seedsLanded: accum.seedsLanded,
      seedSuccessRate: accum.seedsAttempted > 0 ? accum.seedsLanded / accum.seedsAttempted : 0,
    },
    topSpecies,
  };
}
