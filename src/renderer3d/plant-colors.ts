import { Genome } from '../types';
import { RendererState } from './state';

/**
 * Compute a single RGB tint multiplier for a plant instance.
 *
 * The vertex colors are baked into the merged geometry from gallery materials.
 * THREE.js multiplies vertexColor × instanceColor, so:
 * - (1,1,1) = gallery colors unchanged
 * - values < 1 darken, > 1 brighten
 *
 * Tint encodes natural genome variation.
 * Tint is fully stable per plant, only changing on birth or cache clear.
 */

// Pre-allocated output object — reused every call (callers must consume before next call)
const _tint = { r: 1, g: 1, b: 1 };

export function computePlantTint(
  state: RendererState,
  plantId: number,
  genome: Genome,
): { r: number; g: number; b: number } {
  // Check cache first
  const cached = state.plantColorCache.get(plantId);
  if (cached) {
    _tint.r = cached.cr;
    _tint.g = cached.cg;
    _tint.b = cached.cb;
    return _tint;
  }

  let r = 1.0, g = 1.0, b = 1.0;

  // Subtle genome-based variation (±15% per channel)
  r += (genome.rootPriority - 0.5) * 0.2;
  g += (genome.leafSize - 0.5) * 0.15;
  b += (genome.heightPriority - 0.5) * 0.15;

  // Seed investment → slight warmth
  r += genome.seedInvestment * 0.06;
  g -= genome.seedInvestment * 0.02;

  // Defense → slightly darker
  r -= genome.defense * 0.05;
  g -= genome.defense * 0.03;

  // Cache the base tint
  state.plantColorCache.set(plantId, { cr: r, cg: g, cb: b });

  _tint.r = r;
  _tint.g = g;
  _tint.b = b;
  return _tint;
}
