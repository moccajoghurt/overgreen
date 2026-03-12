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
  extremeAridity: number;
  tropicality: number;
  winterHarshness: number;
  seasonality: number;
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
  const droughtStress = cp.aridity * tp.drainage;
  // Ground heat: direct solar exposure + aridity-driven ground-level heat buildup.
  // On flat arid terrain, low wind (1-exposure) + low moisture (1-waterlogging) trap
  // intense radiative heat at ground level. Wind-exposed terrain (hills) stays cooler.
  const groundHeat = cp.heat * cp.aridity * (1 - tp.exposure) * (1 - tp.waterlogging) * 0.5;
  return {
    droughtStress,
    frostRisk:        cp.coldness * tp.exposure,
    diseasePressure:  cp.humidity * (1 - tp.exposure),
    windExposure:     tp.exposure * (1 - cp.humidity * 0.3),
    waterlogging:     tp.waterlogging * cp.humidity,
    heatStress:       cp.heat * tp.exposure + groundHeat,
    soilFertility:    tp.soilDepth * cp.humidity * (1 - tp.exposure * 0.5),
    extremeAridity:   Math.max(0, droughtStress - 0.35),
    // Composite climate axes — these create large gaps between climate zones
    // (4-7×) unlike terrain×climate products where terrain dominates.
    // Trop=0.63, Med=0.15, Temp=0.15, Desert=0.09
    tropicality:      cp.heat * cp.humidity,
    // Temp=0.42, Med=0.10, Desert=0.03, Trop=0.00
    winterHarshness:  cp.coldness * (1 - cp.heat),
    // Temp=0.69, Med=0.31, Desert=0.27, Trop=0.09
    seasonality:      (cp.coldness * 0.8 + (1 - cp.heat) * 0.3) * (1 - tp.exposure * 0.15),
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
      eff.diseasePressure  = base.diseasePressure;              // static
      eff.windExposure     = base.windExposure;                 // static
      eff.waterlogging     = base.waterlogging;                 // static
      eff.soilFertility    = base.soilFertility;               // static
      eff.extremeAridity   = Math.max(0, eff.droughtStress - 0.35); // derived from seasonal drought
      eff.tropicality      = base.tropicality;                  // static (climate-only)
      eff.winterHarshness  = base.winterHarshness;              // static (climate-only)
      eff.seasonality      = base.seasonality;                  // static
    }
  }
}

// ── Layer 2: Trait Tradeoff Table ──

type GenomeTrait = keyof Genome;
type EnvVar = keyof CellEnvironment;

interface TraitEffect {
  trait: GenomeTrait;
  trait2?: GenomeTrait;    // second trait for interaction terms (trait × trait2 × env)
  envVar: EnvVar | null;
  coefficient: number;
  inverse?: boolean;       // use (1 - traitVal) instead of traitVal
  inverse2?: boolean;      // use (1 - trait2Val)
  peaked?: number;         // tent function: max(0, 1 - 2*|trait - peaked|)
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

  // Defense — costly metabolic investment, essential where disease/herbivory thrives
  { trait: 'defense',        envVar: 'diseasePressure', coefficient: +0.70, description: 'disease resistance' },
  { trait: 'defense',        envVar: null,              coefficient: -0.35, description: 'metabolic cost of alkaloids, spines, and lignified tissue' },
  { trait: 'defense',        envVar: 'heatStress',      coefficient: +0.10, description: 'waxy coating provides minor heat protection' },
  { trait: 'defense',        envVar: 'soilFertility',   coefficient: -0.30, description: 'on fertile soil, fast undefended growth outcompetes slow defended growth' },
  { trait: 'defense',        envVar: 'waterlogging',    coefficient: -0.25, description: 'waterlogged soil leaches defensive chemicals; low herbivory pressure' },

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
  { trait: 'woodiness',      envVar: 'heatStress',     coefficient: -0.30, description: 'bark cracking and xylem desiccation in extreme heat' },
  { trait: 'woodiness',      envVar: 'windExposure',   coefficient: +0.20, inverse: true, description: 'flexible herbaceous stems resist wind' },
  { trait: 'woodiness',      envVar: 'waterlogging',   coefficient: -0.40, description: 'root rot in waterlogged soil' },
  { trait: 'woodiness',      envVar: 'droughtStress',  coefficient: -0.35, description: 'water-demanding woody tissue' },
  { trait: 'woodiness',      envVar: 'extremeAridity',  coefficient: -1.50, description: 'xylem cavitation and wood cracking in extreme desert' },

