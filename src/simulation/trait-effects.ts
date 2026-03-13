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
  shallowSoil: number;
}

const TERRAIN_PHYSICS: Record<TerrainType, TerrainPhysics> = {
  [TerrainType.Soil]:    { soilDepth: 0.9, drainage: 0.5, exposure: 0.15, waterlogging: 0.1 },
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
    windExposure:     tp.exposure * (1 - cp.humidity * 0.5),
    waterlogging:     tp.waterlogging * cp.humidity,
    heatStress:       cp.heat * tp.exposure + groundHeat,
    soilFertility:    tp.soilDepth * cp.humidity * (1 - tp.exposure * 0.5),
    extremeAridity:   Math.max(0, droughtStress - 0.35),
    // Composite climate axes — these create large gaps between climate zones
    // (4-7×) unlike terrain×climate products where terrain dominates.
    // Power scaling creates sharp separation: Trop=0.50, Med=0.06, Temp=0.06, Desert=0.03
    tropicality:      Math.pow(cp.heat * cp.humidity, 1.5),
    // Temp=0.42, Med=0.10, Desert=0.03, Trop=0.00
    winterHarshness:  cp.coldness * (1 - cp.heat),
    // Temp=0.69, Med=0.31, Desert=0.27, Trop=0.09
    seasonality:      (cp.coldness * 0.8 + (1 - cp.heat) * 0.3) * (1 - tp.exposure * 0.15),
    // Soil=0.1, Hill=0.7, Wetland=0.3, Arid=0.6 — penalizes deep-rooted woody plants
    shallowSoil:      1 - tp.soilDepth,
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
      eff.shallowSoil      = base.shallowSoil;                  // static (terrain-only)
    }
  }
  recompileTraitEffects();
}

// ── Layer 2: Trait Tradeoff Table ──

type GenomeTrait = keyof Genome;
type EnvVar = keyof CellEnvironment;

interface TraitEffect {
  trait: GenomeTrait;
  trait2?: GenomeTrait;    // second trait for interaction terms (trait × trait2 × env)
  trait3?: GenomeTrait;    // third trait for 3-way interactions (trait × trait2 × trait3 × env)
  envVar: EnvVar | null;
  coefficient: number;
  inverse?: boolean;       // use (1 - traitVal) instead of traitVal
  inverse2?: boolean;      // use (1 - trait2Val)
  inverse3?: boolean;      // use (1 - trait3Val)
  peaked?: number;         // tent function: max(0, 1 - 2*|trait - peaked|)
  description: string;
}

