import { World } from './types';

/** Get all species IDs that belong to a given lineage root (from alive plants). */
export function getLineageGroup(world: World, rootId: number): Set<number> {
  const group = new Set<number>();
  for (const p of world.plants.values()) {
    if (p.alive && p.lineageRoot === rootId) {
      group.add(p.speciesId);
    }
  }
  // Always include the root itself
  group.add(rootId);
  return group;
}
