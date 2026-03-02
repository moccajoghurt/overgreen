import { Genome, GRID_WIDTH, WeatherOverlay, Season } from '../types';
import {
  RendererState, HALF, MAX_INSTANCES, MAX_SEEDS, MAX_BRANCHES_PER_PLANT,
  DEATH_ANIM_FRAMES, GROWTH_ANIM_FRAMES, SEED_FLIGHT_FRAMES, BURN_ANIM_FRAMES,
  computeSilhouette, computeSeasonalFoliageFactor, easeOutCubic, lerp, plantHash,
} from './state';

function naturalCanopyColor(genome: Genome) {
  const { rootPriority, heightPriority, leafSize, seedInvestment } = genome;
  // Base: mid-forest green
  let r = 0.16;
  let g = 0.42;
  let b = 0.14;

  // leafSize high → brighter, lusher green
  g += leafSize * 0.18;
  r += leafSize * 0.04;

  // heightPriority high → darker, deeper green
  g -= heightPriority * 0.10;
  r -= heightPriority * 0.04;

  // rootPriority high → olive/yellow-green shift
  r += rootPriority * 0.08;
  b -= rootPriority * 0.03;

  // seedInvestment high → slight warm tint
  r += seedInvestment * 0.06;
  g -= seedInvestment * 0.02;

  return {
    cr: Math.max(0.08, Math.min(0.35, r)),
    cg: Math.max(0.22, Math.min(0.65, g)),
    cb: Math.max(0.05, Math.min(0.20, b)),
  };
}

function naturalTrunkColor(genome: Genome) {
  const { rootPriority, heightPriority, leafSize } = genome;
  // Base: bark brown
  let r = 0.28;
  let g = 0.18;
  let b = 0.10;

  // rootPriority high → darker, richer brown
  r -= rootPriority * 0.06;
  g -= rootPriority * 0.04;
  b -= rootPriority * 0.02;

  // heightPriority high → lighter, grayer bark (birch-like)
  r += heightPriority * 0.10;
  g += heightPriority * 0.10;
  b += heightPriority * 0.08;

  // leafSize high → slight mossy warmth
  g += leafSize * 0.04;
  r += leafSize * 0.02;

  return {
    tr: Math.max(0.15, Math.min(0.42, r)),
    tg: Math.max(0.10, Math.min(0.32, g)),
    tb: Math.max(0.06, Math.min(0.22, b)),
  };
}

function seasonalCanopyColor(
  cr: number, cg: number, cb: number,
  env: { season: Season; seasonProgress: number },
): { cr: number; cg: number; cb: number } {
  const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;

  const seasonTargets: [number, number, number][] = [
    [0.30, 0.55, 0.15], // Spring: fresh green
    [cr,   cg,   cb  ], // Summer: identity
    [0.70, 0.18, 0.04], // Autumn: vivid orange-red
    [0.35, 0.28, 0.20], // Winter: gray-brown bark
  ];

  const c0 = seasonTargets[env.season];
  const c1 = seasonTargets[(env.season + 1) % 4];
  const tr = c0[0] + (c1[0] - c0[0]) * t;
  const tg = c0[1] + (c1[1] - c0[1]) * t;
  const tb = c0[2] + (c1[2] - c0[2]) * t;

  let blendStrength: number;
  if (env.season === Season.Summer) {
    blendStrength = 0.05 + t * 0.15; // warm up toward end of summer
  } else if (env.season === Season.Autumn) {
    blendStrength = 0.7 * t + 0.25; // strong from the start, nearly full by end
  } else if (env.season === Season.Winter) {
    blendStrength = 0.6;
  } else {
    blendStrength = 0.5 * (1 - t);
  }

  return {
    cr: lerp(cr, tr, blendStrength),
    cg: lerp(cg, tg, blendStrength),
    cb: lerp(cb, tb, blendStrength),
  };
}

function computePlantColors(state: RendererState, speciesId: number, genome: Genome) {
  if (state.colorMode === 'natural') {
    const canopy = naturalCanopyColor(genome);
    const trunk = naturalTrunkColor(genome);
    return { ...canopy, ...trunk };
  }

  // Species mode: current behavior
  const sc = state.world.speciesColors.get(speciesId);
  const gr = 0.2 + genome.rootPriority * 0.6;
  const gg = 0.3 + genome.leafSize * 0.5;
  const gb = 0.2 + genome.heightPriority * 0.6;
  const cr = sc ? sc.r * 0.7 + gr * 0.3 : gr;
  const cg = sc ? sc.g * 0.7 + gg * 0.3 : gg;
  const cb = sc ? sc.b * 0.7 + gb * 0.3 : gb;

  const barkR = 0.28, barkG = 0.18, barkB = 0.10;
  return {
    cr, cg, cb,
    tr: barkR * 0.85 + cr * 0.15,
    tg: barkG * 0.85 + cg * 0.15,
    tb: barkB * 0.85 + cb * 0.15,
  };
}

