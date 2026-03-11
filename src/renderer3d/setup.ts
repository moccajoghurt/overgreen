import * as THREE from 'three';
import { World, TerrainType } from '../types';
import {
  GRID, ELEV_SCALE, MAX_SEEDS, MAX_PER_SUBTYPE, MAX_PER_SUBTYPE_HEALTH,
  SNOW_PARTICLE_COUNT, RAIN_PARTICLE_COUNT, MOTE_PARTICLE_COUNT, LEAF_PARTICLE_COUNT,
  FIRE_PARTICLE_COUNT, DUST_PARTICLE_COUNT, SPORE_PARTICLE_COUNT,
  WeatherParticle, EventParticle,
} from './state';
import { buildSubtypeModels, buildSubtypeModelsLow, buildSubtypeModelsStressed, buildSubtypeModelsStressedLow, buildSubtypeModelsDying, buildSubtypeModelsDyingLow } from './plant-models';
import { createRockFormations, RockFormations } from './rocks';
import { createTerrainDetailTexture } from './terrain-detail-texture';

/** Shared output buffer for getCellSlope — avoids per-call allocation. */
const _slopeOut = new Float32Array(2); // [dYdX, dYdZ]

// ── Terrain ──

/**
 * Compute smooth normals from the height-field gradient at each corner,
 * then assign them to the non-indexed terrain geometry's 6 vertices per cell.
 */
function smoothTerrainNormals(
  geo: THREE.BufferGeometry,
  corners: Float32Array,
  cs: number, // cornerSize = GRID + 1
  world: World,
): void {
  // Mark corners adjacent to river cells
  const nearRiver = new Uint8Array(cs * cs);
  for (let cy = 0; cy < cs; cy++) {
    for (let cx = 0; cx < cs; cx++) {
      for (const [dx, dy] of CELL_OFFSETS) {
        const gx = cx + dx, gy = cy + dy;
        if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID &&
            world.grid[gy][gx].terrainType === TerrainType.River) {
          nearRiver[cy * cs + cx] = 1;
          break;
        }
      }
    }
  }

  // Compute per-corner normals from finite-difference height gradients
  const cornerNormals = new Float32Array(cs * cs * 3);
  for (let cy = 0; cy < cs; cy++) {
    for (let cx = 0; cx < cs; cx++) {
      const h = corners[cy * cs + cx];
      const hL = cx > 0 ? corners[cy * cs + cx - 1] : h;
      const hR = cx < cs - 1 ? corners[cy * cs + cx + 1] : h;
      const hU = cy > 0 ? corners[(cy - 1) * cs + cx] : h;
      const hD = cy < cs - 1 ? corners[(cy + 1) * cs + cx] : h;
      const dx = cx > 0 && cx < cs - 1 ? 2 : 1;
      const dz = cy > 0 && cy < cs - 1 ? 2 : 1;
      // normal = normalize(-dh/dx, upBias, -dh/dz)
      // Near rivers, bias the Y component upward so steep bank faces get more light
      const upBias = nearRiver[cy * cs + cx] ? 4.0 : 1.0;
      const nx = -(hR - hL) / dx;
      const nz = -(hD - hU) / dz;
      const len = Math.sqrt(nx * nx + upBias * upBias + nz * nz);
      const i3 = (cy * cs + cx) * 3;
      cornerNormals[i3] = nx / len;
      cornerNormals[i3 + 1] = upBias / len;
      cornerNormals[i3 + 2] = nz / len;
    }
  }

  // Assign corner normals to each cell's 6 vertices
  const normAttr = geo.attributes.normal;
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const base = (row * GRID + col) * 6;
      // Corner indices: TL=(col,row), TR=(col+1,row), BL=(col,row+1), BR=(col+1,row+1)
      const iTL = (row * cs + col) * 3;
      const iTR = (row * cs + col + 1) * 3;
      const iBL = ((row + 1) * cs + col) * 3;
      const iBR = ((row + 1) * cs + col + 1) * 3;
      // Vertex order: TL, BL, TR, BL, BR, TR
      const corners_for_verts = [iTL, iBL, iTR, iBL, iBR, iTR];
      for (let v = 0; v < 6; v++) {
        const ci = corners_for_verts[v];
        normAttr.setXYZ(base + v, cornerNormals[ci], cornerNormals[ci + 1], cornerNormals[ci + 2]);
      }
    }
  }
  normAttr.needsUpdate = true;
}

const CELL_OFFSETS: [number, number][] = [[0, 0], [-1, 0], [0, -1], [-1, -1]];

/** River depth in 3D units — how far below bank terrain the riverbed sits. */
export const RIVER_DEPTH = 0.8;

