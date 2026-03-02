import { Genome, GRID_WIDTH, WeatherOverlay, Season } from '../types';
import {
  RendererState, HALF, MAX_INSTANCES, MAX_SEEDS, MAX_BRANCHES_PER_PLANT,
  DEATH_ANIM_FRAMES, GROWTH_ANIM_FRAMES, SEED_FLIGHT_FRAMES, BURN_ANIM_FRAMES,
  computeSilhouette, computeSeasonalFoliageFactor, easeOutCubic, lerp, plantHash,
} from './state';

// ── Reusable output objects (avoid per-plant allocations in hot path) ──
const _clr = { cr: 0, cg: 0, cb: 0, tr: 0, tg: 0, tb: 0 };
const _season = { cr: 0, cg: 0, cb: 0 };

export function naturalCanopyColor(genome: Genome, out: { cr: number; cg: number; cb: number }) {
  const { rootPriority, heightPriority, leafSize, seedInvestment } = genome;

  // Compute normalized dominance for nonlinear archetype accents
  const sum = rootPriority + heightPriority + leafSize + seedInvestment + 0.01;
  const rDom = rootPriority / sum;
  const hDom = heightPriority / sum;
  const sDom = seedInvestment / sum;

  // Base: mid-forest green
  let r = 0.18;
  let g = 0.40;
  let b = 0.14;

  // leafSize high → bright, lush, saturated emerald green
  r += leafSize * 0.02;
  g += leafSize * 0.25;
  b += leafSize * 0.04;

  // heightPriority high → dark blue-green (conifer needles)
  r -= heightPriority * 0.08;
  g -= heightPriority * 0.12;
  b += heightPriority * 0.08;

  // rootPriority high → warm olive / khaki
  r += rootPriority * 0.14;
  g += rootPriority * 0.02;
  b -= rootPriority * 0.06;

  // seedInvestment high → light yellow-green / silver-green
  r += seedInvestment * 0.10;
  g += seedInvestment * 0.08;
  b -= seedInvestment * 0.04;

  // Nonlinear archetype accents (kick in when a gene is clearly dominant)
  if (hDom > 0.30) {
    const strength = (hDom - 0.30) * 2.0;
    r -= strength * 0.06;
    g -= strength * 0.05;
    b += strength * 0.10;
  }
  if (rDom > 0.30) {
    const strength = (rDom - 0.30) * 2.0;
    r += strength * 0.08;
    g += strength * 0.04;
    b -= strength * 0.04;
  }
  if (sDom > 0.30) {
    const strength = (sDom - 0.30) * 2.0;
    r += strength * 0.06;
    g += strength * 0.10;
    b += strength * 0.06;
  }

  out.cr = Math.max(0.06, Math.min(0.45, r));
  out.cg = Math.max(0.18, Math.min(0.72, g));
  out.cb = Math.max(0.04, Math.min(0.30, b));
}

export function naturalTrunkColor(genome: Genome, out: { tr: number; tg: number; tb: number }) {
  const { rootPriority, heightPriority, leafSize, seedInvestment } = genome;
  // Base: bark brown
  let r = 0.28;
  let g = 0.18;
  let b = 0.10;

  // rootPriority high → very dark, rich brown (massive ancient wood)
  r -= rootPriority * 0.10;
  g -= rootPriority * 0.08;
  b -= rootPriority * 0.04;

  // heightPriority high → pale, silvery-gray bark (birch/aspen)
  r += heightPriority * 0.14;
  g += heightPriority * 0.14;
  b += heightPriority * 0.12;

  // leafSize high → warm, mossy bark
  g += leafSize * 0.06;
  r += leafSize * 0.03;

  // seedInvestment high → reddish-brown papery bark (cherry/madrone)
  r += seedInvestment * 0.10;
  g -= seedInvestment * 0.02;
  b -= seedInvestment * 0.02;

  // defense high → dark charcoal-grey bark (thick, armored)
  r -= genome.defense * 0.12;
  g -= genome.defense * 0.08;
  b -= genome.defense * 0.02;

  out.tr = Math.max(0.12, Math.min(0.50, r));
  out.tg = Math.max(0.08, Math.min(0.38, g));
  out.tb = Math.max(0.04, Math.min(0.28, b));
}

/** Seasonal color targets (constant, no need to allocate per call) */
const SEASON_TARGETS = [
  [0.30, 0.55, 0.15], // Spring: fresh green
  [0, 0, 0],          // Summer: placeholder (identity — filled per call)
  [0.70, 0.18, 0.04], // Autumn: vivid orange-red
  [0.35, 0.28, 0.20], // Winter: gray-brown bark
] as const;

function seasonalCanopyColor(
  cr: number, cg: number, cb: number,
  env: { season: Season; seasonProgress: number },
  out: { cr: number; cg: number; cb: number },
): void {
  const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;

  const s0 = env.season;
  const s1 = (env.season + 1) % 4;
  const c0r = s0 === 1 ? cr : SEASON_TARGETS[s0][0];
  const c0g = s0 === 1 ? cg : SEASON_TARGETS[s0][1];
  const c0b = s0 === 1 ? cb : SEASON_TARGETS[s0][2];
  const c1r = s1 === 1 ? cr : SEASON_TARGETS[s1][0];
  const c1g = s1 === 1 ? cg : SEASON_TARGETS[s1][1];
  const c1b = s1 === 1 ? cb : SEASON_TARGETS[s1][2];
  const tr = c0r + (c1r - c0r) * t;
  const tg = c0g + (c1g - c0g) * t;
  const tb = c0b + (c1b - c0b) * t;

  let blendStrength: number;
  if (env.season === Season.Summer) {
    blendStrength = 0.05 + t * 0.15;
  } else if (env.season === Season.Autumn) {
    blendStrength = 0.7 * t + 0.25;
  } else if (env.season === Season.Winter) {
    blendStrength = 0.6;
  } else {
    blendStrength = 0.5 * (1 - t);
  }

  out.cr = lerp(cr, tr, blendStrength);
  out.cg = lerp(cg, tg, blendStrength);
  out.cb = lerp(cb, tb, blendStrength);
}

