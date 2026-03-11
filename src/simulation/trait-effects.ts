import { TerrainType, Genome } from '../types/core';
import { ClimateZone, CLIMATE_ZONE_COUNT } from '../types/environment';
import type { Environment } from '../types/environment';

// ── Layer 1: Environment Variables ──

interface TerrainPhysics {
  soilDepth: number;
  drainage: number;
  exposure: number;
  waterlogging: number;
}

interface ClimatePhysics {
  aridity: number;
  coldness: number;
  humidity: number;
  heat: number;
}

export interface CellEnvironment {
  droughtStress: number;
  frostRisk: number;
  diseasePressure: number;
  windExposure: number;
  waterlogging: number;
  heatStress: number;
}

const TERRAIN_PHYSICS: Record<TerrainType, TerrainPhysics> = {
  [TerrainType.Soil]:    { soilDepth: 0.9, drainage: 0.5, exposure: 0.3, waterlogging: 0.1 },
  [TerrainType.River]:   { soilDepth: 0.0, drainage: 0.0, exposure: 0.1, waterlogging: 1.0 },
  [TerrainType.Rock]:    { soilDepth: 0.05, drainage: 0.95, exposure: 0.6, waterlogging: 0.0 },
  [TerrainType.Hill]:    { soilDepth: 0.3, drainage: 0.7, exposure: 0.8, waterlogging: 0.0 },
  [TerrainType.Wetland]: { soilDepth: 0.7, drainage: 0.1, exposure: 0.2, waterlogging: 0.9 },
  [TerrainType.Arid]:    { soilDepth: 0.4, drainage: 0.9, exposure: 0.5, waterlogging: 0.0 },
};

const CLIMATE_PHYSICS: Record<ClimateZone, ClimatePhysics> = {
  [ClimateZone.Temperate]:     { aridity: 0.3, coldness: 0.6, humidity: 0.5, heat: 0.3 },
  [ClimateZone.Tropical]:      { aridity: 0.2, coldness: 0.0, humidity: 0.9, heat: 0.7 },
  [ClimateZone.Mediterranean]: { aridity: 0.5, coldness: 0.2, humidity: 0.3, heat: 0.5 },
  [ClimateZone.Desert]:        { aridity: 0.9, coldness: 0.3, humidity: 0.1, heat: 0.9 },
};

const TERRAIN_COUNT = 6;

function deriveCellEnv(tp: TerrainPhysics, cp: ClimatePhysics): CellEnvironment {
  return {
    droughtStress:   cp.aridity * tp.drainage,
    frostRisk:       cp.coldness * tp.exposure,
    diseasePressure: cp.humidity * (1 - tp.exposure),
    windExposure:    tp.exposure * (1 - cp.humidity * 0.3),
    waterlogging:    tp.waterlogging * cp.humidity,
    heatStress:      cp.heat * tp.exposure,
  };
}

// Pre-computed base environments: index = climateZone * TERRAIN_COUNT + terrainType
const BASE_ENV: CellEnvironment[] = new Array(CLIMATE_ZONE_COUNT * TERRAIN_COUNT);
for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
  for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
    BASE_ENV[cz * TERRAIN_COUNT + tt] = deriveCellEnv(
      TERRAIN_PHYSICS[tt as TerrainType],
      CLIMATE_PHYSICS[cz as ClimateZone],
    );
  }
}

// Mutable copy for seasonal modulation
export const EFFECTIVE_ENV: CellEnvironment[] = BASE_ENV.map(e => ({ ...e }));

export function getEffectiveEnv(climateZone: number, terrainType: number): CellEnvironment {
  return EFFECTIVE_ENV[climateZone * TERRAIN_COUNT + terrainType];
}

/** Called once per tick after computeSeasonModifiers(). */
export function updateEffectiveEnv(env: Environment): void {
  for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
    const zm = env.zoneModifiers[cz];
    for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
      const idx = cz * TERRAIN_COUNT + tt;
      const base = BASE_ENV[idx];
      const eff = EFFECTIVE_ENV[idx];
      eff.droughtStress   = base.droughtStress * zm.droughtMult;
      eff.frostRisk       = base.frostRisk * zm.frostMult;
      eff.heatStress      = base.heatStress * zm.droughtMult; // co-varies with drought
      eff.diseasePressure = base.diseasePressure;              // static
      eff.windExposure    = base.windExposure;                 // static
      eff.waterlogging    = base.waterlogging;                 // static
    }
  }
}

