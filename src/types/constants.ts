import { TerrainType } from './core';

export const GRID_WIDTH = 80;
export const GRID_HEIGHT = 80;

// Vertical tier thresholds (height in sim units)
export const CANOPY_THRESHOLD = 3.0;
export const GROUND_THRESHOLD = 1.0;

// Light filtering coefficients per tier
export const CANOPY_FILTER_COEFF = 0.12;
export const UNDERSTORY_FILTER_COEFF = 0.15;
export const MIN_TIER_LIGHT = 0.05;

export const SIM = {
  // Water
  BASE_WATER_RECHARGE: 0.4,
  MAX_WATER: 10.0,
  WATER_ABSORPTION_PER_ROOT: 0.4,
  TRANSPIRATION_PER_LEAF: 0.55,
  ROOT_COMPETITION_RATE: 0.06,

  // Nutrients
  MAX_NUTRIENTS: 10.0,
  NUTRIENT_GROWTH_BONUS: 0.20,
  NUTRIENT_ROOT_ACCESS_MIN: 0.3,
  NUTRIENT_DECAY: 0.02,

  // Light
  BASE_LIGHT: 1.0,
  SHADOW_REDUCTION: 0.25,
  SHADOW_HEIGHT_SCALE: 3.0,
  MIN_LIGHT: 0.1,

  // Energy / Photosynthesis
  PHOTOSYNTHESIS_RATE: 0.5,
  LEAF_EFFICIENCY_EXPONENT: 0.7,
  HEIGHT_LIGHT_BONUS: 1.0,
  MAINTENANCE_BASE: 0.05,
  MAINTENANCE_PER_HEIGHT: 0.03,
  MAINTENANCE_PER_ROOT: 0.03,
  MAINTENANCE_PER_LEAF: 0.04,

  // Growth
  MAX_HEIGHT: 10.0,
  MAX_ROOT_DEPTH: 10.0,
  MAX_LEAF_AREA: 8.0,
  GROWTH_EFFICIENCY: 0.3,

  // Reproduction
  SEED_ENERGY_COST: 0.8,
  SEED_RANGE_MIN: 1,
  SEED_RANGE_MAX: 3,
  SEED_RANGE_HEIGHT_DIVISOR: 2,
  SEED_INITIAL_ENERGY: 2.0,
  MUTATION_RATE: 0.2,
  CROSSOVER_MATE_RADIUS: 4,
  SEED_SIZE_MULT_MIN: 0.6,
  SEED_SIZE_MULT_RANGE: 0.8,
  SEED_SIZE_VIGOR_MIN: 0.4,
  SEED_SIZE_VIGOR_RANGE: 1.2,
  SEED_SIZE_DISPERSAL_BONUS: 1,
  ESTABLISHMENT_TICKS: 5,
  WETLAND_ESTABLISHMENT_TICKS: 3,   // easy — abundant water, nutrients
  SOIL_ESTABLISHMENT_TICKS: 5,      // baseline
  HILL_ESTABLISHMENT_TICKS: 8,      // wind + thin soil
  ARID_ESTABLISHMENT_TICKS: 7,      // drought stress

  // Seedling vigor dampening — compress or amplify seed-size advantage per terrain
  // >0 compresses toward 1.0 (productive: size doesn't matter)
  // <0 amplifies away from 1.0 (harsh: size matters MORE)
  WETLAND_VIGOR_DAMPEN: 0.85,  // abundant resources equalize seedlings
  SOIL_VIGOR_DAMPEN: 0.0,      // baseline — full vigor range
  HILL_VIGOR_DAMPEN: -0.3,     // harsh — small seeds produce weaker seedlings
  ARID_VIGOR_DAMPEN: -0.5,     // harshest — seed size critical for survival

  // Death / Decomposition
  STARVATION_THRESHOLD: 0,
  DECOMP_WATER_BOOST: 2.0,
  DECOMP_NUTRIENT_BOOST: 1.5,
  DECOMP_NUTRIENT_PER_HEIGHT: 0.3,

  // Age & Senescence
  MAX_AGE: 2500,
  SENESCENCE_ONSET: 0.2,       // fraction of maxAge when senescence begins
  SENESCENCE_MAX_MULT: 6.0,    // maintenance multiplier at maxAge
  LONGEVITY_MAINTENANCE_RATE: 0.08, // ongoing cost of long-lived tissue

  // Environmental stress mortality — per-tick death chance when trait modifier < threshold
  STRESS_MORTALITY_RATE: 0.10,
  STRESS_MORTALITY_THRESHOLD: 0.05,

  // Disease / Blight
  DISEASE_DISTANCE_THRESHOLD: 0.25,
  DISEASE_DRAIN_PER_TICK: 0.15,
  DISEASE_PHOTO_PENALTY: 0.7,
  DISEASE_SPREAD_BASE: 0.30,
  DISEASE_CELL_DURATION_MIN: 15,
  DISEASE_CELL_DURATION_MAX: 25,
  DISEASE_EVENT_DURATION_MIN: 40,
  DISEASE_EVENT_DURATION_MAX: 80,
  DISEASE_SPAWN_CHANCE: 0.003,
  DISEASE_MIN_UNIFORMITY: 0.5,
  DISEASE_SCAN_RADIUS: 5,
  DISEASE_SCAR_DURATION: 40,
  DISEASE_SPAWN_MIN_TICK: 300,

  // Drought
  DROUGHT_EVAPORATION_RATE: 0.3,

  // Arid dry spells (terrain-wide zero-recharge episodes, summer only)
  ARID_DRY_SPELL_CHANCE: 0.008,
  ARID_DRY_SPELL_DURATION_MIN: 15,
  ARID_DRY_SPELL_DURATION_MAX: 35,
  ARID_DRY_SPELL_EVAP: 0.05,

  // Terrain
  RIVER_WATER_RECHARGE: 1.2,
  ROCK_WATER_RECHARGE: 0.08,
  ROCK_NUTRIENT_MAX: 0.5,
  HILL_LIGHT_BONUS: 0.35,
  HILL_WATER_PENALTY: 0.4,
  HILL_NUTRIENT_MAX: 3.0,
  HILL_ROOT_NUTRIENT_BONUS: 0.15,
  HILL_ROOT_NUTRIENT_THRESHOLD: 0.3,
  RIVER_SEEPAGE: 0.4,
  RIVER_NUTRIENT_SEEPAGE: 0.1,
  RIVER_NUTRIENT_BONUS: 2.0,

  // Wetland terrain
  WETLAND_WATER_RECHARGE: 0.7,
  WETLAND_NUTRIENT_BONUS: 2.0,
  WETLAND_NUTRIENT_MAX: 8.0,

  // Arid terrain
  ARID_WATER_RECHARGE: 0.25,
  ARID_NUTRIENT_MAX: 1.5,
  ARID_LIGHT_BONUS: 0.2,
  // Water table depth per terrain (depth to saturated zone — roots below this access groundwater)
  SOIL_WATER_TABLE: 4.0,
  HILL_WATER_TABLE: 5.0,
  WETLAND_WATER_TABLE: 0.5,
  ARID_WATER_TABLE: 3.0,
  GROUNDWATER_ABSORPTION_RATE: 0.3,

  // Defense
  DEFENSE_GRAZE_REDUCTION: 0.7,
  DEFENSE_HERBIVORE_DAMAGE: 0.3,
  DEFENSE_MAINTENANCE_RATE: 0.05,
  DEFENSE_DISEASE_RESIST: 0.5,         // max 50% spread reduction at defense=1
  DEFENSE_DISEASE_PHOTO_RECOVER: 0.15, // photo penalty: 0.70 → 0.85 at defense=1
  DEFENSE_DISEASE_DRAIN_RESIST: 0.4,   // drain: 0.15 → 0.09/tick at defense=1

  // Fire survival
  FIRE_SURVIVAL_BARK_WEIGHT: 0.5,      // max 50% survival from woodiness²
  FIRE_SURVIVAL_MOISTURE_WEIGHT: 0.3,  // max 30% survival from water reserves
  FIRE_SURVIVAL_ENERGY_LOSS: 0.6,      // 60% energy lost when surviving
  FIRE_SURVIVAL_LEAF_LOSS: 0.9,        // 90% leaves lost when surviving

  // Reproductive maintenance — ongoing cost for maintaining floral/fruiting structures
  REPRODUCTIVE_MAINTENANCE_RATE: 0.04,

  // Water storage
  WATER_STORAGE_CAPACITY: 5.0,
  WATER_STORAGE_MAINTENANCE: 0.04,
  WATER_STORAGE_FILL_RATE: 0.5,
  WATER_STORAGE_SEEDLING_PROVISION: 3.0,

  // Seed bank
  SEED_MAX_AGE: 200,
  SEED_DECAY_RATE: 0.01,
  SEED_GERMINATION_WATER: 2.0,
  SEED_MAX_PER_CELL: 8,

  // Facilitation
  FACILITATION_BONUS: 0.25,         // photosynthesis boost per distinct neighbor archetype

  // Shade adaptation
  SHADE_HEIGHT_CUTOFF: 5.0,         // height above which shade tolerance drops to 0
  SHADE_THRESHOLD: 0.8,             // fraction of BASE_LIGHT below which shade tolerance activates
  SHADE_FLOOR: 0.3,                 // minimum shade tolerance strength under drought
  SHADE_LEAF_EFFICIENCY: 1.5,       // leafSize scaling for diffuse light capture in shade

  // Health EMA
  HEALTH_EMA_DECLINE_ALPHA: 0.25,   // smoothing speed for health decline
  HEALTH_EMA_RECOVERY_ALPHA: 0.12,  // smoothing speed for health recovery
  ENERGY_FLOOR_THRESHOLD: 0.6,      // energy below this forces visual decline

  // Visual senescence (health EMA age floor)
  VISUAL_SENESCENCE_ONSET: 0.85,    // fraction of maxAge when visual senescence begins

  // Wind stunting
  WIND_STUNT_WOODINESS: 2.0,        // wind × woodiness scaling for height cap reduction
  WIND_STUNT_LEAF_SIZE: 1.5,        // wind × leafSize scaling for leaf area cap reduction

  // Janzen-Connell effect
  JC_SUBTYPE_COEFF: 3.0,            // penalty strength near same-subtype adults
  JC_ARCHETYPE_COEFF: 1.0,          // penalty strength near same-archetype adults

  // Frequency-dependent selection
  FDS_STRENGTH: 2.5,                // how strongly frequency penalizes dominant subtypes
} as const;

