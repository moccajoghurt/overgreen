export const GRID_WIDTH = 80;
export const GRID_HEIGHT = 80;

export enum TerrainType {
  Soil = 0,
  River = 1,
  Rock = 2,
  Hill = 3,
}

export const SIM = {
  // Water
  BASE_WATER_RECHARGE: 0.4,
  MAX_WATER: 10.0,
  WATER_ABSORPTION_PER_ROOT: 0.4,
  TRANSPIRATION_PER_LEAF: 0.2,

  // Nutrients
  MAX_NUTRIENTS: 10.0,
  NUTRIENT_GROWTH_BONUS: 0.15,
  NUTRIENT_DECAY: 0.02,

  // Light
  BASE_LIGHT: 1.0,
  SHADOW_REDUCTION: 0.15,
  MIN_LIGHT: 0.1,

  // Energy / Photosynthesis
  PHOTOSYNTHESIS_RATE: 0.5,
  MAINTENANCE_BASE: 0.05,
  MAINTENANCE_PER_HEIGHT: 0.05,
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
  SEED_INITIAL_ENERGY: 2.0,
  MUTATION_RATE: 0.05,

  // Death / Decomposition
  STARVATION_THRESHOLD: 0,
  DECOMP_WATER_BOOST: 2.0,
  DECOMP_NUTRIENT_BOOST: 1.5,
  DECOMP_NUTRIENT_PER_HEIGHT: 0.3,

  // Age
  MAX_AGE: 500,

  // Terrain
  RIVER_WATER_RECHARGE: 1.2,
  ROCK_WATER_RECHARGE: 0.08,
  ROCK_NUTRIENT_MAX: 0.5,
  HILL_LIGHT_BONUS: 0.15,
  HILL_WATER_PENALTY: 0.7,
  RIVER_SEEPAGE: 0.15,
  RIVER_NUTRIENT_BONUS: 2.0,
} as const;

export interface SpeciesColor {
  r: number;
  g: number;
  b: number;
}

export interface Genome {
  rootPriority: number;
  heightPriority: number;
  leafSize: number;
  seedInvestment: number;
}

export interface Plant {
  id: number;
  speciesId: number;
  x: number;
  y: number;
  height: number;
  rootDepth: number;
  leafArea: number;
  energy: number;
  age: number;
  genome: Genome;
  alive: boolean;
  causeOfDeath?: 'fire';
  lastLightReceived: number;
  lastWaterAbsorbed: number;
  lastEnergyProduced: number;
  lastMaintenanceCost: number;
}

export interface Cell {
  x: number;
  y: number;
  elevation: number;
  terrainType: TerrainType;
  waterLevel: number;
  waterRechargeRate: number;
  nutrients: number;
  lightLevel: number;
  plantId: number | null;
  lastSpeciesId: number | null;
}

export interface World {
  width: number;
  height: number;
  grid: Cell[][];
  plants: Map<number, Plant>;
  tick: number;
  nextPlantId: number;
  nextSpeciesId: number;
  speciesColors: Map<number, SpeciesColor>;
  speciesNames: Map<number, string>;
  seedEvents: SeedEvent[];
  fireDeathEvents: FireDeathEvent[];
  environment: Environment;
  environmentEvents: EnvironmentEvent[];
}

export interface FireDeathEvent {
  id: number;
  x: number; y: number;
  height: number; rootDepth: number; leafArea: number;
  speciesId: number; genome: Genome;
}

export interface SeedEvent {
  parentX: number;
  parentY: number;
  childX: number;
  childY: number;
  childId: number;
  speciesId: number;
}

export interface Renderer {
  render(selectedCell: { x: number; y: number } | null): void;
  cellAt(canvasX: number, canvasY: number): { x: number; y: number } | null;
  projectToScreen(gridX: number, gridY: number): { x: number; y: number } | null;
}

// ── Seasons / Environment ──

export enum Season {
  Spring = 0,
  Summer = 1,
  Autumn = 2,
  Winter = 3,
}

export const SEASON_LENGTH = 125;
export const YEAR_LENGTH = 500;

export const SEASON_NAMES: Record<Season, string> = {
  [Season.Spring]: 'Spring',
  [Season.Summer]: 'Summer',
  [Season.Autumn]: 'Autumn',
  [Season.Winter]: 'Winter',
};

export interface DroughtPatch {
  centerX: number;
  centerY: number;
  radius: number;
  intensity: number; // 0-1
  ticksRemaining: number;
}

export interface FireEvent {
  cells: Map<string, number>; // "x,y" -> burn ticks remaining per cell
  ticksRemaining: number;    // overall fire duration (controls spreading)
}

export interface Environment {
  season: Season;
  seasonProgress: number; // 0-1 within current season
  yearCount: number;
  waterMult: number;
  lightMult: number;
  leafMaintenanceMult: number;
  droughts: DroughtPatch[];
  fires: FireEvent[];
  scorchedCells: Map<string, number>; // "x,y" -> ticks remaining
  parchedCells: Map<string, number>;  // "x,y" -> ticks remaining
  weatherOverlay: Uint8Array; // GRID_WIDTH * GRID_HEIGHT, 0=normal 1=drought 2=burning 3=scorched 4=parched
}

export interface EnvironmentEvent {
  type: 'season_change' | 'drought_start' | 'drought_end' | 'fire_start' | 'fire_end';
  message: string;
}

// ── History / Analytics ──

export interface TickSnapshot {
  tick: number;
  populations: Map<number, number>; // speciesId → alive count
  traitAverages: { root: number; height: number; leaf: number; seed: number };
}

export interface SpeciesRecord {
  speciesId: number;
  firstSeenTick: number;
  lastSeenTick: number;
  maxPopulation: number;
  maxPopulationTick: number;
  extinct: boolean;
}

export type SimEventType =
  | 'extinction'
  | 'population_record'
  | 'notable_age'
  | 'dominance_shift'
  | 'mass_extinction'
  | 'season_change'
  | 'drought_start'
  | 'drought_end'
  | 'fire_start'
  | 'fire_end';

export interface SimEvent {
  tick: number;
  type: SimEventType;
  message: string;
  speciesId?: number;
}

export interface History {
  snapshots: TickSnapshot[];
  species: Map<number, SpeciesRecord>;
  events: SimEvent[];
  eventSeq: number;
  prevPopulations: Map<number, number>;
  prevDominant: number | null;
  firedAgeMilestones: Set<string>; // "speciesId-threshold"
  firedPopMilestones: Set<string>; // "speciesId-threshold"
}