/**
 * Depress terrain corners at/near river cells to carve a riverbed channel.
 * Each corner is depressed proportionally to how many of its 4 adjacent cells
 * are rivers, creating natural slopes at the bank edges.
 */
function depressRiverCorners(world: World, corners: Float32Array, cs: number): void {
  for (let cy = 0; cy < cs; cy++) {
    for (let cx = 0; cx < cs; cx++) {
      let riverCount = 0, total = 0;
      for (const [dx, dy] of CELL_OFFSETS) {
        const gx = cx + dx, gy = cy + dy;
        if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
          total++;
          if (world.grid[gy][gx].terrainType === TerrainType.River) riverCount++;
        }
      }
      if (riverCount > 0) {
        corners[cy * cs + cx] -= RIVER_DEPTH * (riverCount / total);
      }
    }
  }
}

export interface TerrainResult {
  terrainMesh: THREE.Mesh;
  colorArray: Float32Array;
  colorAttr: THREE.BufferAttribute;
  getCellElevation: (cx: number, cy: number) => number;
  getCellSlope: (cx: number, cy: number) => Float32Array;
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

  const detailMap = createTerrainDetailTexture();
  const terrainMat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: detailMap,
  });
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

  // Smooth terrain near rivers to create gentle bank slopes
  depressRiverCorners(world, corners, cornerSize);

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
  smoothTerrainNormals(terrainGeo, corners, cornerSize, world);

  function getCellElevation(cx: number, cy: number): number {
    // Average the 4 corner heights to match the actual terrain mesh surface
    const tl = corners[cy * cornerSize + cx];
    const tr = corners[cy * cornerSize + cx + 1];
    const bl = corners[(cy + 1) * cornerSize + cx];
    const br = corners[(cy + 1) * cornerSize + cx + 1];
    return (tl + tr + bl + br) * 0.25;
  }

  function getCellSlope(cx: number, cy: number): Float32Array {
    const tl = corners[cy * cornerSize + cx];
    const tr = corners[cy * cornerSize + cx + 1];
    const bl = corners[(cy + 1) * cornerSize + cx];
    const br = corners[(cy + 1) * cornerSize + cx + 1];
    _slopeOut[0] = ((tr + br) - (tl + bl)) * 0.5; // dY/dX
    _slopeOut[1] = ((bl + br) - (tl + tr)) * 0.5; // dY/dZ
    return _slopeOut;
  }

  // Extended ground plane
  const groundGeo = new THREE.PlaneGeometry(256, 256);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a5a2a });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.3;

  return { terrainMesh, colorArray, colorAttr, getCellElevation, getCellSlope, groundMesh, groundMat, rockFormations };
}

/**
 * Rebuild terrain vertex heights in-place from current world grid elevations.
 * Recomputes rock formations and corner heights, then updates the existing mesh.
 */
export function rebuildTerrainGeometry(
  world: World,
  terrain: TerrainResult,
): { getCellElevation: (cx: number, cy: number) => number; getCellSlope: (cx: number, cy: number) => Float32Array; rockFormations: RockFormations } {
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

  // Smooth terrain near rivers to create gentle bank slopes
  depressRiverCorners(world, corners, cornerSize);

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
  smoothTerrainNormals(terrain.terrainMesh.geometry, corners, cornerSize, world);

  function getCellElevation(cx: number, cy: number): number {
    const tl = corners[cy * cornerSize + cx];
    const tr = corners[cy * cornerSize + cx + 1];
    const bl = corners[(cy + 1) * cornerSize + cx];
    const br = corners[(cy + 1) * cornerSize + cx + 1];
    return (tl + tr + bl + br) * 0.25;
  }

  function getCellSlope(cx: number, cy: number): Float32Array {
    const tl = corners[cy * cornerSize + cx];
    const tr = corners[cy * cornerSize + cx + 1];
    const bl = corners[(cy + 1) * cornerSize + cx];
    const br = corners[(cy + 1) * cornerSize + cx + 1];
    _slopeOut[0] = ((tr + br) - (tl + bl)) * 0.5; // dY/dX
    _slopeOut[1] = ((bl + br) - (tl + tr)) * 0.5; // dY/dZ
    return _slopeOut;
  }

  return { getCellElevation, getCellSlope, rockFormations };
}

// ── Per-subtype instanced meshes (24 subtypes, one InstancedMesh each) ──

import type { SubtypeModel } from './plant-models';

// Tree subtypes: 6-11, 32-33
const WIND_SUBTYPES: Set<number> = new Set([6, 7, 8, 9, 10, 11, 32, 33]);

// Shared heatmap uniform — single object so all materials see the same value
const heatmapUniform = { value: 0.0 };

