import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { SIM, World, Renderer, Genome, TerrainType, Season, Environment } from './types';

const GRID = 80;
const HALF = GRID / 2;
const DEATH_ANIM_FRAMES = 90; // ~1.5s at 60fps
const MAX_DYING = 200;
const GROWTH_ANIM_FRAMES = 60; // ~1s at 60fps
const SEED_FLIGHT_FRAMES = 36; // ~0.6s at 60fps
const MAX_SEEDS = 400;
const WEATHER_PARTICLE_COUNT = 300;
const WEATHER_SPREAD = 50;

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

interface GrowingPlant {
  plantId: number;
  progress: number; // 0→1 over GROWTH_ANIM_FRAMES
}

interface FlyingSeed {
  parentX: number;
  parentY: number;
  childX: number;
  childY: number;
  childId: number;
  speciesId: number;
  progress: number; // 0→1 over SEED_FLIGHT_FRAMES
  startY: number;   // world-space Y of arc start (parent canopy height)
  arcPeak: number;   // peak height of the parabolic arc
}

interface WeatherParticle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  phase: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
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

  // ── Apply terrain elevation ──
  const ELEV_SCALE = 4.0;

  // Build 81×81 corner elevation grid by averaging adjacent cells
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

  // Apply elevation to terrain vertex Y positions
  // PlaneGeometry.toNonIndexed() per cell: 6 vertices (2 triangles)
  // Winding: tri1 = (a, c, b), tri2 = (c, d, b) where
  //   a=top-left, b=top-right, c=bottom-left, d=bottom-right
  const posAttr = terrainGeo.attributes.position;
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const base = (row * GRID + col) * 6;
      const eTL = corners[row * cornerSize + col];
      const eTR = corners[row * cornerSize + col + 1];
      const eBL = corners[(row + 1) * cornerSize + col];
      const eBR = corners[(row + 1) * cornerSize + col + 1];

      // tri1: a(TL), c(BL), b(TR)
      posAttr.setY(base + 0, eTL);
      posAttr.setY(base + 1, eBL);
      posAttr.setY(base + 2, eTR);
      // tri2: c(BL), d(BR), b(TR)
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

  // ── Seed flight & growth animation state ──
  const growingPlants = new Map<number, GrowingPlant>();
  const flyingSeeds: FlyingSeed[] = [];
  let lastProcessedTick = -1;

  // ── Seed particles (instanced mesh) ──
  const seedGeo = new THREE.SphereGeometry(0.08, 4, 4);
  const seeds = new THREE.InstancedMesh(
    seedGeo,
    new THREE.MeshLambertMaterial(),
    MAX_SEEDS,
  );
  seeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  seeds.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_SEEDS * 3),
    3,
  );
  seeds.instanceColor.setUsage(THREE.DynamicDrawUsage);
  seeds.count = 0;
  seeds.frustumCulled = false;
  scene.add(seeds);

  // ── Weather particles (instanced meshes, one per season effect) ──
  type WeatherType = 'snow' | 'rain' | 'mote' | 'leaf';

  function createWeatherMesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
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

  const snowParticles = makeParticlePool();
  const rainParticles = makeParticlePool();
  const moteParticles = makeParticlePool();
  const leafParticles = makeParticlePool();

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

        switch (cell.terrainType) {
          case TerrainType.River: {
            const depth = 0.6 + (cell.waterLevel / SIM.MAX_WATER) * 0.4;
            tmpColor.setHSL(210 / 360, 0.55, 0.25 * depth);
            break;
          }
          case TerrainType.Rock: {
            const rockVar = 0.9 + cell.elevation * 0.2;
            tmpColor.setHSL(30 / 360, 0.08, 0.35 * rockVar);
            break;
          }
          case TerrainType.Hill: {
            const wr = cell.waterLevel / SIM.MAX_WATER;
            const nr = cell.nutrients / SIM.MAX_NUTRIENTS;
            tmpColor.setHSL(
              (lerp(35, 28, wr) - nr * 5) / 360,
              lerp(35, 45, wr) / 100,
              Math.max(10, lerp(60, 30, wr) - nr * 3) / 100,
            );
            break;
          }
          default: {
            const wr = cell.waterLevel / SIM.MAX_WATER;
            const nr = cell.nutrients / SIM.MAX_NUTRIENTS;
            tmpColor.setHSL(
              (lerp(30, 25, wr) - nr * 5) / 360,
              lerp(40, 50, wr) / 100,
              Math.max(10, lerp(55, 25, wr) - nr * 5) / 100,
            );
            break;
          }
        }

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

        // Season tint
        const env = world.environment;
        const seasonColors = [
          [0.3, 0.6, 0.3],  // Spring: green
          [0.6, 0.5, 0.2],  // Summer: golden
          [0.5, 0.35, 0.2], // Autumn: orange-brown
          [0.3, 0.35, 0.5], // Winter: blue-grey
        ];
        const sc0 = seasonColors[env.season];
        const sc1 = seasonColors[(env.season + 1) % 4];
        const st = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;
        const sr = sc0[0] + (sc1[0] - sc0[0]) * st;
        const sg = sc0[1] + (sc1[1] - sc0[1]) * st;
        const sb = sc0[2] + (sc1[2] - sc0[2]) * st;
        tmpColor.r = tmpColor.r * 0.85 + sr * 0.15;
        tmpColor.g = tmpColor.g * 0.85 + sg * 0.15;
        tmpColor.b = tmpColor.b * 0.85 + sb * 0.15;

        // Weather overlay
        const overlayVal = env.weatherOverlay[row * GRID + col];
        if (overlayVal === 1) {
          // Drought: desaturate + warm shift
          const avg = (tmpColor.r + tmpColor.g + tmpColor.b) / 3;
          tmpColor.r = lerp(tmpColor.r, avg + 0.1, 0.4);
          tmpColor.g = lerp(tmpColor.g, avg - 0.02, 0.4);
          tmpColor.b = lerp(tmpColor.b, avg - 0.08, 0.4);
        } else if (overlayVal === 2) {
          // Burning: bright orange-red
          tmpColor.r = lerp(tmpColor.r, 0.9, 0.7);
          tmpColor.g = lerp(tmpColor.g, 0.3, 0.7);
          tmpColor.b = lerp(tmpColor.b, 0.05, 0.7);
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
    wx: number, wz: number, baseY: number,
    sil: ReturnType<typeof computeSilhouette>,
    cr: number, cg: number, cb: number,
    tiltAngle: number, tiltDir: number,
    trunkMtx: Float32Array, trunkClr: Float32Array,
    canopyMtx: Float32Array, canopyClr: Float32Array,
    canopy2Mtx: Float32Array, canopy2Clr: Float32Array,
  ): void {
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

    // ── Primary canopy (overlaps trunk top) ──
    const canopyCenterY = baseY + sil.trunkH - sil.canopyY * 0.3;
    dummy.position.set(wx, canopyCenterY, wz);
    dummy.scale.set(sil.canopyX, sil.canopyY, sil.canopyZ);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    dummy.matrix.toArray(canopyMtx, idx * 16);

    // ── Secondary canopy blob (offset, 70% scale) ──
    dummy.position.set(
      wx + 0.15 * sil.canopyX,
      canopyCenterY - sil.canopyY * 0.1, // canopyCenterY already includes baseY
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

    // ── Ingest seed events (once per simulation tick) ──
    if (world.tick !== lastProcessedTick) {
      lastProcessedTick = world.tick;
      for (const evt of world.seedEvents) {
        let parentHeight = 1.0;
        // Find parent by position
        for (const p of world.plants.values()) {
          if (p.x === evt.parentX && p.y === evt.parentY && p.alive) {
            parentHeight = p.height;
            break;
          }
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
    const flyingChildIds = new Set(flyingSeeds.map(fs => fs.childId));

    // ── Clean up flying seeds for plants that no longer exist ──
    for (let i = flyingSeeds.length - 1; i >= 0; i--) {
      if (!world.plants.has(flyingSeeds[i].childId)) {
        flyingSeeds.splice(i, 1);
      }
    }

    // ── Detect deaths: plants in prev snapshot but no longer in world ──
    for (const [id, snap] of prevSnapshots) {
      if (!world.plants.has(id) && !flyingChildIds.has(id)) {
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

      // Skip rendering if seed is still in flight
      if (flyingChildIds.has(plant.id)) continue;

      const wx = plant.x - HALF + 0.5;
      const wz = plant.y - HALF + 0.5;
      const sil = computeSilhouette(plant.height, plant.rootDepth, plant.leafArea, plant.genome.leafSize);

      // Apply growth animation scale
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
          sil.blob2 *= s;
        }
      }

      const { cr, cg, cb } = plantColor(plant.speciesId, plant.genome);
      const baseY = getCellElevation(plant.x, plant.y);

      writeInstance(idx, wx, wz, baseY, sil, cr, cg, cb, 0, 0,
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

      const baseY = getCellElevation(dp.x, dp.y);
      writeInstance(idx, wx, wz, baseY, sil, cr, cg, cb, tiltAngle, tiltDir,
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

  function updateSeeds(): void {
    const seedMtx = seeds.instanceMatrix.array as Float32Array;
    const seedClr = seeds.instanceColor!.array as Float32Array;
    let seedIdx = 0;

    for (let i = flyingSeeds.length - 1; i >= 0; i--) {
      const fs = flyingSeeds[i];
      fs.progress += 1 / SEED_FLIGHT_FRAMES;

      if (fs.progress >= 1) {
        // Seed landed — start growth animation
        if (world.plants.has(fs.childId)) {
          growingPlants.set(fs.childId, { plantId: fs.childId, progress: 0 });
        }
        flyingSeeds.splice(i, 1);
        continue;
      }

      if (seedIdx >= MAX_SEEDS) continue;

      // Parabolic arc from parent → child
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

      // Brownish seed color with species tint
      const sc = world.speciesColors.get(fs.speciesId);
      const ci = seedIdx * 3;
      seedClr[ci]     = sc ? sc.r * 0.4 + 0.3 : 0.5;
      seedClr[ci + 1] = sc ? sc.g * 0.4 + 0.2 : 0.35;
      seedClr[ci + 2] = sc ? sc.b * 0.4 + 0.1 : 0.2;

      seedIdx++;
    }

    seeds.count = seedIdx;
    if (seedIdx > 0) {
      seeds.instanceMatrix.needsUpdate = true;
      seeds.instanceColor!.needsUpdate = true;
    }
  }

  // ═══════════════════════════════════════════════════════
  // Weather particles
  // ═══════════════════════════════════════════════════════

  function getSeasonIntensity(targetSeason: Season, env: Environment): number {
    if (env.season === targetSeason) {
      return Math.sin(env.seasonProgress * Math.PI);
    }
    // Short fade tail into the next season
    const nextSeason = (targetSeason + 1) % 4 as Season;
    if (env.season === nextSeason && env.seasonProgress < 0.15) {
      return (0.15 - env.seasonProgress) / 0.15 * 0.3;
    }
    return 0;
  }

  function respawnParticle(p: WeatherParticle, camTarget: THREE.Vector3, type: WeatherType): void {
    p.x = camTarget.x + (Math.random() - 0.5) * WEATHER_SPREAD * 2;
    p.z = camTarget.z + (Math.random() - 0.5) * WEATHER_SPREAD * 2;
    p.y = 2 + Math.random() * 23;
    p.life = 1.0;
    p.phase = Math.random() * Math.PI * 2;
    switch (type) {
      case 'snow':
        p.vx = (Math.random() - 0.5) * 0.02;
        p.vy = -0.03 - Math.random() * 0.02;
        p.vz = (Math.random() - 0.5) * 0.02;
        break;
      case 'rain':
        p.vx = 0.01;
        p.vy = -0.4 - Math.random() * 0.1;
        p.vz = 0.005;
        break;
      case 'mote':
        p.vx = (Math.random() - 0.5) * 0.01;
        p.vy = -0.005 - Math.random() * 0.005;
        p.vz = (Math.random() - 0.5) * 0.01;
        break;
      case 'leaf':
        p.vx = 0.02 + Math.random() * 0.02;
        p.vy = -0.04 - Math.random() * 0.03;
        p.vz = (Math.random() - 0.5) * 0.015;
        break;
    }
  }

  function updateOneEffect(
    particles: WeatherParticle[],
    mesh: THREE.InstancedMesh,
    intensity: number,
    camTarget: THREE.Vector3,
    type: WeatherType,
  ): void {
    if (intensity < 0.01) {
      mesh.count = 0;
      return;
    }

    (mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, intensity * 0.8 + 0.2);

    const activeCount = Math.floor(WEATHER_PARTICLE_COUNT * intensity);
    const mtx = mesh.instanceMatrix.array as Float32Array;
    const clr = mesh.instanceColor!.array as Float32Array;
    const camQuat = camera.quaternion;
    let idx = 0;

    for (let i = 0; i < activeCount; i++) {
      const p = particles[i];

      if (p.life <= 0 || p.y < -1) {
        respawnParticle(p, camTarget, type);
      }

      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.life -= 0.003;
      p.phase += 0.05;

      // Per-type motion
      if (type === 'snow') {
        p.x += Math.sin(p.phase) * 0.008;
        p.z += Math.cos(p.phase * 0.7) * 0.006;
      } else if (type === 'leaf') {
        p.x += Math.sin(p.phase * 1.2) * 0.012;
        p.z += Math.cos(p.phase * 0.8) * 0.008;
      }

      dummy.position.set(p.x, p.y, p.z);

      if (type === 'leaf') {
        dummy.rotation.set(p.phase, p.phase * 0.7, p.phase * 0.3);
        dummy.scale.setScalar(1);
      } else {
        // Billboard: face camera
        dummy.quaternion.copy(camQuat);
        dummy.scale.setScalar(1);
      }

      dummy.updateMatrix();
      dummy.matrix.toArray(mtx, idx * 16);

      const ci = idx * 3;
      if (type === 'leaf') {
        const hue = Math.sin(p.phase * 137) * 0.5 + 0.5;
        clr[ci]     = 0.6 + hue * 0.3;
        clr[ci + 1] = 0.2 + hue * 0.2;
        clr[ci + 2] = 0.05;
      } else if (type === 'snow') {
        clr[ci] = 0.95; clr[ci + 1] = 0.97; clr[ci + 2] = 1.0;
      } else if (type === 'rain') {
        clr[ci] = 0.5; clr[ci + 1] = 0.7; clr[ci + 2] = 0.85;
      } else {
        clr[ci] = 1.0; clr[ci + 1] = 0.95; clr[ci + 2] = 0.6;
      }

      idx++;
    }

    mesh.count = idx;
    if (idx > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    }
  }

  function updateWeatherParticles(): void {
    const env = world.environment;
    const camTarget = controls.target;

    updateOneEffect(snowParticles, snowMesh, getSeasonIntensity(Season.Winter, env), camTarget, 'snow');
    updateOneEffect(rainParticles, rainMesh, getSeasonIntensity(Season.Spring, env), camTarget, 'rain');
    updateOneEffect(moteParticles, moteMesh, getSeasonIntensity(Season.Summer, env), camTarget, 'mote');
    updateOneEffect(leafParticles, leafMesh, getSeasonIntensity(Season.Autumn, env), camTarget, 'leaf');
  }

  // ═══════════════════════════════════════════════════════
  // Public API (Renderer interface)
  // ═══════════════════════════════════════════════════════

  function render(selectedCell: { x: number; y: number } | null): void {
    // Adjust directional light by season
    const env = world.environment;
    const warmth = env.season === Season.Summer ? 0.12
      : env.season === Season.Winter ? -0.08 : 0;
    dirLight.color.setHSL(40 / 360 + warmth * 0.05, 0.3 + warmth, 0.8 + warmth * 0.1);
    dirLight.intensity = Math.max(0.5, env.lightMult);

    updateTerrainColors();
    updatePlants();
    updateSeeds();
    updateWeatherParticles();

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

  const projVec = new THREE.Vector3();

  function projectToScreen(gridX: number, gridY: number): { x: number; y: number } | null {
    const cx = Math.max(0, Math.min(GRID - 1, Math.round(gridX)));
    const cy = Math.max(0, Math.min(GRID - 1, Math.round(gridY)));
    const elev = getCellElevation(cx, cy);
    projVec.set(gridX - HALF + 0.5, elev + 1.5, gridY - HALF + 0.5);
    projVec.project(camera);
    if (projVec.z > 1) return null; // behind camera
    const w = webgl.domElement.clientWidth;
    const h = webgl.domElement.clientHeight;
    return {
      x: (projVec.x * 0.5 + 0.5) * w,
      y: (-projVec.y * 0.5 + 0.5) * h,
    };
  }

  return { render, cellAt, projectToScreen, canvas: webgl.domElement };
}
