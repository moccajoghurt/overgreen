import { TerrainType, Genome, SpeciesColor } from './core';
import { ClimateEra } from './environment';

export interface ScenarioCell {
  x: number;
  y: number;
  terrain: TerrainType;
  elevation?: number;
  water?: number;
  waterRecharge?: number;
  nutrients?: number;
}

export interface ScenarioSpecies {
  id: number;
  name: string;
  genome: Genome;
  color: SpeciesColor;
  placements: { x: number; y: number }[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  size: number;
  defaultTerrain: TerrainType;
  defaultElevation?: number;
  cells: ScenarioCell[];
  species: ScenarioSpecies[];
  lockedEra?: ClimateEra;
}
