import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { World, Renderer, Season } from './types';
import { RendererState, GRID, HALF } from './renderer3d/state';
import { updateTerrainColors } from './renderer3d/terrain-colors';
import { updatePlants, updateSeeds } from './renderer3d/plants';
import { updateWeatherParticles } from './renderer3d/weather';
import { updateFireParticles, updateDroughtParticles, updateDiseaseParticles } from './renderer3d/fire-particles';
import { createSkyDome } from './renderer3d/sky';
import { createWaterSurface } from './renderer3d/water';
import { createDistantEnvironment } from './renderer3d/environment';
import { createTerrain, createPlantMeshes, createWeatherMeshes, createEventMeshes } from './renderer3d/setup';
import { createHerbivoreMesh, updateHerbivores } from './renderer3d/herbivores';

export function createRenderer3D(
  container: HTMLElement,
  world: World,
): Renderer & { canvas: HTMLCanvasElement } {
  // ── Scene & lights ──
  const scene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
  dirLight.position.set(30, 50, 20);
  scene.add(dirLight);

  // ── Sky dome & fog ──
  const skyDome = createSkyDome(scene);

  // ── Terrain ──
  const terrain = createTerrain(world);
  scene.add(terrain.terrainMesh);
  scene.add(terrain.groundMesh);
  const { colorArray, colorAttr, getCellElevation, groundMat, rockFormations } = terrain;

  // ── Distant environment (hills + forest ring) ──
  const distantEnvironment = createDistantEnvironment(scene);

  // ── Water surface ──
  const waterSurface = createWaterSurface(world);
  scene.add(waterSurface.mesh);

  // ── Plants ──
  const plants = createPlantMeshes();
  scene.add(plants.trunks);
  scene.add(plants.canopies);
  scene.add(plants.branches);
  scene.add(plants.seeds);

  // ── Weather particles ──
  const weather = createWeatherMeshes();
  scene.add(weather.snowMesh);
  scene.add(weather.rainMesh);
  scene.add(weather.moteMesh);
  scene.add(weather.leafMesh);

  // ── Herbivores ──
  const herbivoreMesh = createHerbivoreMesh();
  scene.add(herbivoreMesh);

  // ── Event particles (fire, ember, dust, spore) ──
  const events = createEventMeshes();
  scene.add(events.fireMesh);
  scene.add(events.emberMesh);
  scene.add(events.dustMesh);
  scene.add(events.sporeMesh);

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
    45, container.clientWidth / container.clientHeight, 0.1, 20000,
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
    trunks: plants.trunks,
    canopies: plants.canopies,
    branches: plants.branches,
    seeds: plants.seeds,
    prevSnapshots: new Map(),
    dyingPlants: new Map(),
    burningPlants: new Map(),
    growingPlants: new Map(),
    flyingSeeds: [],
    lastProcessedTick: -1,
    lastTerrainTick: -1,
    lastTerrainColorMode: 'natural',
    lastPlantTick: -1,
    lastPlantColorMode: 'natural',
    plantColorCache: new Map(),
    nextSnapshots: new Map(),
    ...weather,
    ...events,
    herbivoreMesh,
    prevHerbivoreSnapshots: new Map(),
    dyingHerbivores: new Map(),
    movingHerbivores: new Map(),
    lastHerbivoreTick: -1,
    skyDome,
    ambientLight,
    dirLight,
    waterSurface,
    distantEnvironment,
    rockFormations,
  };

  // ═══════════════════════════════════════════════════════
  // Public API (Renderer interface)
  // ═══════════════════════════════════════════════════════

  function render(selectedCell: { x: number; y: number } | null): void {
    const env = world.environment;

    // Seasonal directional light color + intensity
    const warmth = env.season === Season.Summer ? 0.12
      : env.season === Season.Winter ? -0.08 : 0;
    dirLight.color.setHSL(40 / 360 + warmth * 0.05, 0.3 + warmth, 0.8 + warmth * 0.1);
    dirLight.intensity = Math.max(0.5, env.lightMult);

    // Seasonal sun height: higher in summer, lower in winter
    const seasonSunHeight = env.season === Season.Summer ? 55
      : env.season === Season.Winter ? 25 : 40;
    const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;
    const nextSunHeight = ((env.season + 1) % 4) === Season.Summer ? 55
      : ((env.season + 1) % 4) === Season.Winter ? 25 : 40;
    dirLight.position.y = seasonSunHeight + (nextSunHeight - seasonSunHeight) * t;

    // Seasonal ambient light
    const ambientTargets = [0.55, 0.45, 0.50, 0.60];
    const a0 = ambientTargets[env.season];
    const a1 = ambientTargets[(env.season + 1) % 4];
    ambientLight.intensity = a0 + (a1 - a0) * t;

    // Update sky dome & fog
    skyDome.update(env, camera.position);

    // Update distant environment colors
    distantEnvironment.update(env);

    // Update ground plane color seasonally
    const groundColors: [number, number, number][] = [
      [0.25, 0.38, 0.18],
      [0.22, 0.35, 0.14],
      [0.35, 0.30, 0.15],
      [0.75, 0.78, 0.85],  // Winter: snowy
    ];
    const gc0 = groundColors[env.season];
    const gc1 = groundColors[(env.season + 1) % 4];
    groundMat.color.setRGB(
      gc0[0] + (gc1[0] - gc0[0]) * t,
      gc0[1] + (gc1[1] - gc0[1]) * t,
      gc0[2] + (gc1[2] - gc0[2]) * t,
    );

    // Update water animation
    waterSurface.update(env, skyDome.getSunDirection(), skyDome.getFogColor());

    updateTerrainColors(state);
    updatePlants(state);
    updateSeeds(state);
    updateWeatherParticles(state);
    updateHerbivores(state);
    updateFireParticles(state);
    updateDroughtParticles(state);
    updateDiseaseParticles(state);

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
    const hits = raycaster.intersectObject(terrain.terrainMesh);
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
