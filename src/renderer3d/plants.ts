import * as THREE from 'three';
import { GRID_WIDTH, WeatherOverlay } from '../types';
import {
  RendererState, GRID, HALF, MAX_SEEDS, MAX_DYING,
  DEATH_ANIM_FRAMES, GROWTH_ANIM_FRAMES, BURN_ANIM_FRAMES,
  easeOutCubic, lerp, plantHash,
} from './state';
import { computePlantTint } from './plant-colors';
import { classifySubtype, SHADER_GRASS_SUBTYPES } from '../types/subtypes';

const SUBTYPE_COUNT = 40;

// Pre-allocated temporaries for terrain-tilt quaternion math (zero allocation per frame)
const _qSpin  = new THREE.Quaternion();
const _qTiltX = new THREE.Quaternion();
const _qTiltZ = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);
const _yAxis = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);

/** Write one plant instance into the subtype's instance buffers. */
function writePlantInstance(
  state: RendererState,
  subtype: number, idx: number,
  mtxArrays: Float32Array[], clrArrays: Float32Array[],
  wx: number, wz: number, baseY: number,
  height: number, scale: number,
  plantId: number,
  tr: number, tg: number, tb: number,
): void {
  const { dummy, maturityHeights, groundCover } = state;
  const matH = maturityHeights[subtype];
  const s = (height / matH) * scale;

  const ry = plantHash(plantId, 0) * Math.PI * 2;
  if (groundCover[subtype]) {
    // Random XZ offset to break grid alignment (±0.15 units)
    const jx = (plantHash(plantId, 1) - 0.5) * 0.3;
    const jz = (plantHash(plantId, 2) - 0.5) * 0.3;
    dummy.position.set(wx + jx, baseY, wz + jz);
    dummy.scale.set(1, s, 1);

    // Recover cell coords and look up terrain slope
    const cx = Math.max(0, Math.min(GRID - 1, Math.round(wx + HALF - 0.5)));
    const cy = Math.max(0, Math.min(GRID - 1, Math.round(wz + HALF - 0.5)));
    const slope = state.getCellSlope(cx, cy);
    const dYdX = slope[0];
    const dYdZ = slope[1];

    // Compose: Rz(tilt) * Rx(tilt) * Ry(spin) — spin first, then world-space tilts
    _qSpin.setFromAxisAngle(_yAxis, ry);
    _qTiltX.setFromAxisAngle(_xAxis, -Math.atan2(dYdZ, 1));
    _qTiltZ.setFromAxisAngle(_zAxis, Math.atan2(dYdX, 1));
    dummy.quaternion.copy(_qTiltZ).multiply(_qTiltX).multiply(_qSpin);
  } else {
    dummy.position.set(wx, baseY, wz);
    dummy.scale.setScalar(s);
    dummy.quaternion.setFromAxisAngle(_yAxis, ry);
  }
  dummy.updateMatrix();
  dummy.matrix.toArray(mtxArrays[subtype], idx * 16);

  const ci = idx * 3;
  clrArrays[subtype][ci] = tr;
  clrArrays[subtype][ci + 1] = tg;
  clrArrays[subtype][ci + 2] = tb;
}

/** Compute final tint (base tint + disease + highlight) for a live plant. */
function computeFinalTint(
  state: RendererState,
  plantId: number, speciesId: number,
  genome: import('../types').Genome,
  x: number, y: number,
  lineageRoot: number,
): { tr: number; tg: number; tb: number } {
  const tint = computePlantTint(state, plantId, speciesId, genome);
  let tr = tint.r, tg = tint.g, tb = tint.b;

  // Disease overlay
  if (state.world.environment.weatherOverlay[y * GRID_WIDTH + x] === WeatherOverlay.Diseased) {
    tr = lerp(tr, 0.55, 0.4);
    tg = lerp(tg, 0.50, 0.4);
    tb = lerp(tb, 0.15, 0.4);
  }

  // Highlighted species/lineage glow / dim
  if (state.highlightedLineageRoot !== null) {
    if (lineageRoot === state.highlightedLineageRoot) {
      tr = Math.min(tr * 1.4, 1.5);
      tg = Math.min(tg * 1.4, 1.5);
      tb = Math.min(tb * 1.4, 1.5);
    } else {
      tr *= 0.55; tg *= 0.55; tb *= 0.55;
    }
  } else if (state.highlightedSpecies !== null) {
    if (state.highlightedSpecies.has(speciesId)) {
      tr = Math.min(tr * 1.4, 1.5);
      tg = Math.min(tg * 1.4, 1.5);
      tb = Math.min(tb * 1.4, 1.5);
    } else {
      tr *= 0.55; tg *= 0.55; tb *= 0.55;
    }
  }

  return { tr, tg, tb };
}

