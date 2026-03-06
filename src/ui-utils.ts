import { SpeciesColor, World } from './types';

/** Tick-scoped cache: computes all centroids in a single pass on first call per tick */
let _centroidCache: Map<number, { x: number; y: number }> = new Map();
let _centroidTick = -1;

export function speciesCentroid(world: World, speciesId: number): { x: number; y: number } | null {
  if (world.tick !== _centroidTick) {
    _centroidCache.clear();
    _centroidTick = world.tick;
    const sums = new Map<number, { sx: number; sy: number; count: number }>();
    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;
      let s = sums.get(plant.speciesId);
      if (!s) { s = { sx: 0, sy: 0, count: 0 }; sums.set(plant.speciesId, s); }
      s.sx += plant.x;
      s.sy += plant.y;
      s.count++;
    }
    for (const [sid, s] of sums) {
      _centroidCache.set(sid, { x: s.sx / s.count, y: s.sy / s.count });
    }
  }
  return _centroidCache.get(speciesId) ?? null;
}

/** Convert a SpeciesColor (0-1 floats) to an rgb() CSS string */
export function speciesColorToRgb(sc: SpeciesColor): string {
  return `rgb(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)})`;
}

/** Convert a SpeciesColor to an rgba() CSS string */
export function speciesColorToRgba(sc: SpeciesColor, alpha: number): string {
  return `rgba(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)},${alpha})`;
}

/** Compute a "nice" axis step size for chart grid lines */
export function niceStep(range: number, targetLines: number): number {
  if (range <= 0) return 1;
  const rough = range / targetLines;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3.5) step = 2;
  else if (norm < 7.5) step = 5;
  else step = 10;
  return step * mag;
}

/** Convert a hex color (#rgb or #rrggbb) to an rgba() CSS string */
export function hexToRgba(hex: string, alpha: number): string {
  let r: number, g: number, b: number;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}