const TRAIT_EFFECTS: TraitEffect[] = [
  // ── Leaf size — big leaves capture light but are vulnerable to stress ──
  { trait: 'leafSize',       envVar: null,             coefficient: +0.15, description: 'base light capture' },
  { trait: 'leafSize',       envVar: 'soilFertility',  coefficient: +0.80, description: 'big leaves thrive on fertile soil' },
  { trait: 'leafSize',       envVar: 'soilFertility',  coefficient: -0.40, inverse: true, description: 'small leaves can\'t capture light on fertile soil' },
  { trait: 'leafSize',       envVar: 'waterlogging',   coefficient: +0.55, description: 'lush growth in saturated soil' },
  { trait: 'leafSize',       envVar: 'droughtStress',  coefficient: -0.55, description: 'transpiration loss' },
  { trait: 'leafSize',       envVar: 'frostRisk',      coefficient: -0.30, description: 'freeze damage' },
  { trait: 'leafSize',       envVar: 'heatStress',     coefficient: -0.25, description: 'heat scorching' },
  { trait: 'leafSize',       envVar: 'diseasePressure', coefficient: -0.30, description: 'large leaves catch disease' },
  { trait: 'leafSize',       envVar: 'windExposure',   coefficient: -0.40, description: 'wind strips foliage on broad-leaved plants' },
  { trait: 'leafSize',       envVar: 'windExposure',   coefficient: +0.25, inverse: true, description: 'narrow-leaved plants are aerodynamic — low wind resistance' },

  // ── Defense — costly but essential where disease thrives ──
  { trait: 'defense',        envVar: 'diseasePressure', coefficient: +0.70, description: 'disease resistance' },
  { trait: 'defense',        envVar: null,              coefficient: -0.38, description: 'metabolic cost of defensive tissue' },
  { trait: 'defense',        envVar: 'heatStress',      coefficient: +0.30, description: 'spines and waxy coating provide sun/heat protection' },
  { trait: 'defense',        envVar: 'droughtStress',   coefficient: +0.50, description: 'thorns and thick bark reduce water loss in drought' },
  { trait: 'defense',        envVar: 'extremeAridity',  coefficient: +0.80, description: 'spines critical for surviving extreme arid exposure' },
  { trait: 'defense',        envVar: 'windExposure',    coefficient: -0.30, description: 'defensive structures (thorns, bark) ripped by wind' },

  // ── Water storage — critical in drought, liability everywhere else ──
  { trait: 'waterStorage',   envVar: null,             coefficient: -0.15, description: 'metabolic cost of maintaining water storage tissue' },
  { trait: 'waterStorage',   envVar: 'droughtStress',  coefficient: +0.40, description: 'drought buffer' },
  { trait: 'waterStorage',   envVar: 'extremeAridity', coefficient: +2.50, description: 'succulent tissue essential in extreme arid conditions' },
  { trait: 'waterStorage',   envVar: 'heatStress',     coefficient: +0.30, description: 'evaporative cooling' },
  { trait: 'waterStorage',   envVar: 'soilFertility',  coefficient: -1.00, description: 'water storage wasteful when soil moisture abundant' },
  { trait: 'waterStorage',   envVar: 'frostRisk',      coefficient: -0.40, description: 'succulent tissue freezes' },
  { trait: 'waterStorage',   envVar: 'waterlogging',   coefficient: -0.60, description: 'redundant in saturated soil' },
  { trait: 'waterStorage',   envVar: 'windExposure',   coefficient: -0.30, description: 'wind desiccation of exposed succulent tissue' },

  // ── Woodiness — structural support on fertile soil, but fails in wind/shallow soil/drought ──
  { trait: 'woodiness',      envVar: null,             coefficient: +0.05, description: 'structural support for canopy' },
  { trait: 'woodiness',      envVar: 'soilFertility',  coefficient: +0.50, description: 'woody investment pays off on fertile soil' },
  { trait: 'woodiness',      envVar: 'frostRisk',      coefficient: +0.15, description: 'bark insulates' },
  { trait: 'woodiness',      envVar: 'windExposure',   coefficient: -1.40, description: 'rigid trunks snap in wind' },
  { trait: 'woodiness',      envVar: 'windExposure',   coefficient: +0.60, inverse: true, description: 'flexible herbaceous stems resist wind' },
  { trait: 'woodiness',      envVar: 'heatStress',     coefficient: -0.30, description: 'bark cracking and xylem desiccation in extreme heat' },
  { trait: 'woodiness',      envVar: 'waterlogging',   coefficient: -0.35, description: 'root rot in waterlogged soil' },
  { trait: 'woodiness',      envVar: 'droughtStress',  coefficient: -0.55, description: 'water-demanding woody tissue' },
  { trait: 'woodiness',      envVar: 'extremeAridity', coefficient: -2.00, description: 'xylem cavitation and wood cracking in extreme desert' },
  { trait: 'woodiness',      envVar: 'shallowSoil',   coefficient: -0.80, description: 'trees cannot anchor in thin rocky soil' },

  // ── Root priority — deep roots mine nutrients, but drown in wetland and fail in shallow soil ──
  { trait: 'rootPriority',   envVar: null,             coefficient: +0.18, description: 'nutrient mining and soil anchoring' },
  { trait: 'rootPriority',   envVar: 'soilFertility',  coefficient: +0.55, description: 'deep roots mine nutrients from fertile soil' },
  { trait: 'rootPriority',   envVar: 'droughtStress',  coefficient: +0.65, description: 'deep water access' },
  { trait: 'rootPriority',   envVar: 'windExposure',   coefficient: -0.25, description: 'deep taproots wind-levered in thin exposed soil' },
  { trait: 'rootPriority',   envVar: 'waterlogging',   coefficient: -0.60, description: 'root drowning' },
  { trait: 'rootPriority',   envVar: 'waterlogging',   coefficient: +0.55, inverse: true, description: 'shallow roots thrive in saturated soil' },
  { trait: 'rootPriority',   envVar: 'heatStress',     coefficient: -0.25, description: 'root zone overheating in hot exposed soil' },
  { trait: 'rootPriority',   envVar: 'shallowSoil',   coefficient: -0.35, description: 'deep taproots hit bedrock in shallow soil' },

  // ── Height priority — competitive light positioning, but wind/shallow soil destroy tall plants ──
  { trait: 'heightPriority', envVar: null,             coefficient: +0.02, description: 'competitive light positioning' },
  { trait: 'heightPriority', envVar: 'soilFertility',  coefficient: +0.20, description: 'tall plants compete for light on fertile soil' },
  { trait: 'heightPriority', envVar: 'windExposure',   coefficient: -1.00, description: 'wind damage to tall plants' },
  { trait: 'heightPriority', envVar: 'windExposure',   coefficient: +0.50, inverse: true, description: 'low plants hug ground in wind' },
  { trait: 'heightPriority', envVar: 'waterlogging',   coefficient: +0.30, description: 'flood escape' },
  { trait: 'heightPriority', envVar: 'heatStress',     coefficient: +0.50, description: 'tall columnar form radiates heat efficiently' },
  { trait: 'heightPriority', envVar: 'extremeAridity', coefficient: +0.80, description: 'tall plants escape lethal ground-level heat in extreme desert' },
  { trait: 'heightPriority', envVar: 'shallowSoil',   coefficient: -0.60, description: 'tall plants topple on thin soil without anchorage' },

  // ── Seed investment — colonizers exploit harsh niches via rapid reproduction ──
  { trait: 'seedInvestment', envVar: 'windExposure',   coefficient: +0.25, description: 'wind seed dispersal' },
  { trait: 'seedInvestment', envVar: 'shallowSoil',   coefficient: +0.20, description: 'fast colonizers thrive in disturbed shallow-soil habitats' },
  { trait: 'seedInvestment', envVar: 'waterlogging',   coefficient: +0.15, description: 'pioneer colonizers rapidly establish in dynamic wetland' },
  { trait: 'seedInvestment', envVar: null,              coefficient: -0.06, description: 'reproductive allocation reduces somatic performance' },

  // ── Longevity — persistence advantage but costly in harsh environments ──
  { trait: 'longevity',      envVar: null,              coefficient: +0.01, description: 'persistence advantage' },
  { trait: 'longevity',      envVar: 'diseasePressure', coefficient: +0.08, description: 'evolved immune system in disease-rich environments' },
  { trait: 'longevity',      envVar: 'droughtStress',   coefficient: +0.05, description: 'established perennial root networks resist drought' },
  { trait: 'longevity',      envVar: 'frostRisk',       coefficient: -0.10, description: 'frost damages accumulated long-lived tissue' },

  // ── Tropicality axis — separates tropical from other climates ──
  // (coefficients scaled up ~20% to compensate for power-scaled tropicality values)
  { trait: 'leafSize',       envVar: 'tropicality',     coefficient: +0.90, description: 'lush foliage thrives in warm humid conditions' },
  { trait: 'defense',        envVar: 'tropicality',     coefficient: +0.80, description: 'chemical defenses essential against tropical herbivores and pathogens' },
  { trait: 'heightPriority', envVar: 'tropicality',     coefficient: +0.25, description: 'intense canopy competition in tropical forests' },
  { trait: 'waterStorage',   envVar: 'tropicality',     coefficient: -0.55, description: 'succulence unnecessary in humid tropics — wasted tissue' },
  { trait: 'rootPriority',   envVar: 'tropicality',     coefficient: -0.30, description: 'shallow lateral roots outperform taproots in tropical soils' },
  { trait: 'woodiness',      envVar: 'tropicality',     coefficient: +0.50, description: 'woody trees dominate tropical canopy structure' },

  // ── Winter harshness axis — separates temperate from other climates ──
  { trait: 'woodiness',      envVar: 'winterHarshness', coefficient: +0.60, description: 'woody perennials survive winter dormancy' },
  // defense × winterHarshness removed — hurts temperate oaks and hollies too much
  { trait: 'waterStorage',   envVar: 'winterHarshness', coefficient: -0.80, description: 'succulent tissue destroyed by freeze-thaw cycles' },
  { trait: 'longevity',      envVar: 'winterHarshness', coefficient: +0.35, description: 'long-lived perennials amortize winter survival investment' },
  { trait: 'leafSize',       envVar: 'winterHarshness', coefficient: -0.35, description: 'deciduous leaf loss — large leaves are costly to regrow each spring' },
  { trait: 'rootPriority',   envVar: 'winterHarshness', coefficient: +0.40, description: 'deep perennial roots survive underground through winter' },
  { trait: 'seedInvestment', envVar: 'winterHarshness', coefficient: -0.45, description: 'r-strategists struggle to establish in harsh winters' },

  // ── Seasonality axis ──
  { trait: 'woodiness',      envVar: 'seasonality',    coefficient: +0.30, description: 'woody tissue persists through seasons; herbaceous must regrow each spring' },
  { trait: 'rootPriority',   envVar: 'seasonality',    coefficient: +0.20, description: 'deep root networks weather seasonal fluctuations' },
  { trait: 'seedInvestment', envVar: 'seasonality',    coefficient: -0.15, description: 'seasonal timing limits r-strategist success' },
  { trait: 'leafSize',       envVar: 'seasonality',    coefficient: -0.10, description: 'large deciduous leaves costly to regrow each spring' },
  { trait: 'waterStorage',   envVar: 'seasonality',    coefficient: -0.25, description: 'succulent tissue damaged by seasonal freeze-thaw cycles' },

  // ── Trait interaction terms ──

  // Arid/drought specialization: two competing succulent strategies
  { trait: 'leafSize', trait2: 'waterStorage', envVar: 'droughtStress', coefficient: +0.35,
    description: 'fleshy rosette leaves store water and photosynthesize in drought' },
  { trait: 'defense', trait2: 'waterStorage', envVar: 'droughtStress', coefficient: +0.35,
    description: 'armored water-storing body survives extreme drought exposure' },
  { trait: 'leafSize', trait2: 'waterStorage', envVar: 'extremeAridity', coefficient: +0.80,
    description: 'rosette succulents thrive in extreme arid' },
  { trait: 'defense', trait2: 'waterStorage', envVar: 'extremeAridity', coefficient: +0.80,
    description: 'armored succulents thrive in extreme arid' },

  // Tropical forest specialization: woody canopy dominance + gap colonizers
  { trait: 'woodiness', trait2: 'defense', envVar: 'tropicality', coefficient: +0.55,
    description: 'woody defended canopy trees dominate tropical forests' },
  { trait: 'woodiness', trait2: 'heightPriority', envVar: 'tropicality', coefficient: +0.45,
    description: 'tall woody trees compete for tropical canopy' },
  { trait: 'heightPriority', trait2: 'seedInvestment', envVar: 'tropicality', coefficient: +0.60,
    description: 'fast-growing gap colonizers thrive in tropical disturbance cycles' },

  // Arid tree specialization
  { trait: 'defense', trait2: 'rootPriority', envVar: 'extremeAridity', coefficient: +1.20,
    description: 'thorny deep-rooted trees tap groundwater in arid environments' },
  { trait: 'heightPriority', trait2: 'woodiness', envVar: 'droughtStress', coefficient: +0.40,
    description: 'tall columnar wood escapes ground-level heat and accesses light' },

  // Wetland specialization
  { trait: 'heightPriority', trait2: 'rootPriority', inverse2: true, envVar: 'waterlogging', coefficient: +0.70,
    description: 'prop-root shrubs grow above waterline without deep roots' },
  { trait: 'leafSize', trait2: 'rootPriority', inverse2: true, envVar: 'waterlogging', coefficient: +0.60,
    description: 'leafy shallow-rooted plants exploit saturated surface soil' },

  // Mediterranean specialization
  { trait: 'woodiness', trait2: 'waterStorage', envVar: 'heatStress', coefficient: +0.50,
    description: 'woody drought-hardy scrub with thick bark survives Mediterranean summers' },
  { trait: 'defense', trait2: 'longevity', envVar: 'heatStress', coefficient: +0.40,
    description: 'aromatic defensive chemistry deters herbivores in open dry scrubland' },

  // ── Short woody specialization — zero-mean pair (seasonality/shallowSoil) ──
  { trait: 'heightPriority', trait2: 'woodiness', envVar: 'seasonality', coefficient: +1.10,
    inverse: true,
    description: 'low compact woody shrubs and short trees persist through seasonal cycles' },
  { trait: 'heightPriority', trait2: 'woodiness', envVar: 'shallowSoil', coefficient: -0.906,
    inverse: true,
    description: 'short woody plants still need soil anchorage despite compact form' },

  // ── Seed size — large seeds anchor in rocky shallow soil, small seeds wind-disperse ──
  { trait: 'seedSize',        envVar: 'shallowSoil',    coefficient: +0.25, description: 'large heavy seeds anchor in cracks of rocky shallow soil' },
  { trait: 'seedSize',        envVar: 'windExposure',   coefficient: -0.15, description: 'heavy seeds cannot wind-disperse on exposed terrain' },

  // ── Seed+leaf climate axis — zero-mean paired terms for niche differentiation ──
  { trait: 'seedInvestment', trait2: 'leafSize', envVar: 'winterHarshness', coefficient: +1.25,
    description: 'flowering forbs spread seeds efficiently in harsh-winter meadows' },
  { trait: 'seedInvestment', trait2: 'leafSize', envVar: 'tropicality', coefficient: -1.07,
    description: 'vegetative reproduction outperforms seeding in stable tropical canopy' },

  // ── 3-way interactions — surgical niche targeting ──

  // Saguaro specialization: peaked(hgt=0.50) × defense × waterStorage in extreme desert
  // Peaked at 0.50 targets only moderate-height succulents (Saguaro hgt=0.50)
  // while ignoring short (Barrel hgt=0.01) and tall (Euphorbia hgt=0.99)
  // Zero-mean: 5.00×0.059 - 1.343×0.219 = 0.294 - 0.294 = 0.000
  { trait: 'heightPriority', trait2: 'defense', trait3: 'waterStorage',
    peaked: 0.50,
    envVar: 'extremeAridity', coefficient: +5.00,
    description: 'tall columnar armored succulents escape ground heat in extreme desert' },
  { trait: 'heightPriority', trait2: 'defense', trait3: 'waterStorage',
    peaked: 0.50,
    envVar: 'soilFertility', coefficient: -1.343,
    description: 'tall columnar succulents are over-invested for fertile soil' },


  // ── Defense × longevity climate axis — rewards armored perennials in drought, penalizes in tropics ──
  // Zero-mean: 0.25×0.261 - 0.405×0.161 = 0.065 - 0.065 = 0.000
  { trait: 'defense', trait2: 'longevity', envVar: 'droughtStress', coefficient: +0.25,
    description: 'armored long-lived plants survive sustained drought exposure' },
  { trait: 'defense', trait2: 'longevity', envVar: 'tropicality', coefficient: -0.405,
    description: 'high-defense perennials over-invested for rapid tropical turnover' },

  // ── Turfgrass arid suppression — peaked(leaf=0.01) × (1-woodiness) × defense ──
  // Targets leaf=0.01 non-woody plants (Turfgrass peaked=1.0, 1-wood=0.99 → 0.970)
  // Trees (wood=0.71, 1-wood=0.29) get only 30% effect. leaf=0.50 gets 2% effect.
  // Zero-mean: 0.60×0.261 = 0.973×0.161 → 0.157 = 0.157 ✓
  { trait: 'leafSize', trait2: 'woodiness', trait3: 'defense',
    peaked: 0.01, inverse2: true,
    envVar: 'droughtStress', coefficient: -0.60,
    description: 'minimal-leaf non-woody armored plants cannot photosynthesize in drought' },
  { trait: 'leafSize', trait2: 'woodiness', trait3: 'defense',
    peaked: 0.01, inverse2: true,
    envVar: 'tropicality', coefficient: +0.973,
    description: 'minimal-leaf armored ground cover thrives in tropical understory' },

  // ── Broadleaf defended seed-producer hill boost — zero-mean (shallowSoil/tropicality) ──
  // Wildflower/Clover (seed=0.99, leaf=0.99, def=0.99) get +0.054 on hills (shallow=0.700)
  // Bunchgrass (seed=0.01) gets nothing. Ryegrass (leaf=0.49) gets half.
  // Zero-mean: 0.08×0.425 = 0.211×0.161 → 0.034 = 0.034 ✓
  { trait: 'seedInvestment', trait2: 'leafSize', trait3: 'defense',
    envVar: 'shallowSoil', coefficient: +0.08,
    description: 'broadleaf defended seed-producers colonize rocky hillside meadows' },
  { trait: 'seedInvestment', trait2: 'leafSize', trait3: 'defense',
    envVar: 'tropicality', coefficient: -0.211,
    description: 'broadleaf defended forbs outcompeted in tropical canopy' },

  // ── Fundamental tradeoffs — climate-dependent to allow tropical "max everything" but penalize it elsewhere ──
  { trait: 'leafSize', trait2: 'defense', envVar: 'winterHarshness', coefficient: -0.30,
    description: 'leaf+defense combo costly in cold: frost damages defended broadleaf tissue' },
  { trait: 'leafSize', trait2: 'defense', envVar: 'seasonality', coefficient: -0.15,
    description: 'leaf+defense combo costly in seasonal: regrowth of defended leaves each spring' },
  { trait: 'waterStorage', trait2: 'woodiness', envVar: null, coefficient: -0.30,
    description: 'succulent tissue and rigid wood compete for biomass — fat stems can\'t be woody' },
  { trait: 'rootPriority', trait2: 'heightPriority', envVar: null, coefficient: -0.18,
    description: 'resource allocation: deep roots vs tall growth compete for biomass investment' },
  { trait: 'seedInvestment', trait2: 'longevity', envVar: null, coefficient: -0.25,
    description: 'r-K tradeoff: heavy seed investment reduces somatic maintenance and vice versa' },

  // ── Tall evergreen specialization — narrow-leaved tall trees in seasonal climates (Cypress, Conifer) ──
  { trait: 'heightPriority', trait2: 'longevity', envVar: 'seasonality', coefficient: +0.35,
    description: 'tall long-lived evergreens outlast deciduous competitors through harsh seasons' },
  { trait: 'leafSize', trait2: 'defense', envVar: 'tropicality', coefficient: +0.70,
    description: 'large defended leaves dominate in tropical canopy' },

  // ── Ground-moisture specialization — low moisture-loving plants (Moss, Vine) ──
  { trait: 'waterStorage', trait2: 'heightPriority', inverse2: true, envVar: 'soilFertility', coefficient: +0.25,
    description: 'low moisture-retaining plants (moss, groundcover) thrive on shaded fertile soil' },

  // ── Fertile soil specialization — tall woody plants dominate deep soil ──
  { trait: 'woodiness', trait2: 'heightPriority', envVar: 'soilFertility', coefficient: +0.65,
    description: 'tall woody canopy trees dominate fertile soil with deep anchorage' },

  // ── Shallow soil specialization — rewards compact ground-hugging strategies ──
  { trait: 'woodiness', trait2: 'heightPriority', envVar: 'shallowSoil', coefficient: -0.50,
    description: 'tall woody plants topple in thin soil without deep anchorage' },
  { trait: 'seedInvestment', trait2: 'rootPriority', envVar: 'shallowSoil', coefficient: +0.30,
    description: 'fibrous-rooted colonizers establish well in shallow disturbed soil' },
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
    const t3 = e.trait3 !== undefined ? evalTrait(genome, e.trait3, e.inverse3) : 1;
    const envVal = e.envVar !== null ? env[e.envVar] : 1;
    modifier += t1 * t2 * t3 * envVal * e.coefficient;
  }
  return modifier;
}