/**
 * Get base plant colors, using per-plant cache to avoid recomputation.
 * Cache is invalidated when colorMode changes.
 */
function getPlantColors(state: RendererState, plantId: number, speciesId: number, genome: Genome) {
  const cached = state.plantColorCache.get(plantId);
  if (cached) return cached;

  if (state.colorMode === 'natural') {
    naturalCanopyColor(genome, _clr);
    naturalTrunkColor(genome, _clr as any);
  } else {
    const sc = state.world.speciesColors.get(speciesId);
    const gr = 0.2 + genome.rootPriority * 0.6;
    const gg = 0.3 + genome.leafSize * 0.5;
    const gb = 0.2 + genome.heightPriority * 0.6;
    _clr.cr = sc ? sc.r * 0.7 + gr * 0.3 : gr;
    _clr.cg = sc ? sc.g * 0.7 + gg * 0.3 : gg;
    _clr.cb = sc ? sc.b * 0.7 + gb * 0.3 : gb;
    _clr.tr = 0.28 * 0.85 + _clr.cr * 0.15;
    _clr.tg = 0.18 * 0.85 + _clr.cg * 0.15;
    _clr.tb = 0.10 * 0.85 + _clr.cb * 0.15;
  }

  const entry = { cr: _clr.cr, cg: _clr.cg, cb: _clr.cb, tr: _clr.tr, tg: _clr.tg, tb: _clr.tb };
  state.plantColorCache.set(plantId, entry);
  return entry;
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
  branchLOD: number,
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

    // Attach height: genome-driven range with jitter
    const baseFrac = attachLow + (i / Math.max(1, primaryCount - 1)) * (attachHigh - attachLow);
    const attachJitter = (plantHash(plantId, i * 10 + 1) - 0.5) * 0.10;
    const attachFrac = Math.max(0.15, Math.min(0.95, baseFrac + attachJitter));
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

  // ── Conifer apex: extra canopy blob at trunk top for tall, narrow plants ──
  if (genome.heightPriority > 0.4 && segmentCount < MAX_BRANCHES_PER_PLANT) {
    const apexStrength = Math.min(1, (genome.heightPriority - 0.4) * 2.5);
    const apexSize = sil.canopyY * volumeShare * 0.7 * apexStrength;

    dummy.position.set(wx, baseY + sil.trunkH * 0.98, wz);
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

export function updatePlants(state: RendererState): void {
  const { world, trunks, canopies, branches,
    growingPlants, flyingSeeds, dyingPlants, burningPlants, getCellElevation } = state;

  // Skip full rebuild if no tick occurred and no animations are active
  const hasTicked = world.tick !== state.lastPlantTick;
  const hasAnimations = growingPlants.size > 0 || dyingPlants.size > 0
    || burningPlants.size > 0 || flyingSeeds.length > 0;
  if (!hasTicked && !hasAnimations) return;
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
      genome: evt.genome,
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

  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;

    // Reference genome directly (immutable per plant — no need to copy)
    newSnapshots.set(plant.id, {
      x: plant.x, y: plant.y,
      height: plant.height, rootDepth: plant.rootDepth,
      leafArea: plant.leafArea, speciesId: plant.speciesId,
      genome: plant.genome,
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

    // Use cached base colors + apply seasonal shift
    const colors = getPlantColors(state, plant.id, plant.speciesId, plant.genome);
    let { cr, cg, cb } = colors;
    const { tr, tg, tb } = colors;

    seasonalCanopyColor(cr, cg, cb, env, _season);
    cr = _season.cr; cg = _season.cg; cb = _season.cb;

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
      brMtx, brClr, canopyMtx, canopyClr, branchLOD);
    branchIdx += liveResult.branchCount;
    canopyIdx += liveResult.canopyCount;
    idx++;
  }

  // Swap snapshot buffers
  state.nextSnapshots = state.prevSnapshots;
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

    // Dying plants: compute colors directly (few of these, not worth caching)
    naturalCanopyColor(dp.genome, _clr);
    naturalTrunkColor(dp.genome, _clr as any);
    if (state.colorMode !== 'natural') {
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
    const p = dp.progress;
    const cr = _season.cr * (1 - p) + 0.35 * p;
    const cg = _season.cg * (1 - p) + 0.20 * p;
    const cb = _season.cb * (1 - p) + 0.08 * p;
    const tr = _clr.tr * (1 - p) + 0.20 * p;
    const tg = _clr.tg * (1 - p) + 0.12 * p;
    const tb = _clr.tb * (1 - p) + 0.06 * p;

    const baseY = getCellElevation(dp.x, dp.y);
    writeInstance(state, idx, wx, wz, baseY, sil, tr, tg, tb, tiltAngle, tiltDir,
      trunkMtx, trunkClr);
    const dyingResult = writeBranchesAndCanopies(state, branchIdx, canopyIdx, id,
      wx, wz, baseY, sil, dp.genome, tr, tg, tb, cr, cg, cb, shrink,
      brMtx, brClr, canopyMtx, canopyClr, branchLOD);
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
      brMtx, brClr, canopyMtx, canopyClr, branchLOD);
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
