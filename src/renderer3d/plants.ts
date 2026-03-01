import { Genome } from '../types';
import {
  RendererState, HALF, MAX_INSTANCES, MAX_SEEDS,
  DEATH_ANIM_FRAMES, GROWTH_ANIM_FRAMES, SEED_FLIGHT_FRAMES, BURN_ANIM_FRAMES,
  computeSilhouette, easeOutCubic, lerp,
} from './state';

function plantColor(state: RendererState, speciesId: number, genome: Genome) {
  const sc = state.world.speciesColors.get(speciesId);
  const gr = 0.2 + genome.rootPriority * 0.6;
  const gg = 0.3 + genome.leafSize * 0.5;
  const gb = 0.2 + genome.heightPriority * 0.6;
  return {
    cr: sc ? sc.r * 0.7 + gr * 0.3 : gr,
    cg: sc ? sc.g * 0.7 + gg * 0.3 : gg,
    cb: sc ? sc.b * 0.7 + gb * 0.3 : gb,
  };
}

function writeInstance(
  state: RendererState,
  idx: number,
  wx: number, wz: number, baseY: number,
  sil: ReturnType<typeof computeSilhouette>,
  cr: number, cg: number, cb: number,
  tiltAngle: number, tiltDir: number,
  trunkMtx: Float32Array, trunkClr: Float32Array,
  canopyMtx: Float32Array, canopyClr: Float32Array,
  canopy2Mtx: Float32Array, canopy2Clr: Float32Array,
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

  // ── Primary canopy (overlaps trunk top) ──
  const canopyCenterY = baseY + sil.trunkH - sil.canopyY * 0.3;
  dummy.position.set(wx, canopyCenterY, wz);
  dummy.scale.set(sil.canopyX, sil.canopyY, sil.canopyZ);
  dummy.rotation.set(0, 0, 0);
  dummy.updateMatrix();
  dummy.matrix.toArray(canopyMtx, idx * 16);

  // ── Secondary canopy blob (offset, 70% scale) ──
  dummy.position.set(
    wx + 0.15 * sil.canopyX,
    canopyCenterY - sil.canopyY * 0.1,
    wz + 0.15 * sil.canopyZ,
  );
  dummy.scale.set(sil.canopyX * sil.blob2, sil.canopyY * sil.blob2, sil.canopyZ * sil.blob2);
  dummy.updateMatrix();
  dummy.matrix.toArray(canopy2Mtx, idx * 16);

  // ── Colors ──
  const ci = idx * 3;

  // Bark: 85% fixed brown + 15% species tint
  const barkR = 0.28, barkG = 0.18, barkB = 0.10;
  trunkClr[ci]     = barkR * 0.85 + cr * 0.15;
  trunkClr[ci + 1] = barkG * 0.85 + cg * 0.15;
  trunkClr[ci + 2] = barkB * 0.85 + cb * 0.15;

  canopyClr[ci] = cr;
  canopyClr[ci + 1] = cg;
  canopyClr[ci + 2] = cb;
  canopy2Clr[ci] = cr;
  canopy2Clr[ci + 1] = cg;
  canopy2Clr[ci + 2] = cb;
}

