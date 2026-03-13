import { TerrainType } from '../../src/types/core';
import { ClimateZone, CLIMATE_ZONE_COUNT } from '../../src/types/environment';
import { EFFECTIVE_ENV, getEnvIdx } from '../../src/simulation/trait-effects';

const TERRAIN_NAMES = ['Soil', 'River', 'Rock', 'Hill', 'Wetland', 'Arid'];
const CLIMATE_NAMES = ['Temperate', 'Tropical', 'Mediterr', 'Desert'];
const TARGET_TT = [0, 3, 4, 5]; // Soil, Hill, Wetland, Arid

const envVars = ['droughtStress','diseasePressure','windExposure','waterlogging','heatStress','soilFertility','extremeAridity','tropicality','winterHarshness','seasonality','shallowSoil','frostRisk'] as const;

console.log('Niche'.padEnd(16) + envVars.map(v => v.slice(0,7).padStart(8)).join(''));
for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
  for (const tt of TARGET_TT) {
    const label = CLIMATE_NAMES[cz] + '/' + TERRAIN_NAMES[tt];
    const env = EFFECTIVE_ENV[getEnvIdx(cz, tt)] as any;
    const vals = envVars.map(v => env[v].toFixed(3).padStart(8)).join('');
    console.log(label.padEnd(16) + vals);
  }
}
