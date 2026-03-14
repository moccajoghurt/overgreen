import { World, Genome, TerrainType } from '../types';
import { classifySubtype } from '../types/subtypes';
import { generateSpeciesName } from '../species-names';
import { createPlant, generateSpeciesColor } from './plants';
import { cellIsEmpty, clearCellPlant, setCellPlant, Tier } from './tiers';

/**
 * Place a sandbox plant at (x, y). Handles terrain guard, cell check,
 * species resolution (reuse existing subtype species or create new), and
 * plant creation.
 *
 * Returns { plantId, speciesId } on success, or null if the cell can't accept a plant.
 */
export function sandboxPlacePlant(
  world: World, x: number, y: number, genome: Genome,
): { plantId: number; speciesId: number } | null {
  const cell = world.grid[y][x];
  if (cell.terrainType === TerrainType.River || cell.terrainType === TerrainType.Rock) return null;
  if (!cellIsEmpty(cell)) return null;

  const subtype = classifySubtype(genome);

  // Reuse existing species for this subtype if one exists
  let speciesId: number;
  const existingForSubtype = world.subtypeSpecies.get(subtype);
  if (existingForSubtype !== undefined) {
    speciesId = existingForSubtype;
  } else {
    speciesId = world.nextSpeciesId++;
    const color = generateSpeciesColor(speciesId);
    const name = generateSpeciesName(genome, speciesId, subtype);
    world.species.set(speciesId, { id: speciesId, name, color, subtype });
    world.subtypeSpecies.set(subtype, speciesId);
  }

  const id = world.nextPlantId++;
  const plant = createPlant(id, x, y, genome, speciesId, speciesId);
  world.plants.set(id, plant);
  setCellPlant(cell, Tier.Ground, id);
  cell.lastSpeciesId = speciesId;

  return { plantId: id, speciesId };
}

/** Remove all plants belonging to the given species IDs. */
export function removePlantsBySpecies(world: World, speciesIds: Set<number>): void {
  for (const plant of world.plants.values()) {
    if (speciesIds.has(plant.speciesId)) {
      const cell = world.grid[plant.y][plant.x];
      clearCellPlant(cell, plant.id);
      world.plants.delete(plant.id);
    }
  }
}

/** Clear every plant, seed, and seed population from the world. */
export function clearAllPlants(world: World): void {
  for (const plant of world.plants.values()) {
    const cell = world.grid[plant.y][plant.x];
    clearCellPlant(cell, plant.id);
  }
  world.plants.clear();
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      world.grid[y][x].seeds.length = 0;
    }
  }
  world.seedPopulations.clear();
}
