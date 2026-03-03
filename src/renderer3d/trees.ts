import { Genome } from '../types';
import { RendererState, StemInfo, MAX_BRANCHES_PER_PLANT, computeSilhouette, plantHash } from './state';

/** Writes trunk cylinder segments and returns stem attachment info for branches. */
export function writeTrunkSegments(
  state: RendererState,
  idx: number,
  plantId: number,
  wx: number, wz: number, baseY: number,
  sil: ReturnType<typeof computeSilhouette>,
  tr: number, tg: number, tb: number,
  tiltAngle: number, tiltDir: number,
  trunkMtx: Float32Array, trunkClr: Float32Array,
  branchLOD: number,
): { trunkCount: number; stems: StemInfo[] } {
  const { dummy } = state;
  const stems: StemInfo[] = [];
  let written = 0;

  // LOD: collapse to single straight segment when far away
  if (branchLOD < 0.5 || sil.stemCount <= 1 && sil.trunkLean < 0.005) {
    // Single straight cylinder (original behavior)
    dummy.position.set(wx, baseY + sil.trunkH * 0.5, wz);
    dummy.scale.set(sil.trunkThickness, sil.trunkH, sil.trunkThickness);
    dummy.rotation.set(
      Math.sin(tiltDir) * tiltAngle,
      0,
      Math.cos(tiltDir) * tiltAngle,
    );
    dummy.updateMatrix();
    dummy.matrix.toArray(trunkMtx, idx * 16);
    const ci = idx * 3;
    trunkClr[ci]     = tr;
    trunkClr[ci + 1] = tg;
    trunkClr[ci + 2] = tb;
    written = 1;

    stems.push({
      baseX: wx, baseY, baseZ: wz,
      tipX: wx, tipY: baseY + sil.trunkH, tipZ: wz,
      thickness: sil.trunkThickness,
    });

    return { trunkCount: written, stems };
  }

  if (sil.stemCount === 1) {
    // ── Single stem: one continuous cylinder tilted by lean ──
    // Instead of 2 segments (which creates a visible seam), use a single
    // cylinder tilted slightly off-vertical to convey the lean as a gentle slant.
    const leanDir = plantHash(plantId, 300) * Math.PI * 2;
    const leanAmt = sil.trunkLean; // 0-0.15 rad

    const leanRotX = Math.cos(leanDir) * leanAmt;
    const leanRotZ = Math.sin(leanDir) * leanAmt;

    // Tip offset from lean (for branch attachment)
    const tipOffsetX = Math.sin(leanDir) * Math.sin(leanAmt) * sil.trunkH;
    const tipOffsetZ = Math.cos(leanDir) * Math.sin(leanAmt) * sil.trunkH;

    dummy.position.set(
      wx + tipOffsetX * 0.5,
      baseY + sil.trunkH * 0.5,
      wz + tipOffsetZ * 0.5,
    );
    dummy.scale.set(sil.trunkThickness, sil.trunkH, sil.trunkThickness);
    dummy.rotation.set(
      leanRotX + Math.sin(tiltDir) * tiltAngle,
      0,
      leanRotZ + Math.cos(tiltDir) * tiltAngle,
    );
    dummy.updateMatrix();
    dummy.matrix.toArray(trunkMtx, idx * 16);
    const ci = idx * 3;
    trunkClr[ci]     = tr;
    trunkClr[ci + 1] = tg;
    trunkClr[ci + 2] = tb;
    written = 1;

    stems.push({
      baseX: wx, baseY, baseZ: wz,
      tipX: wx + tipOffsetX, tipY: baseY + sil.trunkH, tipZ: wz + tipOffsetZ,
      thickness: sil.trunkThickness,
    });

    return { trunkCount: written, stems };
  }

  // ── Multi-stem (2-3 trunks diverging from a shared base) ──
  const forkY = baseY + sil.trunkH * sil.forkFrac;
  const baseH = sil.trunkH * sil.forkFrac;
  const baseThick = sil.trunkThickness * 1.15;

  // Write shared base segment
  dummy.position.set(wx, baseY + baseH * 0.5, wz);
  dummy.scale.set(baseThick, baseH, baseThick);
  dummy.rotation.set(
    Math.sin(tiltDir) * tiltAngle,
    0,
    Math.cos(tiltDir) * tiltAngle,
  );
  dummy.updateMatrix();
  dummy.matrix.toArray(trunkMtx, idx * 16);
  let ci = idx * 3;
  trunkClr[ci]     = tr;
  trunkClr[ci + 1] = tg;
  trunkClr[ci + 2] = tb;
  written++;

  // Write N sub-trunks from fork point
  const N = sil.stemCount;
  const subThick = sil.trunkThickness * 0.7;
  const remainH = sil.trunkH * (1 - sil.forkFrac);

  for (let s = 0; s < N; s++) {
    const angleBase = (s / N) * Math.PI * 2;
    const angleJitter = (plantHash(plantId, 310 + s) - 0.5) * 0.6;
    const stemAngle = angleBase + angleJitter;

    // Divergence angle from vertical (0.20-0.35 rad) — wide enough to see distinct trunks
    const diverge = 0.20 + plantHash(plantId, 320 + s) * 0.15;

    // Length jitter per sub-trunk
    const lenJitter = 0.85 + plantHash(plantId, 330 + s) * 0.30;
    const subH = remainH * lenJitter;

    // Tip position: diverge outward from fork point
    const offsetX = Math.sin(stemAngle) * diverge * subH;
    const offsetZ = Math.cos(stemAngle) * diverge * subH;
    const tipX = wx + offsetX;
    const tipZ = wz + offsetZ;

    // Center of sub-trunk cylinder
    const centerX = wx + offsetX * 0.5;
    const centerZ = wz + offsetZ * 0.5;

    // Tilt the sub-trunk to match its divergence
    const subTiltX = Math.atan2(offsetZ, subH);
    const subTiltZ = -Math.atan2(offsetX, subH);

    dummy.position.set(centerX, forkY + subH * 0.5, centerZ);
    dummy.scale.set(subThick, subH, subThick);
    dummy.rotation.set(
      subTiltX + Math.sin(tiltDir) * tiltAngle,
      0,
      subTiltZ + Math.cos(tiltDir) * tiltAngle,
    );
    dummy.updateMatrix();
    dummy.matrix.toArray(trunkMtx, (idx + written) * 16);
    ci = (idx + written) * 3;
    trunkClr[ci]     = tr;
    trunkClr[ci + 1] = tg;
    trunkClr[ci + 2] = tb;
    written++;

    stems.push({
      baseX: wx, baseY, baseZ: wz,
      tipX, tipY: forkY + subH, tipZ,
      thickness: subThick,
    });
  }

  return { trunkCount: written, stems };
}

