import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { SIM, World, Renderer, Genome } from './types';

const GRID = 80;
const HALF = GRID / 2;
const DEATH_ANIM_FRAMES = 90; // ~1.5s at 60fps
const MAX_DYING = 200;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface PlantSnapshot {
  x: number; y: number;
  height: number; rootDepth: number; leafArea: number;
  speciesId: number; genome: Genome;
}

interface DyingPlant extends PlantSnapshot {
  progress: number; // 0→1
}

function computeSilhouette(height: number, rootDepth: number, leafArea: number, leafGenome: number) {
  const leafRatio = leafArea / SIM.MAX_LEAF_AREA;
  const rootRatio = rootDepth / SIM.MAX_ROOT_DEPTH;

  const trunkH = Math.max(0.1, height * 0.35);
  const trunkThickness = 0.8 + rootRatio * 0.9;

  const canopyBase = 0.1 + leafRatio * 1.6;

  // leafGenome controls crown aspect ratio:
  // high leaf gene → wide & flat (spreading oak), low → narrow & tall (cypress)
  const spread = 0.6 + leafGenome * 0.9;        // 0.6 … 1.5
  const canopyX = canopyBase * spread;
  const canopyY = canopyBase * (1.0 / spread);   // inverse: wide=flat, narrow=tall

  // secondary blob scale: lush for high leaf, nearly absent for low
  const blob2 = 0.2 + leafGenome * 0.6;         // 0.2 … 0.8

  return { trunkH, trunkThickness, canopyX, canopyY, canopyZ: canopyX, blob2 };
}

