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
    return world.grid[cy][cx].elevation * ELEV_SCALE + rockOverlay[cy * GRID + cx];
  }

  // Extended ground plane
  const groundGeo = new THREE.PlaneGeometry(256, 256);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a5a2a });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.3;

  return { terrainMesh, colorArray, colorAttr, getCellElevation, groundMesh, groundMat, rockFormations };
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

export function createPlantMeshes(): PlantMeshes {
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.15, 1, 6);
  const trunks = createInstancedMesh(trunkGeo, MAX_INSTANCES);

  const canopyGeo = makeRoughSphere(0.5, 1, 0.25);
  const canopies = createInstancedMesh(canopyGeo, MAX_BRANCH_INSTANCES);

  const branchGeo = new THREE.CylinderGeometry(0.04, 0.09, 1, 5);
  const branches = createInstancedMesh(branchGeo, MAX_BRANCH_INSTANCES);

  const seedGeo = new THREE.SphereGeometry(0.08, 4, 4);
  const seeds = createInstancedMesh(seedGeo, MAX_SEEDS);

  return { trunks, canopies, branches, seeds };
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