/** Writes 2-level branch cylinders + canopy blobs at each branch tip. */
export function writeBranchesAndCanopies(
  state: RendererState,
  branchIdx: number,
  canopyIdx: number,
  plantId: number,
  wx: number, wz: number, baseY: number,
  sil: ReturnType<typeof computeSilhouette>,
  genome: Genome,
  tr: number, tg: number, tb: number,
  cr: number, cg: number, cb: number,
  branchScale: number,
  brMtx: Float32Array, brClr: Float32Array,
  canopyMtx: Float32Array, canopyClr: Float32Array,
  branchLOD: number,
  stems: StemInfo[],
): { branchCount: number; canopyCount: number } {
  const { dummy } = state;
  const vis = sil.branchVisibility * branchScale;

  let branchCount = 0;
  let canopyCount = 0;
  let segmentCount = 0;

  // ── Level 1: Primary branches ──
  // leafSize → many (bushy), heightPriority → few (conifer), seedInvestment → moderate-many
  const rawPrimaryCount = Math.max(2, Math.min(6,
    Math.round(2 + genome.leafSize * 3 - genome.heightPriority * 2 + genome.seedInvestment * 1.5)));
  // LOD: reduce primaries when zoomed out
  const primaryCount = branchLOD < 1 ? Math.max(2, Math.round(rawPrimaryCount * branchLOD)) : rawPrimaryCount;

  // Tilt from vertical: leafSize → near-horizontal, heightPriority → near-vertical
  const primaryTilt = Math.max(0.15, Math.min(1.5,
    0.6 + genome.leafSize * 0.7 - genome.heightPriority * 0.7
        + genome.rootPriority * 0.1 + genome.seedInvestment * 0.2));

  // Branch length: leafSize → long reaching, heightPriority → short stubs
  const primaryLength = sil.trunkH * (
    0.15 + genome.leafSize * 0.40 - genome.heightPriority * 0.10
         + genome.rootPriority * 0.05 + genome.seedInvestment * 0.15);

  // Branch thickness: rootPriority → massive, seedInvestment → wire-thin
  const primaryThickness = sil.trunkThickness * (
    0.30 + genome.rootPriority * 0.35 - genome.seedInvestment * 0.15);

  // Secondary count per primary (LOD: skip secondaries when zoomed out)
  const rawSecondary = Math.max(0, Math.min(2,
    Math.round(genome.leafSize * 2.0 - genome.heightPriority * 1.2 + genome.seedInvestment * 0.5 - 0.2)));
  const secondaryPerPrimary = branchLOD < 0.6 ? 0 : rawSecondary;

  // Per-tip canopy sizing: archetype-aware volume distribution
  const totalTips = Math.min(MAX_BRANCHES_PER_PLANT,
    primaryCount * (1 + secondaryPerPrimary));
  const sizeExponent = 1 / 3 + genome.heightPriority * 0.1 + genome.seedInvestment * 0.15
                             - genome.leafSize * 0.08;
  const volumeShare = 1 / Math.pow(Math.max(1, totalTips), Math.max(0.2, sizeExponent));

  // Attachment height range: genome-driven distribution
  const attachLow = 0.50 - genome.heightPriority * 0.30 - genome.seedInvestment * 0.15;
  const attachHigh = 0.90 + genome.heightPriority * 0.05;

  for (let i = 0; i < primaryCount; i++) {
    if (segmentCount >= MAX_BRANCHES_PER_PLANT) break;

    // Round-robin branches across stems
    const stem = stems[i % stems.length];

    // Attach height: genome-driven range with jitter
    const baseFrac = attachLow + (i / Math.max(1, primaryCount - 1)) * (attachHigh - attachLow);
    const attachJitter = (plantHash(plantId, i * 10 + 1) - 0.5) * 0.10;
    const attachFrac = Math.max(0.15, Math.min(0.95, baseFrac + attachJitter));

    // Interpolate attachment point along the assigned stem
    const attachX = stem.baseX + (stem.tipX - stem.baseX) * attachFrac;
    const attachY = stem.baseY + (stem.tipY - stem.baseY) * attachFrac;
    const attachZ = stem.baseZ + (stem.tipZ - stem.baseZ) * attachFrac;

    // Angle around trunk: evenly spaced + jitter
    const baseAngle = (i / primaryCount) * Math.PI * 2;
    const angleJitter = (plantHash(plantId, i * 10 + 2) - 0.5) * 0.8;
    const angle = baseAngle + angleJitter;

    // Per-branch length/tilt jitter
    const lenJitter = 0.85 + plantHash(plantId, i * 10 + 3) * 0.30;
    const len = primaryLength * lenJitter * vis;
    const thick = primaryThickness * vis;
    const tilt = primaryTilt + (plantHash(plantId, i * 10 + 4) - 0.5) * 0.2;

    // Direction vector
    const sinT = Math.sin(tilt);
    const cosT = Math.cos(tilt);
    const dirX = Math.sin(angle) * sinT;
    const dirY = cosT;
    const dirZ = Math.cos(angle) * sinT;

    // Write branch cylinder only if visible
    if (vis >= 0.01) {
      dummy.position.set(
        attachX + dirX * len * 0.5,
        attachY + dirY * len * 0.5,
        attachZ + dirZ * len * 0.5,
      );
      dummy.scale.set(thick, len, thick);
      dummy.rotation.set(0, 0, 0);
      dummy.rotateY(angle);
      dummy.rotateX(tilt);
      dummy.updateMatrix();

      const bIdx = branchIdx + branchCount;
      dummy.matrix.toArray(brMtx, bIdx * 16);
      const ci = bIdx * 3;
      brClr[ci]     = tr;
      brClr[ci + 1] = tg;
      brClr[ci + 2] = tb;
      branchCount++;
    }

    // Canopy blob at primary tip
    const tipX = attachX + dirX * len;
    const tipY = attachY + dirY * len;
    const tipZ = attachZ + dirZ * len;
    const jitter = 0.85 + plantHash(plantId, i * 10 + 5) * 0.30;

    dummy.position.set(tipX, tipY, tipZ);
    dummy.scale.set(
      sil.canopyX * volumeShare * jitter,
      sil.canopyY * volumeShare * jitter,
      sil.canopyZ * volumeShare * jitter,
    );
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();

    const cIdx = canopyIdx + canopyCount;
    dummy.matrix.toArray(canopyMtx, cIdx * 16);
    const cci = cIdx * 3;
    canopyClr[cci]     = cr;
    canopyClr[cci + 1] = cg;
    canopyClr[cci + 2] = cb;
    canopyCount++;
    segmentCount++;

    // ── Level 2: Secondary branches (fork from primary) ──
    for (let j = 0; j < secondaryPerPrimary; j++) {
      if (segmentCount >= MAX_BRANCHES_PER_PLANT) break;

      // Attach 70-95% along parent
      const secAttachFrac = 0.70 + plantHash(plantId, i * 10 + j * 5 + 50) * 0.25;
      const secBaseX = attachX + dirX * len * secAttachFrac;
      const secBaseY = attachY + dirY * len * secAttachFrac;
      const secBaseZ = attachZ + dirZ * len * secAttachFrac;

      // Diverge from parent by 0.5-1.2 rad, alternating left/right
      const side = j % 2 === 0 ? 1 : -1;
      const diverge = 0.5 + plantHash(plantId, i * 10 + j * 5 + 51) * 0.7;
      const secAngle = angle + side * diverge;
      const secTilt = Math.min(1.5, tilt + 0.15 + plantHash(plantId, i * 10 + j * 5 + 52) * 0.2);

      // Secondary length/thickness: 50-70% of parent
      const secLenFrac = 0.50 + plantHash(plantId, i * 10 + j * 5 + 53) * 0.20;
      const secLen = len * secLenFrac;
      const secThickFrac = 0.50 + plantHash(plantId, i * 10 + j * 5 + 54) * 0.20;
      const secThick = thick * secThickFrac;

      const sinS = Math.sin(secTilt);
      const cosS = Math.cos(secTilt);
      const sDirX = Math.sin(secAngle) * sinS;
      const sDirY = cosS;
      const sDirZ = Math.cos(secAngle) * sinS;

      // Write branch cylinder only if visible
      if (vis >= 0.01) {
        dummy.position.set(
          secBaseX + sDirX * secLen * 0.5,
          secBaseY + sDirY * secLen * 0.5,
          secBaseZ + sDirZ * secLen * 0.5,
        );
        dummy.scale.set(secThick, secLen, secThick);
        dummy.rotation.set(0, 0, 0);
        dummy.rotateY(secAngle);
        dummy.rotateX(secTilt);
        dummy.updateMatrix();

        const sIdx = branchIdx + branchCount;
        dummy.matrix.toArray(brMtx, sIdx * 16);
        const sci = sIdx * 3;
        brClr[sci]     = tr;
        brClr[sci + 1] = tg;
        brClr[sci + 2] = tb;
        branchCount++;
      }

      // Canopy blob at secondary tip
      const secTipX = secBaseX + sDirX * secLen;
      const secTipY = secBaseY + sDirY * secLen;
      const secTipZ = secBaseZ + sDirZ * secLen;
      const secJitter = 0.85 + plantHash(plantId, i * 10 + j * 5 + 55) * 0.30;

      dummy.position.set(secTipX, secTipY, secTipZ);
      dummy.scale.set(
        sil.canopyX * volumeShare * secJitter,
        sil.canopyY * volumeShare * secJitter,
        sil.canopyZ * volumeShare * secJitter,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();

      const scIdx = canopyIdx + canopyCount;
      dummy.matrix.toArray(canopyMtx, scIdx * 16);
      const scci = scIdx * 3;
      canopyClr[scci]     = cr;
      canopyClr[scci + 1] = cg;
      canopyClr[scci + 2] = cb;
      canopyCount++;
      segmentCount++;
    }
  }

  // ── Conifer apex: extra canopy blob at tallest stem's tip ──
  if (genome.heightPriority > 0.4 && segmentCount < MAX_BRANCHES_PER_PLANT) {
    const apexStrength = Math.min(1, (genome.heightPriority - 0.4) * 2.5);
    const apexSize = sil.canopyY * volumeShare * 0.7 * apexStrength;

    // Use tallest stem tip
    let tallestStem = stems[0];
    for (let s = 1; s < stems.length; s++) {
      if (stems[s].tipY > tallestStem.tipY) tallestStem = stems[s];
    }

    dummy.position.set(tallestStem.tipX, tallestStem.tipY * 0.98 + baseY * 0.02, tallestStem.tipZ);
    dummy.scale.set(apexSize * 0.5, apexSize * 1.3, apexSize * 0.5);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();

    const cIdx = canopyIdx + canopyCount;
    dummy.matrix.toArray(canopyMtx, cIdx * 16);
    const cci = cIdx * 3;
    canopyClr[cci]     = cr;
    canopyClr[cci + 1] = cg;
    canopyClr[cci + 2] = cb;
    canopyCount++;
    segmentCount++;
  }

  // ── Buttress blobs: root-dominant plants get foliage mass near base ──
  if (genome.rootPriority > 0.5 && segmentCount < MAX_BRANCHES_PER_PLANT) {
    const buttressStrength = Math.min(1, (genome.rootPriority - 0.5) * 2.5);
    const buttressSize = sil.canopyX * volumeShare * 0.5 * buttressStrength;
    const buttressCount = genome.rootPriority > 0.7 ? 2 : 1;

    for (let bi = 0; bi < buttressCount && segmentCount < MAX_BRANCHES_PER_PLANT; bi++) {
      const bAngle = plantHash(plantId, 200 + bi) * Math.PI * 2;
      const bDist = sil.trunkThickness * 0.3;

      dummy.position.set(
        wx + Math.sin(bAngle) * bDist,
        baseY + sil.trunkH * 0.15,
        wz + Math.cos(bAngle) * bDist,
      );
      dummy.scale.set(buttressSize, buttressSize * 0.6, buttressSize);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();

      const cIdx = canopyIdx + canopyCount;
      dummy.matrix.toArray(canopyMtx, cIdx * 16);
      const cci = cIdx * 3;
      canopyClr[cci]     = cr * 0.85 + tr * 0.15;
      canopyClr[cci + 1] = cg * 0.85 + tg * 0.15;
      canopyClr[cci + 2] = cb * 0.85 + tb * 0.15;
      canopyCount++;
      segmentCount++;
    }
  }

  return { branchCount, canopyCount };
}
