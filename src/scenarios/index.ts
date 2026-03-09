import { Scenario } from '../types';
import { genesis } from './genesis';
import { lindenvale } from './lindenvale';
import { experimentNicheMatrix } from './experiment-niche-matrix';
import { experimentNeutralBaseline } from './experiment-neutral-baseline';
import { showcase } from './showcase';

export const SCENARIOS: Scenario[] = [
  genesis,
  lindenvale,
  experimentNicheMatrix,
  experimentNeutralBaseline,
  showcase,
];