export function updatePlants(state: RendererState): void {
  const { world, trunks, canopies, canopies2, growingPlants, flyingSeeds, dyingPlants, burningPlants, getCellElevation } = state;

  const trunkMtx = trunks.instanceMatrix.array as Float32Array;
  const trunkClr = trunks.instanceColor!.array as Float32Array;
  const canopyMtx = canopies.instanceMatrix.array as Float32Array;
  const canopyClr = canopies.instanceColor!.array as Float32Array;
  const canopy2Mtx = canopies2.instanceMatrix.array as Float32Array;
  const canopy2Clr = canopies2.instanceColor!.array as Float32Array;

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
  const flyingChildIds = new Set(flyingSeeds.map(fs => fs.childId));

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

  // ── Build new snapshots + render live plants ──
  const newSnapshots = new Map<number, typeof state.prevSnapshots extends Map<number, infer V> ? V : never>();
  let idx = 0;

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
    const sil = computeSilhouette(plant.height, plant.rootDepth, plant.leafArea, plant.genome.leafSize);

    // Apply growth animation scale
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
        sil.blob2 *= s;
      }
    }

    const { cr, cg, cb } = plantColor(state, plant.speciesId, plant.genome);
    const baseY = getCellElevation(plant.x, plant.y);

    writeInstance(state, idx, wx, wz, baseY, sil, cr, cg, cb, 0, 0,
      trunkMtx, trunkClr, canopyMtx, canopyClr, canopy2Mtx, canopy2Clr);
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

    const raw = computeSilhouette(dp.height, dp.rootDepth, dp.leafArea, dp.genome.leafSize);
    const sil = {
      trunkH: raw.trunkH * shrink,
      trunkThickness: raw.trunkThickness * shrink,
      canopyX: raw.canopyX * shrink,
      canopyY: raw.canopyY * shrink,
      canopyZ: raw.canopyZ * shrink,
      blob2: raw.blob2 * shrink,
    };

    const tiltProgress = Math.max(0, (dp.progress - 0.3) / 0.7);
    const tiltAngle = tiltProgress * (Math.PI / 3);
    const tiltDir = ((id * 7) % 13) / 13 * Math.PI * 2;

    const { cr: origR, cg: origG, cb: origB } = plantColor(state, dp.speciesId, dp.genome);
    const p = dp.progress;
    const cr = origR * (1 - p) + 0.35 * p;
    const cg = origG * (1 - p) + 0.20 * p;
    const cb = origB * (1 - p) + 0.08 * p;

    const baseY = getCellElevation(dp.x, dp.y);
    writeInstance(state, idx, wx, wz, baseY, sil, cr, cg, cb, tiltAngle, tiltDir,
      trunkMtx, trunkClr, canopyMtx, canopyClr, canopy2Mtx, canopy2Clr);
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
    const raw = computeSilhouette(bp.height, bp.rootDepth, bp.leafArea, bp.genome.leafSize);

    const burnShrink = 1 - bp.progress * 0.3;
    const sil = {
      trunkH: raw.trunkH * burnShrink,
      trunkThickness: raw.trunkThickness * burnShrink,
      canopyX: raw.canopyX * burnShrink,
      canopyY: raw.canopyY * burnShrink,
      canopyZ: raw.canopyZ * burnShrink,
      blob2: raw.blob2 * burnShrink,
    };

    const flicker = Math.sin(performance.now() * 0.015 + id * 7) * 0.5 + 0.5;
    const t = bp.progress;
    const cr = lerp(1.0, 0.2, t * 0.5) * (0.8 + flicker * 0.2);
    const cg = lerp(0.6, 0.05, t) * (0.7 + flicker * 0.3);
    const cb = lerp(0.1, 0.02, t);

    const baseY = getCellElevation(bp.x, bp.y);
    writeInstance(state, idx, wx, wz, baseY, sil, cr, cg, cb, 0, 0,
      trunkMtx, trunkClr, canopyMtx, canopyClr, canopy2Mtx, canopy2Clr);
    idx++;
  }
  for (const id of burnToRemove) burningPlants.delete(id);

  trunks.count = idx;
  canopies.count = idx;
  canopies2.count = idx;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  canopies2.instanceMatrix.needsUpdate = true;
  trunks.instanceColor!.needsUpdate = true;
  canopies.instanceColor!.needsUpdate = true;
  canopies2.instanceColor!.needsUpdate = true;
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

    const sc = world.speciesColors.get(fs.speciesId);
    const ci = seedIdx * 3;
    seedClr[ci]     = sc ? sc.r * 0.4 + 0.3 : 0.5;
    seedClr[ci + 1] = sc ? sc.g * 0.4 + 0.2 : 0.35;
    seedClr[ci + 2] = sc ? sc.b * 0.4 + 0.1 : 0.2;

    seedIdx++;
  }

  seeds.count = seedIdx;
  if (seedIdx > 0) {
    seeds.instanceMatrix.needsUpdate = true;
    seeds.instanceColor!.needsUpdate = true;
  }
}
