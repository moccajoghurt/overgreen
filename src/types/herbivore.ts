// ── Herbivore types & constants ──

export interface HerbivoreGenome {
  speed: number;        // 0.01..0.99 — movement probability per tick
  appetite: number;     // 0.01..0.99 — grazing amount multiplier
  herdInstinct: number; // 0.01..0.99 — attraction to nearby herbivores
  reproduction: number; // 0.01..0.99 — energy allocation toward breeding
}

export interface Herbivore {
  id: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  energy: number;
  age: number;
  alive: boolean;
  genome: HerbivoreGenome;
  facing: number; // radians, for rendering direction
  lastEnergyGained: number;
  lastMaintenanceCost: number;
}

export interface HerbivoreDeathEvent {
  id: number;
  x: number;
  y: number;
  cause: 'starvation' | 'age' | 'fire';
  age: number;
}

export interface HerbivoreBirthEvent {
  parentId: number;
  childId: number;
  x: number;
  y: number;
}

export const HERB = {
  // Initial
  INITIAL_COUNT: 12,
  INITIAL_ENERGY: 5,
  MAX_ENERGY: 20,

  // Grazing
  BASE_GRAZE_AMOUNT: 0.4,
  ENERGY_PER_LEAF: 1.5,
  MIN_LEAF_AFTER_GRAZE: 0.2,
  TRAMPLE_DAMAGE: 0.25,

  // Metabolism
  MAINTENANCE_BASE: 0.12,
  MAINTENANCE_PER_SPEED: 0.08,
  WINTER_MAINTENANCE_MULT: 1.2,

  // Movement
  MOVE_ENERGY_COST: 0.03,
  FOOD_SEARCH_RADIUS: 3,

  // Reproduction
  REPRODUCE_THRESHOLD: 12,
  REPRODUCE_COST: 6,
  CHILD_ENERGY: 4,
  MUTATION_RATE: 0.06,
  MIN_REPRODUCE_AGE: 30,

  // Death
  MAX_AGE: 400,
  STARVATION_THRESHOLD: 0,

  // Timing
  SPAWN_MIN_TICK: 200,
  RESPAWN_INTERVAL: 200,
  RESPAWN_COUNT: 12,
  MAX_POPULATION: 150,
} as const;
