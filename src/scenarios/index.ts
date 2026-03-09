import { Scenario } from '../types';
import { genesis } from './genesis';
import { lindenvale } from './lindenvale';
import { experimentNicheMatrix } from './experiment-niche-matrix';
import { experimentNeutralBaseline } from './experiment-neutral-baseline';
import { experimentTerrainQuad } from './experiment-terrain-quad';
import { experimentZoneQuad } from './experiment-zone-quad';
import { showcase } from './showcase';

export const SCENARIOS: Scenario[] = [
  genesis,
  lindenvale,
  experimentNicheMatrix,
  experimentNeutralBaseline,
  experimentTerrainQuad,
  experimentZoneQuad,
  showcase,
];