export const GRASS = {
  MAX_HEIGHT: 2.0,
  MAX_ROOT_DEPTH: 3.0,
  MAX_LEAF_AREA: 4.0,

  MAINTENANCE_BASE: 0.02,
  MAINTENANCE_PER_HEIGHT: 0.02,
  MAINTENANCE_PER_ROOT: 0.02,
  MAINTENANCE_PER_LEAF: 0.03,

  SEED_ENERGY_COST: 0.4,
  SEED_RANGE_MAX: 4,
  SEED_RANGE_HEIGHT_DIVISOR: 4,
  SEED_INITIAL_ENERGY: 1.5,
  GROWTH_EFFICIENCY: 0.5,

  MAX_AGE: 750,
  SHADOW_REDUCTION: 0.05,
  SHADOW_HEIGHT_SCALE: 1.0,
  HEIGHT_LIGHT_BONUS: 0.1,

  DECOMP_WATER_BOOST: 1.0,
  DECOMP_NUTRIENT_BOOST: 0.8,
  DECOMP_NUTRIENT_PER_HEIGHT: 0.1,

  SEEDLING_HEIGHT: 0.3,
  SEEDLING_ROOT: 0.3,
  SEEDLING_LEAF: 0.5,

  // Seed bank (grass-specific overrides)
  SEED_MAX_AGE: 150,
  SEED_GERMINATION_WATER: 1.5,
} as const;

