import { World, Scenario, TerrainType, SIM } from './types';
import { createEnvironment } from './simulation/terrain';
import { createPlant } from './simulation/plants';
import { applyTerrainDefaults } from './simulation/terrain-defaults';

/**
 * Load a scenario into an existing world by mutating it in-place.
 * All external references to the world object remain valid.
 */
export function loadScenario(world: World, scenario: Scenario): void {
  const w = scenario.size;
  const h = scenario.size;
  const defaultElev = scenario.defaultElevation ?? 0.5;

  // 1. Reset metadata
  world.width = w;
  world.height = h;
  world.tick = 0;
  world.plants.clear();
  world.herbivores.clear();
  world.speciesColors.clear();
  world.speciesNames.clear();
  world.seedEvents.length = 0;
  world.fireDeathEvents.length = 0;
  world.deathEvents.length = 0;
  world.environmentEvents.length = 0;
  world.herbivoreDeathEvents.length = 0;
  world.herbivoreBirthEvents.length = 0;
  world.seedsAttempted = 0;
  world.nextPlantId = 1;
  world.nextHerbivoreId = 1;

  // 2. Reset environment
  Object.assign(world.environment, createEnvironment());
  world.environment.weatherOverlay = new Uint8Array(w * h);

  // Lock era if scenario requests it (prevents era transitions)
  if (scenario.lockedEra !== undefined) {
    world.environment.era.current = scenario.lockedEra;
    world.environment.era.eraDuration = Number.MAX_SAFE_INTEGER;
  }

  // 3. Rebuild grid with defaults
  world.grid.length = 0;
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const cell = {
        x, y,
        elevation: defaultElev,
        terrainType: scenario.defaultTerrain,
        waterLevel: 3 + Math.random() * 4,
        waterRechargeRate: SIM.BASE_WATER_RECHARGE,
        nutrients: 1 + Math.random() * 3,
        lightLevel: SIM.BASE_LIGHT,
        plantId: null as number | null,
        lastSpeciesId: null as number | null,
      };
      applyTerrainDefaults(cell, scenario.defaultTerrain, defaultElev);
      row.push(cell);
    }
    world.grid.push(row);
  }

  // 4. Apply sparse cell overrides
  for (const sc of scenario.cells) {
    if (sc.x < 0 || sc.x >= w || sc.y < 0 || sc.y >= h) continue;
    const cell = world.grid[sc.y][sc.x];
    const elev = sc.elevation ?? defaultElev;
    applyTerrainDefaults(cell, sc.terrain, elev);
    // Explicit values override defaults
    if (sc.water !== undefined) cell.waterLevel = sc.water;
    if (sc.waterRecharge !== undefined) cell.waterRechargeRate = sc.waterRecharge;
    if (sc.nutrients !== undefined) cell.nutrients = sc.nutrients;
  }

  // 5. Place species
  let maxSpeciesId = 0;
  for (const sp of scenario.species) {
    world.speciesColors.set(sp.id, sp.color);
    world.speciesNames.set(sp.id, sp.name);
    if (sp.id > maxSpeciesId) maxSpeciesId = sp.id;

    for (const pos of sp.placements) {
      if (pos.x < 0 || pos.x >= w || pos.y < 0 || pos.y >= h) continue;
      const cell = world.grid[pos.y][pos.x];
      if (cell.terrainType === TerrainType.River || cell.terrainType === TerrainType.Rock) continue;
      if (cell.plantId !== null) continue;

      const id = world.nextPlantId++;
      const plant = createPlant(id, pos.x, pos.y, sp.genome, sp.id, sp.archetype);
      world.plants.set(id, plant);
      cell.plantId = id;
      cell.lastSpeciesId = sp.id;
    }
  }

  // 6. Set nextSpeciesId past highest scenario species
  world.nextSpeciesId = maxSpeciesId + 1;
}