function makeRoughSphere(radius: number, detail: number, jitter: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z);
    const scale = 1 + (Math.random() * 2 - 1) * jitter;
    pos.setXYZ(i, x / len * radius * scale, y / len * radius * scale, z / len * radius * scale);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createRenderer3D(
  container: HTMLElement,
  world: World,
): Renderer & { canvas: HTMLCanvasElement } {
  // ── Scene ──
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
  dirLight.position.set(30, 50, 20);
  scene.add(dirLight);

  // ── Terrain (non-indexed plane with per-cell vertex colors) ──
  const baseTerrain = new THREE.PlaneGeometry(GRID, GRID, GRID, GRID);
  baseTerrain.rotateX(-Math.PI / 2);
  const terrainGeo = baseTerrain.toNonIndexed();
  baseTerrain.dispose();

  const vertexCount = terrainGeo.attributes.position.count; // 80×80×6 = 38 400
  const colorArray = new Float32Array(vertexCount * 3);
  const colorAttr = new THREE.BufferAttribute(colorArray, 3);
  colorAttr.setUsage(THREE.DynamicDrawUsage);
  terrainGeo.setAttribute('color', colorAttr);

  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  scene.add(terrainMesh);

  // ── Plants (instanced meshes) ──
  const MAX_INSTANCES = GRID * GRID + MAX_DYING;

  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.15, 1, 6);
  const trunks = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshLambertMaterial(),
    MAX_INSTANCES,
  );
  trunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trunks.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_INSTANCES * 3),
    3,
  );
  trunks.instanceColor.setUsage(THREE.DynamicDrawUsage);
  trunks.count = 0;
  trunks.frustumCulled = false;
  scene.add(trunks);

  const canopyGeo = makeRoughSphere(0.5, 2, 0.25);
  const canopies = new THREE.InstancedMesh(
    canopyGeo,
    new THREE.MeshLambertMaterial(),
    MAX_INSTANCES,
  );
  canopies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  canopies.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_INSTANCES * 3),
    3,
  );
  canopies.instanceColor.setUsage(THREE.DynamicDrawUsage);
  canopies.count = 0;
  canopies.frustumCulled = false;
  scene.add(canopies);

  const canopy2Geo = makeRoughSphere(0.5, 2, 0.25);
  const canopies2 = new THREE.InstancedMesh(
    canopy2Geo,
    new THREE.MeshLambertMaterial(),
    MAX_INSTANCES,
  );
  canopies2.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  canopies2.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_INSTANCES * 3),
    3,
  );
  canopies2.instanceColor.setUsage(THREE.DynamicDrawUsage);
  canopies2.count = 0;
  canopies2.frustumCulled = false;
  scene.add(canopies2);

  // ── Dying plant animation state ──
  let prevSnapshots = new Map<number, PlantSnapshot>();
  const dyingPlants = new Map<number, DyingPlant>();

  // ── Selection highlight ──
  const selectMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.05, 1),
    new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true }),
  );
  selectMesh.visible = false;
  selectMesh.position.y = 0.02;
  scene.add(selectMesh);

  // ── Camera ──
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    200,
  );
  camera.position.set(0, 60, 30);
  camera.lookAt(0, 0, 0);

  // ── WebGL Renderer ──
  const webgl = new THREE.WebGLRenderer({ antialias: true });
  webgl.setSize(container.clientWidth, container.clientHeight);
  webgl.setPixelRatio(window.devicePixelRatio);
  webgl.domElement.style.display = 'block';
  container.appendChild(webgl.domElement);

  // ── Map Controls ──
  const controls = new MapControls(camera, webgl.domElement);
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI / 2.5;
  controls.minDistance = 10;
  controls.maxDistance = 120;
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  // ── Raycaster ──
  const raycaster = new THREE.Raycaster();
  const ndcMouse = new THREE.Vector2();

  // ── Reusable temporaries ──
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  // ── Resize ──
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    webgl.setSize(w, h);
  });

  // ═══════════════════════════════════════════════════════
  // Per-frame updates
  // ═══════════════════════════════════════════════════════

  function updateTerrainColors(): void {
    const arr = colorArray; // direct ref to the Float32Array

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const cell = world.grid[row][col];

        // Soil HSL (same formula as the 2D renderer)
        const waterRatio = cell.waterLevel / SIM.MAX_WATER;
        const nutrientRatio = cell.nutrients / SIM.MAX_NUTRIENTS;
        const h = (lerp(30, 25, waterRatio) - nutrientRatio * 5) / 360;
        const s = lerp(40, 50, waterRatio) / 100;
        const l = Math.max(10, lerp(55, 25, waterRatio) - nutrientRatio * 5) / 100;

        tmpColor.setHSL(h, s, l);

        // Bake shadow into terrain color
        const light = cell.lightLevel;
        tmpColor.r *= light;
        tmpColor.g *= light;
        tmpColor.b *= light;

        // Species territory tint
        let speciesId: number | null = null;
        let blendFactor = 0;
        if (cell.plantId !== null) {
          const plant = world.plants.get(cell.plantId);
          if (plant && plant.alive) {
            speciesId = plant.speciesId;
            blendFactor = 0.35;
          }
        }
        if (speciesId === null && cell.lastSpeciesId !== null) {
          speciesId = cell.lastSpeciesId;
          blendFactor = 0.15;
        }
        if (speciesId !== null) {
          const sc = world.speciesColors.get(speciesId);
          if (sc) {
            tmpColor.r = tmpColor.r * (1 - blendFactor) + sc.r * blendFactor;
            tmpColor.g = tmpColor.g * (1 - blendFactor) + sc.g * blendFactor;
            tmpColor.b = tmpColor.b * (1 - blendFactor) + sc.b * blendFactor;
          }
        }

        // 6 vertices per cell, 3 floats per vertex
        const base = (row * GRID + col) * 18;
        for (let v = 0; v < 6; v++) {
          const i = base + v * 3;
          arr[i] = tmpColor.r;
          arr[i + 1] = tmpColor.g;
          arr[i + 2] = tmpColor.b;
        }
      }
    }

    colorAttr.needsUpdate = true;
  }

  function plantColor(speciesId: number, genome: Genome) {
    const sc = world.speciesColors.get(speciesId);
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
    idx: number,
    wx: number, wz: number,
    sil: ReturnType<typeof computeSilhouette>,
    cr: number, cg: number, cb: number,
    tiltAngle: number, tiltDir: number,
    trunkMtx: Float32Array, trunkClr: Float32Array,
    canopyMtx: Float32Array, canopyClr: Float32Array,
    canopy2Mtx: Float32Array, canopy2Clr: Float32Array,
  ): void {
    // ── Trunk ──
    dummy.position.set(wx, sil.trunkH * 0.5, wz);
    dummy.scale.set(sil.trunkThickness, sil.trunkH, sil.trunkThickness);
    dummy.rotation.set(
      Math.sin(tiltDir) * tiltAngle,
      0,
      Math.cos(tiltDir) * tiltAngle,
    );
    dummy.updateMatrix();
    dummy.matrix.toArray(trunkMtx, idx * 16);

    // ── Primary canopy (overlaps trunk top) ──
    const canopyCenterY = sil.trunkH - sil.canopyY * 0.3;
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

  function updatePlants(): void {
    const trunkMtx = trunks.instanceMatrix.array as Float32Array;
    const trunkClr = trunks.instanceColor!.array as Float32Array;
    const canopyMtx = canopies.instanceMatrix.array as Float32Array;
    const canopyClr = canopies.instanceColor!.array as Float32Array;
    const canopy2Mtx = canopies2.instanceMatrix.array as Float32Array;
    const canopy2Clr = canopies2.instanceColor!.array as Float32Array;

    // ── Detect deaths: plants in prev snapshot but no longer in world ──
    for (const [id, snap] of prevSnapshots) {
      if (!world.plants.has(id)) {
        dyingPlants.set(id, { ...snap, progress: 0 });
      }
    }

    // ── Build new snapshots + render live plants ──
    const newSnapshots = new Map<number, PlantSnapshot>();
    let idx = 0;

    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;

      newSnapshots.set(plant.id, {
        x: plant.x, y: plant.y,
        height: plant.height, rootDepth: plant.rootDepth,
        leafArea: plant.leafArea, speciesId: plant.speciesId,
        genome: { ...plant.genome },
      });

      const wx = plant.x - HALF + 0.5;
      const wz = plant.y - HALF + 0.5;
      const sil = computeSilhouette(plant.height, plant.rootDepth, plant.leafArea, plant.genome.leafSize);
      const { cr, cg, cb } = plantColor(plant.speciesId, plant.genome);

      writeInstance(idx, wx, wz, sil, cr, cg, cb, 0, 0,
        trunkMtx, trunkClr, canopyMtx, canopyClr, canopy2Mtx, canopy2Clr);
      idx++;
    }

    prevSnapshots = newSnapshots;

    // ── Render dying plants ──
    const toRemove: number[] = [];
    for (const [id, dp] of dyingPlants) {
      dp.progress += 1 / DEATH_ANIM_FRAMES;
      if (dp.progress >= 1) { toRemove.push(id); continue; }
      if (idx >= MAX_INSTANCES) continue;

      const wx = dp.x - HALF + 0.5;
      const wz = dp.y - HALF + 0.5;
      const shrink = 1 - dp.progress;

      // Silhouette scaled down by shrink
      const raw = computeSilhouette(dp.height, dp.rootDepth, dp.leafArea, dp.genome.leafSize);
      const sil = {
        trunkH: raw.trunkH * shrink,
        trunkThickness: raw.trunkThickness * shrink,
        canopyX: raw.canopyX * shrink,
        canopyY: raw.canopyY * shrink,
        canopyZ: raw.canopyZ * shrink,
        blob2: raw.blob2 * shrink,
      };

      // Tilt starts at progress 0.3
      const tiltProgress = Math.max(0, (dp.progress - 0.3) / 0.7);
      const tiltAngle = tiltProgress * (Math.PI / 3);
      const tiltDir = ((id * 7) % 13) / 13 * Math.PI * 2;

      // Brown-out: lerp original color → brown
      const { cr: origR, cg: origG, cb: origB } = plantColor(dp.speciesId, dp.genome);
      const p = dp.progress;
      const cr = origR * (1 - p) + 0.35 * p;
      const cg = origG * (1 - p) + 0.20 * p;
      const cb = origB * (1 - p) + 0.08 * p;

      writeInstance(idx, wx, wz, sil, cr, cg, cb, tiltAngle, tiltDir,
        trunkMtx, trunkClr, canopyMtx, canopyClr, canopy2Mtx, canopy2Clr);
      idx++;
    }
    for (const id of toRemove) dyingPlants.delete(id);

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

  // ═══════════════════════════════════════════════════════
  // Public API (Renderer interface)
  // ═══════════════════════════════════════════════════════

  function render(selectedCell: { x: number; y: number } | null): void {
    updateTerrainColors();
    updatePlants();

    if (selectedCell) {
      selectMesh.visible = true;
      selectMesh.position.set(
        selectedCell.x - HALF + 0.5,
        0.02,
        selectedCell.y - HALF + 0.5,
      );
    } else {
      selectMesh.visible = false;
    }

    controls.update();
    webgl.render(scene, camera);
  }

  function cellAt(
    canvasX: number,
    canvasY: number,
  ): { x: number; y: number } | null {
    ndcMouse.x = (canvasX / webgl.domElement.clientWidth) * 2 - 1;
    ndcMouse.y = -(canvasY / webgl.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(ndcMouse, camera);
    const hits = raycaster.intersectObject(terrainMesh);
    if (hits.length === 0) return null;

    const p = hits[0].point;
    const cx = Math.floor(p.x + HALF);
    const cy = Math.floor(p.z + HALF);
    if (cx < 0 || cx >= GRID || cy < 0 || cy >= GRID) return null;
    return { x: cx, y: cy };
  }

  return { render, cellAt, canvas: webgl.domElement };
}