// ── Shared event ingestion (used by both full and incremental paths) ──

function ingestEvents(state: RendererState): void {
  const { world, growingPlants, flyingSeeds, dyingPlants, burningPlants } = state;

  // ── Ingest seed landing events (once per simulation tick) ──
  if (world.tick !== state.lastProcessedTick) {
    state.lastProcessedTick = world.tick;
    for (const evt of world.seedLandingEvents) {
      if (flyingSeeds.length >= MAX_SEEDS) break;
      let parentHeight = 1.0;
      const cell = world.grid[evt.parentY]?.[evt.parentX];
      if (cell?.plantId != null) {
        const parent = world.plants.get(cell.plantId);
        if (parent?.alive) parentHeight = parent.height;
      }
      const startY = Math.max(0.3, parentHeight * 0.7);
      const isGrass = evt.woodiness < 0.4;
      const arcPeak = 0.15 + Math.random() * 0.15;
      flyingSeeds.push({
        parentX: evt.parentX, parentY: evt.parentY,
        childX: evt.childX, childY: evt.childY,
        childId: 0, speciesId: evt.speciesId,
        progress: 0, startY, arcPeak,
        spinSpeed: 0.08 + Math.random() * 0.15,
        spinAxis: Math.random() * Math.PI * 2,
        driftAmp: 0.08 + Math.random() * 0.12,
        driftFreq: 2 + Math.random() * 2,
        driftPhase: Math.random() * Math.PI * 2,
        scaleFactor: 0.7 + Math.random() * 0.6,
        flightFrames: isGrass ? 55 + Math.random() * 15 : 40 + Math.random() * 15,
      });
    }

    for (const evt of world.germinationEvents) {
      let delayFrames = 0;
      for (const fs of flyingSeeds) {
        if (fs.childX === evt.x && fs.childY === evt.y && fs.progress < 1) {
          delayFrames = Math.ceil((1 - fs.progress) * fs.flightFrames);
          break;
        }
      }
      growingPlants.set(evt.plantId, {
        plantId: evt.plantId,
        progress: -delayFrames / GROWTH_ANIM_FRAMES,
      });
    }
  }

  // ── Ingest fire death events ──
  const fireDeathIds = new Set<number>();
  for (const evt of world.fireDeathEvents) {
    fireDeathIds.add(evt.id);
    if (burningPlants.size >= MAX_DYING) continue;
    const subtype = world.speciesSubtypes?.get(evt.speciesId) ?? classifySubtype(evt.genome);
    burningPlants.set(evt.id, {
      x: evt.x, y: evt.y,
      height: evt.height, rootDepth: evt.rootDepth,
      leafArea: evt.leafArea, speciesId: evt.speciesId,
      genome: evt.genome,
      woodiness: evt.genome.woodiness,
      subtype,
      progress: 0,
    });
  }

  // ── Detect deaths ──
  for (const [id, snap] of state.prevSnapshots) {
    if (!world.plants.has(id) && !fireDeathIds.has(id)) {
      if (dyingPlants.size >= MAX_DYING) continue;
      dyingPlants.set(id, { ...snap, progress: 0 });
    }
  }

}

// ── Dying / burning animation rendering (appended after live section) ──

