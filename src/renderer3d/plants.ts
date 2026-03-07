import { GRID_WIDTH, WeatherOverlay } from '../types';
import {
  RendererState, HALF, MAX_SEEDS,
  DEATH_ANIM_FRAMES, GROWTH_ANIM_FRAMES, BURN_ANIM_FRAMES,
  easeOutCubic, lerp, plantHash,
} from './state';
import { computePlantTint } from './plant-colors';
import { classifySubtype, subtypeArchetype } from '../types/subtypes';

const SUBTYPE_COUNT = 24;

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
  const { dummy, maturityHeights } = state;
  const matH = maturityHeights[subtype];
  const s = (height / matH) * scale;

  const ry = plantHash(plantId, 0) * Math.PI * 2;
  dummy.position.set(wx, baseY, wz);
  dummy.scale.setScalar(s);
  dummy.rotation.set(0, ry, 0);
  dummy.updateMatrix();
  dummy.matrix.toArray(mtxArrays[subtype], idx * 16);

  const ci = idx * 3;
  clrArrays[subtype][ci] = tr;
  clrArrays[subtype][ci + 1] = tg;
  clrArrays[subtype][ci + 2] = tb;
}

export function updatePlants(state: RendererState): void {
  const { world, subtypeMeshes, growingPlants, flyingSeeds,
    dyingPlants, burningPlants, getCellElevation } = state;

  // Skip full rebuild if no tick occurred and no animations are active
  const hasTicked = world.tick !== state.lastPlantTick;
  const hasAnimations = growingPlants.size > 0 || dyingPlants.size > 0
    || burningPlants.size > 0 || flyingSeeds.length > 0;
  const hoverChanged = state.highlightedSpecies !== state.lastHighlightedSpecies;
  if (!hasTicked && !hasAnimations && !hoverChanged && !state.plantsDirty) return;
  state.plantsDirty = false;
  state.lastHighlightedSpecies = state.highlightedSpecies;
  state.lastPlantTick = world.tick;

  // Invalidate color cache when colorMode changes
  if (state.colorMode !== state.lastPlantColorMode) {
    state.plantColorCache.clear();
    state.lastPlantColorMode = state.colorMode;
  }

  // Pre-extract instance buffer arrays for each subtype
  const mtxArrays = subtypeMeshes.map(m => m.instanceMatrix.array as Float32Array);
  const clrArrays = subtypeMeshes.map(m => m.instanceColor!.array as Float32Array);
  const subtypeCounts = new Uint32Array(SUBTYPE_COUNT);

  // ── Ingest seed landing events (once per simulation tick) ──
  if (world.tick !== state.lastProcessedTick) {
    state.lastProcessedTick = world.tick;
    for (const evt of world.seedLandingEvents) {
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
      dyingPlants.set(id, { ...snap, progress: 0 });
    }
  }

  const env = world.environment;

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

    const wx = plant.x - HALF + 0.5;
    const wz = plant.y - HALF + 0.5;
    const baseY = getCellElevation(plant.x, plant.y);

    // Growth animation
    let growScale = 1.0;
    const growing = growingPlants.get(plant.id);
    if (growing) {
      growing.progress += 1 / GROWTH_ANIM_FRAMES;
      if (growing.progress >= 1) {
        growingPlants.delete(plant.id);
      } else if (growing.progress < 0) {
        growScale = 0;
      } else {
        growScale = Math.max(0.05, easeOutCubic(growing.progress));
      }
    }

    // Compute tint
    const tint = computePlantTint(state, plant.id, plant.speciesId, plant.genome,
      subtypeArchetype(subtype), env);

    // Disease overlay
    let { r: tr, g: tg, b: tb } = tint;
    if (world.environment.weatherOverlay[plant.y * GRID_WIDTH + plant.x] === WeatherOverlay.Diseased) {
      // Muddy yellow tint (shift multiplier toward brownish)
      tr = lerp(tr, 0.55, 0.4);
      tg = lerp(tg, 0.50, 0.4);
      tb = lerp(tb, 0.15, 0.4);
    }

    // Highlighted species glow / dim
    if (state.highlightedSpecies !== null) {
      if (state.highlightedSpecies.has(plant.speciesId)) {
        tr = Math.min(tr * 1.4, 1.5);
        tg = Math.min(tg * 1.4, 1.5);
        tb = Math.min(tb * 1.4, 1.5);
      } else {
        tr *= 0.55; tg *= 0.55; tb *= 0.55;
      }
    }

    const idx = subtypeCounts[subtype]++;
    writePlantInstance(state, subtype, idx, mtxArrays, clrArrays,
      wx, wz, baseY, plant.height, growScale, plant.id, tr, tg, tb);
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

  // ── Update counts and mark dirty ──
  for (let i = 0; i < SUBTYPE_COUNT; i++) {
    subtypeMeshes[i].count = subtypeCounts[i];
    if (subtypeCounts[i] > 0) {
      subtypeMeshes[i].instanceMatrix.needsUpdate = true;
      subtypeMeshes[i].instanceColor!.needsUpdate = true;
    }
  }
}

export function updateSeeds(state: RendererState): void {
  const { dummy, seeds, flyingSeeds, getCellElevation } = state;

  const seedMtx = seeds.instanceMatrix.array as Float32Array;
  const seedClr = seeds.instanceColor!.array as Float32Array;
  let seedIdx = 0;

  for (let i = flyingSeeds.length - 1; i >= 0; i--) {
    const fs = flyingSeeds[i];
    fs.progress += 1 / fs.flightFrames;

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
