import { Scenario } from '../types';
import { riverValley } from './river-valley';
import { desertOasis } from './desert-oasis';
import { islandArchipelago } from './island-archipelago';
import { marshlands } from './marshlands';
import { highlandPlateau } from './highland-plateau';
import { experimentMonoculture } from './experiment-monoculture';

export const SCENARIOS: Scenario[] = [
  riverValley,
  desertOasis,
  islandArchipelago,
  marshlands,
  highlandPlateau,
  experimentMonoculture,
];