  // Root priority — deep roots mine nutrients and anchor plant, but drown in wetland
  { trait: 'rootPriority',   envVar: null,             coefficient: +0.10, description: 'nutrient mining and soil anchoring' },
  { trait: 'rootPriority',   envVar: 'droughtStress',  coefficient: +0.55, description: 'deep water access' },
  { trait: 'rootPriority',   envVar: 'windExposure',   coefficient: -0.20, description: 'deep taproots wind-levered in thin exposed soil' },
  { trait: 'rootPriority',   envVar: 'waterlogging',   coefficient: -0.40, description: 'root drowning' },
  { trait: 'rootPriority',   envVar: 'waterlogging',   coefficient: +0.30, inverse: true, description: 'shallow roots thrive in saturated soil' },
  { trait: 'rootPriority',   envVar: 'heatStress',     coefficient: -0.25, description: 'root zone overheating in hot exposed soil' },

  // Height priority — competitive light positioning, but costly in drought/frost/wind
  { trait: 'heightPriority', envVar: null,             coefficient: +0.04, description: 'competitive light positioning' },
  { trait: 'heightPriority', envVar: 'soilFertility',  coefficient: +0.20, description: 'tall plants compete for light on fertile soil' },
  { trait: 'heightPriority', envVar: 'windExposure',   coefficient: -0.35, description: 'wind damage to tall plants' },
  { trait: 'heightPriority', envVar: 'waterlogging',   coefficient: +0.30, description: 'flood escape' },
  { trait: 'heightPriority', envVar: 'heatStress',     coefficient: +0.20, description: 'tall columnar form radiates heat' },
  { trait: 'heightPriority', envVar: 'extremeAridity',  coefficient: +0.50, description: 'tall plants escape ground-level heat in extreme desert' },
  { trait: 'heightPriority', envVar: 'droughtStress',   coefficient: -0.40, description: 'tall plants need more water transported through longer xylem' },
  { trait: 'heightPriority', envVar: 'frostRisk',       coefficient: -0.25, description: 'tall structures exposed to frost; low growth forms trap insulating snow' },

  // Seed investment — r-strategy colonizers vs K-strategy persisters
  { trait: 'seedInvestment', envVar: null,              coefficient: -0.20, description: 'flowering and fruiting diverts energy from growth and maintenance' },
  { trait: 'seedInvestment', envVar: 'windExposure',   coefficient: +0.20, description: 'wind seed dispersal' },
  { trait: 'seedInvestment', envVar: 'soilFertility',  coefficient: +0.25, description: 'abundant resources make high reproductive investment viable — weedy r-strategy' },
  { trait: 'seedInvestment', envVar: 'droughtStress',  coefficient: -0.30, description: 'fruiting requires water; drought kills developing seeds' },
  { trait: 'seedInvestment', envVar: 'frostRisk',      coefficient: -0.25, description: 'frost kills flowers and developing seeds; narrow reproductive windows' },

  // Longevity — perennial persistence vs annual/ephemeral turnover
  { trait: 'longevity',      envVar: null,              coefficient: -0.10, description: 'maintaining long-lived tissue (structural reinforcement, DNA repair) is expensive' },
  { trait: 'longevity',      envVar: 'diseasePressure', coefficient: +0.20, description: 'long-lived plants accumulate pathogen resistance' },
  { trait: 'longevity',      envVar: 'droughtStress',   coefficient: +0.20, description: 'established perennial root networks persist through drought cycles' },
  { trait: 'longevity',      envVar: 'frostRisk',       coefficient: +0.15, description: 'perennials survive winters via dormancy and bark insulation' },
  { trait: 'longevity',      envVar: 'soilFertility',   coefficient: -0.25, description: 'on fertile soil, fast-growing annuals outcompete slow perennials' },
  { trait: 'longevity',      envVar: 'extremeAridity', inverse: true, coefficient: +0.30, description: 'short-lived ephemerals exploit brief desert rain windows' },

