import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { World, Renderer, Season } from './types';
import {
  RendererState, WeatherParticle, EventParticle,
  GRID, HALF, ELEV_SCALE, MAX_INSTANCES, MAX_SEEDS,
  WEATHER_PARTICLE_COUNT, FIRE_PARTICLE_COUNT, DUST_PARTICLE_COUNT,
  makeRoughSphere,
} from './renderer3d/state';
import { updateTerrainColors } from './renderer3d/terrain-colors';
import { updatePlants, updateSeeds } from './renderer3d/plants';
import { updateWeatherParticles } from './renderer3d/weather';
import { updateFireParticles, updateDroughtParticles } from './renderer3d/fire-particles';

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

  const vertexCount = terrainGeo.attributes.position.count;
  const colorArray = new Float32Array(vertexCount * 3);
  const colorAttr = new THREE.BufferAttribute(colorArray, 3);
  colorAttr.setUsage(THREE.DynamicDrawUsage);
  terrainGeo.setAttribute('color', colorAttr);

  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  scene.add(terrainMesh);

  // ── Apply terrain elevation ──
  const cornerSize = GRID + 1;
  const corners = new Float32Array(cornerSize * cornerSize);
  for (let cy = 0; cy <= GRID; cy++) {
    for (let cx = 0; cx <= GRID; cx++) {
      let sum = 0, count = 0;
      for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
          sum += world.grid[gy][gx].elevation;
          count++;
        }
      }
      corners[cy * cornerSize + cx] = (sum / count) * ELEV_SCALE;
    }
  }

  const posAttr = terrainGeo.attributes.position;
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const base = (row * GRID + col) * 6;
      const eTL = corners[row * cornerSize + col];
      const eTR = corners[row * cornerSize + col + 1];
      const eBL = corners[(row + 1) * cornerSize + col];
      const eBR = corners[(row + 1) * cornerSize + col + 1];

      posAttr.setY(base + 0, eTL);
      posAttr.setY(base + 1, eBL);
      posAttr.setY(base + 2, eTR);
      posAttr.setY(base + 3, eBL);
      posAttr.setY(base + 4, eBR);
      posAttr.setY(base + 5, eTR);
    }
  }
  posAttr.needsUpdate = true;
  terrainGeo.computeVertexNormals();

  function getCellElevation(cx: number, cy: number): number {
    return world.grid[cy][cx].elevation * ELEV_SCALE;
  }

  // ── Plants (instanced meshes) ──
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.15, 1, 6);
  const trunks = new THREE.InstancedMesh(
    trunkGeo, new THREE.MeshLambertMaterial(), MAX_INSTANCES,
  );
  trunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trunks.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_INSTANCES * 3), 3,
  );
  trunks.instanceColor.setUsage(THREE.DynamicDrawUsage);
  trunks.count = 0;
  trunks.frustumCulled = false;
  scene.add(trunks);

  const canopyGeo = makeRoughSphere(0.5, 2, 0.25);
  const canopies = new THREE.InstancedMesh(
    canopyGeo, new THREE.MeshLambertMaterial(), MAX_INSTANCES,
  );
  canopies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  canopies.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_INSTANCES * 3), 3,
  );
  canopies.instanceColor.setUsage(THREE.DynamicDrawUsage);
  canopies.count = 0;
  canopies.frustumCulled = false;
  scene.add(canopies);

  const canopy2Geo = makeRoughSphere(0.5, 2, 0.25);
  const canopies2 = new THREE.InstancedMesh(
    canopy2Geo, new THREE.MeshLambertMaterial(), MAX_INSTANCES,
  );
  canopies2.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  canopies2.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_INSTANCES * 3), 3,
  );
  canopies2.instanceColor.setUsage(THREE.DynamicDrawUsage);
  canopies2.count = 0;
  canopies2.frustumCulled = false;
  scene.add(canopies2);

  // ── Seed particles (instanced mesh) ──
  const seedGeo = new THREE.SphereGeometry(0.08, 4, 4);
  const seeds = new THREE.InstancedMesh(
    seedGeo, new THREE.MeshLambertMaterial(), MAX_SEEDS,
  );
  seeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  seeds.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_SEEDS * 3), 3,
  );
  seeds.instanceColor.setUsage(THREE.DynamicDrawUsage);
  seeds.count = 0;
  seeds.frustumCulled = false;
  scene.add(seeds);

  // ── Weather particles (instanced meshes, one per season effect) ──
  function createWeatherMesh(
    geo: THREE.BufferGeometry, mat: THREE.Material,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geo, mat, WEATHER_PARTICLE_COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(WEATHER_PARTICLE_COUNT * 3), 3,
    );
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  const snowGeo = new THREE.CircleGeometry(0.06, 4);
  snowGeo.rotateX(-Math.PI / 2);
  const snowMesh = createWeatherMesh(snowGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));

  const rainGeo = new THREE.PlaneGeometry(0.02, 0.3);
  const rainMesh = createWeatherMesh(rainGeo,
    new THREE.MeshBasicMaterial({ color: 0x88bbdd, transparent: true, depthWrite: false }));

  const moteGeo = new THREE.CircleGeometry(0.08, 6);
  const moteMesh = createWeatherMesh(moteGeo,
    new THREE.MeshBasicMaterial({
      color: 0xffee88, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));

  const leafGeo = new THREE.PlaneGeometry(0.12, 0.08);
  const leafMesh = createWeatherMesh(leafGeo,
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));

  function makeParticlePool(): WeatherParticle[] {
    return Array.from({ length: WEATHER_PARTICLE_COUNT }, () => ({
      x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  // ── Fire / ember / dust particles ──
  function createParticleMesh(
    geo: THREE.BufferGeometry, mat: THREE.Material, count: number,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3), 3,
    );
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  function makeEventParticlePool(count: number): EventParticle[] {
    return Array.from({ length: count }, () => ({
      x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1,
    }));
  }

  const fireMesh = createParticleMesh(
    new THREE.PlaneGeometry(0.12, 0.18),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    FIRE_PARTICLE_COUNT,
  );
  const emberMesh = createParticleMesh(
    new THREE.CircleGeometry(0.03, 4),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    FIRE_PARTICLE_COUNT,
  );
  const dustMesh = createParticleMesh(
    new THREE.CircleGeometry(0.05, 4),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.6 }),
    DUST_PARTICLE_COUNT,
  );

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
    45, container.clientWidth / container.clientHeight, 0.1, 200,
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

  // ── Build shared state for sub-modules ──
  const state: RendererState = {
    colorMode: 'natural',
    world,
    scene,
    camera,
    controls,
    dummy,
    tmpColor,
    colorArray,
    colorAttr,
    getCellElevation,
    trunks,
    canopies,
    canopies2,
    seeds,
    prevSnapshots: new Map(),
    dyingPlants: new Map(),
    burningPlants: new Map(),
    growingPlants: new Map(),
    flyingSeeds: [],
    lastProcessedTick: -1,
    snowMesh,
    rainMesh,
    moteMesh,
    leafMesh,
    snowParticles: makeParticlePool(),
    rainParticles: makeParticlePool(),
    moteParticles: makeParticlePool(),
    leafParticles: makeParticlePool(),
    fireMesh,
    emberMesh,
    dustMesh,
    fireParticles: makeEventParticlePool(FIRE_PARTICLE_COUNT),
    emberParticles: makeEventParticlePool(FIRE_PARTICLE_COUNT),
    dustParticles: makeEventParticlePool(DUST_PARTICLE_COUNT),
  };

  // ═══════════════════════════════════════════════════════
  // Public API (Renderer interface)
  // ═══════════════════════════════════════════════════════

  function render(selectedCell: { x: number; y: number } | null): void {
    const env = world.environment;
    const warmth = env.season === Season.Summer ? 0.12
      : env.season === Season.Winter ? -0.08 : 0;
    dirLight.color.setHSL(40 / 360 + warmth * 0.05, 0.3 + warmth, 0.8 + warmth * 0.1);
    dirLight.intensity = Math.max(0.5, env.lightMult);

    updateTerrainColors(state);
    updatePlants(state);
    updateSeeds(state);
    updateWeatherParticles(state);
    updateFireParticles(state);
    updateDroughtParticles(state);

    if (selectedCell) {
      selectMesh.visible = true;
      selectMesh.position.set(
        selectedCell.x - HALF + 0.5,
        getCellElevation(selectedCell.x, selectedCell.y) + 0.02,
        selectedCell.y - HALF + 0.5,
      );
    } else {
      selectMesh.visible = false;
    }

    controls.update();
    webgl.render(scene, camera);
  }

  function cellAt(
    canvasX: number, canvasY: number,
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

  const projVec = new THREE.Vector3();

  function projectToScreen(gridX: number, gridY: number): { x: number; y: number } | null {
    const cx = Math.max(0, Math.min(GRID - 1, Math.round(gridX)));
    const cy = Math.max(0, Math.min(GRID - 1, Math.round(gridY)));
    const elev = getCellElevation(cx, cy);
    projVec.set(gridX - HALF + 0.5, elev + 1.5, gridY - HALF + 0.5);
    projVec.project(camera);
    if (projVec.z > 1) return null;
    const w = webgl.domElement.clientWidth;
    const h = webgl.domElement.clientHeight;
    return {
      x: (projVec.x * 0.5 + 0.5) * w,
      y: (-projVec.y * 0.5 + 0.5) * h,
    };
  }

  function moveTo(gridX: number, gridY: number): void {
    const wx = gridX - HALF + 0.5;
    const wz = gridY - HALF + 0.5;
    const wy = getCellElevation(
      Math.max(0, Math.min(GRID - 1, Math.round(gridX))),
      Math.max(0, Math.min(GRID - 1, Math.round(gridY))),
    );
    const offset = camera.position.clone().sub(controls.target);
    controls.target.set(wx, wy, wz);
    camera.position.copy(controls.target).add(offset);
  }

  function setColorMode(mode: 'natural' | 'species'): void {
    state.colorMode = mode;
  }

  return { render, cellAt, projectToScreen, moveTo, setColorMode, canvas: webgl.domElement };
}
