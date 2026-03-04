import { Cell, TerrainType, SIM } from '../types';

/**
 * Apply default cell properties based on terrain type and elevation.
 * Used by both createWorld (procedural generation) and loadScenario.
 */
export function applyTerrainDefaults(
  cell: Cell,
  terrainType: TerrainType,
  elevation: number,
): void {
  cell.terrainType = terrainType;
  cell.elevation = elevation;

  switch (terrainType) {
    case TerrainType.River:
      cell.waterRechargeRate = SIM.RIVER_WATER_RECHARGE;
      cell.waterLevel = SIM.MAX_WATER;
      cell.nutrients = Math.min(SIM.MAX_NUTRIENTS, cell.nutrients + SIM.RIVER_NUTRIENT_BONUS);
      break;

    case TerrainType.Rock:
      cell.waterRechargeRate = SIM.ROCK_WATER_RECHARGE;
      cell.nutrients = Math.min(cell.nutrients, SIM.ROCK_NUTRIENT_MAX);
      break;

    case TerrainType.Hill:
      cell.waterRechargeRate = SIM.BASE_WATER_RECHARGE * SIM.HILL_WATER_PENALTY;
      cell.nutrients = Math.min(cell.nutrients, SIM.HILL_NUTRIENT_MAX);
      break;

    case TerrainType.Wetland:
      cell.waterRechargeRate = SIM.WETLAND_WATER_RECHARGE;
      cell.waterLevel = SIM.MAX_WATER * 0.8;
      cell.nutrients = Math.min(SIM.WETLAND_NUTRIENT_MAX, cell.nutrients + SIM.WETLAND_NUTRIENT_BONUS);
      break;

    case TerrainType.Arid:
      cell.waterRechargeRate = SIM.ARID_WATER_RECHARGE;
      cell.nutrients = Math.min(cell.nutrients, SIM.ARID_NUTRIENT_MAX);
      break;

    case TerrainType.Soil:
    default: {
      const valleyBonus = 1.0 + (1.0 - elevation) * 0.3;
      cell.waterRechargeRate = SIM.BASE_WATER_RECHARGE * valleyBonus;
      cell.nutrients += (1.0 - elevation) * 1.5;
      break;
    }
  }
}
