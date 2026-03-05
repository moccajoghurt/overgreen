// ── History / Analytics ──

export type TraitAverages = { root: number; height: number; leaf: number; seed: number; sz: number; def: number; wood: number };
export type TerrainCounts = { soil: number; hill: number; wetland: number; arid: number };

export interface TickSnapshot {
  tick: number;
  populations: Map<number, number>; // speciesId → alive count
  traitAverages: TraitAverages;
  speciesTraitAverages: Map<number, TraitAverages>;
  speciesMaxGeneration: Map<number, number>;
  speciesTerrainCounts: Map<number, TerrainCounts>;
  herbivoreCount: number;
}

export interface SpeciesRecord {
  speciesId: number;
  firstSeenTick: number;
  lastSeenTick: number;
  maxPopulation: number;
  maxPopulationTick: number;
  extinct: boolean;
  maxGeneration: number;
  totalOffspring: number;
  totalDeaths: number;
}

export type SimEventType =
  | 'extinction'
  | 'population_record'
  | 'notable_age'
  | 'dominance_shift'
  | 'mass_extinction'
  | 'season_change'
  | 'era_change'
  | 'drought_start'
  | 'drought_end'
  | 'fire_start'
  | 'fire_end'
  | 'disease_start'
  | 'disease_end'
  | 'herbivore_spawn'
  | 'herbivore_boom'
  | 'herbivore_crash';

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
  prevHerbivoreCount: number;
}