function renderDyingBurning(
  state: RendererState,
  subtypeCounts: Uint32Array,
  mtxArrays: Float32Array[], clrArrays: Float32Array[],
): void {
  const { world, dyingPlants, burningPlants, getCellElevation } = state;

  // ── Render dying plants ──
  const toRemove: number[] = [];
  for (const [id, dp] of dyingPlants) {
    dp.progress += state.animSpeed / DEATH_ANIM_FRAMES;
    if (dp.progress >= 1) { toRemove.push(id); continue; }

    // Skip shader-grass subtypes — death handled by shader field clearing
    if (SHADER_GRASS_SUBTYPES.has(dp.subtype)) continue;

    const wx = dp.x - HALF + 0.5;
    const wz = dp.y - HALF + 0.5;
    const shrink = 1 - dp.progress;
    const baseY = getCellElevation(dp.x, dp.y);
    const p = dp.progress;

    // Dying tint: fade toward brown
    let tr = lerp(1.0, 0.45, p);
    let tg = lerp(1.0, 0.30, p);
    let tb = lerp(1.0, 0.12, p);

    // Species mode: tint the dying plant too
    if (state.colorMode === 'species') {
      const sc = world.speciesColors.get(dp.speciesId);
      if (sc) {
        tr *= lerp(0.4 + sc.r * 0.8, 0.45, p);
        tg *= lerp(0.4 + sc.g * 0.8, 0.30, p);
        tb *= lerp(0.4 + sc.b * 0.8, 0.12, p);
      }
    }

    const idx = subtypeCounts[dp.subtype]++;
    writePlantInstance(state, dp.subtype, idx, mtxArrays, clrArrays,
      wx, wz, baseY, dp.height, shrink, id, tr, tg, tb);
  }
  for (const id of toRemove) dyingPlants.delete(id);

  // ── Render burning plants ──
  const burnToRemove: number[] = [];
  for (const [id, bp] of burningPlants) {
    const burnFrames = bp.woodiness < 0.4 ? BURN_ANIM_FRAMES * 0.5 : BURN_ANIM_FRAMES;
    bp.progress += state.animSpeed / burnFrames;
    if (bp.progress >= 1) {
      burnToRemove.push(id);
      state.dyingPlants.set(id, { ...bp, progress: 0 });
      continue;
    }

    // Skip shader-grass subtypes — burn handled by shader field clearing
    if (SHADER_GRASS_SUBTYPES.has(bp.subtype)) continue;

    const wx = bp.x - HALF + 0.5;
    const wz = bp.y - HALF + 0.5;
    const baseY = getCellElevation(bp.x, bp.y);
    const flicker = Math.sin(performance.now() * 0.015 + id * 7) * 0.5 + 0.5;
    const t = bp.progress;
    const burnShrink = bp.woodiness < 0.4 ? 1 - t * 0.5 : 1 - t * 0.3;

    // Fire tint: orange-red → dark
    const tr = (bp.woodiness < 0.4
      ? lerp(2.5, 0.4, t) * (0.8 + flicker * 0.2)
      : lerp(2.2, 0.3, t * 0.5) * (0.8 + flicker * 0.2));
    const tg = (bp.woodiness < 0.4
      ? lerp(1.5, 0.1, t) * (0.7 + flicker * 0.3)
      : lerp(1.2, 0.08, t) * (0.7 + flicker * 0.3));
    const tb = bp.woodiness < 0.4 ? lerp(0.3, 0.03, t) : lerp(0.2, 0.03, t);

    const idx = subtypeCounts[bp.subtype]++;
    writePlantInstance(state, bp.subtype, idx, mtxArrays, clrArrays,
      wx, wz, baseY, bp.height, burnShrink, id, tr, tg, tb);
  }
  for (const id of burnToRemove) burningPlants.delete(id);
}

// ── Full rebuild path ──