// ── Compiled Trait Effects (fast path) ──
// Groups TRAIT_EFFECTS entries by their trait signature, pre-multiplies
// envVal × coefficient per niche. The TRAIT_EFFECTS table stays readable
// and editable — this layer just "compiles" it into a numeric form.

const GENOME_TRAITS: GenomeTrait[] = [
  'leafSize', 'defense', 'waterStorage', 'woodiness',
  'rootPriority', 'heightPriority', 'seedInvestment', 'longevity', 'seedSize',
];
const TRAIT_TO_IDX = new Map<string, number>();
for (let i = 0; i < GENOME_TRAITS.length; i++) TRAIT_TO_IDX.set(GENOME_TRAITS[i], i);

// Reusable buffer for genome trait values (avoids per-plant allocation)
const _traitBuf = new Float64Array(9);

interface CompiledGroup {
  traitIdx: number;
  trait2Idx: number;     // -1 if no trait2
  trait3Idx: number;     // -1 if no trait3
  inverse: boolean;
  inverse2: boolean;
  inverse3: boolean;
  peaked: number;        // NaN if not peaked
  nicheCoeffs: Float64Array;  // [NICHE_COUNT], pre-multiplied envVal × coefficient
}

let _compiledGroups: CompiledGroup[] = [];

function groupKey(e: TraitEffect): string {
  let k = e.inverse ? `!${e.trait}` : e.trait as string;
  if (e.peaked !== undefined) k = `^${e.peaked}:${k}`;
  if (e.trait2 !== undefined) k += `*${e.inverse2 ? '!' : ''}${e.trait2}`;
  if (e.trait3 !== undefined) k += `*${e.inverse3 ? '!' : ''}${e.trait3}`;
  return k;
}

