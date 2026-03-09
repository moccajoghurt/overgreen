import { TerrainType, Genome, SpeciesColor } from './core';
import { ClimateZone } from './environment';

export interface ScenarioCell {
  x: number;
  y: number;
  terrain: TerrainType;
  elevation?: number;
  water?: number;
  waterRecharge?: number;
  nutrients?: number;
  climateZone?: ClimateZone;
}

export interface ScenarioSpecies {
  id: number;
  name: string;
  genome: Genome;
  color: SpeciesColor;
  placements: { x: number; y: number; height?: number; energy?: number; age?: number }[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  size: number;
  defaultTerrain: TerrainType;
  defaultElevation?: number;
  defaultZone?: ClimateZone;
  frozen?: boolean;
  cells: ScenarioCell[];
  species: ScenarioSpecies[];
}