function fullRebuild(
  state: RendererState,
  mtxArrays: Float32Array[], clrArrays: Float32Array[],
  mtxArraysLow: Float32Array[], clrArraysLow: Float32Array[],
): void {
  const { world, growingPlants, getCellElevation } = state;
  const subtypeCounts = state.subtypeLiveCounts;
  const subtypeCountsLow = state.subtypeLiveCountsLow;
  subtypeCounts.fill(0);
  subtypeCountsLow.fill(0);
  state.plantIndex.clear();
  state.prevPlantDisease.clear();

  const camX = state.camera.position.x;
  const camZ = state.camera.position.z;
  const lodDistSq = state.lodDistSq;

  // ── Reuse snapshot map ──
  const newSnapshots = state.nextSnapshots;
  newSnapshots.clear();

  // ── Render live plants ──
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;

    const subtype = world.speciesSubtypes?.get(plant.speciesId) ?? classifySubtype(plant.genome);

    newSnapshots.set(plant.id, {
      x: plant.x, y: plant.y,
      height: plant.height, rootDepth: plant.rootDepth,
      leafArea: plant.leafArea, speciesId: plant.speciesId,
      genome: plant.genome,
      woodiness: plant.genome.woodiness,
      subtype,
    });

    // Skip shader-grass subtypes — handled entirely by shader grass field
    if (SHADER_GRASS_SUBTYPES.has(subtype)) {
      // Still advance growth animation so grass-layer reads correct growScale
      const growing = growingPlants.get(plant.id);
      if (growing) {
        growing.progress += state.animSpeed / GROWTH_ANIM_FRAMES;
        if (growing.progress >= 1) growingPlants.delete(plant.id);
      }
      continue;
    }

    const wx = plant.x - HALF + 0.5;
    const wz = plant.y - HALF + 0.5;
    const baseY = getCellElevation(plant.x, plant.y);

    // Growth animation
    let growScale = 1.0;
    const growing = growingPlants.get(plant.id);
    if (growing) {
      growing.progress += state.animSpeed / GROWTH_ANIM_FRAMES;
      if (growing.progress >= 1) {
        growingPlants.delete(plant.id);
      } else if (growing.progress < 0) {
        growScale = 0;
      } else {
        growScale = Math.max(0.05, easeOutCubic(growing.progress));
      }
    }

    // Compute final tint
    const { tr, tg, tb } = computeFinalTint(
      state, plant.id, plant.speciesId, plant.genome,
      plant.x, plant.y, plant.lineageRoot,
    );

    // LOD: pick hi or lo mesh based on distance to camera
    const dx = wx - camX;
    const dz = wz - camZ;
    const isLow = dx * dx + dz * dz > lodDistSq;

    if (isLow) {
      const idx = subtypeCountsLow[subtype]++;
      state.subtypePlantIdsLow[subtype][idx] = plant.id;
      state.plantIndex.set(plant.id, { subtype, idx, low: true });
      writePlantInstance(state, subtype, idx, mtxArraysLow, clrArraysLow,
        wx, wz, baseY, plant.height, growScale, plant.id, tr, tg, tb);
    } else {
      const idx = subtypeCounts[subtype]++;
      state.subtypePlantIds[subtype][idx] = plant.id;
      state.plantIndex.set(plant.id, { subtype, idx, low: false });
      writePlantInstance(state, subtype, idx, mtxArrays, clrArrays,
        wx, wz, baseY, plant.height, growScale, plant.id, tr, tg, tb);
    }

    const isDiseased = world.environment.weatherOverlay[plant.y * GRID_WIDTH + plant.x] === WeatherOverlay.Diseased;
    state.prevPlantDisease.set(plant.id, isDiseased);
  }

  // Swap snapshot buffers
  state.nextSnapshots = state.prevSnapshots;
  state.prevSnapshots = newSnapshots;

  // Dying/burning appended after live plants (hi mesh only)
  const animCounts = new Uint32Array(subtypeCounts);
  renderDyingBurning(state, animCounts, mtxArrays, clrArrays);

  // ── Update counts and mark dirty (hi + lo) ──
  for (let i = 0; i < SUBTYPE_COUNT; i++) {
    const count = animCounts[i];
    state.subtypeMeshes[i].count = count;
    state.subtypeMeshes[i].visible = count > 0;
    if (count > 0) {
      state.subtypeMeshes[i].instanceMatrix.needsUpdate = true;
      state.subtypeMeshes[i].instanceColor!.needsUpdate = true;
    }

    const countLow = subtypeCountsLow[i];
    state.subtypeMeshesLow[i].count = countLow;
    state.subtypeMeshesLow[i].visible = countLow > 0;
    if (countLow > 0) {
      state.subtypeMeshesLow[i].instanceMatrix.needsUpdate = true;
      state.subtypeMeshesLow[i].instanceColor!.needsUpdate = true;
    }
  }

  state.forceFullRebuild = false;
}

// ── Incremental update path ──