function compileTraitEffects(): void {
  const nicheCount = CLIMATE_ZONE_COUNT * TERRAIN_COUNT;

  // Group entries by trait signature
  const groupMap = new Map<string, { entries: TraitEffect[], rep: TraitEffect }>();
  for (const e of TRAIT_EFFECTS) {
    const key = groupKey(e);
    let g = groupMap.get(key);
    if (!g) { g = { entries: [], rep: e }; groupMap.set(key, g); }
    g.entries.push(e);
  }

  _compiledGroups = [];
  for (const [, group] of groupMap) {
    const rep = group.rep;
    const cg: CompiledGroup = {
      traitIdx: TRAIT_TO_IDX.get(rep.trait)!,
      trait2Idx: rep.trait2 !== undefined ? TRAIT_TO_IDX.get(rep.trait2)! : -1,
      trait3Idx: rep.trait3 !== undefined ? TRAIT_TO_IDX.get(rep.trait3)! : -1,
      inverse: !!rep.inverse,
      inverse2: !!rep.inverse2,
      inverse3: !!rep.inverse3,
      peaked: rep.peaked !== undefined ? rep.peaked : NaN,
      nicheCoeffs: new Float64Array(nicheCount),
    };

    for (let ni = 0; ni < nicheCount; ni++) {
      const env = EFFECTIVE_ENV[ni];
      let sum = 0;
      for (const e of group.entries) {
        const envVal = e.envVar !== null ? env[e.envVar] : 1;
        sum += envVal * e.coefficient;
      }
      cg.nicheCoeffs[ni] = sum;
    }

    _compiledGroups.push(cg);
  }
}

