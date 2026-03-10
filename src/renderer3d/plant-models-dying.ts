/**
 * Assembler: combines dying builders from all 4 category files into
 * complete 40-element BUILDERS_DYING / BUILDERS_DYING_LOW arrays.
 *
 * Grass slots (0-4, 30-31) and Sedge (5) fall through to the healthy builder.
 */
import { BUILDERS, BUILDERS_LOW } from './plant-models';
import { DYING_TREES, DYING_TREES_LOW } from './plant-models-dying-trees';
import { DYING_SHRUBS, DYING_SHRUBS_LOW } from './plant-models-dying-shrubs';
import { DYING_SUCCULENTS, DYING_SUCCULENTS_LOW } from './plant-models-dying-succulents';
import { DYING_FORBS, DYING_FORBS_LOW } from './plant-models-dying-forbs';
import { DYING_GRASSES, DYING_GRASSES_LOW } from './plant-models-dying-grasses';
import type * as THREE from 'three';

type Builder = () => THREE.Group;

function merge(...maps: Record<number, Builder>[]): Record<number, Builder> {
  const r: Record<number, Builder> = {};
  for (const m of maps) Object.assign(r, m);
  return r;
}

const ALL = merge(DYING_TREES, DYING_SHRUBS, DYING_SUCCULENTS, DYING_FORBS, DYING_GRASSES);
const ALL_LOW = merge(DYING_TREES_LOW, DYING_SHRUBS_LOW, DYING_SUCCULENTS_LOW, DYING_FORBS_LOW, DYING_GRASSES_LOW);

export const BUILDERS_DYING: Builder[] = BUILDERS.map((healthy, i) => ALL[i] ?? healthy);
export const BUILDERS_DYING_LOW: Builder[] = BUILDERS_LOW.map((healthy, i) => ALL_LOW[i] ?? healthy);