  // ── Tropicality axis — separates tropical from other climates ──
  { trait: 'leafSize',       envVar: 'tropicality',     coefficient: +0.50, description: 'lush foliage thrives in warm humid conditions' },
  { trait: 'defense',        envVar: 'tropicality',     coefficient: +0.40, description: 'chemical defenses essential against tropical herbivores and pathogens' },
  { trait: 'heightPriority', envVar: 'tropicality',     coefficient: +0.35, description: 'intense canopy competition in tropical forests' },
  { trait: 'waterStorage',   envVar: 'tropicality',     coefficient: -0.35, description: 'succulence unnecessary in humid tropics — wasted tissue' },
  { trait: 'rootPriority',   envVar: 'tropicality',     coefficient: -0.20, description: 'shallow lateral roots outperform taproots in tropical soils' },

  // ── Winter harshness axis — separates temperate from other climates ──
  { trait: 'woodiness',      envVar: 'winterHarshness', coefficient: +0.40, description: 'woody perennials survive winter dormancy' },
  { trait: 'waterStorage',   envVar: 'winterHarshness', coefficient: -0.45, description: 'succulent tissue destroyed by freeze-thaw cycles' },
  { trait: 'longevity',      envVar: 'winterHarshness', coefficient: +0.25, description: 'long-lived perennials amortize winter survival investment' },
  { trait: 'leafSize',       envVar: 'winterHarshness', coefficient: -0.25, description: 'deciduous leaf loss — large leaves are costly to regrow each spring' },

  // ── Seasonality axis — separates deciduous/annual from evergreen/perennial ──
  { trait: 'longevity',      envVar: 'seasonality',    coefficient: +0.30, description: 'perennials survive seasonal dormancy; amortize winter survival structures' },
  { trait: 'woodiness',      envVar: 'seasonality',    coefficient: +0.25, description: 'woody tissue persists through seasons; herbaceous must regrow each spring' },
  { trait: 'seedInvestment', envVar: 'seasonality',    coefficient: -0.20, description: 'narrow reproductive windows waste high seed allocation in seasonal climates' },
  { trait: 'leafSize',       envVar: 'seasonality',    coefficient: -0.20, description: 'large leaves costly to regrow each spring; vulnerable to late frosts' },
  { trait: 'waterStorage',   envVar: 'seasonality',    coefficient: -0.15, description: 'freeze-thaw cycles damage succulent water-storing tissue' },

  // ── Trait interaction terms ──
  // These create multiple fitness peaks within the same niche by rewarding specific
  // COMBINATIONS of traits. A linear sum of single-trait effects has at most one peak;
  // trait×trait products create saddle points that split evolution into distinct strategies.

  // Arid/drought specialization: two competing succulent strategies
  // Rosette succulent (Aloe): leafy + water-storing, undefended
  { trait: 'leafSize', trait2: 'waterStorage', envVar: 'droughtStress', coefficient: +0.80,
    description: 'fleshy rosette leaves store water and photosynthesize in drought' },
  // Armored succulent (Barrel Cactus/Saguaro): defended + water-storing, leafless
  { trait: 'defense', trait2: 'waterStorage', envVar: 'droughtStress', coefficient: +0.80,
    description: 'armored water-storing body survives extreme drought exposure' },
  // These are mutually exclusive: high leafSize×waterStorage vs high defense×waterStorage
  // push genomes toward either the Aloe or Barrel Cactus classifier profile

  // Tropical forest specialization: two competing tree strategies
  // Canopy tree (Tropical): tall + defensive, broad-leaved
  { trait: 'heightPriority', trait2: 'defense', envVar: 'tropicality', coefficient: +0.70,
    description: 'tall defended canopy trees dominate tropical forests' },
  // Pioneer/colonizer (Birch/Palm): tall + reproductive, fast turnover
  { trait: 'heightPriority', trait2: 'seedInvestment', envVar: 'tropicality', coefficient: +0.50,
    description: 'fast-growing gap colonizers thrive in tropical disturbance cycles' },

