import { Scenario } from '../types';
import { experimentMonoculture } from './experiment-monoculture';
import { experimentWaterCompetition } from './experiment-water-competition';
import { experimentLightCompetition } from './experiment-light-competition';
import { experimentSeedTradeoff } from './experiment-seed-tradeoff';
import { experimentAllelopathy } from './experiment-allelopathy';
import { experimentDefense } from './experiment-defense';

export const SCENARIOS: Scenario[] = [
  experimentMonoculture,
  experimentWaterCompetition,
  experimentLightCompetition,
  experimentSeedTradeoff,
  experimentAllelopathy,
  experimentDefense,
];
