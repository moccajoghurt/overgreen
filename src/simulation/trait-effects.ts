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
  soilFertility: number;
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
    soilFertility:   tp.soilDepth * cp.humidity * (1 - tp.exposure * 0.5),
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
      eff.soilFertility   = base.soilFertility;               // static
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
  inverse?: boolean; // use (1 - traitVal) instead of traitVal
  description: string;
}

const TRAIT_EFFECTS: TraitEffect[] = [
  // Leaf size — big leaves capture light but are vulnerable to stress
  { trait: 'leafSize',       envVar: null,             coefficient: +0.22, description: 'base light capture' },
  { trait: 'leafSize',       envVar: 'soilFertility',  coefficient: +0.60, description: 'big leaves thrive on fertile soil' },
  { trait: 'leafSize',       envVar: 'soilFertility',  coefficient: -0.30, inverse: true, description: 'small leaves can\'t capture light on fertile soil' },
  { trait: 'leafSize',       envVar: 'waterlogging',   coefficient: +0.25, description: 'lush growth in saturated soil' },
  { trait: 'leafSize',       envVar: 'droughtStress',  coefficient: -0.50, description: 'transpiration loss' },
  { trait: 'leafSize',       envVar: 'frostRisk',      coefficient: -0.30, description: 'freeze damage' },
  { trait: 'leafSize',       envVar: 'heatStress',     coefficient: -0.25, description: 'heat scorching' },
  { trait: 'leafSize',       envVar: 'diseasePressure', coefficient: -0.30, description: 'large leaves catch disease' },
  { trait: 'leafSize',       envVar: 'windExposure',   coefficient: -0.20, description: 'wind strips foliage on broad-leaved plants' },

  // Defense — costly but essential where disease thrives
  { trait: 'defense',        envVar: 'diseasePressure', coefficient: +0.70, description: 'disease resistance' },
  { trait: 'defense',        envVar: null,              coefficient: -0.25, description: 'metabolic cost of defensive tissue' },

  // Water storage — critical in drought, liability in frost/wetland/wind
  { trait: 'waterStorage',   envVar: 'droughtStress',  coefficient: +0.70, description: 'drought buffer' },
  { trait: 'waterStorage',   envVar: 'heatStress',     coefficient: +0.25, description: 'evaporative cooling' },
  { trait: 'waterStorage',   envVar: 'frostRisk',      coefficient: -0.40, description: 'succulent tissue freezes' },
  { trait: 'waterStorage',   envVar: 'waterlogging',   coefficient: -0.50, description: 'redundant in saturated soil' },
  { trait: 'waterStorage',   envVar: 'windExposure',   coefficient: -0.35, description: 'wind desiccation of exposed succulent tissue' },

  // Woodiness — structural support enables efficient photosynthesis, but rigid structures suffer in wind/water
  { trait: 'woodiness',      envVar: null,             coefficient: +0.12, description: 'structural support for canopy' },
  { trait: 'woodiness',      envVar: 'soilFertility',  coefficient: +0.25, description: 'woody investment pays off on fertile soil' },
  { trait: 'woodiness',      envVar: 'frostRisk',      coefficient: +0.15, description: 'bark insulates' },
  { trait: 'woodiness',      envVar: 'windExposure',   coefficient: -0.70, description: 'rigid trunks snap in wind' },
  { trait: 'woodiness',      envVar: 'windExposure',   coefficient: +0.20, inverse: true, description: 'flexible herbaceous stems resist wind' },
  { trait: 'woodiness',      envVar: 'waterlogging',   coefficient: -0.40, description: 'root rot in waterlogged soil' },
  { trait: 'woodiness',      envVar: 'droughtStress',  coefficient: -0.15, description: 'water-demanding woody tissue' },

  // Root priority — deep roots mine nutrients and anchor plant, but drown in wetland
  { trait: 'rootPriority',   envVar: null,             coefficient: +0.10, description: 'nutrient mining and soil anchoring' },
  { trait: 'rootPriority',   envVar: 'droughtStress',  coefficient: +0.55, description: 'deep water access' },
  { trait: 'rootPriority',   envVar: 'windExposure',   coefficient: -0.20, description: 'deep taproots wind-levered in thin exposed soil' },
  { trait: 'rootPriority',   envVar: 'waterlogging',   coefficient: -0.40, description: 'root drowning' },
  { trait: 'rootPriority',   envVar: 'waterlogging',   coefficient: +0.30, inverse: true, description: 'shallow roots thrive in saturated soil' },

  // Height priority — competitive light positioning, but wind destroys tall plants
  { trait: 'heightPriority', envVar: null,             coefficient: +0.06, description: 'competitive light positioning' },
  { trait: 'heightPriority', envVar: 'soilFertility',  coefficient: +0.30, description: 'tall plants compete for light on fertile soil' },
  { trait: 'heightPriority', envVar: 'windExposure',   coefficient: -0.35, description: 'wind damage to tall plants' },
  { trait: 'heightPriority', envVar: 'waterlogging',   coefficient: +0.30, description: 'flood escape' },

  // Seed investment — colonizers exploit harsh niches via rapid reproduction
  { trait: 'seedInvestment', envVar: 'windExposure',   coefficient: +0.20, description: 'wind seed dispersal' },
  { trait: 'seedInvestment', envVar: null,              coefficient: -0.06, description: 'reproductive allocation reduces somatic performance' },

  // Longevity — persistence advantage but costly in harsh environments
  { trait: 'longevity',      envVar: null,              coefficient: +0.01, description: 'persistence advantage' },
  { trait: 'longevity',      envVar: 'diseasePressure', coefficient: +0.08, description: 'evolved immune system in disease-rich environments' },
  { trait: 'longevity',      envVar: 'droughtStress',   coefficient: +0.05, description: 'established perennial root networks resist drought' },
  { trait: 'longevity',      envVar: 'frostRisk',       coefficient: -0.10, description: 'frost damages accumulated long-lived tissue' },
];

/** Compute the aggregate production modifier from genome × environment interaction. */
export function computeTraitModifier(genome: Genome, env: CellEnvironment): number {
  let modifier = 0;
  for (let i = 0; i < TRAIT_EFFECTS.length; i++) {
    const e = TRAIT_EFFECTS[i];
    const traitVal = e.inverse ? 1 - genome[e.trait] : genome[e.trait];
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
    const traitVal = e.inverse ? 1 - genome[e.trait] : genome[e.trait];
    const envVal = e.envVar !== null ? env[e.envVar] : 1;
    return {
      trait: e.inverse ? `(1-${e.trait})` : e.trait,
      envVar: e.envVar,
      coefficient: e.coefficient,
      traitVal,
      envVal,
      contribution: traitVal * envVal * e.coefficient,
      description: e.description,
    };
  });
}
