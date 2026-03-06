import * as THREE from 'three';
import { World } from '../types';
import {
  GRID, ELEV_SCALE, MAX_INSTANCES, MAX_SEEDS, MAX_BRANCH_INSTANCES,
  SNOW_PARTICLE_COUNT, RAIN_PARTICLE_COUNT, MOTE_PARTICLE_COUNT, LEAF_PARTICLE_COUNT,
  FIRE_PARTICLE_COUNT, DUST_PARTICLE_COUNT, SPORE_PARTICLE_COUNT,
  WeatherParticle, EventParticle,
  makeRoughSphere,
} from './state';
import { createRockFormations, RockFormations } from './rocks';

// ── Terrain ──

export interface TerrainResult {
  terrainMesh: THREE.Mesh;
  colorArray: Float32Array;
  colorAttr: THREE.BufferAttribute;
  getCellElevation: (cx: number, cy: number) => number;
  groundMesh: THREE.Mesh;
  groundMat: THREE.MeshLambertMaterial;
  rockFormations: RockFormations;
}

export function createTerrain(world: World): TerrainResult {
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

  // Rock formations (compute height overlay before terrain)
  const rockFormations = createRockFormations(world);
  const rockOverlay = rockFormations.heightOverlay;

  // Apply terrain elevation
  const cornerSize = GRID + 1;
  const corners = new Float32Array(cornerSize * cornerSize);
  for (let cy = 0; cy <= GRID; cy++) {
    for (let cx = 0; cx <= GRID; cx++) {
      let sum = 0, count = 0;
      let rockSum = 0;
      for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
          sum += world.grid[gy][gx].elevation;
          rockSum += rockOverlay[gy * GRID + gx];
          count++;
        }
      }
      corners[cy * cornerSize + cx] = (sum / count) * ELEV_SCALE + rockSum / count;
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
    // Average the 4 corner heights to match the actual terrain mesh surface
    const tl = corners[cy * cornerSize + cx];
    const tr = corners[cy * cornerSize + cx + 1];
    const bl = corners[(cy + 1) * cornerSize + cx];
    const br = corners[(cy + 1) * cornerSize + cx + 1];
    return (tl + tr + bl + br) * 0.25;
  }

  // Extended ground plane
  const groundGeo = new THREE.PlaneGeometry(256, 256);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a5a2a });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.3;

  return { terrainMesh, colorArray, colorAttr, getCellElevation, groundMesh, groundMat, rockFormations };
}

/**
 * Rebuild terrain vertex heights in-place from current world grid elevations.
 * Recomputes rock formations and corner heights, then updates the existing mesh.
 */
export function rebuildTerrainGeometry(
  world: World,
  terrain: TerrainResult,
): { getCellElevation: (cx: number, cy: number) => number; rockFormations: RockFormations } {
  const rockFormations = createRockFormations(world);
  const rockOverlay = rockFormations.heightOverlay;

  const cornerSize = GRID + 1;
  const corners = new Float32Array(cornerSize * cornerSize);
  for (let cy = 0; cy <= GRID; cy++) {
    for (let cx = 0; cx <= GRID; cx++) {
      let sum = 0, count = 0;
      let rockSum = 0;
      for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
          sum += world.grid[gy][gx].elevation;
          rockSum += rockOverlay[gy * GRID + gx];
          count++;
        }
      }
      corners[cy * cornerSize + cx] = (sum / count) * ELEV_SCALE + rockSum / count;
    }
  }

  const posAttr = terrain.terrainMesh.geometry.attributes.position;
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
  terrain.terrainMesh.geometry.computeVertexNormals();

  function getCellElevation(cx: number, cy: number): number {
    const tl = corners[cy * cornerSize + cx];
    const tr = corners[cy * cornerSize + cx + 1];
    const bl = corners[(cy + 1) * cornerSize + cx];
    const br = corners[(cy + 1) * cornerSize + cx + 1];
    return (tl + tr + bl + br) * 0.25;
  }

  return { getCellElevation, rockFormations };
}

// ── Plant meshes ──

export interface PlantMeshes {
  trunks: THREE.InstancedMesh;
  canopies: THREE.InstancedMesh;
  branches: THREE.InstancedMesh;
  seeds: THREE.InstancedMesh;
}

function createInstancedMesh(
  geo: THREE.BufferGeometry, maxCount: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), maxCount);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(maxCount * 3), 3,
  );
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  return mesh;
}

// ── Grass meshes ──

export const MAX_GRASS_TUFTS = MAX_INSTANCES;

export interface GrassMeshes {
  grassTufts: THREE.InstancedMesh;
}

