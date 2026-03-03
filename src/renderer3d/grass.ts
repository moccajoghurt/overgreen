import { RendererState, computeGrassSilhouette, plantHash } from './state';
import { MAX_GRASS_BLADES, MAX_GRASS_BASES } from './setup';

export function writeGrassInstances(
  state: RendererState,
  grassBladeIdx: number,
  grassBaseIdx: number,
  plantId: number,
  wx: number, wz: number, baseY: number,
  gsil: ReturnType<typeof computeGrassSilhouette>,
  cr: number, cg: number, cb: number,
  scale: number,
  gbMtx: Float32Array, gbClr: Float32Array,
  baseMtx: Float32Array, baseClr: Float32Array,
): { bladeCount: number; baseCount: number } {
  const { dummy } = state;
  let bladeCount = 0;

  for (let i = 0; i < gsil.bladeCount; i++) {
    if (grassBladeIdx + bladeCount >= MAX_GRASS_BLADES) break;

    const angle = (i / gsil.bladeCount) * Math.PI * 2 + plantHash(plantId, i * 3) * 0.5;
    const tiltOut = 0.2 + gsil.spread * (0.5 + plantHash(plantId, i * 3 + 1) * 0.5);
    const bladeH = gsil.bladeH * (0.8 + plantHash(plantId, i * 3 + 2) * 0.4) * scale;
    const bladeW = gsil.bladeWidth * scale;

    const offsetX = Math.sin(angle) * gsil.spread * 0.3;
    const offsetZ = Math.cos(angle) * gsil.spread * 0.3;

    dummy.position.set(wx + offsetX, baseY, wz + offsetZ);
    dummy.scale.set(bladeW, bladeH, bladeW);
    dummy.rotation.set(0, 0, 0);
    dummy.rotateY(angle);
    dummy.rotateX(-tiltOut);
    dummy.updateMatrix();

    const bIdx = grassBladeIdx + bladeCount;
    dummy.matrix.toArray(gbMtx, bIdx * 16);
    const ci = bIdx * 3;
    // Per-blade color jitter
    const jitter = (plantHash(plantId, i * 7 + 100) - 0.5) * 0.08;
    gbClr[ci]     = Math.max(0, cr + jitter);
    gbClr[ci + 1] = Math.max(0, cg + jitter);
    gbClr[ci + 2] = Math.max(0, cb + jitter * 0.5);
    bladeCount++;
  }

  // Write base tuft
  if (grassBaseIdx < MAX_GRASS_BASES) {
    dummy.position.set(wx, baseY + gsil.baseSize * 0.1, wz);
    dummy.scale.set(gsil.baseSize * scale, gsil.baseSize * 0.5 * scale, gsil.baseSize * scale);
    dummy.rotation.set(0, plantHash(plantId, 999) * Math.PI * 2, 0);
    dummy.updateMatrix();
    dummy.matrix.toArray(baseMtx, grassBaseIdx * 16);
    const bci = grassBaseIdx * 3;
    baseClr[bci]     = cr * 0.7;
    baseClr[bci + 1] = cg * 0.6;
    baseClr[bci + 2] = cb * 0.5;
  }

  return { bladeCount, baseCount: 1 };
}