/** All archetype-dependent constants, interpolated by woodiness. */
export interface PlantConstants {
  maxHeight: number;
  maxRootDepth: number;
  maxLeafArea: number;
  maintenanceBase: number;
  maintenancePerHeight: number;
  maintenancePerRoot: number;
  maintenancePerLeaf: number;
  seedEnergyCost: number;
  seedRangeMax: number;
  seedRangeHeightDivisor: number;
  seedInitialEnergy: number;
  growthEfficiency: number;
  maxAge: number;
  shadowReduction: number;
  shadowHeightScale: number;
  heightLightBonus: number;
  decompWaterBoost: number;
  decompNutrientBoost: number;
  decompNutrientPerHeight: number;
  seedlingHeight: number;
  seedlingRoot: number;
  seedlingLeaf: number;
  seedMaxAge: number;
  seedGerminationWater: number;
}

function lerpVal(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Quantized cache for getPlantConstants — pure function of (woodiness, longevity),
// so cache never needs clearing. Bounded at ~10K entries (101×101 bins).
const _constantsCache = new Map<number, PlantConstants>();

/** Linearly interpolate all plant constants between herbaceous (w=0) and woody (w=1) endpoints. */
export function getPlantConstants(genome: import('./core').Genome): PlantConstants {
  const w = Math.max(0, Math.min(1, genome.woodiness));
  const lon = Math.max(0, Math.min(1, genome.longevity));
  const key = Math.round(w * 100) * 101 + Math.round(lon * 100);
  const cached = _constantsCache.get(key);
  if (cached) return cached;
  const maxAge = lerpVal(lerpVal(100, 200, w), lerpVal(1000, 2500, w), lon);
  const result: PlantConstants = {
    maxHeight: lerpVal(GRASS.MAX_HEIGHT, SIM.MAX_HEIGHT, w),
    maxRootDepth: lerpVal(GRASS.MAX_ROOT_DEPTH, SIM.MAX_ROOT_DEPTH, w),
    maxLeafArea: lerpVal(GRASS.MAX_LEAF_AREA, SIM.MAX_LEAF_AREA, w),
    maintenanceBase: lerpVal(GRASS.MAINTENANCE_BASE, SIM.MAINTENANCE_BASE, w),
    maintenancePerHeight: lerpVal(GRASS.MAINTENANCE_PER_HEIGHT, SIM.MAINTENANCE_PER_HEIGHT, w),
    maintenancePerRoot: lerpVal(GRASS.MAINTENANCE_PER_ROOT, SIM.MAINTENANCE_PER_ROOT, w),
    maintenancePerLeaf: lerpVal(GRASS.MAINTENANCE_PER_LEAF, SIM.MAINTENANCE_PER_LEAF, w),
    seedEnergyCost: lerpVal(GRASS.SEED_ENERGY_COST, SIM.SEED_ENERGY_COST, w),
    seedRangeMax: lerpVal(GRASS.SEED_RANGE_MAX, SIM.SEED_RANGE_MAX, w),
    seedRangeHeightDivisor: lerpVal(GRASS.SEED_RANGE_HEIGHT_DIVISOR, SIM.SEED_RANGE_HEIGHT_DIVISOR, w),
    seedInitialEnergy: lerpVal(GRASS.SEED_INITIAL_ENERGY, SIM.SEED_INITIAL_ENERGY, w),
    growthEfficiency: (lerpVal(GRASS.GROWTH_EFFICIENCY, SIM.GROWTH_EFFICIENCY, w)
      // Shrub growth efficiency bump: mid-woodiness plants grow faster, resisting drift to tree/grass
      + Math.max(0, 0.1 * (1 - Math.pow((w - 0.55) / 0.2, 2)))) * (1.3 - lon * 0.6),
    maxAge,
    shadowReduction: lerpVal(GRASS.SHADOW_REDUCTION, SIM.SHADOW_REDUCTION, w),
    shadowHeightScale: lerpVal(GRASS.SHADOW_HEIGHT_SCALE, SIM.SHADOW_HEIGHT_SCALE, w),
    heightLightBonus: lerpVal(GRASS.HEIGHT_LIGHT_BONUS, SIM.HEIGHT_LIGHT_BONUS, w),
    decompWaterBoost: lerpVal(GRASS.DECOMP_WATER_BOOST, SIM.DECOMP_WATER_BOOST, w),
    decompNutrientBoost: lerpVal(GRASS.DECOMP_NUTRIENT_BOOST, SIM.DECOMP_NUTRIENT_BOOST, w),
    decompNutrientPerHeight: lerpVal(GRASS.DECOMP_NUTRIENT_PER_HEIGHT, SIM.DECOMP_NUTRIENT_PER_HEIGHT, w),
    seedlingHeight: lerpVal(GRASS.SEEDLING_HEIGHT, 1, w),
    seedlingRoot: lerpVal(GRASS.SEEDLING_ROOT, 1, w),
    seedlingLeaf: lerpVal(GRASS.SEEDLING_LEAF, 1, w),
    seedMaxAge: lerpVal(GRASS.SEED_MAX_AGE, SIM.SEED_MAX_AGE, w),
    seedGerminationWater: lerpVal(GRASS.SEED_GERMINATION_WATER, SIM.SEED_GERMINATION_WATER, w),
  };
  _constantsCache.set(key, result);
  return result;
}

// ── Terrain property lookup table ──

export interface TerrainProperties {
  waterTable: number;
  lightBonus: number;
  establishmentTicks: number;
  vigorDampen: number;
  nutrientMax: number;
  plantable: boolean;
}

export const TERRAIN_PROPS: Record<TerrainType, TerrainProperties> = {
  [TerrainType.Soil]: {
    waterTable: SIM.SOIL_WATER_TABLE,
    lightBonus: 0,
    establishmentTicks: SIM.SOIL_ESTABLISHMENT_TICKS,
    vigorDampen: SIM.SOIL_VIGOR_DAMPEN,
    nutrientMax: SIM.MAX_NUTRIENTS,
    plantable: true,
  },
  [TerrainType.River]: {
    waterTable: SIM.SOIL_WATER_TABLE,
    lightBonus: 0,
    establishmentTicks: SIM.SOIL_ESTABLISHMENT_TICKS,
    vigorDampen: 0,
    nutrientMax: SIM.MAX_NUTRIENTS,
    plantable: false,
  },
  [TerrainType.Rock]: {
    waterTable: SIM.SOIL_WATER_TABLE,
    lightBonus: 0,
    establishmentTicks: SIM.SOIL_ESTABLISHMENT_TICKS,
    vigorDampen: 0,
    nutrientMax: SIM.ROCK_NUTRIENT_MAX,
    plantable: false,
  },
  [TerrainType.Hill]: {
    waterTable: SIM.HILL_WATER_TABLE,
    lightBonus: SIM.HILL_LIGHT_BONUS,
    establishmentTicks: SIM.HILL_ESTABLISHMENT_TICKS,
    vigorDampen: SIM.HILL_VIGOR_DAMPEN,
    nutrientMax: SIM.HILL_NUTRIENT_MAX,
    plantable: true,
  },
  [TerrainType.Wetland]: {
    waterTable: SIM.WETLAND_WATER_TABLE,
    lightBonus: 0,
    establishmentTicks: SIM.WETLAND_ESTABLISHMENT_TICKS,
    vigorDampen: SIM.WETLAND_VIGOR_DAMPEN,
    nutrientMax: SIM.WETLAND_NUTRIENT_MAX,
    plantable: true,
  },
  [TerrainType.Arid]: {
    waterTable: SIM.ARID_WATER_TABLE,
    lightBonus: SIM.ARID_LIGHT_BONUS,
    establishmentTicks: SIM.ARID_ESTABLISHMENT_TICKS,
    vigorDampen: SIM.ARID_VIGOR_DAMPEN,
    nutrientMax: SIM.ARID_NUTRIENT_MAX,
    plantable: true,
  },
};

