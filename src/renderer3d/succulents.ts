import { RendererState, SucculentSilhouette, plantHash } from './state';
import { MAX_SUCCULENT_BODIES } from './setup';

/**
 * Writes a single succulent body instance — one sphere per plant,
 * scaled to genome-driven proportions (tall/narrow or squat/wide).
 */
export function writeSucculentBody(
  state: RendererState,
  bodyIdx: number,
  plantId: number,
  wx: number, wz: number, baseY: number,
  sil: SucculentSilhouette,
  bodyR: number, bodyG: number, bodyB: number,
  scale: number,
  bodyMtx: Float32Array, bodyClr: Float32Array,
): number {
  if (bodyIdx >= MAX_SUCCULENT_BODIES) return 0;

  const { dummy } = state;
  const bH = sil.bodyH * scale;
  const bR = sil.bodyRadius * scale;

  // Position equator near ground — bottom 15% sinks into terrain,
  // so the visible shape is widest at the base and domes upward (barrel cactus look)
  dummy.position.set(wx, baseY + bH * 0.35, wz);
  dummy.scale.set(bR, bH, bR);
  // Random Y-rotation so rib edges don't all face the same direction
  dummy.rotation.set(0, plantHash(plantId, 7) * Math.PI * 2, 0);
  dummy.updateMatrix();

  dummy.matrix.toArray(bodyMtx, bodyIdx * 16);
  const ci = bodyIdx * 3;
  bodyClr[ci]     = bodyR;
  bodyClr[ci + 1] = bodyG;
  bodyClr[ci + 2] = bodyB;

  return 1;
}
