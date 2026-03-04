import { Scenario } from '../types';
import { experimentMonoculture } from './experiment-monoculture';
import { experimentWaterCompetition } from './experiment-water-competition';
import { experimentLightCompetition } from './experiment-light-competition';
import { experimentSeedTradeoff } from './experiment-seed-tradeoff';
import { experimentAllelopathy } from './experiment-allelopathy';
import { experimentDefense } from './experiment-defense';
import { experimentHillSpecialist } from './experiment-hill-specialist';
import { experimentAridSpecialist } from './experiment-arid-specialist';
import { experimentWetlandSpecialist } from './experiment-wetland-specialist';
import { experimentGrassVsTrees } from './experiment-grass-vs-trees';
import { experimentNutrientCycle } from './experiment-nutrient-cycle';
import { experimentTerrainMosaic } from './experiment-terrain-mosaic';
import { experimentTerrainIsolated } from './experiment-terrain-isolated';
import { experimentSeedBank } from './experiment-seed-bank';

export const SCENARIOS: Scenario[] = [
  experimentMonoculture,
  experimentWaterCompetition,
  experimentLightCompetition,
  experimentSeedTradeoff,
  experimentAllelopathy,
  experimentDefense,
  experimentHillSpecialist,
  experimentAridSpecialist,
  experimentWetlandSpecialist,
  experimentGrassVsTrees,
  experimentNutrientCycle,
  experimentTerrainMosaic,
  experimentTerrainIsolated,
  experimentSeedBank,
];
