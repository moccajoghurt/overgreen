import { SIM, TERRAIN_PROPS, World, getPlantConstants } from '../types';
import { clearCellPlant } from './tiers';

export function phaseDecomposition(world: World): void {
  const toRemove: number[] = [];
  for (const plant of world.plants.values()) {
    if (plant.alive) continue;
    const dpc = getPlantConstants(plant.genome);
    const dWater = dpc.decompWaterBoost;
    const dNutrient = dpc.decompNutrientBoost;
    const dNutrientH = dpc.decompNutrientPerHeight;
    const cell = world.grid[plant.y][plant.x];
    cell.waterLevel = Math.min(SIM.MAX_WATER, cell.waterLevel + dWater);
    cell.nutrients = Math.min(SIM.MAX_NUTRIENTS,
      cell.nutrients + dNutrient + plant.height * dNutrientH);
    cell.nutrients = Math.min(TERRAIN_PROPS[cell.terrainType].nutrientMax, cell.nutrients);
    clearCellPlant(cell, plant.id);
    toRemove.push(plant.id);
  }
  for (const id of toRemove) {
    world.plants.delete(id);
  }
}