function incrementalUpdate(
  state: RendererState,
  mtxArrays: Float32Array[], clrArrays: Float32Array[],
  mtxArraysLow: Float32Array[], clrArraysLow: Float32Array[],
): void {
  const { world, growingPlants, getCellElevation,
    subtypePlantIds, subtypePlantIdsLow, plantIndex,
    subtypeLiveCounts, subtypeLiveCountsLow, dirtyPlants,
    prevPlantDisease } = state;

  const camX = state.camera.position.x;
  const camZ = state.camera.position.z;
  const lodDistSq = state.lodDistSq;

  // 1. Process deaths: swap-remove dead plants from index
  for (const [id] of state.prevSnapshots) {
    if (world.plants.has(id)) continue;
    // This plant died (already added to dyingPlants/burningPlants by ingestEvents)
    const entry = plantIndex.get(id);
    if (entry && entry.subtype > 4) {
      const { subtype, idx, low } = entry;
      const counts = low ? subtypeLiveCountsLow : subtypeLiveCounts;
      const ids = low ? subtypePlantIdsLow : subtypePlantIds;
      const mArrs = low ? mtxArraysLow : mtxArrays;
      const cArrs = low ? clrArraysLow : clrArrays;
      const lastIdx = counts[subtype] - 1;
      if (lastIdx > idx) {
        const lastPlantId = ids[subtype][lastIdx];
        ids[subtype][idx] = lastPlantId;
        mArrs[subtype].copyWithin(idx * 16, lastIdx * 16, lastIdx * 16 + 16);
        cArrs[subtype].copyWithin(idx * 3, lastIdx * 3, lastIdx * 3 + 3);
        const swapEntry = plantIndex.get(lastPlantId);
        if (swapEntry) swapEntry.idx = idx;
        dirtyPlants.add(lastPlantId);
      }
      counts[subtype]--;
      plantIndex.delete(id);
    }
    prevPlantDisease.delete(id);
    state.plantColorCache.delete(id);
  }

  // 2. Process births: append new plants (LOD based on current camera)
  for (const evt of world.germinationEvents) {
    const plant = world.plants.get(evt.plantId);
    if (!plant?.alive) continue;
    const subtype = world.speciesSubtypes?.get(plant.speciesId) ?? classifySubtype(plant.genome);
    if (SHADER_GRASS_SUBTYPES.has(subtype)) continue; // grass handled by shader

    const wx = plant.x - HALF + 0.5;
    const wz = plant.y - HALF + 0.5;
    const dx = wx - camX;
    const dz = wz - camZ;
    const isLow = dx * dx + dz * dz > lodDistSq;

    if (isLow) {
      const idx = subtypeLiveCountsLow[subtype]++;
      subtypePlantIdsLow[subtype][idx] = plant.id;
      plantIndex.set(plant.id, { subtype, idx, low: true });
    } else {
      const idx = subtypeLiveCounts[subtype]++;
      subtypePlantIds[subtype][idx] = plant.id;
      plantIndex.set(plant.id, { subtype, idx, low: false });
    }

    const isDiseased = world.environment.weatherOverlay[plant.y * GRID_WIDTH + plant.x] === WeatherOverlay.Diseased;
    prevPlantDisease.set(plant.id, isDiseased);
    dirtyPlants.add(plant.id);
  }

  // 3. Detect height/disease changes + growing plants + build snapshots (single O(N) pass)
  const newSnapshots = state.nextSnapshots;
  newSnapshots.clear();
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const subtype = world.speciesSubtypes?.get(plant.speciesId) ?? classifySubtype(plant.genome);

    newSnapshots.set(plant.id, {
      x: plant.x, y: plant.y,
      height: plant.height, rootDepth: plant.rootDepth,
      leafArea: plant.leafArea, speciesId: plant.speciesId,
      genome: plant.genome,
      woodiness: plant.genome.woodiness,
      subtype,
    });

    if (SHADER_GRASS_SUBTYPES.has(subtype)) {
      // Still advance growth animation for grass
      const growing = growingPlants.get(plant.id);
      if (growing) {
        growing.progress += state.animSpeed / GROWTH_ANIM_FRAMES;
        if (growing.progress >= 1) growingPlants.delete(plant.id);
      }
      continue;
    }

    if (world.heightChangedIds.has(plant.id)) {
      dirtyPlants.add(plant.id);
    }

    const isDiseased = world.environment.weatherOverlay[plant.y * GRID_WIDTH + plant.x] === WeatherOverlay.Diseased;
    const wasDiseased = prevPlantDisease.get(plant.id);
    if (wasDiseased !== undefined && wasDiseased !== isDiseased) {
      dirtyPlants.add(plant.id);
      prevPlantDisease.set(plant.id, isDiseased);
    }

    // Growing plants are always dirty (growScale changes each frame)
    if (growingPlants.has(plant.id)) {
      dirtyPlants.add(plant.id);
    }
  }
  state.nextSnapshots = state.prevSnapshots;
  state.prevSnapshots = newSnapshots;

  // 4. Write dirty instances only (to whichever LOD mesh they belong to)
  for (const pid of dirtyPlants) {
    const entry = plantIndex.get(pid);
    if (!entry) continue;
    const plant = world.plants.get(pid);
    if (!plant?.alive) continue;

    const { subtype, idx, low } = entry;

    const wx = plant.x - HALF + 0.5;
    const wz = plant.y - HALF + 0.5;
    const baseY = getCellElevation(plant.x, plant.y);

    // Growth animation
    let growScale = 1.0;
    const growing = growingPlants.get(plant.id);
    if (growing) {
      growing.progress += state.animSpeed / GROWTH_ANIM_FRAMES;
      if (growing.progress >= 1) {
        growingPlants.delete(plant.id);
      } else if (growing.progress < 0) {
        growScale = 0;
      } else {
        growScale = Math.max(0.05, easeOutCubic(growing.progress));
      }
    }

    const { tr, tg, tb } = computeFinalTint(
      state, plant.id, plant.speciesId, plant.genome,
      plant.x, plant.y, plant.lineageRoot,
    );

    const targetMtx = low ? mtxArraysLow : mtxArrays;
    const targetClr = low ? clrArraysLow : clrArrays;
    writePlantInstance(state, subtype, idx, targetMtx, targetClr,
      wx, wz, baseY, plant.height, growScale, plant.id, tr, tg, tb);

    // Partial GPU upload for this instance
    const mesh = low ? state.subtypeMeshesLow[subtype] : state.subtypeMeshes[subtype];
    mesh.instanceMatrix.addUpdateRange(idx * 16, 16);
    mesh.instanceColor!.addUpdateRange(idx * 3, 3);
  }
  dirtyPlants.clear();

  // 6. Dying/burning appended after live section (hi mesh only)
  const animCounts = new Uint32Array(subtypeLiveCounts);
  renderDyingBurning(state, animCounts, mtxArrays, clrArrays);

  // 7. Update counts and needsUpdate (hi + lo)
  for (let i = 0; i < SUBTYPE_COUNT; i++) {
    const count = animCounts[i];
    const liveCount = subtypeLiveCounts[i];
    state.subtypeMeshes[i].count = count;
    state.subtypeMeshes[i].visible = count > 0;
    if (count > 0) {
      if (count > liveCount) {
        state.subtypeMeshes[i].instanceMatrix.addUpdateRange(liveCount * 16, (count - liveCount) * 16);
        state.subtypeMeshes[i].instanceColor!.addUpdateRange(liveCount * 3, (count - liveCount) * 3);
      }
      state.subtypeMeshes[i].instanceMatrix.needsUpdate = true;
      state.subtypeMeshes[i].instanceColor!.needsUpdate = true;
    }

    const countLow = subtypeLiveCountsLow[i];
    state.subtypeMeshesLow[i].count = countLow;
    state.subtypeMeshesLow[i].visible = countLow > 0;
    if (countLow > 0) {
      state.subtypeMeshesLow[i].instanceMatrix.needsUpdate = true;
      state.subtypeMeshesLow[i].instanceColor!.needsUpdate = true;
    }
  }
}

