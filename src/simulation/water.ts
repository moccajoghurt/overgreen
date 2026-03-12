import { Cell, Plant, SIM, TERRAIN_PROPS, TerrainType, World, getPlantConstants } from '../types';
import { NEIGHBORS, inBounds } from './neighbors';
import { cellIsEmpty, cellPrimaryPlantId } from './tiers';

export function phaseRechargeWater(world: World): void {
  const env = world.environment;
  const nutrientDecay = SIM.NUTRIENT_DECAY;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      const zm = env.zoneModifiers[cell.climateZone];
      let recharge = cell.waterRechargeRate * zm.waterMult;

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
      // Hill bedrock nutrient extraction: deep roots weather minerals
      if (cell.terrainType === TerrainType.Hill && !cellIsEmpty(cell)) {
        const hillPlantId = cellPrimaryPlantId(cell);
        const hillPlant = hillPlantId !== null ? world.plants.get(hillPlantId) : undefined;
        if (hillPlant && hillPlant.alive) {
          const hillMaxRoot = getPlantConstants(hillPlant.genome).maxRootDepth;
          const hillRootFrac = hillPlant.rootDepth / hillMaxRoot;
          if (hillRootFrac > SIM.HILL_ROOT_NUTRIENT_THRESHOLD) {
            const extraction = (hillRootFrac - SIM.HILL_ROOT_NUTRIENT_THRESHOLD)
              * SIM.HILL_ROOT_NUTRIENT_BONUS * hillPlant.rootDepth;
            cell.nutrients = Math.min(SIM.HILL_NUTRIENT_MAX, cell.nutrients + extraction);
          }
        }
      }
      cell.nutrients = Math.min(TERRAIN_PROPS[cell.terrainType].nutrientMax, cell.nutrients);
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

export function absorbWater(plant: Plant, cell: Cell, world: World): number {
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
  const waterTable = TERRAIN_PROPS[cell.terrainType].waterTable;

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