/** Set heatmap mode for all plant materials (0 = off, 1 = on). */
export function setPlantHeatmap(on: boolean): void {
  heatmapUniform.value = on ? 1.0 : 0.0;
}

function createMeshesFromModels(models: SubtypeModel[], capacity = MAX_PER_SUBTYPE): THREE.InstancedMesh[] {
  return models.map((m, i) => {
    const meshMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const isWind = WIND_SUBTYPES.has(i);
    meshMat.onBeforeCompile = (shader) => {
      // ── Heatmap uniform (all subtypes) ──
      // When heatmap is on, skip vertex color multiply so instanceColor
      // is used directly as the plant color (pure resource gradient).
      shader.uniforms.uHeatmap = heatmapUniform;
      shader.vertexShader = 'uniform float uHeatmap;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <color_vertex>',
        `#include <color_vertex>
if (uHeatmap > 0.5) {
  vColor = vec4(instanceColor, 1.0);
}`,
      );

      // ── Wind sway (tree subtypes only) ──
      if (isWind) {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uWindStrength = { value: 0.1 };
        shader.vertexShader =
          'uniform float uTime;\nuniform float uWindStrength;\nattribute float swayWeight;\n' +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>
{
  vec3 iPos = vec3(instanceMatrix[3]);
  vec4 wOrigin = modelMatrix * vec4(iPos, 1.0);
  float sw = swayWeight * swayWeight;
  float wp = wOrigin.x * 0.8 + wOrigin.z * 0.6 + uTime * 0.8;
  float wind1 = sin(wp) * uWindStrength * sw;
  float wind2 = sin(wOrigin.x * 0.5 - wOrigin.z * 0.7 + uTime * 0.5) * uWindStrength * 0.3 * sw;
  vec3 worldOffset = vec3(wind1 * 0.7 + wind2 * 0.3, 0.0, wind1 * 0.3 + wind2 * 0.7);
  mvPosition.xyz += (viewMatrix * vec4(worldOffset, 0.0)).xyz;
  gl_Position = projectionMatrix * mvPosition;
}`,
        );
      }
      meshMat.userData.shader = shader;
    };
    const mesh = new THREE.InstancedMesh(m.geometry, meshMat, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3), 3,
    );
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    return mesh;
  });
}

export interface SubtypeMeshResult {
  meshes: THREE.InstancedMesh[];
  meshesLow: THREE.InstancedMesh[];
  meshesStressed: THREE.InstancedMesh[];
  meshesStressedLow: THREE.InstancedMesh[];
  meshesDying: THREE.InstancedMesh[];
  meshesDyingLow: THREE.InstancedMesh[];
  maturityHeights: Float32Array;
  groundCover: boolean[];
}

export async function createSubtypeMeshes(): Promise<SubtypeMeshResult> {
  const models = buildSubtypeModels();
  const modelsLow = buildSubtypeModelsLow();
  const [modelsStressed, modelsStressedLow, modelsDying, modelsDyingLow] = await Promise.all([
    buildSubtypeModelsStressed(),
    buildSubtypeModelsStressedLow(),
    buildSubtypeModelsDying(),
    buildSubtypeModelsDyingLow(),
  ]);
  const meshes = createMeshesFromModels(models);
  const meshesLow = createMeshesFromModels(modelsLow);
  const meshesStressed = createMeshesFromModels(modelsStressed, MAX_PER_SUBTYPE_HEALTH);
  const meshesStressedLow = createMeshesFromModels(modelsStressedLow, MAX_PER_SUBTYPE_HEALTH);
  const meshesDying = createMeshesFromModels(modelsDying, MAX_PER_SUBTYPE_HEALTH);
  const meshesDyingLow = createMeshesFromModels(modelsDyingLow, MAX_PER_SUBTYPE_HEALTH);
  const maturityHeights = new Float32Array(models.map(m => m.maturityHeight));
  const groundCover = models.map(m => m.groundCover);
  return { meshes, meshesLow, meshesStressed, meshesStressedLow, meshesDying, meshesDyingLow, maturityHeights, groundCover };
}

// ── Seed mesh (flying seeds — separate from plant subtypes) ──

export function createSeedMesh(): THREE.InstancedMesh {
  const seedGeo = new THREE.CircleGeometry(0.10, 5);
  const seedMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const seeds = new THREE.InstancedMesh(seedGeo, seedMat, MAX_SEEDS);
  seeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  seeds.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_SEEDS * 3), 3,
  );
  seeds.instanceColor.setUsage(THREE.DynamicDrawUsage);
  seeds.count = 0;
  seeds.frustumCulled = false;
  return seeds;
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
