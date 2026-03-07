import { Environment, EnvironmentEvent } from './environment';
import { Herbivore, HerbivoreDeathEvent, HerbivoreBirthEvent } from './herbivore';

export enum TerrainType {
  Soil = 0,
  River = 1,
  Rock = 2,
  Hill = 3,
  Wetland = 4,
  Arid = 5,
}

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
  seedSize: number;      // 0.01-0.99 — small (many cheap) to large (few expensive) seeds
  defense: number;       // 0.01-0.99 — resistance to herbivore grazing
  woodiness: number;     // 0.01-0.99 — herbaceous (low) to woody/tree-like (high)
  waterStorage: number;  // 0.01-0.99 — internal water tank capacity
  longevity: number;     // 0.01-0.99 — short-lived annual (low) to long-lived perennial (high)
}

export const enum Archetype { Grass, Shrub, Succulent, Tree }

/** Classify a genome into one of four archetypes. Pure function of genome. */
export function archetype(genome: Genome): Archetype {
  if (genome.woodiness < 0.4) return Archetype.Grass;
  if (genome.waterStorage >= 0.55) return Archetype.Succulent;
  if (genome.woodiness <= 0.7) return Archetype.Shrub;
  return Archetype.Tree;
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
  causeOfDeath?: 'fire' | 'disease';
  lastLightReceived: number;
  lastWaterAbsorbed: number;
  lastEnergyProduced: number;
  lastMaintenanceCost: number;
  isDiseased: boolean;
  storedWater: number;
  generation: number;
  parentId: number | null;
  offspringCount: number;
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
  seeds: Seed[];
}

export interface SpeciesCentroid {
  sumRoot: number;
  sumHeight: number;
  sumLeaf: number;
  sumSeed: number;
  sumSeedSize: number;
  sumDefense: number;
  sumWoodiness: number;
  sumWaterStorage: number;
  sumLongevity: number;
  count: number;
  foundingGenome: Genome;
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
  seedLandingEvents: SeedLandingEvent[];
  germinationEvents: GerminationEvent[];
  fireDeathEvents: FireDeathEvent[];
  deathEvents: DeathEvent[];
  seedsAttempted: number;
  seedPopulations: Map<number, number>;
  environment: Environment;
  environmentEvents: EnvironmentEvent[];
  herbivores: Map<number, Herbivore>;
  nextHerbivoreId: number;
  herbivoreDeathEvents: HerbivoreDeathEvent[];
  herbivoreBirthEvents: HerbivoreBirthEvent[];
  speciesCentroids: Map<number, SpeciesCentroid>;
  speciationEvents: SpeciationEvent[];
  speciesSubtypes: Map<number, number>;
  speciesLineage: Map<number, number>;  // childSpeciesId → parentSpeciesId
}

export interface DeathEvent {
  id: number;
  speciesId: number;
  cause: 'starvation' | 'age' | 'fire' | 'disease';
  age: number;
  offspringCount: number;
  generation: number;
}

export interface FireDeathEvent {
  id: number;
  x: number; y: number;
  height: number; rootDepth: number; leafArea: number;
  speciesId: number; genome: Genome;
}

export interface Seed {
  speciesId: number;
  genome: Genome;
  energy: number;
  age: number;
  generation: number;
}

export interface SeedLandingEvent {
  parentX: number;
  parentY: number;
  childX: number;
  childY: number;
  speciesId: number;
  woodiness: number;
}

export interface GerminationEvent {
  x: number;
  y: number;
  plantId: number;
  speciesId: number;
  woodiness: number;
}

export interface SpeciationEvent {
  newSpeciesId: number;
  parentSpeciesId: number;
  newSpeciesName: string;
}
