import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { SIM, World, Renderer } from './types';

const GRID = 80;
const HALF = GRID / 2;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
  const MAX_PLANTS = GRID * GRID;

  const trunkGeo = new THREE.CylinderGeometry(0.05, 0.1, 1, 6);
  const trunks = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshLambertMaterial(),
    MAX_PLANTS,
  );
  trunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trunks.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_PLANTS * 3),
    3,
  );
  trunks.instanceColor.setUsage(THREE.DynamicDrawUsage);
  trunks.count = 0;
  trunks.frustumCulled = false;
  scene.add(trunks);

  const canopyGeo = new THREE.IcosahedronGeometry(0.5, 1);
  const canopies = new THREE.InstancedMesh(
    canopyGeo,
    new THREE.MeshLambertMaterial(),
    MAX_PLANTS,
  );
  canopies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  canopies.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_PLANTS * 3),
    3,
  );
  canopies.instanceColor.setUsage(THREE.DynamicDrawUsage);
  canopies.count = 0;
  canopies.frustumCulled = false;
  scene.add(canopies);

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

  function updatePlants(): void {
    const trunkMtx = trunks.instanceMatrix.array as Float32Array;
    const trunkClr = trunks.instanceColor!.array as Float32Array;
    const canopyMtx = canopies.instanceMatrix.array as Float32Array;
    const canopyClr = canopies.instanceColor!.array as Float32Array;

    let idx = 0;

    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;

      const wx = plant.x - HALF + 0.5;
      const wz = plant.y - HALF + 0.5;
      const h = plant.height;
      const leafRatio = plant.leafArea / SIM.MAX_LEAF_AREA;

      // ── Trunk ──
      const trunkH = Math.max(0.1, h * 0.6);
      dummy.position.set(wx, trunkH * 0.5, wz);
      dummy.scale.set(1, trunkH, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      dummy.matrix.toArray(trunkMtx, idx * 16);

      // ── Canopy ──
      const canopyS = 0.2 + leafRatio * 0.6;
      dummy.position.set(wx, trunkH + canopyS * 0.3, wz);
      dummy.scale.set(canopyS, canopyS, canopyS);
      dummy.updateMatrix();
      dummy.matrix.toArray(canopyMtx, idx * 16);

      // ── Species color blended with genome variation ──
      const sc = world.speciesColors.get(plant.speciesId);
      const g = plant.genome;
      const gr = 0.2 + g.rootPriority * 0.6;
      const gg = 0.3 + g.leafSize * 0.5;
      const gb = 0.2 + g.heightPriority * 0.6;

      const cr = sc ? sc.r * 0.7 + gr * 0.3 : gr;
      const cg = sc ? sc.g * 0.7 + gg * 0.3 : gg;
      const cb = sc ? sc.b * 0.7 + gb * 0.3 : gb;

      const ci = idx * 3;
      trunkClr[ci] = cr * 0.5;
      trunkClr[ci + 1] = cg * 0.4;
      trunkClr[ci + 2] = cb * 0.3;

      canopyClr[ci] = cr;
      canopyClr[ci + 1] = cg;
      canopyClr[ci + 2] = cb;

      idx++;
    }

    trunks.count = idx;
    canopies.count = idx;
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    trunks.instanceColor!.needsUpdate = true;
    canopies.instanceColor!.needsUpdate = true;
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
