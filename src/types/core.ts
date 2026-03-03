import { Environment, EnvironmentEvent } from './environment';
import { Herbivore, HerbivoreDeathEvent, HerbivoreBirthEvent } from './herbivore';

export enum TerrainType {
  Soil = 0,
  River = 1,
  Rock = 2,
  Hill = 3,
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
  allelopathy: number;   // 0.01-0.99 — chemical suppression of neighbors
  defense: number;       // 0.01-0.99 — resistance to herbivore grazing
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
  deathEvents: DeathEvent[];
  seedsAttempted: number;
  environment: Environment;
  environmentEvents: EnvironmentEvent[];
  herbivores: Map<number, Herbivore>;
  nextHerbivoreId: number;
  herbivoreDeathEvents: HerbivoreDeathEvent[];
  herbivoreBirthEvents: HerbivoreBirthEvent[];
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

export interface SeedEvent {
  parentX: number;
  parentY: number;
  childX: number;
  childY: number;
  childId: number;
  speciesId: number;
}
