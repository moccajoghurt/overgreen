import { EFFECTIVE_ENV, getEnvIdx, NICHE_COUNT } from '../../src/simulation/trait-effects';

const TERRAIN_COUNT = 6;
const CLIMATE_COUNT = 4;
const targetNiches: number[] = [];
for (let cz = 0; cz < CLIMATE_COUNT; cz++) {
  for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
    if (tt === 1 || tt === 2) continue;
    targetNiches.push(getEnvIdx(cz, tt));
  }
}

const envVars = ['droughtStress','frostRisk','diseasePressure','windExposure','waterlogging','heatStress','soilFertility','extremeAridity','tropicality','winterHarshness','seasonality','shallowSoil','mediterraneity','coolWetland','continentalDrought','desertSoilHeat'] as const;

console.log('Mean env var values across 16 target niches:');
for (const v of envVars) {
  let sum = 0;
  for (const ni of targetNiches) sum += EFFECTIVE_ENV[ni][v];
  console.log(`  ${v.padEnd(20)} ${(sum / targetNiches.length).toFixed(4)}`);
}

console.log('\nPer-niche values for key vars:');
const TERRAIN_NAMES = ['Soil','River','Rock','Hill','Wetland','Arid'];
const CLIMATE_NAMES = ['Temperate','Tropical','Mediterr','Desert'];
const keyVars = ['waterlogging','coolWetland','continentalDrought','soilFertility','tropicality','winterHarshness','extremeAridity','shallowSoil','desertSoilHeat','mediterraneity','seasonality','droughtStress'] as const;
for (const v of keyVars) {
  console.log(`  ${v}:`);
  for (let cz = 0; cz < CLIMATE_COUNT; cz++) {
    const row: string[] = [];
    for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
      if (tt === 1 || tt === 2) continue;
      row.push(`${TERRAIN_NAMES[tt]}=${EFFECTIVE_ENV[getEnvIdx(cz, tt)][v].toFixed(3)}`);
    }
    console.log(`    ${CLIMATE_NAMES[cz].padEnd(12)} ${row.join('  ')}`);
  }
}