// ── Animation-only path (no tick, just advance dying/burning/growing) ──

function animationOnlyUpdate(
  state: RendererState,
  mtxArrays: Float32Array[], clrArrays: Float32Array[],
  mtxArraysLow: Float32Array[], clrArraysLow: Float32Array[],
): void {
  const { world, growingPlants, getCellElevation, subtypeLiveCounts, subtypeLiveCountsLow, dirtyPlants } = state;

  // Advance growing plants and mark dirty (growScale changed)
  for (const [pid, growing] of growingPlants) {
    const plant = world.plants.get(pid);
    if (!plant?.alive) { growingPlants.delete(pid); continue; }
    const subtype = world.speciesSubtypes?.get(plant.speciesId) ?? classifySubtype(plant.genome);
    if (SHADER_GRASS_SUBTYPES.has(subtype)) {
      growing.progress += state.animSpeed / GROWTH_ANIM_FRAMES;
      if (growing.progress >= 1) growingPlants.delete(pid);
      continue;
    }

    growing.progress += state.animSpeed / GROWTH_ANIM_FRAMES;
    if (growing.progress >= 1) {
      growingPlants.delete(pid);
    }

    const entry = state.plantIndex.get(pid);
    if (!entry) continue;

    let growScale = 1.0;
    if (growing.progress < 0) {
      growScale = 0;
    } else if (growing.progress < 1) {
      growScale = Math.max(0.05, easeOutCubic(growing.progress));
    }

    const wx = plant.x - HALF + 0.5;
    const wz = plant.y - HALF + 0.5;
    const baseY = getCellElevation(plant.x, plant.y);
    const { tr, tg, tb } = computeFinalTint(
      state, plant.id, plant.speciesId, plant.genome,
      plant.x, plant.y, plant.lineageRoot,
    );

    const targetMtx = entry.low ? mtxArraysLow : mtxArrays;
    const targetClr = entry.low ? clrArraysLow : clrArrays;
    writePlantInstance(state, entry.subtype, entry.idx, targetMtx, targetClr,
      wx, wz, baseY, plant.height, growScale, plant.id, tr, tg, tb);

    const mesh = entry.low ? state.subtypeMeshesLow[entry.subtype] : state.subtypeMeshes[entry.subtype];
    mesh.instanceMatrix.addUpdateRange(entry.idx * 16, 16);
    mesh.instanceColor!.addUpdateRange(entry.idx * 3, 3);
  }
  dirtyPlants.clear();

  // Dying/burning appended after live section (hi mesh only)
  const animCounts = new Uint32Array(subtypeLiveCounts);
  renderDyingBurning(state, animCounts, mtxArrays, clrArrays);

  // Update counts (hi + lo)
  for (let i = 0; i < SUBTYPE_COUNT; i++) {
    const count = animCounts[i];
    const liveCount = subtypeLiveCounts[i];
    state.subtypeMeshes[i].count = count;
    state.subtypeMeshes[i].visible = count > 0;
    if (count > 0) {
      if (count > liveCount) {
        state.subtypeMeshes[i].instanceMatrix.addUpdateRange(liveCount * 16, (count - liveCount) * 16);
        state.subtypeMeshes[i].instanceColor!.addUpdateRange(liveCount * 3, (count - liveCount) * 3);
      }
      state.subtypeMeshes[i].instanceMatrix.needsUpdate = true;
      state.subtypeMeshes[i].instanceColor!.needsUpdate = true;
    }

    const countLow = subtypeLiveCountsLow[i];
    state.subtypeMeshesLow[i].count = countLow;
    state.subtypeMeshesLow[i].visible = countLow > 0;
    if (countLow > 0) {
      state.subtypeMeshesLow[i].instanceMatrix.needsUpdate = true;
      state.subtypeMeshesLow[i].instanceColor!.needsUpdate = true;
    }
  }
}