// ── Layer 2: Trait Tradeoff Table ──

type GenomeTrait = keyof Genome;
type EnvVar = keyof CellEnvironment;

interface TraitEffect {
  trait: GenomeTrait;
  envVar: EnvVar | null;
  coefficient: number;
  description: string;
}

const TRAIT_EFFECTS: TraitEffect[] = [
  // Leaf size
  { trait: 'leafSize',       envVar: null,             coefficient: +0.20, description: 'base light capture' },
  { trait: 'leafSize',       envVar: 'droughtStress',  coefficient: -0.35, description: 'transpiration loss' },
  { trait: 'leafSize',       envVar: 'frostRisk',      coefficient: -0.20, description: 'freeze damage' },
  { trait: 'leafSize',       envVar: 'heatStress',     coefficient: -0.15, description: 'heat scorching' },

  // Defense
  { trait: 'defense',        envVar: 'diseasePressure', coefficient: +0.50, description: 'disease resistance' },
  { trait: 'defense',        envVar: null,              coefficient: -0.08, description: 'metabolic cost of defensive tissue' },

  // Water storage
  { trait: 'waterStorage',   envVar: 'droughtStress',  coefficient: +0.50, description: 'drought buffer' },
  { trait: 'waterStorage',   envVar: 'heatStress',     coefficient: +0.15, description: 'evaporative cooling' },
  { trait: 'waterStorage',   envVar: 'frostRisk',      coefficient: -0.25, description: 'succulent tissue freezes' },
  { trait: 'waterStorage',   envVar: 'waterlogging',   coefficient: -0.40, description: 'redundant in saturated soil' },

  // Woodiness
  { trait: 'woodiness',      envVar: 'frostRisk',      coefficient: +0.25, description: 'bark insulates' },
  { trait: 'woodiness',      envVar: 'windExposure',   coefficient: +0.15, description: 'structural wind resistance' },
  { trait: 'woodiness',      envVar: 'waterlogging',   coefficient: -0.30, description: 'root rot' },
  { trait: 'woodiness',      envVar: 'droughtStress',  coefficient: -0.10, description: 'water-demanding tissue' },

  // Root priority
  { trait: 'rootPriority',   envVar: 'droughtStress',  coefficient: +0.30, description: 'deep water access' },
  { trait: 'rootPriority',   envVar: 'waterlogging',   coefficient: -0.30, description: 'root drowning' },

  // Height priority
  { trait: 'heightPriority', envVar: 'windExposure',   coefficient: -0.25, description: 'wind damage' },
  { trait: 'heightPriority', envVar: 'waterlogging',   coefficient: +0.20, description: 'flood escape' },

  // Longevity
  { trait: 'longevity',      envVar: null,              coefficient: +0.03, description: 'persistence advantage' },
  { trait: 'longevity',      envVar: 'droughtStress',   coefficient: -0.05, description: 'long-lived tissue costly in harsh conditions' },

  // Seed investment
  { trait: 'seedInvestment', envVar: null,              coefficient: -0.05, description: 'reproductive allocation reduces somatic performance' },
];

/** Compute the aggregate production modifier from genome × environment interaction. */
export function computeTraitModifier(genome: Genome, env: CellEnvironment): number {
  let modifier = 0;
  for (let i = 0; i < TRAIT_EFFECTS.length; i++) {
    const e = TRAIT_EFFECTS[i];
    const traitVal = genome[e.trait];
    const envVal = e.envVar !== null ? env[e.envVar] : 1;
    modifier += traitVal * envVal * e.coefficient;
  }
  return modifier;
}

/** Per-entry breakdown for the plant inspector. */
export function diagnoseTraitEffects(genome: Genome, env: CellEnvironment): Array<{
  trait: string; envVar: string | null; coefficient: number;
  traitVal: number; envVal: number; contribution: number; description: string;
}> {
  return TRAIT_EFFECTS.map(e => {
    const traitVal = genome[e.trait];
    const envVal = e.envVar !== null ? env[e.envVar] : 1;
    return {
      trait: e.trait,
      envVar: e.envVar,
      coefficient: e.coefficient,
      traitVal,
      envVal,
      contribution: traitVal * envVal * e.coefficient,
      description: e.description,
    };
  });
}
