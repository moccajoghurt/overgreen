import { SpeciesColor, World } from './types';

/** Compute the average grid position of all alive plants in a species */
export function speciesCentroid(world: World, speciesId: number): { x: number; y: number } | null {
  let sx = 0, sy = 0, count = 0;
  for (const plant of world.plants.values()) {
    if (plant.alive && plant.speciesId === speciesId) {
      sx += plant.x;
      sy += plant.y;
      count++;
    }
  }
  return count > 0 ? { x: sx / count, y: sy / count } : null;
}

/** Convert a SpeciesColor (0-1 floats) to an rgb() CSS string */
export function speciesColorToRgb(sc: SpeciesColor): string {
  return `rgb(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)})`;
}