// ═══════════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════════

export function updatePlants(state: RendererState): void {
  const { world, subtypeMeshes, subtypeMeshesLow, growingPlants, flyingSeeds,
    dyingPlants, burningPlants } = state;

  // Detect camera movement for LOD reassignment
  const camX = state.camera.position.x;
  const camZ = state.camera.position.z;
  const camDx = camX - state.lastLodCamX;
  const camDz = camZ - state.lastLodCamZ;
  const cameraMoved = camDx * camDx + camDz * camDz > 4; // >2 units
  if (cameraMoved) {
    state.forceFullRebuild = true;
    state.lastLodCamX = camX;
    state.lastLodCamZ = camZ;
  }

  // Skip if no tick occurred and no animations are active
  const hasTicked = world.tick !== state.lastPlantTick;
  const hasAnimations = growingPlants.size > 0 || dyingPlants.size > 0
    || burningPlants.size > 0 || flyingSeeds.length > 0;
  const colorModeChanged = state.colorMode !== state.lastPlantColorMode;
  const hoverChanged = state.highlightedSpecies !== state.lastHighlightedSpecies
    || state.highlightedLineageRoot !== state.lastHighlightedLineageRoot;
  if (!hasTicked && !hasAnimations && !hoverChanged && !state.plantsDirty
      && !state.forceFullRebuild && !colorModeChanged) return;

  state.plantsDirty = false;
  state.lastHighlightedSpecies = state.highlightedSpecies;
  state.lastHighlightedLineageRoot = state.highlightedLineageRoot;
  // Fast-forward animations proportionally when multiple ticks ran this frame
  state.animSpeed = hasTicked && state.lastPlantTick >= 0
    ? Math.max(1, world.tick - state.lastPlantTick)
    : 1;
  state.lastPlantTick = world.tick;

  // Invalidate color cache when colorMode changes
  if (colorModeChanged) {
    state.plantColorCache.clear();
    state.lastPlantColorMode = state.colorMode;
  }

  // Pre-extract instance buffer arrays for each subtype (hi + lo)
  const mtxArrays = subtypeMeshes.map(m => m.instanceMatrix.array as Float32Array);
  const clrArrays = subtypeMeshes.map(m => m.instanceColor!.array as Float32Array);
  const mtxArraysLow = subtypeMeshesLow.map(m => m.instanceMatrix.array as Float32Array);
  const clrArraysLow = subtypeMeshesLow.map(m => m.instanceColor!.array as Float32Array);

  // Decision: which path to take?
  const needsFullRebuild = state.forceFullRebuild || hoverChanged || colorModeChanged;

  if (needsFullRebuild) {
    // Full rebuild needed — ingest events, then rebuild everything
    ingestEvents(state);
    fullRebuild(state, mtxArrays, clrArrays, mtxArraysLow, clrArraysLow);
  } else if (hasTicked) {
    // Incremental update — only rewrite dirty instances
    ingestEvents(state);
    incrementalUpdate(state, mtxArrays, clrArrays, mtxArraysLow, clrArraysLow);
  } else {
    // Animation-only — advance growing/dying/burning at stable indices
    animationOnlyUpdate(state, mtxArrays, clrArrays, mtxArraysLow, clrArraysLow);
  }
}

