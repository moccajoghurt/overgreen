import { RendererState, computeGrassSilhouette, plantHash } from './state';
import { MAX_GRASS_TUFTS } from './setup';

export function writeGrassTufts(
  state: RendererState,
  tuftIdx: number,
  plantId: number,
  wx: number, wz: number, baseY: number,
  gsil: ReturnType<typeof computeGrassSilhouette>,
  cr: number, cg: number, cb: number,
  scale: number,
  tuftMtx: Float32Array, tuftClr: Float32Array,
): number {
  const { dummy } = state;
  let written = 0;

  for (let c = 0; c < gsil.clumpCount; c++) {
    if (tuftIdx + written >= MAX_GRASS_TUFTS) break;

    const ox = (plantHash(plantId, 100 + c * 3) - 0.5) * 0.50;
    const oz = (plantHash(plantId, 200 + c * 3) - 0.5) * 0.50;

    const hVar = 0.80 + plantHash(plantId, 300 + c) * 0.35;
    const wVar = 0.90 + plantHash(plantId, 400 + c) * 0.25;

    const w = gsil.width * scale * wVar;
    const h = gsil.height * scale * hVar;

    const leanX = (plantHash(plantId, 600 + c) - 0.5) * 0.15;
    const leanZ = (plantHash(plantId, 700 + c) - 0.5) * 0.15;

    dummy.position.set(wx + ox, baseY, wz + oz);
    dummy.scale.set(w, h, w);
    dummy.rotation.set(leanX, plantHash(plantId, 42 + c * 7) * Math.PI * 2, leanZ);
    dummy.updateMatrix();

    const idx = tuftIdx + written;
    dummy.matrix.toArray(tuftMtx, idx * 16);
    const ci = idx * 3;
    const colorVar = 0.90 + plantHash(plantId, 500 + c) * 0.20;
    tuftClr[ci]     = Math.min(1, cr * colorVar);
    tuftClr[ci + 1] = Math.min(1, cg * colorVar);
    tuftClr[ci + 2] = Math.min(1, cb * colorVar);

    written++;
  }

  return written;
}
