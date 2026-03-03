import { GRID_WIDTH, WeatherOverlay } from '../types';
import {
  RendererState, HALF, MAX_INSTANCES, MAX_SEEDS,
  DEATH_ANIM_FRAMES, GROWTH_ANIM_FRAMES, SEED_FLIGHT_FRAMES, BURN_ANIM_FRAMES,
  computeSilhouette, computeGrassSilhouette, computeSeasonalFoliageFactor, easeOutCubic, lerp,
} from './state';
import { MAX_GRASS_BLADES } from './setup';
import {
  _clr, _season,
  naturalCanopyColor, naturalTrunkColor, naturalGrassColor,
  seasonalGrassColor, seasonalCanopyColor, getPlantColors,
} from './plant-colors';
import { writeTrunkSegments, writeBranchesAndCanopies } from './trees';
import { writeGrassInstances } from './grass';

export function updatePlants(state: RendererState): void {
  const { world, trunks, canopies, branches, grassBlades, grassBases,
    growingPlants, flyingSeeds, dyingPlants, burningPlants, getCellElevation } = state;

  // Skip full rebuild if no tick occurred and no animations are active
  const hasTicked = world.tick !== state.lastPlantTick;
  const hasAnimations = growingPlants.size > 0 || dyingPlants.size > 0
    || burningPlants.size > 0 || flyingSeeds.length > 0;
  const hoverChanged = state.hoveredSpecies !== state.lastHoveredSpecies;
  if (!hasTicked && !hasAnimations && !hoverChanged) return;
  state.lastHoveredSpecies = state.hoveredSpecies;
  state.lastPlantTick = world.tick;

  // Invalidate color cache when colorMode changes
  if (state.colorMode !== state.lastPlantColorMode) {
    state.plantColorCache.clear();
    state.lastPlantColorMode = state.colorMode;
  }

  const trunkMtx = trunks.instanceMatrix.array as Float32Array;
  const trunkClr = trunks.instanceColor!.array as Float32Array;
  const canopyMtx = canopies.instanceMatrix.array as Float32Array;
  const canopyClr = canopies.instanceColor!.array as Float32Array;
  const brMtx = branches.instanceMatrix.array as Float32Array;
  const brClr = branches.instanceColor!.array as Float32Array;
  const gbMtx = grassBlades.instanceMatrix.array as Float32Array;
  const gbClr = grassBlades.instanceColor!.array as Float32Array;
  const baseMtx = grassBases.instanceMatrix.array as Float32Array;
  const baseClr = grassBases.instanceColor!.array as Float32Array;

  // ── Ingest seed events (once per simulation tick) ──
  if (world.tick !== state.lastProcessedTick) {
    state.lastProcessedTick = world.tick;
    for (const evt of world.seedEvents) {
      // O(1) parent lookup via grid cell instead of scanning all plants
      let parentHeight = 1.0;
      const cell = world.grid[evt.parentY]?.[evt.parentX];
      if (cell?.plantId != null) {
        const parent = world.plants.get(cell.plantId);
        if (parent?.alive) parentHeight = parent.height;
      }
      const startY = Math.max(0.1, parentHeight * 0.35);
      const dx = Math.abs(evt.childX - evt.parentX);
      const dy = Math.abs(evt.childY - evt.parentY);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const arcPeak = evt.archetype === 'grass'
        ? Math.max(0.8, startY * 0.3 + dist * 0.3)
        : Math.max(1.5, startY * 0.5 + dist * 0.5);
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
      genome: evt.genome,
      archetype: evt.archetype,
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

  // ── Camera-distance LOD for branches ──
  const camPos = state.camera.position;
  const camDist = Math.sqrt(camPos.x * camPos.x + camPos.y * camPos.y + camPos.z * camPos.z);
  const branchLOD = camDist < 40 ? 1.0 : camDist < 70 ? (70 - camDist) / 30 : 0.3;

  // ── Reuse snapshot map (swap instead of allocating new) ──
  const newSnapshots = state.nextSnapshots;
  newSnapshots.clear();
  let idx = 0;
  let branchIdx = 0;
  let canopyIdx = 0;
  let grassBladeIdx = 0;
  let grassBaseIdx = 0;

  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const isGrass = plant.archetype === 'grass';

    // Reference genome directly (immutable per plant — no need to copy)
    newSnapshots.set(plant.id, {
      x: plant.x, y: plant.y,
      height: plant.height, rootDepth: plant.rootDepth,
      leafArea: plant.leafArea, speciesId: plant.speciesId,
      genome: plant.genome,
      archetype: plant.archetype,
    });

    // Skip rendering if seed is still in flight
    if (flyingChildIds.has(plant.id)) continue;

    const wx = plant.x - HALF + 0.5;
    const wz = plant.y - HALF + 0.5;
    const baseY = getCellElevation(plant.x, plant.y);

    // Growth animation scale
    let growScale = 1.0;
    const growing = growingPlants.get(plant.id);
    if (growing) {
      growing.progress += 1 / GROWTH_ANIM_FRAMES;
      if (growing.progress >= 1) {
        growingPlants.delete(plant.id);
      } else {
        growScale = Math.max(0.05, easeOutCubic(growing.progress));
      }
    }

    if (isGrass) {
      // ── Grass rendering ──
      const gsil = computeGrassSilhouette(plant.height, plant.rootDepth, plant.leafArea, plant.genome);

      const colors = getPlantColors(state, plant.id, plant.speciesId, plant.genome, true);
      let { cr, cg, cb } = colors;
      seasonalGrassColor(cr, cg, cb, env, _season);
      cr = _season.cr; cg = _season.cg; cb = _season.cb;

      if (world.environment.weatherOverlay[plant.y * GRID_WIDTH + plant.x] === WeatherOverlay.Diseased) {
        cr = lerp(cr, 0.50, 0.45);
        cg = lerp(cg, 0.45, 0.45);
        cb = lerp(cb, 0.10, 0.45);
      }

      // Hovered species glow / dim
      if (state.hoveredSpecies !== null) {
        if (plant.speciesId === state.hoveredSpecies) {
          cr = Math.min(cr * 1.5, 1.0);
          cg = Math.min(cg * 1.5, 1.0);
          cb = Math.min(cb * 1.5, 1.0);
        } else {
          cr *= 0.5; cg *= 0.5; cb *= 0.5;
        }
      }

      const result = writeGrassInstances(state, grassBladeIdx, grassBaseIdx, plant.id,
        wx, wz, baseY, gsil, cr, cg, cb, growScale,
        gbMtx, gbClr, baseMtx, baseClr);
      grassBladeIdx += result.bladeCount;
      grassBaseIdx += result.baseCount;
    } else {
      // ── Tree rendering ──
      const sil = computeSilhouette(plant.height, plant.rootDepth, plant.leafArea, plant.genome);

      let branchScale = 1.0;
      if (growScale < 1.0) {
        sil.trunkH *= growScale;
        sil.trunkThickness *= growScale;
        sil.canopyX *= growScale;
        sil.canopyY *= growScale;
        sil.canopyZ *= growScale;
        branchScale = Math.max(0, easeOutCubic(Math.max(0, (growing?.progress ?? 1) - 0.3) / 0.7));
      }

      sil.canopyX *= canopyScale;
      sil.canopyY *= canopyScale;
      sil.canopyZ *= canopyScale;

      const colors = getPlantColors(state, plant.id, plant.speciesId, plant.genome);
      let { cr, cg, cb } = colors;
      const { tr, tg, tb } = colors;

      seasonalCanopyColor(cr, cg, cb, env, _season);
      cr = _season.cr; cg = _season.cg; cb = _season.cb;

      if (world.environment.weatherOverlay[plant.y * GRID_WIDTH + plant.x] === WeatherOverlay.Diseased) {
        cr = lerp(cr, 0.50, 0.45);
        cg = lerp(cg, 0.45, 0.45);
        cb = lerp(cb, 0.10, 0.45);
      }

      // Hovered species glow / dim
      let trf = tr, tgf = tg, tbf = tb;
      if (state.hoveredSpecies !== null) {
        if (plant.speciesId === state.hoveredSpecies) {
          cr = Math.min(cr * 1.5, 1.0);
          cg = Math.min(cg * 1.5, 1.0);
          cb = Math.min(cb * 1.5, 1.0);
          trf = Math.min(tr * 1.5, 1.0);
          tgf = Math.min(tg * 1.5, 1.0);
          tbf = Math.min(tb * 1.5, 1.0);
        } else {
          cr *= 0.5; cg *= 0.5; cb *= 0.5;
          trf = tr * 0.5; tgf = tg * 0.5; tbf = tb * 0.5;
        }
      }

      if (idx + 4 >= MAX_INSTANCES) continue;
      const trunkResult = writeTrunkSegments(state, idx, plant.id, wx, wz, baseY, sil,
        trf, tgf, tbf, 0, 0, trunkMtx, trunkClr, branchLOD);
      idx += trunkResult.trunkCount;
      const liveResult = writeBranchesAndCanopies(state, branchIdx, canopyIdx, plant.id,
        wx, wz, baseY, sil, plant.genome, trf, tgf, tbf, cr, cg, cb, branchScale,
        brMtx, brClr, canopyMtx, canopyClr, branchLOD, trunkResult.stems);
      branchIdx += liveResult.branchCount;
      canopyIdx += liveResult.canopyCount;
    }
  }

  // Swap snapshot buffers
  state.nextSnapshots = state.prevSnapshots;
  state.prevSnapshots = newSnapshots;

  // ── Render dying plants ──
  const toRemove: number[] = [];
  for (const [id, dp] of dyingPlants) {
    dp.progress += 1 / DEATH_ANIM_FRAMES;
    if (dp.progress >= 1) { toRemove.push(id); continue; }

    const wx = dp.x - HALF + 0.5;
    const wz = dp.y - HALF + 0.5;
    const shrink = 1 - dp.progress;
    const baseY = getCellElevation(dp.x, dp.y);
    const p = dp.progress;

    if (dp.archetype === 'grass') {
      // Dying grass: shrink + brown out (no tilt)
      if (grassBladeIdx >= MAX_GRASS_BLADES) continue;
      const gsil = computeGrassSilhouette(dp.height, dp.rootDepth, dp.leafArea, dp.genome);

      naturalGrassColor(dp.genome, _clr);
      if (state.colorMode === 'species') {
        const sc = world.speciesColors.get(dp.speciesId);
        const gr = 0.2 + dp.genome.rootPriority * 0.6;
        const gg = 0.3 + dp.genome.leafSize * 0.5;
        const gb = 0.2 + dp.genome.heightPriority * 0.6;
        _clr.cr = sc ? sc.r * 0.7 + gr * 0.3 : gr;
        _clr.cg = sc ? sc.g * 0.7 + gg * 0.3 : gg;
        _clr.cb = sc ? sc.b * 0.7 + gb * 0.3 : gb;
      }
      seasonalGrassColor(_clr.cr, _clr.cg, _clr.cb, env, _season);
      // Fade to brown
      const cr = _season.cr * (1 - p) + 0.40 * p;
      const cg = _season.cg * (1 - p) + 0.30 * p;
      const cb = _season.cb * (1 - p) + 0.10 * p;

      const result = writeGrassInstances(state, grassBladeIdx, grassBaseIdx, id,
        wx, wz, baseY, gsil, cr, cg, cb, shrink,
        gbMtx, gbClr, baseMtx, baseClr);
      grassBladeIdx += result.bladeCount;
      grassBaseIdx += result.baseCount;
    } else {
      // Dying tree: force single stem, no lean
      if (idx + 4 >= MAX_INSTANCES) continue;

      const raw = computeSilhouette(dp.height, dp.rootDepth, dp.leafArea, dp.genome);
      const sil = {
        trunkH: raw.trunkH * shrink,
        trunkThickness: raw.trunkThickness * shrink,
        canopyX: raw.canopyX * shrink * canopyScale,
        canopyY: raw.canopyY * shrink * canopyScale,
        canopyZ: raw.canopyZ * shrink * canopyScale,
        branchVisibility: raw.branchVisibility,
        stemCount: 1,
        trunkLean: 0,
        forkFrac: raw.forkFrac,
      };

      const tiltProgress = Math.max(0, (dp.progress - 0.3) / 0.7);
      const tiltAngle = tiltProgress * (Math.PI / 3);
      const tiltDir = ((id * 7) % 13) / 13 * Math.PI * 2;

      naturalCanopyColor(dp.genome, _clr);
      naturalTrunkColor(dp.genome, _clr as any);
      if (state.colorMode === 'species') {
        const sc = world.speciesColors.get(dp.speciesId);
        const gr = 0.2 + dp.genome.rootPriority * 0.6;
        const gg = 0.3 + dp.genome.leafSize * 0.5;
        const gb = 0.2 + dp.genome.heightPriority * 0.6;
        _clr.cr = sc ? sc.r * 0.7 + gr * 0.3 : gr;
        _clr.cg = sc ? sc.g * 0.7 + gg * 0.3 : gg;
        _clr.cb = sc ? sc.b * 0.7 + gb * 0.3 : gb;
        _clr.tr = 0.28 * 0.85 + _clr.cr * 0.15;
        _clr.tg = 0.18 * 0.85 + _clr.cg * 0.15;
        _clr.tb = 0.10 * 0.85 + _clr.cb * 0.15;
      }
      seasonalCanopyColor(_clr.cr, _clr.cg, _clr.cb, env, _season);
      const cr = _season.cr * (1 - p) + 0.35 * p;
      const cg = _season.cg * (1 - p) + 0.20 * p;
      const cb = _season.cb * (1 - p) + 0.08 * p;
      const tr = _clr.tr * (1 - p) + 0.20 * p;
      const tg = _clr.tg * (1 - p) + 0.12 * p;
      const tb = _clr.tb * (1 - p) + 0.06 * p;

      const trunkResult = writeTrunkSegments(state, idx, id, wx, wz, baseY, sil,
        tr, tg, tb, tiltAngle, tiltDir, trunkMtx, trunkClr, branchLOD);
      idx += trunkResult.trunkCount;
      const dyingResult = writeBranchesAndCanopies(state, branchIdx, canopyIdx, id,
        wx, wz, baseY, sil, dp.genome, tr, tg, tb, cr, cg, cb, shrink,
        brMtx, brClr, canopyMtx, canopyClr, branchLOD, trunkResult.stems);
      branchIdx += dyingResult.branchCount;
      canopyIdx += dyingResult.canopyCount;
    }
  }
  for (const id of toRemove) dyingPlants.delete(id);

  // ── Render burning plants (fire deaths) ──
  const burnToRemove: number[] = [];
  for (const [id, bp] of burningPlants) {
    const burnFrames = bp.archetype === 'grass' ? BURN_ANIM_FRAMES * 0.5 : BURN_ANIM_FRAMES;
    bp.progress += 1 / burnFrames;
    if (bp.progress >= 1) {
      burnToRemove.push(id);
      dyingPlants.set(id, { ...bp, progress: 0 });
      continue;
    }

    const wx = bp.x - HALF + 0.5;
    const wz = bp.y - HALF + 0.5;
    const baseY = getCellElevation(bp.x, bp.y);
    const flicker = Math.sin(performance.now() * 0.015 + id * 7) * 0.5 + 0.5;
    const t = bp.progress;

    if (bp.archetype === 'grass') {
      // Burning grass: quick flash-burn with orange-yellow
      if (grassBladeIdx >= MAX_GRASS_BLADES) continue;
      const gsil = computeGrassSilhouette(bp.height, bp.rootDepth, bp.leafArea, bp.genome);
      const burnShrink = 1 - t * 0.5;
      const cr = lerp(1.0, 0.3, t) * (0.8 + flicker * 0.2);
      const cg = lerp(0.7, 0.08, t) * (0.7 + flicker * 0.3);
      const cb = lerp(0.15, 0.02, t);

      const result = writeGrassInstances(state, grassBladeIdx, grassBaseIdx, id,
        wx, wz, baseY, gsil, cr, cg, cb, burnShrink,
        gbMtx, gbClr, baseMtx, baseClr);
      grassBladeIdx += result.bladeCount;
      grassBaseIdx += result.baseCount;
    } else {
      // Burning tree: use full trunk variation (no tilt during fire)
      if (idx + 4 >= MAX_INSTANCES) continue;
      const raw = computeSilhouette(bp.height, bp.rootDepth, bp.leafArea, bp.genome);

      const burnShrink = 1 - bp.progress * 0.3;
      const sil = {
        trunkH: raw.trunkH * burnShrink,
        trunkThickness: raw.trunkThickness * burnShrink,
        canopyX: raw.canopyX * burnShrink * canopyScale,
        canopyY: raw.canopyY * burnShrink * canopyScale,
        canopyZ: raw.canopyZ * burnShrink * canopyScale,
        branchVisibility: raw.branchVisibility,
        stemCount: raw.stemCount,
        trunkLean: raw.trunkLean,
        forkFrac: raw.forkFrac,
      };

      const cr = lerp(1.0, 0.2, t * 0.5) * (0.8 + flicker * 0.2);
      const cg = lerp(0.6, 0.05, t) * (0.7 + flicker * 0.3);
      const cb = lerp(0.1, 0.02, t);

      const trunkResult = writeTrunkSegments(state, idx, id, wx, wz, baseY, sil,
        cr, cg, cb, 0, 0, trunkMtx, trunkClr, branchLOD);
      idx += trunkResult.trunkCount;
      const burnResult = writeBranchesAndCanopies(state, branchIdx, canopyIdx, id,
        wx, wz, baseY, sil, bp.genome, cr, cg, cb, cr, cg, cb, burnShrink,
        brMtx, brClr, canopyMtx, canopyClr, branchLOD, trunkResult.stems);
      branchIdx += burnResult.branchCount;
      canopyIdx += burnResult.canopyCount;
    }
  }
  for (const id of burnToRemove) burningPlants.delete(id);

  trunks.count = idx;
  canopies.count = canopyIdx;
  branches.count = branchIdx;
  grassBlades.count = grassBladeIdx;
  grassBases.count = grassBaseIdx;
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
  if (grassBladeIdx > 0) {
    grassBlades.instanceMatrix.needsUpdate = true;
    grassBlades.instanceColor!.needsUpdate = true;
  }
  if (grassBaseIdx > 0) {
    grassBases.instanceMatrix.needsUpdate = true;
    grassBases.instanceColor!.needsUpdate = true;
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
    const childPlant = world.plants.get(fs.childId);
    const isGrassSeed = childPlant?.archetype === 'grass';
    if (state.colorMode !== 'species') {
      if (isGrassSeed) {
        // Grass seeds: lighter straw color
        seedClr[ci]     = 0.60;
        seedClr[ci + 1] = 0.52;
        seedClr[ci + 2] = 0.25;
      } else {
        seedClr[ci]     = 0.45;
        seedClr[ci + 1] = 0.32;
        seedClr[ci + 2] = 0.15;
      }
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