function writeInstance(
  state: RendererState,
  idx: number,
  wx: number, wz: number, baseY: number,
  sil: ReturnType<typeof computeSilhouette>,
  tr: number, tg: number, tb: number,
  tiltAngle: number, tiltDir: number,
  trunkMtx: Float32Array, trunkClr: Float32Array,
): void {
  const { dummy } = state;

  // ── Trunk ──
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
}

/** Writes 2-level branch cylinders + canopy blobs at each branch tip. */
function writeBranchesAndCanopies(
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
): { branchCount: number; canopyCount: number } {
  const { dummy } = state;
  const vis = sil.branchVisibility * branchScale;

  let branchCount = 0;
  let canopyCount = 0;
  let segmentCount = 0;

  // ── Level 1: Primary branches ──
  const primaryCount = Math.max(2, Math.min(5,
    Math.round(3 + genome.leafSize * 2 - genome.heightPriority * 1)));

  // Tilt from vertical: leafy → outward, tall → upward
  const primaryTilt = Math.max(0.3, Math.min(1.3,
    0.8 + genome.leafSize * 0.5 - genome.heightPriority * 0.5));

  // Branch length and thickness from genome
  const primaryLength = sil.trunkH * (0.25 + genome.leafSize * 0.30 + genome.rootPriority * 0.10);
  const primaryThickness = sil.trunkThickness * (0.35 + genome.rootPriority * 0.25);

  // Secondary count per primary
  const secondaryPerPrimary = Math.max(0, Math.min(2,
    Math.round(0.5 + genome.leafSize * 1.5 - genome.heightPriority * 0.8)));

  // Per-tip canopy sizing: preserve total volume across tips
  const totalTips = Math.min(MAX_BRANCHES_PER_PLANT,
    primaryCount * (1 + secondaryPerPrimary));
  const volumeShare = 1 / Math.pow(Math.max(1, totalTips), 1 / 3);

  for (let i = 0; i < primaryCount; i++) {
    if (segmentCount >= MAX_BRANCHES_PER_PLANT) break;

    // Attach height: evenly distributed between 45-90% of trunk height with jitter
    const baseFrac = 0.45 + (i / Math.max(1, primaryCount - 1)) * 0.45;
    const attachJitter = (plantHash(plantId, i * 10 + 1) - 0.5) * 0.10;
    const attachFrac = Math.max(0.40, Math.min(0.95, baseFrac + attachJitter));
    const attachY = baseY + sil.trunkH * attachFrac;

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
        wx + dirX * len * 0.5,
        attachY + dirY * len * 0.5,
        wz + dirZ * len * 0.5,
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
    const tipX = wx + dirX * len;
    const tipY = attachY + dirY * len;
    const tipZ = wz + dirZ * len;
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
      const secBaseX = wx + dirX * len * secAttachFrac;
      const secBaseY = attachY + dirY * len * secAttachFrac;
      const secBaseZ = wz + dirZ * len * secAttachFrac;

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

  return { branchCount, canopyCount };
}

export function updatePlants(state: RendererState): void {
  const { world, trunks, canopies, branches,
    growingPlants, flyingSeeds, dyingPlants, burningPlants, getCellElevation } = state;

  // Skip full rebuild if no tick occurred and no animations are active
  const hasTicked = world.tick !== state.lastPlantTick;
  const hasAnimations = growingPlants.size > 0 || dyingPlants.size > 0
    || burningPlants.size > 0 || flyingSeeds.length > 0;
  if (!hasTicked && !hasAnimations) return;
  state.lastPlantTick = world.tick;

  const trunkMtx = trunks.instanceMatrix.array as Float32Array;
  const trunkClr = trunks.instanceColor!.array as Float32Array;
  const canopyMtx = canopies.instanceMatrix.array as Float32Array;
  const canopyClr = canopies.instanceColor!.array as Float32Array;
  const brMtx = branches.instanceMatrix.array as Float32Array;
  const brClr = branches.instanceColor!.array as Float32Array;

  // ── Ingest seed events (once per simulation tick) ──
  if (world.tick !== state.lastProcessedTick) {
    state.lastProcessedTick = world.tick;
    for (const evt of world.seedEvents) {
      let parentHeight = 1.0;
      for (const p of world.plants.values()) {
        if (p.x === evt.parentX && p.y === evt.parentY && p.alive) {
          parentHeight = p.height;
          break;
        }
      }
      const startY = Math.max(0.1, parentHeight * 0.35);
      const dx = Math.abs(evt.childX - evt.parentX);
      const dy = Math.abs(evt.childY - evt.parentY);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const arcPeak = Math.max(1.5, startY * 0.5 + dist * 0.5);
      flyingSeeds.push({
        parentX: evt.parentX, parentY: evt.parentY,
        childX: evt.childX, childY: evt.childY,
        childId: evt.childId, speciesId: evt.speciesId,
        progress: 0, startY, arcPeak,
      });
    }
  }

  // ── Build set of plants whose seeds are still in flight ──
  const flyingChildIds = new Set<number>();
  for (let i = 0; i < flyingSeeds.length; i++) flyingChildIds.add(flyingSeeds[i].childId);

  // ── Clean up flying seeds for plants that no longer exist ──
  for (let i = flyingSeeds.length - 1; i >= 0; i--) {
    if (!world.plants.has(flyingSeeds[i].childId)) {
      flyingSeeds.splice(i, 1);
    }
  }

  // ── Ingest fire death events (accumulated across ticks) ──
  const fireDeathIds = new Set<number>();
  for (const evt of world.fireDeathEvents) {
    fireDeathIds.add(evt.id);
    burningPlants.set(evt.id, {
      x: evt.x, y: evt.y,
      height: evt.height, rootDepth: evt.rootDepth,
      leafArea: evt.leafArea, speciesId: evt.speciesId,
      genome: { ...evt.genome },
      progress: 0,
    });
  }
  world.fireDeathEvents.length = 0;

  // ── Detect deaths: plants in prev snapshot but no longer in world ──
  for (const [id, snap] of state.prevSnapshots) {
    if (!world.plants.has(id) && !flyingChildIds.has(id) && !fireDeathIds.has(id)) {
      dyingPlants.set(id, { ...snap, progress: 0 });
    }
  }

  // ── Seasonal foliage factor (once per frame) ──
  const env = world.environment;
  const foliageFactor = computeSeasonalFoliageFactor(env);
  const canopyScale = Math.max(0.05, foliageFactor);

  // ── Build new snapshots + render live plants ──
  const newSnapshots = new Map<number, typeof state.prevSnapshots extends Map<number, infer V> ? V : never>();
  let idx = 0;
  let branchIdx = 0;
  let canopyIdx = 0;

  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;

    newSnapshots.set(plant.id, {
      x: plant.x, y: plant.y,
      height: plant.height, rootDepth: plant.rootDepth,
      leafArea: plant.leafArea, speciesId: plant.speciesId,
      genome: { ...plant.genome },
    });

    // Skip rendering if seed is still in flight
    if (flyingChildIds.has(plant.id)) continue;

    const wx = plant.x - HALF + 0.5;
    const wz = plant.y - HALF + 0.5;
    const sil = computeSilhouette(plant.height, plant.rootDepth, plant.leafArea, plant.genome);

    // Apply growth animation scale
    let branchScale = 1.0;
    const growing = growingPlants.get(plant.id);
    if (growing) {
      growing.progress += 1 / GROWTH_ANIM_FRAMES;
      if (growing.progress >= 1) {
        growingPlants.delete(plant.id);
      } else {
        const s = Math.max(0.05, easeOutCubic(growing.progress));
        sil.trunkH *= s;
        sil.trunkThickness *= s;
        sil.canopyX *= s;
        sil.canopyY *= s;
        sil.canopyZ *= s;
        // Branches appear with delay: start at 30% growth, finish at 100%
        branchScale = Math.max(0, easeOutCubic(Math.max(0, growing.progress - 0.3) / 0.7));
      }
    }

    // Apply seasonal foliage scale (canopy shrinks in autumn/winter, trunk+branches unchanged)
    sil.canopyX *= canopyScale;
    sil.canopyY *= canopyScale;
    sil.canopyZ *= canopyScale;

    let { cr, cg, cb, tr, tg, tb } = computePlantColors(state, plant.speciesId, plant.genome);

    // Apply seasonal canopy color shift
    const sc = seasonalCanopyColor(cr, cg, cb, env);
    cr = sc.cr; cg = sc.cg; cb = sc.cb;

    const baseY = getCellElevation(plant.x, plant.y);

    // Desaturate diseased plant canopies toward sickly yellow-brown
    if (world.environment.weatherOverlay[plant.y * GRID_WIDTH + plant.x] === WeatherOverlay.Diseased) {
      cr = lerp(cr, 0.50, 0.45);
      cg = lerp(cg, 0.45, 0.45);
      cb = lerp(cb, 0.10, 0.45);
    }

    writeInstance(state, idx, wx, wz, baseY, sil, tr, tg, tb, 0, 0,
      trunkMtx, trunkClr);
    const liveResult = writeBranchesAndCanopies(state, branchIdx, canopyIdx, plant.id,
      wx, wz, baseY, sil, plant.genome, tr, tg, tb, cr, cg, cb, branchScale,
      brMtx, brClr, canopyMtx, canopyClr);
    branchIdx += liveResult.branchCount;
    canopyIdx += liveResult.canopyCount;
    idx++;
  }

  state.prevSnapshots = newSnapshots;

  // ── Render dying plants ──
  const toRemove: number[] = [];
  for (const [id, dp] of dyingPlants) {
    dp.progress += 1 / DEATH_ANIM_FRAMES;
    if (dp.progress >= 1) { toRemove.push(id); continue; }
    if (idx >= MAX_INSTANCES) continue;

    const wx = dp.x - HALF + 0.5;
    const wz = dp.y - HALF + 0.5;
    const shrink = 1 - dp.progress;

    const raw = computeSilhouette(dp.height, dp.rootDepth, dp.leafArea, dp.genome);
    const sil = {
      trunkH: raw.trunkH * shrink,
      trunkThickness: raw.trunkThickness * shrink,
      canopyX: raw.canopyX * shrink * canopyScale,
      canopyY: raw.canopyY * shrink * canopyScale,
      canopyZ: raw.canopyZ * shrink * canopyScale,
      branchVisibility: raw.branchVisibility,
    };

    const tiltProgress = Math.max(0, (dp.progress - 0.3) / 0.7);
    const tiltAngle = tiltProgress * (Math.PI / 3);
    const tiltDir = ((id * 7) % 13) / 13 * Math.PI * 2;

    const orig = computePlantColors(state, dp.speciesId, dp.genome);
    const sOrig = seasonalCanopyColor(orig.cr, orig.cg, orig.cb, env);
    const p = dp.progress;
    const cr = sOrig.cr * (1 - p) + 0.35 * p;
    const cg = sOrig.cg * (1 - p) + 0.20 * p;
    const cb = sOrig.cb * (1 - p) + 0.08 * p;
    const tr = orig.tr * (1 - p) + 0.20 * p;
    const tg = orig.tg * (1 - p) + 0.12 * p;
    const tb = orig.tb * (1 - p) + 0.06 * p;

    const baseY = getCellElevation(dp.x, dp.y);
    writeInstance(state, idx, wx, wz, baseY, sil, tr, tg, tb, tiltAngle, tiltDir,
      trunkMtx, trunkClr);
    const dyingResult = writeBranchesAndCanopies(state, branchIdx, canopyIdx, id,
      wx, wz, baseY, sil, dp.genome, tr, tg, tb, cr, cg, cb, shrink,
      brMtx, brClr, canopyMtx, canopyClr);
    branchIdx += dyingResult.branchCount;
    canopyIdx += dyingResult.canopyCount;
    idx++;
  }
  for (const id of toRemove) dyingPlants.delete(id);

  // ── Render burning plants (fire deaths) ──
  const burnToRemove: number[] = [];
  for (const [id, bp] of burningPlants) {
    bp.progress += 1 / BURN_ANIM_FRAMES;
    if (bp.progress >= 1) {
      burnToRemove.push(id);
      dyingPlants.set(id, { ...bp, progress: 0 });
      continue;
    }
    if (idx >= MAX_INSTANCES) continue;

    const wx = bp.x - HALF + 0.5;
    const wz = bp.y - HALF + 0.5;
    const raw = computeSilhouette(bp.height, bp.rootDepth, bp.leafArea, bp.genome);

    const burnShrink = 1 - bp.progress * 0.3;
    const sil = {
      trunkH: raw.trunkH * burnShrink,
      trunkThickness: raw.trunkThickness * burnShrink,
      canopyX: raw.canopyX * burnShrink * canopyScale,
      canopyY: raw.canopyY * burnShrink * canopyScale,
      canopyZ: raw.canopyZ * burnShrink * canopyScale,
      branchVisibility: raw.branchVisibility,
    };

    const flicker = Math.sin(performance.now() * 0.015 + id * 7) * 0.5 + 0.5;
    const t = bp.progress;
    const cr = lerp(1.0, 0.2, t * 0.5) * (0.8 + flicker * 0.2);
    const cg = lerp(0.6, 0.05, t) * (0.7 + flicker * 0.3);
    const cb = lerp(0.1, 0.02, t);

    const baseY = getCellElevation(bp.x, bp.y);
    writeInstance(state, idx, wx, wz, baseY, sil, cr, cg, cb, 0, 0,
      trunkMtx, trunkClr);
    const burnResult = writeBranchesAndCanopies(state, branchIdx, canopyIdx, id,
      wx, wz, baseY, sil, bp.genome, cr, cg, cb, cr, cg, cb, burnShrink,
      brMtx, brClr, canopyMtx, canopyClr);
    branchIdx += burnResult.branchCount;
    canopyIdx += burnResult.canopyCount;
    idx++;
  }
  for (const id of burnToRemove) burningPlants.delete(id);

  trunks.count = idx;
  canopies.count = canopyIdx;
  branches.count = branchIdx;
  trunks.instanceMatrix.needsUpdate = true;
  trunks.instanceColor!.needsUpdate = true;
  if (canopyIdx > 0) {
    canopies.instanceMatrix.needsUpdate = true;
    canopies.instanceColor!.needsUpdate = true;
  }
  if (branchIdx > 0) {
    branches.instanceMatrix.needsUpdate = true;
    branches.instanceColor!.needsUpdate = true;
  }
}

