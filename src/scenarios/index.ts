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
];
