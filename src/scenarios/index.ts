import { Scenario } from '../types';
import { experimentMonoculture } from './experiment-monoculture';
import { experimentWaterCompetition } from './experiment-water-competition';
import { experimentLightCompetition } from './experiment-light-competition';
import { experimentSeedTradeoff } from './experiment-seed-tradeoff';

export const SCENARIOS: Scenario[] = [
  experimentMonoculture,
  experimentWaterCompetition,
  experimentLightCompetition,
  experimentSeedTradeoff,
];
