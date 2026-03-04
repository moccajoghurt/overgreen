import { Scenario } from '../types';
import { experimentMonoculture } from './experiment-monoculture';
import { experimentWaterCompetition } from './experiment-water-competition';

export const SCENARIOS: Scenario[] = [
  experimentMonoculture,
  experimentWaterCompetition,
];