export function updateSeeds(state: RendererState): void {
  const { world, dummy, seeds, flyingSeeds, growingPlants, getCellElevation } = state;

  const seedMtx = seeds.instanceMatrix.array as Float32Array;
  const seedClr = seeds.instanceColor!.array as Float32Array;
  let seedIdx = 0;

  for (let i = flyingSeeds.length - 1; i >= 0; i--) {
    const fs = flyingSeeds[i];
    fs.progress += 1 / SEED_FLIGHT_FRAMES;

    if (fs.progress >= 1) {
      if (world.plants.has(fs.childId)) {
        growingPlants.set(fs.childId, { plantId: fs.childId, progress: 0 });
      }
      flyingSeeds.splice(i, 1);
      continue;
    }

    if (seedIdx >= MAX_SEEDS) continue;

    const t = fs.progress;
    const wx0 = fs.parentX - HALF + 0.5;
    const wz0 = fs.parentY - HALF + 0.5;
    const wx1 = fs.childX - HALF + 0.5;
    const wz1 = fs.childY - HALF + 0.5;
    const parentElev = getCellElevation(fs.parentX, fs.parentY);
    const childElev = getCellElevation(fs.childX, fs.childY);

    const x = lerp(wx0, wx1, t);
    const z = lerp(wz0, wz1, t);
    const arcHeight = 4 * fs.arcPeak * t * (1 - t);
    const y = lerp(parentElev + fs.startY, childElev + 0.1, t) + arcHeight;

    dummy.position.set(x, y, z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    dummy.matrix.toArray(seedMtx, seedIdx * 16);

    const ci = seedIdx * 3;
    if (state.colorMode === 'natural') {
      seedClr[ci]     = 0.45;
      seedClr[ci + 1] = 0.32;
      seedClr[ci + 2] = 0.15;
    } else {
      const sc = world.speciesColors.get(fs.speciesId);
      seedClr[ci]     = sc ? sc.r * 0.4 + 0.3 : 0.5;
      seedClr[ci + 1] = sc ? sc.g * 0.4 + 0.2 : 0.35;
      seedClr[ci + 2] = sc ? sc.b * 0.4 + 0.1 : 0.2;
    }

    seedIdx++;
  }

  seeds.count = seedIdx;
  if (seedIdx > 0) {
    seeds.instanceMatrix.needsUpdate = true;
    seeds.instanceColor!.needsUpdate = true;
  }
}