// Initialize on module load
compileTraitEffects();

/** Recompile after seasonal environment changes. Called from updateEffectiveEnv. */
export function recompileTraitEffects(): void {
  compileTraitEffects();
}

/** Fast compiled version of computeTraitModifier — uses pre-grouped, pre-multiplied coefficients. */
export function computeTraitModifierFast(genome: Genome, nicheIdx: number): number {
  _traitBuf[0] = genome.leafSize;
  _traitBuf[1] = genome.defense;
  _traitBuf[2] = genome.waterStorage;
  _traitBuf[3] = genome.woodiness;
  _traitBuf[4] = genome.rootPriority;
  _traitBuf[5] = genome.heightPriority;
  _traitBuf[6] = genome.seedInvestment;
  _traitBuf[7] = genome.longevity;
  _traitBuf[8] = genome.seedSize;

  let modifier = 0;
  for (let i = 0; i < _compiledGroups.length; i++) {
    const cg = _compiledGroups[i];
    const ec = cg.nicheCoeffs[nicheIdx];
    if (ec === 0) continue;
    let t1 = cg.inverse ? 1 - _traitBuf[cg.traitIdx] : _traitBuf[cg.traitIdx];
    if (cg.peaked === cg.peaked) t1 = Math.max(0, 1 - 2 * Math.abs(t1 - cg.peaked)); // NaN !== NaN skips non-peaked
    const t2 = cg.trait2Idx >= 0 ? (cg.inverse2 ? 1 - _traitBuf[cg.trait2Idx] : _traitBuf[cg.trait2Idx]) : 1;
    const t3 = cg.trait3Idx >= 0 ? (cg.inverse3 ? 1 - _traitBuf[cg.trait3Idx] : _traitBuf[cg.trait3Idx]) : 1;
    modifier += t1 * t2 * t3 * ec;
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
    const t3 = e.trait3 !== undefined ? evalTrait(genome, e.trait3, e.inverse3) : 1;
    const envVal = e.envVar !== null ? env[e.envVar] : 1;
    const traitVal = t1 * t2 * t3;
    let traitLabel = e.inverse ? `(1-${e.trait})` : e.trait as string;
    if (e.trait2) traitLabel += `×${e.inverse2 ? '(1-' + e.trait2 + ')' : e.trait2}`;
    if (e.trait3) traitLabel += `×${e.inverse3 ? '(1-' + e.trait3 + ')' : e.trait3}`;
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
