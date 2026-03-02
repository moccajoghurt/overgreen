import * as THREE from 'three';
import { World, Plant, Renderer } from './types';
import { computeSilhouette, plantHash, makeRoughSphere } from './renderer3d/state';
import { naturalCanopyColor, naturalTrunkColor } from './renderer3d/plants';
import { speciesCentroid, speciesColorToRgb } from './ui-utils';
import { createFloatingLabels } from './floating-labels';

// ── Constants ──

const CANVAS_SIZE = 100;
const RENDER_SIZE = 128;
const UPDATE_EVERY_N_TICKS = 10;
const MAX_REBUILDS_PER_UPDATE = 3;

// ── Types ──

interface SpeciesEntry {
  speciesId: number;
  count: number;
  representative: Plant;
}

interface CachedEntry {
  speciesId: number;
  plantId: number;
  plantScore: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  row: HTMLDivElement;
  nameEl: HTMLSpanElement;
  countEl: HTMLSpanElement;
  dotEl: HTMLSpanElement;
}

// ── Showcase ──

export function createShowcase(
  container: HTMLElement,
  _world: World,
  renderer: Renderer,
  mapContainer: HTMLElement,
): { update(world: World): void } {
  // Shared offscreen renderer (single WebGL context)
  const offRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  offRenderer.setSize(RENDER_SIZE, RENDER_SIZE);
  offRenderer.setClearColor(0x000000, 0);

  const renderTarget = new THREE.WebGLRenderTarget(RENDER_SIZE, RENDER_SIZE, {
    format: THREE.RGBAFormat,
  });
  const pixelBuf = new Uint8Array(RENDER_SIZE * RENDER_SIZE * 4);

  // Shared scene setup
  const scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.8);
  dirLight.position.set(3, 6, 4);
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0xc0d0ff, 0.6);
  fillLight.position.set(-3, 3, -2);
  scene.add(fillLight);

  // Camera: looking down ~30deg
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  // Shared geometries
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.15, 1, 6);
  const branchGeo = new THREE.CylinderGeometry(0.04, 0.09, 1, 5);
  const canopyGeo = makeRoughSphere(0.5, 2, 0.25);

  // Cache
  const cache: CachedEntry[] = [];
  let lastUpdateTick = -UPDATE_EVERY_N_TICKS;

  // Container title
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'color:#8f8; font-size:12px; margin-bottom:6px;';
  titleEl.textContent = 'Top Species';
  container.appendChild(titleEl);

  const listEl = document.createElement('div');
  container.appendChild(listEl);

  // Floating labels
  const labels = createFloatingLabels(mapContainer, renderer, {
    zIndex: 12, holdMs: 5000, fadeMs: 600, animPrefix: 'showcase-label', maxLabels: 0,
  });
  let lastWorld: World | null = null;

  function handleEntryClick(speciesId: number): void {
    if (!lastWorld) return;
    const pos = speciesCentroid(lastWorld, speciesId);
    if (!pos) return;
    renderer.moveTo(pos.x, pos.y);
    const sc = lastWorld.speciesColors.get(speciesId);
    const rgb = sc ? speciesColorToRgb(sc) : '#888';
    const name = lastWorld.speciesNames.get(speciesId) ?? `Sp ${speciesId}`;
    labels.show(name, rgb, pos.x, pos.y);
  }

  function getTopSpecies(world: World): SpeciesEntry[] {
    const counts = new Map<number, number>();
    const best = new Map<number, Plant>();

    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;
      const sid = plant.speciesId;
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
      const prev = best.get(sid);
      const score = plant.height + plant.leafArea + plant.rootDepth;
      if (!prev || score > prev.height + prev.leafArea + prev.rootDepth) {
        best.set(sid, plant);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([speciesId, count]) => ({
        speciesId,
        count,
        representative: best.get(speciesId)!,
      }));
  }

  function buildTreeGroup(plant: Plant): THREE.Group {
    const group = new THREE.Group();
    const { genome } = plant;
    const sil = computeSilhouette(plant.height, plant.rootDepth, plant.leafArea, genome);
    const { cr, cg, cb } = naturalCanopyColor(genome);
    const { tr, tg, tb } = naturalTrunkColor(genome);

    const trunkColor = new THREE.Color(tr, tg, tb);
    const canopyColor = new THREE.Color(cr, cg, cb);

    // Trunk
    const trunkMesh = new THREE.Mesh(trunkGeo, new THREE.MeshLambertMaterial({ color: trunkColor }));
    trunkMesh.position.set(0, sil.trunkH * 0.5, 0);
    trunkMesh.scale.set(sil.trunkThickness, sil.trunkH, sil.trunkThickness);
    group.add(trunkMesh);

    // Branches + canopies (adapted from writeBranchesAndCanopies)
    const vis = sil.branchVisibility;
    if (vis < 0.01) {
      // Seedling: single canopy blob on top
      const blob = new THREE.Mesh(canopyGeo, new THREE.MeshLambertMaterial({ color: canopyColor }));
      blob.position.set(0, sil.trunkH, 0);
      blob.scale.set(sil.canopyX, sil.canopyY, sil.canopyZ);
      group.add(blob);
      return group;
    }

    // leafSize → many (bushy), heightPriority → few (conifer), seedInvestment → moderate-many
    const primaryCount = Math.max(2, Math.min(6,
      Math.round(2 + genome.leafSize * 3 - genome.heightPriority * 2 + genome.seedInvestment * 1.5)));
    const primaryTilt = Math.max(0.15, Math.min(1.5,
      0.6 + genome.leafSize * 0.7 - genome.heightPriority * 0.7
          + genome.rootPriority * 0.1 + genome.seedInvestment * 0.2));
    const primaryLength = sil.trunkH * (
      0.15 + genome.leafSize * 0.40 - genome.heightPriority * 0.10
           + genome.rootPriority * 0.05 + genome.seedInvestment * 0.15);
    const primaryThickness = sil.trunkThickness * (
      0.30 + genome.rootPriority * 0.35 - genome.seedInvestment * 0.15);
    const secondaryPerPrimary = Math.max(0, Math.min(2,
      Math.round(genome.leafSize * 2.0 - genome.heightPriority * 1.2 + genome.seedInvestment * 0.5 - 0.2)));
    const totalTips = Math.min(12, primaryCount * (1 + secondaryPerPrimary));
    const sizeExponent = 1 / 3 + genome.heightPriority * 0.1 + genome.seedInvestment * 0.15
                               - genome.leafSize * 0.08;
    const volumeShare = 1 / Math.pow(Math.max(1, totalTips), Math.max(0.2, sizeExponent));

    const attachLow = 0.50 - genome.heightPriority * 0.30 - genome.seedInvestment * 0.15;
    const attachHigh = 0.90 + genome.heightPriority * 0.05;

    const branchMat = new THREE.MeshLambertMaterial({ color: trunkColor });
    const canopyMat = new THREE.MeshLambertMaterial({ color: canopyColor });
    const pid = plant.id;

    for (let i = 0; i < primaryCount; i++) {
      const baseFrac = attachLow + (i / Math.max(1, primaryCount - 1)) * (attachHigh - attachLow);
      const attachJitter = (plantHash(pid, i * 10 + 1) - 0.5) * 0.10;
      const attachFrac = Math.max(0.15, Math.min(0.95, baseFrac + attachJitter));
      const attachY = sil.trunkH * attachFrac;

      const baseAngle = (i / primaryCount) * Math.PI * 2;
      const angleJitter = (plantHash(pid, i * 10 + 2) - 0.5) * 0.8;
      const angle = baseAngle + angleJitter;

      const lenJitter = 0.85 + plantHash(pid, i * 10 + 3) * 0.30;
      const len = primaryLength * lenJitter * vis;
      const thick = primaryThickness * vis;
      const tilt = primaryTilt + (plantHash(pid, i * 10 + 4) - 0.5) * 0.2;

      const sinT = Math.sin(tilt);
      const cosT = Math.cos(tilt);
      const dirX = Math.sin(angle) * sinT;
      const dirY = cosT;
      const dirZ = Math.cos(angle) * sinT;

      // Branch cylinder
      const bm = new THREE.Mesh(branchGeo, branchMat);
      bm.position.set(dirX * len * 0.5, attachY + dirY * len * 0.5, dirZ * len * 0.5);
      bm.scale.set(thick, len, thick);
      bm.rotation.set(0, 0, 0);
      bm.rotateY(angle);
      bm.rotateX(tilt);
      group.add(bm);

      // Canopy at tip
      const tipX = dirX * len;
      const tipY = attachY + dirY * len;
      const tipZ = dirZ * len;
      const jitter = 0.85 + plantHash(pid, i * 10 + 5) * 0.30;

      const cm = new THREE.Mesh(canopyGeo, canopyMat);
      cm.position.set(tipX, tipY, tipZ);
      cm.scale.set(
        sil.canopyX * volumeShare * jitter,
        sil.canopyY * volumeShare * jitter,
        sil.canopyZ * volumeShare * jitter,
      );
      group.add(cm);

      // Secondary branches
      for (let j = 0; j < secondaryPerPrimary; j++) {
        const secAttachFrac = 0.70 + plantHash(pid, i * 10 + j * 5 + 50) * 0.25;
        const secBaseX = dirX * len * secAttachFrac;
        const secBaseY = attachY + dirY * len * secAttachFrac;
        const secBaseZ = dirZ * len * secAttachFrac;

        const side = j % 2 === 0 ? 1 : -1;
        const diverge = 0.5 + plantHash(pid, i * 10 + j * 5 + 51) * 0.7;
        const secAngle = angle + side * diverge;
        const secTilt = Math.min(1.5, tilt + 0.15 + plantHash(pid, i * 10 + j * 5 + 52) * 0.2);

        const secLenFrac = 0.50 + plantHash(pid, i * 10 + j * 5 + 53) * 0.20;
        const secLen = len * secLenFrac;
        const secThickFrac = 0.50 + plantHash(pid, i * 10 + j * 5 + 54) * 0.20;
        const secThick = thick * secThickFrac;

        const sinS = Math.sin(secTilt);
        const cosS = Math.cos(secTilt);
        const sDirX = Math.sin(secAngle) * sinS;
        const sDirY = cosS;
        const sDirZ = Math.cos(secAngle) * sinS;

        // Secondary branch
        const sbm = new THREE.Mesh(branchGeo, branchMat);
        sbm.position.set(
          secBaseX + sDirX * secLen * 0.5,
          secBaseY + sDirY * secLen * 0.5,
          secBaseZ + sDirZ * secLen * 0.5,
        );
        sbm.scale.set(secThick, secLen, secThick);
        sbm.rotation.set(0, 0, 0);
        sbm.rotateY(secAngle);
        sbm.rotateX(secTilt);
        group.add(sbm);

        // Canopy at secondary tip
        const secTipX = secBaseX + sDirX * secLen;
        const secTipY = secBaseY + sDirY * secLen;
        const secTipZ = secBaseZ + sDirZ * secLen;
        const secJitter = 0.85 + plantHash(pid, i * 10 + j * 5 + 55) * 0.30;

        const scm = new THREE.Mesh(canopyGeo, canopyMat);
        scm.position.set(secTipX, secTipY, secTipZ);
        scm.scale.set(
          sil.canopyX * volumeShare * secJitter,
          sil.canopyY * volumeShare * secJitter,
          sil.canopyZ * volumeShare * secJitter,
        );
        group.add(scm);
      }
    }

    // Conifer apex blob
    if (genome.heightPriority > 0.4) {
      const apexStrength = Math.min(1, (genome.heightPriority - 0.4) * 2.5);
      const apexSize = sil.canopyY * volumeShare * 0.7 * apexStrength;
      const apexMat = new THREE.MeshLambertMaterial({ color: canopyColor });
      const apex = new THREE.Mesh(canopyGeo, apexMat);
      apex.position.set(0, sil.trunkH * 0.98, 0);
      apex.scale.set(apexSize * 0.5, apexSize * 1.3, apexSize * 0.5);
      group.add(apex);
    }

    // Buttress blobs for root-dominant plants
    if (genome.rootPriority > 0.5) {
      const buttressStrength = Math.min(1, (genome.rootPriority - 0.5) * 2.5);
      const buttressSize = sil.canopyX * volumeShare * 0.5 * buttressStrength;
      const buttressCount = genome.rootPriority > 0.7 ? 2 : 1;
      const buttressColor = new THREE.Color(
        cr * 0.85 + tr * 0.15,
        cg * 0.85 + tg * 0.15,
        cb * 0.85 + tb * 0.15,
      );
      const buttressMat = new THREE.MeshLambertMaterial({ color: buttressColor });
      for (let bi = 0; bi < buttressCount; bi++) {
        const bAngle = plantHash(pid, 200 + bi) * Math.PI * 2;
        const bDist = sil.trunkThickness * 0.3;
        const bm = new THREE.Mesh(canopyGeo, buttressMat);
        bm.position.set(
          Math.sin(bAngle) * bDist,
          sil.trunkH * 0.15,
          Math.cos(bAngle) * bDist,
        );
        bm.scale.set(buttressSize, buttressSize * 0.6, buttressSize);
        group.add(bm);
      }
    }

    return group;
  }

  function renderTreeToCanvas(
    group: THREE.Group,
    ctx: CanvasRenderingContext2D,
  ): void {
    // Compute bounding box to frame the tree
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);

    // Position camera for ~30deg down view
    const dist = maxDim * 2.2;
    const camAngle = Math.PI / 6; // 30 deg down
    camera.position.set(
      center.x + dist * 0.3,
      center.y + dist * Math.sin(camAngle),
      center.z + dist * Math.cos(camAngle),
    );
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    // Clear and add group to scene
    while (scene.children.length > 3) scene.remove(scene.children[scene.children.length - 1]);
    scene.add(group);

    // Render to target
    offRenderer.setRenderTarget(renderTarget);
    offRenderer.clear();
    offRenderer.render(scene, camera);

    // Read pixels
    offRenderer.readRenderTargetPixels(renderTarget, 0, 0, RENDER_SIZE, RENDER_SIZE, pixelBuf);
    offRenderer.setRenderTarget(null);

    // Remove group from scene
    scene.remove(group);

    // Copy to 2D canvas (flip Y — WebGL is bottom-up)
    const imgData = ctx.createImageData(RENDER_SIZE, RENDER_SIZE);
    for (let y = 0; y < RENDER_SIZE; y++) {
      const srcRow = (RENDER_SIZE - 1 - y) * RENDER_SIZE * 4;
      const dstRow = y * RENDER_SIZE * 4;
      for (let x = 0; x < RENDER_SIZE; x++) {
        const si = srcRow + x * 4;
        const di = dstRow + x * 4;
        imgData.data[di] = pixelBuf[si];
        imgData.data[di + 1] = pixelBuf[si + 1];
        imgData.data[di + 2] = pixelBuf[si + 2];
        imgData.data[di + 3] = pixelBuf[si + 3];
      }
    }

    // Scale down to canvas size
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = RENDER_SIZE;
    tmpCanvas.height = RENDER_SIZE;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    tmpCtx.putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(tmpCanvas, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  function createEntryDOM(): CachedEntry {
    const row = document.createElement('div');
    row.style.cssText = 'text-align:center; padding:4px 0; border-bottom:1px solid #333; cursor:pointer;';

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    canvas.style.cssText = 'display:block; margin:0 auto; border-radius:8px; background:radial-gradient(ellipse at 50% 60%, #2a3a2a 0%, #1a1a1a 100%);';
    const ctx = canvas.getContext('2d')!;
    row.appendChild(canvas);

    const info = document.createElement('div');
    info.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:6px; font-size:12px; margin-top:2px;';

    const dotEl = document.createElement('span');
    dotEl.style.cssText = 'display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0;';
    info.appendChild(dotEl);

    const nameEl = document.createElement('span');
    info.appendChild(nameEl);

    const countEl = document.createElement('span');
    countEl.style.cssText = 'color:#888; margin-left:auto;';
    info.appendChild(countEl);

    row.appendChild(info);

    const entry: CachedEntry = { speciesId: -1, plantId: -1, plantScore: -1, canvas, ctx, row, nameEl, countEl, dotEl };
    row.addEventListener('click', () => {
      if (entry.speciesId !== -1) handleEntryClick(entry.speciesId);
    });
    return entry;
  }

  function update(world: World): void {
    lastWorld = world;

    labels.updatePositions();

    if (world.tick - lastUpdateTick < UPDATE_EVERY_N_TICKS) return;
    lastUpdateTick = world.tick;

    const top = getTopSpecies(world);

    // Ensure we have enough DOM entries
    while (cache.length < top.length) {
      const entry = createEntryDOM();
      cache.push(entry);
      listEl.appendChild(entry.row);
    }
    // Hide extras
    for (let i = top.length; i < cache.length; i++) {
      cache[i].row.style.display = 'none';
    }

    let rebuilds = 0;
    for (let i = 0; i < top.length; i++) {
      const sp = top[i];
      const entry = cache[i];
      entry.row.style.display = '';

      const score = sp.representative.height + sp.representative.leafArea + sp.representative.rootDepth;
      const needsRebuild =
        entry.speciesId !== sp.speciesId ||
        entry.plantId !== sp.representative.id ||
        Math.abs(entry.plantScore - score) > 0.5;

      const isInitial = entry.speciesId === -1;
      if (needsRebuild && (isInitial || rebuilds < MAX_REBUILDS_PER_UPDATE)) {
        entry.speciesId = sp.speciesId;
        entry.plantId = sp.representative.id;
        entry.plantScore = score;

        const group = buildTreeGroup(sp.representative);
        renderTreeToCanvas(group, entry.ctx);
        if (!isInitial) rebuilds++;

        // Dispose meshes
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.material.dispose();
          }
        });
      }

      // Update labels
      const sc = world.speciesColors.get(sp.speciesId);
      const rgb = sc ? speciesColorToRgb(sc) : '#888';
      entry.dotEl.style.background = rgb;
      entry.nameEl.textContent = world.speciesNames.get(sp.speciesId) ?? `Sp ${sp.speciesId}`;
      entry.nameEl.style.color = rgb;
      entry.countEl.textContent = `(${sp.count})`;
    }
  }

  return { update };
}
