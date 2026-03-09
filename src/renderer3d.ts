import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { World, Renderer, Season, ColorMode } from './types';
import type { TimingHooks } from './perf';
import { RendererState, GRID, HALF, MAX_PER_SUBTYPE } from './renderer3d/state';
import { updateTerrainColors } from './renderer3d/terrain-colors';
import { updatePlants, updateSeeds } from './renderer3d/plants';
import { updateWeatherParticles } from './renderer3d/weather';
import { updateFireParticles, updateDroughtParticles, updateDiseaseParticles } from './renderer3d/fire-particles';
import { createSkyDome } from './renderer3d/sky';
import { createWaterSurface } from './renderer3d/water';
import { createDistantEnvironment } from './renderer3d/environment';
import { createTerrain, rebuildTerrainGeometry, createSubtypeMeshes, createSeedMesh, createWeatherMeshes, createEventMeshes } from './renderer3d/setup';
import { createHerbivoreMesh, updateHerbivores } from './renderer3d/herbivores';
import { createDecorMeshes, placeTerrainDecor } from './renderer3d/terrain-decor';
import { createGrassLayer } from './renderer3d/grass-layer';

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
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(512, 512);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 150;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  // ── Sky dome & fog ──
  const skyDome = createSkyDome(scene);

  // ── Terrain ──
  const terrain = createTerrain(world);
  terrain.terrainMesh.castShadow = true;
  terrain.terrainMesh.receiveShadow = true;
  scene.add(terrain.terrainMesh);
  terrain.groundMesh.receiveShadow = true;
  scene.add(terrain.groundMesh);
  const { colorArray, colorAttr, groundMat } = terrain;
  let getCellElevation = terrain.getCellElevation;
  let getCellSlope = terrain.getCellSlope;
  let rockFormations = terrain.rockFormations;

  // ── Distant environment (hills + forest ring) ──
  const distantEnvironment = createDistantEnvironment(scene);

  // ── Water surface ──
  let waterSurface = createWaterSurface(world);
  scene.add(waterSurface.mesh);

  // ── Shader-based grass base layer ──
  const grassLayer = createGrassLayer(getCellElevation);
  scene.add(grassLayer.mesh);

  // ── Plants (24 subtype meshes × 2 LOD levels + seeds) ──
  const { meshes: subtypeMeshes, meshesLow: subtypeMeshesLow, maturityHeights, groundCover } = createSubtypeMeshes();
  for (let i = 0; i < subtypeMeshes.length; i++) {
    if (i <= 4) continue; // subtypes 0-4: handled entirely by shader grass field
    subtypeMeshes[i].castShadow = i >= 6;
    subtypeMeshesLow[i].castShadow = i >= 6;
    scene.add(subtypeMeshes[i]);
    scene.add(subtypeMeshesLow[i]);
  }
  const seeds = createSeedMesh();
  scene.add(seeds);

  // ── Weather particles ──
  const weather = createWeatherMeshes();
  scene.add(weather.snowMesh);
  scene.add(weather.rainMesh);
  scene.add(weather.moteMesh);
  scene.add(weather.leafMesh);

  // ── Herbivores ──
  const herbivoreMesh = createHerbivoreMesh();
  scene.add(herbivoreMesh);

  // ── Terrain decorations (static) ──
  const decor = createDecorMeshes();
  decor.stones.castShadow = true;
  scene.add(decor.stones);
  scene.add(decor.reeds);
  scene.add(decor.dryBrush);
  placeTerrainDecor(world, getCellElevation, decor);

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
  webgl.shadowMap.enabled = true;
  webgl.shadowMap.type = THREE.PCFShadowMap;
  webgl.shadowMap.autoUpdate = false;
  webgl.toneMapping = THREE.ACESFilmicToneMapping;
  webgl.toneMappingExposure = 1.8;
  webgl.domElement.style.display = 'block';
  container.appendChild(webgl.domElement);

  // ── Vignette overlay (pure CSS, zero GPU cost) ──
  const vignette = document.createElement('div');
  vignette.style.cssText =
    'position:absolute;inset:0;pointer-events:none;' +
    'background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,0.45) 100%);'
  ;
  container.appendChild(vignette);

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
    getCellSlope,
    subtypeMeshes,
    subtypeMeshesLow,
    maturityHeights,
    groundCover,
    grassLayer,
    seeds,
    prevSnapshots: new Map(),
    dyingPlants: new Map(),
    burningPlants: new Map(),
    growingPlants: new Map(),
    flyingSeeds: [],
    lastProcessedTick: -1,
    lastShadowCounts: new Uint32Array(40),
    lastTerrainTick: -1,
    lastTerrainColorMode: 'natural',
    lastPlantTick: -1,
    animSpeed: 1,
    lastPlantColorMode: 'natural',
    plantsDirty: false,
    highlightedSpecies: null,
    highlightedLineageRoot: null,
    lastHighlightedSpecies: null,
    lastHighlightedLineageRoot: null,
    plantColorCache: new Map(),
    nextSnapshots: new Map(),
    subtypePlantIds: Array.from({ length: 40 }, () => new Int32Array(MAX_PER_SUBTYPE)),
    subtypePlantIdsLow: Array.from({ length: 40 }, () => new Int32Array(MAX_PER_SUBTYPE)),
    plantIndex: new Map(),
    subtypeLiveCounts: new Uint32Array(40),
    subtypeLiveCountsLow: new Uint32Array(40),
    dirtyPlants: new Set(),
    prevPlantDisease: new Map(),
    forceFullRebuild: true,
    lodDistSq: 25 * 25,
    lastLodCamX: Infinity,
    lastLodCamZ: Infinity,
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
    decorStones: decor.stones,
    decorReeds: decor.reeds,
    decorDryBrush: decor.dryBrush,
  };

  // ═══════════════════════════════════════════════════════
  // Public API (Renderer interface)
  // ═══════════════════════════════════════════════════════

  function render(selectedCell: { x: number; y: number } | null, hooks?: TimingHooks): void {
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
    const sunDir = skyDome.getSunDirection();
    const fogColor = skyDome.getFogColor();
    waterSurface.update(env, sunDir, fogColor);

    // Update grass layer uniforms (per-frame wind animation)
    grassLayer.updateUniforms(performance.now() * 0.001, sunDir, fogColor, camera);

    // Capture before updatePlants clears these
    const isNewTick = world.tick !== state.lastProcessedTick;
    const isFirstFrame = state.lastProcessedTick === -1;
    const tickDelta = isFirstFrame ? 1 : world.tick - state.lastProcessedTick;

    hooks?.begin('terrainColors');  updateTerrainColors(state);     hooks?.end('terrainColors');
    hooks?.begin('plants');         updatePlants(state);            hooks?.end('plants');

    // Re-render shadow map when per-subtype instance counts change (deaths/births),
    // or periodically every 30 ticks for gradual growth. Checked AFTER updatePlants
    // so mesh counts reflect the current tick. Always render on first frame.
    if (isNewTick) {
      let shadowDirty = isFirstFrame || world.tick % 30 === 0;
      if (!shadowDirty && tickDelta <= 1) {
        for (let i = 0; i < subtypeMeshes.length; i++) {
          if (state.subtypeLiveCounts[i] + state.subtypeLiveCountsLow[i] !== state.lastShadowCounts[i]) {
            shadowDirty = true;
            break;
          }
        }
      }
      if (shadowDirty) {
        webgl.shadowMap.needsUpdate = true;
        for (let i = 0; i < subtypeMeshes.length; i++) {
          state.lastShadowCounts[i] = state.subtypeLiveCounts[i] + state.subtypeLiveCountsLow[i];
        }
      }
    }
    // In fast mode (tickDelta > 1), throttle secondary updates to every 3rd tick
    const skipSecondary = tickDelta > 1 && (world.tick % 3 !== 0);
    if (!skipSecondary) {
      hooks?.begin('grass');          grassLayer.updateCellData(state); hooks?.end('grass');
      hooks?.begin('seeds');          updateSeeds(state);             hooks?.end('seeds');
      hooks?.begin('weather');        updateWeatherParticles(state);  hooks?.end('weather');
      hooks?.begin('fire');           updateFireParticles(state);     hooks?.end('fire');
      hooks?.begin('drought');        updateDroughtParticles(state);  hooks?.end('drought');
      hooks?.begin('disease');        updateDiseaseParticles(state);  hooks?.end('disease');
    }
    hooks?.begin('herbivoresR');    updateHerbivores(state);        hooks?.end('herbivoresR');

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

    hooks?.begin('glDraw');  webgl.render(scene, camera);  hooks?.end('glDraw');
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

  function plantAt(
    canvasX: number, canvasY: number,
  ): { plantId: number; speciesId: number } | null {
    ndcMouse.x = (canvasX / webgl.domElement.clientWidth) * 2 - 1;
    ndcMouse.y = -(canvasY / webgl.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(ndcMouse, camera);
    const hits = raycaster.intersectObject(terrain.terrainMesh);
    if (hits.length === 0) return null;

    const p = hits[0].point;
    const cx = Math.floor(p.x + HALF);
    const cy = Math.floor(p.z + HALF);

    // Search a 3x3 neighborhood for the closest plant to the hit point
    let bestPlant: { plantId: number; speciesId: number } | null = null;
    let bestDist = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= GRID) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= GRID) continue;
        const cell = world.grid[ny][nx];
        if (cell.plantId === null) continue;
        const plant = world.plants.get(cell.plantId);
        if (!plant?.alive) continue;
        const wx = plant.x - HALF + 0.5;
        const wz = plant.y - HALF + 0.5;
        const ddx = p.x - wx;
        const ddz = p.z - wz;
        const dist = ddx * ddx + ddz * ddz;
        // Only match if within roughly the plant's visual footprint
        const radius = Math.max(0.3, plant.height * 0.4);
        if (dist < radius * radius && dist < bestDist) {
          bestDist = dist;
          bestPlant = { plantId: plant.id, speciesId: plant.speciesId };
        }
      }
    }
    return bestPlant;
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

  function setColorMode(mode: ColorMode): void {
    state.colorMode = mode;
  }

  function setHighlightedSpecies(ids: Set<number> | null): void {
    state.highlightedSpecies = ids;
  }

  function setHighlightedLineageRoot(rootId: number | null): void {
    state.highlightedLineageRoot = rootId;
  }

  function markPlantsDirty(): void { state.plantsDirty = true; }

  function rebuildTerrain(): void {
    const result = rebuildTerrainGeometry(world, terrain);
    getCellElevation = result.getCellElevation;
    getCellSlope = result.getCellSlope;
    rockFormations = result.rockFormations;
    state.getCellElevation = getCellElevation;
    state.getCellSlope = getCellSlope;
    state.rockFormations = rockFormations;

    // Clear all animation state
    state.prevSnapshots.clear();
    state.dyingPlants.clear();
    state.burningPlants.clear();
    state.growingPlants.clear();
    state.flyingSeeds.length = 0;
    state.plantColorCache.clear();
    state.nextSnapshots.clear();
    state.plantIndex.clear();
    state.subtypeLiveCounts.fill(0);
    state.subtypeLiveCountsLow.fill(0);
    state.dirtyPlants.clear();
    state.prevPlantDisease.clear();
    state.forceFullRebuild = true;
    state.prevHerbivoreSnapshots.clear();
    state.dyingHerbivores.clear();
    state.movingHerbivores.clear();

    // Re-place terrain decorations with new elevation
    placeTerrainDecor(world, getCellElevation, decor);

    // Rebuild grass layer elevation texture
    grassLayer.rebuildElevation(getCellElevation);

    // Force full update on next frame
    state.lastProcessedTick = -1;
    state.lastShadowCounts.fill(0);
    state.lastTerrainTick = -1;
    state.lastPlantTick = -1;
    state.lastHerbivoreTick = -1;
    state.plantsDirty = true;
  }

  function rebuildWater(): void {
    // Remove old water mesh
    scene.remove(waterSurface.mesh);
    if (waterSurface.mesh.geometry) waterSurface.mesh.geometry.dispose();

    // Create new water surface
    waterSurface = createWaterSurface(world);
    scene.add(waterSurface.mesh);
    state.waterSurface = waterSurface;
  }

  return { render, cellAt, plantAt, projectToScreen, moveTo, setColorMode, setHighlightedSpecies, setHighlightedLineageRoot, markPlantsDirty, rebuildTerrain, rebuildWater, canvas: webgl.domElement, camera, mapControls: controls };
}
