import { RendererState, computeGrassSilhouette, plantHash } from './state';
import { MAX_GRASS_TUFTS } from './setup';

export function writeGrassInstance(
  state: RendererState,
  tuftIdx: number,
  plantId: number,
  wx: number, wz: number, baseY: number,
  gsil: ReturnType<typeof computeGrassSilhouette>,
  cr: number, cg: number, cb: number,
  scale: number,
  tuftMtx: Float32Array, tuftClr: Float32Array,
): number {
  if (tuftIdx >= MAX_GRASS_TUFTS) return 0;

  const { dummy } = state;

  const w = gsil.width * scale;
  const h = gsil.height * scale;

  dummy.position.set(wx, baseY, wz);
  dummy.scale.set(w, h, w);
  dummy.rotation.set(0, plantHash(plantId, 42) * Math.PI, 0);
  dummy.updateMatrix();

  dummy.matrix.toArray(tuftMtx, tuftIdx * 16);
  const ci = tuftIdx * 3;
  tuftClr[ci]     = cr;
  tuftClr[ci + 1] = cg;
  tuftClr[ci + 2] = cb;

  return 1;
}
