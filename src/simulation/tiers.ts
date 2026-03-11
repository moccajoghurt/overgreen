import {
  Cell, Plant, World,
  CANOPY_THRESHOLD, GROUND_THRESHOLD,
  CANOPY_FILTER_COEFF, UNDERSTORY_FILTER_COEFF, MIN_TIER_LIGHT,
} from '../types';

export const enum Tier {
  Ground = 0,
  Understory = 1,
  Canopy = 2,
}

export function heightToTier(height: number): Tier {
  if (height >= CANOPY_THRESHOLD) return Tier.Canopy;
  if (height >= GROUND_THRESHOLD) return Tier.Understory;
  return Tier.Ground;
}

/** Yield all non-null plant IDs in a cell (up to 3). */
export function* cellPlantIds(cell: Cell): Generator<number> {
  if (cell.canopyId !== null) yield cell.canopyId;
  if (cell.understoryId !== null) yield cell.understoryId;
  if (cell.groundId !== null) yield cell.groundId;
}

export function cellIsEmpty(cell: Cell): boolean {
  return cell.canopyId === null && cell.understoryId === null && cell.groundId === null;
}

export function cellHasSpace(cell: Cell): boolean {
  return cell.canopyId === null || cell.understoryId === null || cell.groundId === null;
}

export function setCellPlant(cell: Cell, tier: Tier, id: number): void {
  switch (tier) {
    case Tier.Ground: cell.groundId = id; break;
    case Tier.Understory: cell.understoryId = id; break;
    case Tier.Canopy: cell.canopyId = id; break;
  }
}

export function clearCellPlant(cell: Cell, plantId: number): void {
  if (cell.canopyId === plantId) cell.canopyId = null;
  if (cell.understoryId === plantId) cell.understoryId = null;
  if (cell.groundId === plantId) cell.groundId = null;
}

/** Backward-compat: return the "primary" plant (tallest tier occupied). */
export function cellPrimaryPlantId(cell: Cell): number | null {
  return cell.canopyId ?? cell.understoryId ?? cell.groundId;
}

/**
 * Phase: Assign each alive plant to its tier slot based on height.
 * If a slot is occupied by a taller plant, the shorter one is displaced down.
 * Plants with no available slot are marked for death.
 */
export function phaseTierAssignment(world: World): void {
  const W = world.width;
  const H = world.height;

  // Clear all tier slots
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cell = world.grid[y][x];
      cell.canopyId = null;
      cell.understoryId = null;
      cell.groundId = null;
    }
  }

  // Sort plants by height descending so tallest claim slots first
  const alivePlants: Plant[] = [];
  for (const plant of world.plants.values()) {
    if (plant.alive) alivePlants.push(plant);
  }
  alivePlants.sort((a, b) => b.height - a.height);

  for (const plant of alivePlants) {
    const cell = world.grid[plant.y][plant.x];
    const tier = heightToTier(plant.height);

    // Try preferred tier, then fall down
    if (tier === Tier.Canopy) {
      if (cell.canopyId === null) { cell.canopyId = plant.id; continue; }
      if (cell.understoryId === null) { cell.understoryId = plant.id; continue; }
      if (cell.groundId === null) { cell.groundId = plant.id; continue; }
    } else if (tier === Tier.Understory) {
      if (cell.understoryId === null) { cell.understoryId = plant.id; continue; }
      if (cell.groundId === null) { cell.groundId = plant.id; continue; }
      // Can't displace up to canopy
    } else {
      if (cell.groundId === null) { cell.groundId = plant.id; continue; }
    }

    // No slot available — kill plant
    plant.alive = false;
    plant.energy = 0;
    world.deathEvents.push({
      id: plant.id,
      speciesId: plant.speciesId,
      cause: 'starvation',
      age: plant.age,
      offspringCount: plant.offspringCount,
      generation: plant.generation,
    });
  }

  // Sync plantId for backward compatibility
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cell = world.grid[y][x];
      cell.plantId = cellPrimaryPlantId(cell);
    }
  }
}

/**
 * Phase: Cascade cell light through tiers into per-plant effectiveLight.
 * Canopy gets full cell.lightLevel; understory is filtered by canopy leaf area;
 * ground is filtered by understory leaf area.
 */
export function phaseTierLight(world: World): void {
  const W = world.width;
  const H = world.height;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cell = world.grid[y][x];
      let light = cell.lightLevel;

      // Canopy tier
      if (cell.canopyId !== null) {
        const p = world.plants.get(cell.canopyId);
        if (p && p.alive) {
          p.effectiveLight = Math.max(MIN_TIER_LIGHT, light);
          light = Math.max(MIN_TIER_LIGHT, light * (1 - p.leafArea * CANOPY_FILTER_COEFF));
        }
      }

      // Understory tier
      if (cell.understoryId !== null) {
        const p = world.plants.get(cell.understoryId);
        if (p && p.alive) {
          p.effectiveLight = Math.max(MIN_TIER_LIGHT, light);
          light = Math.max(MIN_TIER_LIGHT, light * (1 - p.leafArea * UNDERSTORY_FILTER_COEFF));
        }
      }

      // Ground tier
      if (cell.groundId !== null) {
        const p = world.plants.get(cell.groundId);
        if (p && p.alive) {
          p.effectiveLight = Math.max(MIN_TIER_LIGHT, light);
        }
      }
    }
  }
}