  // Arid tree specialization: two competing strategies
  // Acacia: defended + deep-rooted, small-leaved
  { trait: 'defense', trait2: 'rootPriority', envVar: 'extremeAridity', coefficient: +0.90,
    description: 'thorny deep-rooted trees tap groundwater in arid environments' },
  // Cypress/columnar: tall + woody, narrow form
  { trait: 'heightPriority', trait2: 'woodiness', envVar: 'droughtStress', coefficient: +0.40,
    description: 'tall columnar wood escapes ground-level heat and accesses light' },

  // Wetland specialization: two competing strategies
  // Mangrove/shallow-root shrub: tall + shallow-rooted, flood-adapted
  { trait: 'heightPriority', trait2: 'rootPriority', inverse2: true, envVar: 'waterlogging', coefficient: +0.60,
    description: 'prop-root shrubs grow above waterline without deep roots' },
  // Sedge/rush: leafy + shallow-rooted, ground-level
  { trait: 'leafSize', trait2: 'rootPriority', inverse2: true, envVar: 'waterlogging', coefficient: +0.50,
    description: 'leafy shallow-rooted plants exploit saturated surface soil' },

  // Mediterranean specialization: fire-adapted vs drought-tolerant
  // Mediterranean shrub: woody + water-storing (thick bark, drought-hardy)
  { trait: 'woodiness', trait2: 'waterStorage', envVar: 'heatStress', coefficient: +0.50,
    description: 'woody drought-hardy scrub with thick bark survives Mediterranean summers' },
  // Aromatic/compact shrub: defensive + long-lived (chemical defense, persistence)
  { trait: 'defense', trait2: 'longevity', envVar: 'heatStress', coefficient: +0.40,
    description: 'aromatic defensive chemistry deters herbivores in open dry scrubland' },
];

/** Niche index for a terrain×climate combination. */
export function getEnvIdx(climateZone: number, terrainType: number): number {
  return climateZone * TERRAIN_COUNT + terrainType;
}

export const NICHE_COUNT = CLIMATE_ZONE_COUNT * TERRAIN_COUNT;

/** Evaluate a single trait value, handling inverse and peaked modes. */
function evalTrait(genome: Genome, trait: GenomeTrait, inverse?: boolean, peaked?: number): number {
  const raw = inverse ? 1 - genome[trait] : genome[trait];
  if (peaked !== undefined) return Math.max(0, 1 - 2 * Math.abs(raw - peaked));
  return raw;
}

/** Compute the aggregate production modifier from genome × environment interaction. */
export function computeTraitModifier(genome: Genome, env: CellEnvironment): number {
  let modifier = 0;
  for (let i = 0; i < TRAIT_EFFECTS.length; i++) {
    const e = TRAIT_EFFECTS[i];
    const t1 = evalTrait(genome, e.trait, e.inverse, e.peaked);
    const t2 = e.trait2 !== undefined ? evalTrait(genome, e.trait2, e.inverse2) : 1;
    const envVal = e.envVar !== null ? env[e.envVar] : 1;
    modifier += t1 * t2 * envVal * e.coefficient;
  }
  return modifier;
}

/** Per-entry breakdown for the plant inspector. */
export function diagnoseTraitEffects(genome: Genome, env: CellEnvironment): Array<{
  trait: string; envVar: string | null; coefficient: number;
  traitVal: number; envVal: number; contribution: number; description: string;
}> {
  return TRAIT_EFFECTS.map(e => {
    const t1 = evalTrait(genome, e.trait, e.inverse, e.peaked);
    const t2 = e.trait2 !== undefined ? evalTrait(genome, e.trait2, e.inverse2) : 1;
    const envVal = e.envVar !== null ? env[e.envVar] : 1;
    const traitVal = t1 * t2;
    const traitLabel = e.trait2
      ? `${e.inverse ? '(1-' + e.trait + ')' : e.trait}×${e.inverse2 ? '(1-' + e.trait2 + ')' : e.trait2}`
      : (e.inverse ? `(1-${e.trait})` : e.trait);
    return {
      trait: traitLabel,
      envVar: e.envVar,
      coefficient: e.coefficient,
      traitVal,
      envVal,
      contribution: traitVal * envVal * e.coefficient,
      description: e.description,
    };
  });
}
