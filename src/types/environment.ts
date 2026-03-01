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
