/** Follow parent chain to the root ancestor. */
export function getLineageRoot(lineage: Map<number, number>, speciesId: number): number {
  let id = speciesId;
  while (lineage.has(id)) {
    id = lineage.get(id)!;
  }
  return id;
}

/** All species sharing the same root ancestor (including the root itself). */
export function getLineageGroup(lineage: Map<number, number>, speciesId: number): Set<number> {
  const root = getLineageRoot(lineage, speciesId);
  const group = new Set<number>([root]);
  for (const [child, parent] of lineage) {
    if (getLineageRoot(lineage, child) === root) {
      group.add(child);
    }
  }
  return group;
}