export function updateSeeds(state: RendererState): void {
  const { dummy, seeds, flyingSeeds, getCellElevation } = state;

  const seedMtx = seeds.instanceMatrix.array as Float32Array;
  const seedClr = seeds.instanceColor!.array as Float32Array;
  let seedIdx = 0;

  for (let i = flyingSeeds.length - 1; i >= 0; i--) {
    const fs = flyingSeeds[i];
    fs.progress += state.animSpeed / fs.flightFrames;

    if (fs.progress >= 1) {
      flyingSeeds.splice(i, 1);
      continue;
    }

    if (seedIdx >= MAX_SEEDS - 2) continue;

    const t = fs.progress;

    const wx0 = fs.parentX - HALF + 0.5;
    const wz0 = fs.parentY - HALF + 0.5;
    const wx1 = fs.childX - HALF + 0.5;
    const wz1 = fs.childY - HALF + 0.5;
    const parentElev = getCellElevation(fs.parentX, fs.parentY);
    const childElev = getCellElevation(fs.childX, fs.childY);

    const fdx = wx1 - wx0;
    const fdz = wz1 - wz0;
    const fdist = Math.sqrt(fdx * fdx + fdz * fdz) || 1;
    const perpX = -fdz / fdist;
    const perpZ = fdx / fdist;

    const phase = t * fs.flightFrames * 0.05 + fs.driftPhase;

    const floatHeight = parentElev + fs.startY;
    const landHeight = childElev + 0.1;
    const posAt = (pt: number) => {
      const ph = pt * fs.flightFrames * 0.05 + fs.driftPhase;
      const drift = Math.sin(ph * fs.driftFreq) * fs.driftAmp
                   + Math.sin(ph * fs.driftFreq * 0.7 + 1.3) * fs.driftAmp * 0.5;
      const px = lerp(wx0, wx1, pt) + perpX * drift;
      const pz = lerp(wz0, wz1, pt) + perpZ * drift;
      const descent = pt < 0.6 ? 0 : ((pt - 0.6) / 0.4) * ((pt - 0.6) / 0.4);
      const py = lerp(floatHeight, landHeight, descent)
               + Math.sin(ph * 3.0) * 0.03
               + Math.sin(ph * 1.7) * 0.015
               + fs.arcPeak * Math.sin(ph * 0.9) * 0.5;
      return { x: px, y: py, z: pz };
    };

    const s = fs.scaleFactor * 0.35;

    const trailOffsets = [0, 0.02, 0.04];
    const trailScales = [1.0, 0.7, 0.4];

    for (let g = 0; g < 3; g++) {
      const gt = t - trailOffsets[g];
      if (gt < 0.01) continue;
      if (seedIdx >= MAX_SEEDS) break;

      const pos = posAt(gt);
      const gs = s * trailScales[g];

      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.scale.set(gs, gs, gs);
      dummy.rotation.set(
        Math.sin(phase * 1.2) * 0.5,
        phase * fs.spinSpeed * 3,
        Math.cos(phase * 0.8) * 0.4,
      );
      dummy.updateMatrix();
      dummy.matrix.toArray(seedMtx, seedIdx * 16);

      const ci = seedIdx * 3;
      const dim = g === 0 ? 1.0 : g === 1 ? 0.85 : 0.7;
      seedClr[ci]     = 0.45 * dim;
      seedClr[ci + 1] = 0.32 * dim;
      seedClr[ci + 2] = 0.15 * dim;

      seedIdx++;
    }
  }

  seeds.count = seedIdx;
  if (seedIdx > 0) {
    seeds.instanceMatrix.needsUpdate = true;
    seeds.instanceColor!.needsUpdate = true;
  }
}
