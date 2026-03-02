// ── Seasons / Environment ──

export const enum WeatherOverlay {
  None = 0,
  Drought = 1,
  Burning = 2,
  Scorched = 3,
  Parched = 4,
  Diseased = 5,
  Blighted = 6,
}

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

export interface DiseaseEvent {
  targetGenome: { rootPriority: number; heightPriority: number; leafSize: number; seedInvestment: number };
  cells: Map<string, number>; // "x,y" -> ticks remaining per cell
  ticksRemaining: number;
  originX: number;
  originY: number;
  patientZeroSpeciesId: number;
  killCount: number;
}

export interface Environment {
  season: Season;
  seasonProgress: number; // 0-1 within current season
  yearCount: number;
  waterMult: number;
  lightMult: number;
  leafMaintenanceMult: number;
  growthMult: number;
  seedMult: number;
  leafDecayRate: number;
  droughts: DroughtPatch[];
  fires: FireEvent[];
  diseases: DiseaseEvent[];
  scorchedCells: Map<string, number>; // "x,y" -> ticks remaining
  parchedCells: Map<string, number>;  // "x,y" -> ticks remaining
  diseasedCells: Map<string, number>; // "x,y" -> ticks remaining (blight scar)
  weatherOverlay: Uint8Array; // GRID_WIDTH * GRID_HEIGHT, 0=normal 1=drought 2=burning 3=scorched 4=parched 5=diseased 6=blight scar
}

export interface EnvironmentEvent {
  type: 'season_change' | 'drought_start' | 'drought_end' | 'fire_start' | 'fire_end' | 'disease_start' | 'disease_end';
  message: string;
}
