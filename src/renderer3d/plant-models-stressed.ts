/**
 * Assembler: combines stressed builders from all 4 category files into
 * complete 40-element BUILDERS_STRESSED / BUILDERS_STRESSED_LOW arrays.
 *
 * Grass slots (0-4, 30-31) and Sedge (5) fall through to the healthy builder.
 */
import { BUILDERS, BUILDERS_LOW } from './plant-models';
import { STRESSED_TREES, STRESSED_TREES_LOW } from './plant-models-stressed-trees';
import { STRESSED_SHRUBS, STRESSED_SHRUBS_LOW } from './plant-models-stressed-shrubs';
import { STRESSED_SUCCULENTS, STRESSED_SUCCULENTS_LOW } from './plant-models-stressed-succulents';
import { STRESSED_FORBS, STRESSED_FORBS_LOW } from './plant-models-stressed-forbs';
import type * as THREE from 'three';

type Builder = () => THREE.Group;

function merge(...maps: Record<number, Builder>[]): Record<number, Builder> {
  const r: Record<number, Builder> = {};
  for (const m of maps) Object.assign(r, m);
  return r;
}

const ALL = merge(STRESSED_TREES, STRESSED_SHRUBS, STRESSED_SUCCULENTS, STRESSED_FORBS);
const ALL_LOW = merge(STRESSED_TREES_LOW, STRESSED_SHRUBS_LOW, STRESSED_SUCCULENTS_LOW, STRESSED_FORBS_LOW);

export const BUILDERS_STRESSED: Builder[] = BUILDERS.map((healthy, i) => ALL[i] ?? healthy);
export const BUILDERS_STRESSED_LOW: Builder[] = BUILDERS_LOW.map((healthy, i) => ALL_LOW[i] ?? healthy);