function createGrassTuftGeometry(): THREE.BufferGeometry {
  // Two cross-planes at 90° with an asymmetric blade silhouette.
  // Multiple instances per plant (randomly positioned/rotated) create
  // natural-looking coverage without the "pizza" pattern of 3-plane stars.
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const PLANES = 2;
  const HALF_W = 0.55;

  // Asymmetric silhouette: peak right of center, gentle left ramp, steeper right drop.
  // Shallow valleys (0.35-0.55) so it reads as a dense clump, not spikes.
  const topHeights = [0.0, 0.35, 0.58, 0.48, 0.72, 0.60, 0.88, 1.0, 0.65, 0.78, 0.50, 0.38, 0.0];
  const topN = topHeights.length;

  for (let p = 0; p < PLANES; p++) {
    const angle = (p / PLANES) * Math.PI; // 0° and 90°
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = -sin, nz = cos;

    const vBase = vertices.length / 3;

    for (let i = 0; i < topN; i++) {
      const t = i / (topN - 1);
      const localX = (t - 0.5) * 2 * HALF_W;
      const wx = localX * cos;
      const wz = localX * sin;

      vertices.push(wx, 0, wz);
      normals.push(nx, 0, nz);
      vertices.push(wx, topHeights[i], wz);
      normals.push(nx, 0, nz);
    }

    for (let i = 0; i < topN - 1; i++) {
      const bl = vBase + i * 2;
      const tl = bl + 1;
      const br = vBase + (i + 1) * 2;
      const tr = br + 1;
      indices.push(bl, br, tl);
      indices.push(tl, br, tr);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

export function createGrassMeshes(): GrassMeshes {
  const tuftGeo = createGrassTuftGeometry();
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const grassTufts = new THREE.InstancedMesh(tuftGeo, mat, MAX_GRASS_TUFTS);
  grassTufts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  grassTufts.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_GRASS_TUFTS * 3), 3,
  );
  grassTufts.instanceColor.setUsage(THREE.DynamicDrawUsage);
  grassTufts.count = 0;
  grassTufts.frustumCulled = false;

  return { grassTufts };
}

// ── Succulent meshes ──

export const MAX_SUCCULENT_BODIES = MAX_INSTANCES; // one body per succulent plant

export interface SucculentMeshes {
  succulentBodies: THREE.InstancedMesh;
}

export function createSucculentMeshes(): SucculentMeshes {
  // Capsule with few radial segments → visible vertical ribs (cactus-like)
  // length=0 makes it sphere-shaped; per-instance Y-scaling elongates for columnar vs barrel
  // 8 radial segments = 8 vertical ribs visible via flat shading
  const capsule = new THREE.CapsuleGeometry(0.5, 0, 2, 8);
  const bodyGeo = capsule.toNonIndexed(); // required for proper flat shading
  capsule.dispose();
  bodyGeo.computeVertexNormals();

  // Flat shading → each facet is a distinct panel (reads as cactus ribs)
  const mat = new THREE.MeshLambertMaterial({ flatShading: true });
  const succulentBodies = new THREE.InstancedMesh(bodyGeo, mat, MAX_SUCCULENT_BODIES);
  succulentBodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  succulentBodies.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_SUCCULENT_BODIES * 3), 3,
  );
  succulentBodies.instanceColor.setUsage(THREE.DynamicDrawUsage);
  succulentBodies.count = 0;
  succulentBodies.frustumCulled = false;
  return { succulentBodies };
}

export function createPlantMeshes(): PlantMeshes {
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.15, 1, 6);
  const trunks = createInstancedMesh(trunkGeo, MAX_INSTANCES);

  const canopyGeo = makeRoughSphere(0.5, 1, 0.25);
  const canopies = createInstancedMesh(canopyGeo, MAX_BRANCH_INSTANCES);

  const branchGeo = new THREE.CylinderGeometry(0.04, 0.09, 1, 5);
  const branches = createInstancedMesh(branchGeo, MAX_BRANCH_INSTANCES);

  const seedGeo = new THREE.CircleGeometry(0.10, 5);
  const seeds = createInstancedMesh(seedGeo, MAX_SEEDS);
  (seeds.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;

  return { trunks, canopies, branches, seeds };
}

// ── Floral meshes (flowers, fruit, grass seed heads) ──

export const MAX_FLORAL = 20000;
export const MAX_GRASS_SEED_HEADS = 12000;

export interface FloralMeshes {
  flowerFruit: THREE.InstancedMesh;
  grassSeedHeads: THREE.InstancedMesh;
}

export function createFloralMeshes(): FloralMeshes {
  const flowerFruitGeo = new THREE.IcosahedronGeometry(0.12, 1);
  const flowerFruit = createInstancedMesh(flowerFruitGeo, MAX_FLORAL);

  const grassSeedGeo = new THREE.SphereGeometry(0.06, 4, 3);
  const grassSeedHeads = createInstancedMesh(grassSeedGeo, MAX_GRASS_SEED_HEADS);

  return { flowerFruit, grassSeedHeads };
}

// ── Weather meshes ──

export interface WeatherMeshes {
  snowMesh: THREE.InstancedMesh;
  rainMesh: THREE.InstancedMesh;
  moteMesh: THREE.InstancedMesh;
  leafMesh: THREE.InstancedMesh;
  snowParticles: WeatherParticle[];
  rainParticles: WeatherParticle[];
  moteParticles: WeatherParticle[];
  leafParticles: WeatherParticle[];
}

function createWeatherInstancedMesh(
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
  return mesh;
}

function makeWeatherParticlePool(count: number): WeatherParticle[] {
  return Array.from({ length: count }, () => ({
    x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0,
    phase: Math.random() * Math.PI * 2,
  }));
}

export function createWeatherMeshes(): WeatherMeshes {
  const snowGeo = new THREE.CircleGeometry(0.06, 4);
  snowGeo.rotateX(-Math.PI / 2);
  const snowMesh = createWeatherInstancedMesh(snowGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }),
    SNOW_PARTICLE_COUNT);

  const rainGeo = new THREE.PlaneGeometry(0.02, 0.3);
  const rainMesh = createWeatherInstancedMesh(rainGeo,
    new THREE.MeshBasicMaterial({ color: 0x88bbdd, transparent: true, depthWrite: false }),
    RAIN_PARTICLE_COUNT);

  const moteGeo = new THREE.CircleGeometry(0.08, 6);
  const moteMesh = createWeatherInstancedMesh(moteGeo,
    new THREE.MeshBasicMaterial({
      color: 0xffee88, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    MOTE_PARTICLE_COUNT);

  const leafGeo = new THREE.PlaneGeometry(0.12, 0.08);
  const leafMesh = createWeatherInstancedMesh(leafGeo,
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    LEAF_PARTICLE_COUNT);

  return {
    snowMesh, rainMesh, moteMesh, leafMesh,
    snowParticles: makeWeatherParticlePool(SNOW_PARTICLE_COUNT),
    rainParticles: makeWeatherParticlePool(RAIN_PARTICLE_COUNT),
    moteParticles: makeWeatherParticlePool(MOTE_PARTICLE_COUNT),
    leafParticles: makeWeatherParticlePool(LEAF_PARTICLE_COUNT),
  };
}

// ── Event meshes (fire, ember, dust, spore) ──

export interface EventMeshes {
  fireMesh: THREE.InstancedMesh;
  emberMesh: THREE.InstancedMesh;
  dustMesh: THREE.InstancedMesh;
  sporeMesh: THREE.InstancedMesh;
  fireParticles: EventParticle[];
  emberParticles: EventParticle[];
  dustParticles: EventParticle[];
  sporeParticles: EventParticle[];
}

function createEventInstancedMesh(
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
  return mesh;
}

function makeEventParticlePool(count: number): EventParticle[] {
  return Array.from({ length: count }, () => ({
    x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1,
  }));
}

export function createEventMeshes(): EventMeshes {
  const fireMesh = createEventInstancedMesh(
    new THREE.PlaneGeometry(0.12, 0.18),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    FIRE_PARTICLE_COUNT,
  );
  const emberMesh = createEventInstancedMesh(
    new THREE.CircleGeometry(0.03, 4),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    FIRE_PARTICLE_COUNT,
  );
  const dustMesh = createEventInstancedMesh(
    new THREE.CircleGeometry(0.05, 4),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.6 }),
    DUST_PARTICLE_COUNT,
  );
  const sporeMesh = createEventInstancedMesh(
    new THREE.CircleGeometry(0.04, 5),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.7 }),
    SPORE_PARTICLE_COUNT,
  );

  return {
    fireMesh, emberMesh, dustMesh, sporeMesh,
    fireParticles: makeEventParticlePool(FIRE_PARTICLE_COUNT),
    emberParticles: makeEventParticlePool(FIRE_PARTICLE_COUNT),
    dustParticles: makeEventParticlePool(DUST_PARTICLE_COUNT),
    sporeParticles: makeEventParticlePool(SPORE_PARTICLE_COUNT),
  };
}
