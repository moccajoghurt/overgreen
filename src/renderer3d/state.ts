import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { SIM, GRASS, Genome, World, Season, ColorMode, TerrainType } from '../types';
import type { SkyDome } from './sky';
import type { WaterSurface } from './water';
import type { DistantEnvironment } from './environment';
import type { RockFormations } from './rocks';
import type { HerbivoreSnapshot, DyingHerbivore, MovingHerbivore } from './herbivores';

// ── Constants ──

export const GRID = 80;
export const HALF = GRID / 2;
export const ELEV_SCALE = 4.0;
export const DEATH_ANIM_FRAMES = 90;
export const MAX_DYING = 200;
export const MAX_INSTANCES = (GRID * GRID + MAX_DYING) * 4;
export const GROWTH_ANIM_FRAMES = 60;
export const SEED_FLIGHT_FRAMES = 36;
export const MAX_SEEDS = 400;
export const BURN_ANIM_FRAMES = 40;
export const MAX_BRANCHES_PER_PLANT = 12;
export const MAX_BRANCH_INSTANCES = MAX_INSTANCES * MAX_BRANCHES_PER_PLANT;
export const SNOW_PARTICLE_COUNT = 1200;
export const RAIN_PARTICLE_COUNT = 800;
export const MOTE_PARTICLE_COUNT = 500;
export const LEAF_PARTICLE_COUNT = 600;
export const WEATHER_SPREAD = 50;
export const FIRE_PARTICLE_COUNT = 400;
export const DUST_PARTICLE_COUNT = 300;
export const SPORE_PARTICLE_COUNT = 250;

// ── Animation interfaces ──

export interface PlantSnapshot {
  x: number; y: number;
  height: number; rootDepth: number; leafArea: number;
  speciesId: number; genome: Genome;
  woodiness: number;
  causeOfDeath?: 'fire' | 'disease';
}

export interface DyingPlant extends PlantSnapshot {
  progress: number;
}

export interface BurningPlant extends PlantSnapshot {
  progress: number;
}

export interface GrowingPlant {
  plantId: number;
  progress: number;
}

export interface FlyingSeed {
  parentX: number;
  parentY: number;
  childX: number;
  childY: number;
  childId: number;
  speciesId: number;
  progress: number;
  startY: number;
  arcPeak: number;
}

export interface WeatherParticle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  phase: number;
}

export interface EventParticle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
}

export interface StemInfo {
  baseX: number; baseY: number; baseZ: number;
  tipX: number;  tipY: number;  tipZ: number;
  thickness: number;
}

export type WeatherType = 'snow' | 'rain' | 'mote' | 'leaf';

// ── Renderer state (shared across all update functions) ──

export interface RendererState {
  colorMode: ColorMode;
  world: World;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: MapControls;
  dummy: THREE.Object3D;
  tmpColor: THREE.Color;

  // Terrain
  colorArray: Float32Array;
  colorAttr: THREE.BufferAttribute;
  getCellElevation: (cx: number, cy: number) => number;

  // Plant meshes
  trunks: THREE.InstancedMesh;
  canopies: THREE.InstancedMesh;
  branches: THREE.InstancedMesh;

  // Grass meshes
  grassTufts: THREE.InstancedMesh;

  // Succulent meshes
  succulentBodies: THREE.InstancedMesh;

  // Seed mesh
  seeds: THREE.InstancedMesh;

  // Plant animation state
  prevSnapshots: Map<number, PlantSnapshot>;
  dyingPlants: Map<number, DyingPlant>;
  burningPlants: Map<number, BurningPlant>;
  growingPlants: Map<number, GrowingPlant>;
  flyingSeeds: FlyingSeed[];
  lastProcessedTick: number;
  lastTerrainTick: number;
  lastTerrainColorMode: ColorMode;
  lastPlantTick: number;
  lastPlantColorMode: ColorMode;
  plantsDirty: boolean;
  hoveredSpecies: number | null;
  lastHoveredSpecies: number | null;

  // Performance: cached plant base colors (keyed by plant id, invalidated on colorMode change)
  plantColorCache: Map<number, { cr: number; cg: number; cb: number; tr: number; tg: number; tb: number }>;
  // Performance: double-buffered snapshot maps to avoid per-tick allocation
  nextSnapshots: Map<number, PlantSnapshot>;

  // Weather meshes & particles
  snowMesh: THREE.InstancedMesh;
  rainMesh: THREE.InstancedMesh;
  moteMesh: THREE.InstancedMesh;
  leafMesh: THREE.InstancedMesh;
  snowParticles: WeatherParticle[];
  rainParticles: WeatherParticle[];
  moteParticles: WeatherParticle[];
  leafParticles: WeatherParticle[];

  // Fire/ember/dust meshes & particles
  fireMesh: THREE.InstancedMesh;
  emberMesh: THREE.InstancedMesh;
  dustMesh: THREE.InstancedMesh;
  sporeMesh: THREE.InstancedMesh;
  fireParticles: EventParticle[];
  emberParticles: EventParticle[];
  dustParticles: EventParticle[];
  sporeParticles: EventParticle[];

  // Sky & atmosphere
  skyDome: SkyDome;
  ambientLight: THREE.AmbientLight;
  dirLight: THREE.DirectionalLight;

  // Water
  waterSurface: WaterSurface;

  // Environment
  distantEnvironment: DistantEnvironment;

  // Rock formations
  rockFormations: RockFormations;

  // Herbivores
  herbivoreMesh: THREE.InstancedMesh;
  prevHerbivoreSnapshots: Map<number, HerbivoreSnapshot>;
  dyingHerbivores: Map<number, DyingHerbivore>;
  movingHerbivores: Map<number, MovingHerbivore>;
  lastHerbivoreTick: number;
}

// ── Pure helpers ──

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Deterministic hash for per-plant pseudo-random values. Returns [0, 1). */
export function plantHash(plantId: number, salt: number): number {
  let h = (plantId * 2654435761 + salt * 340573) | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = (h >> 16) ^ h;
  return (h & 0x7FFFFFFF) / 0x7FFFFFFF;
}

export function computeShrubiness(genome: Genome): number {
  const raw = (1 - genome.heightPriority) * genome.leafSize - genome.seedInvestment * 0.2;
  return Math.max(0, Math.min(1, raw));
}

export function computeSilhouette(height: number, rootDepth: number, leafArea: number, genome: Genome) {
  const leafRatio = leafArea / SIM.MAX_LEAF_AREA;
  const rootRatio = rootDepth / SIM.MAX_ROOT_DEPTH;

  // Trunk height: heightPriority → taller, rootPriority → squatter
  const heightMult = 0.35 + genome.heightPriority * 0.15 - genome.rootPriority * 0.08;
  let trunkH = Math.max(0.1, height * heightMult);

  // Trunk thickness: rootPriority → very fat (baobab), seedInvestment → thinner, defense → much thicker (armored bark)
  let trunkThickness = Math.max(0.15,
    0.3 + rootRatio * 2.5 - genome.seedInvestment * 0.4 + genome.defense * 1.5);

  // Canopy size driven by actual leaf growth; seedInvestment → smaller individual blobs
  const canopyBase = (0.05 + leafRatio * 2.0 - genome.seedInvestment * leafRatio * 0.5) * 1.4;

  // Canopy shape: leafSize → wide & flat (acacia), heightPriority → narrow & tall (conifer)
  const spread = Math.max(0.15,
    (0.5 + genome.leafSize * 1.2 - genome.heightPriority * 0.7 + genome.rootPriority * 0.1) * 1.2);
  let canopyX = canopyBase * spread;
  let canopyY = canopyBase / spread;

  // Hide branches on seedlings/small plants
  const branchVisibility = Math.max(0, Math.min(1, (trunkH - 0.2) * 3));

  // Stem count: bushy root-heavy trees fork, tall trees stay single
  const stemRaw = genome.leafSize * 0.6 + genome.rootPriority * 0.3
    - genome.heightPriority * 0.5 - genome.seedInvestment * 0.2;
  let stemCount = trunkH < 0.3 ? 1 : stemRaw >= 0.35 ? 3 : stemRaw >= 0.15 ? 2 : 1;

  // Trunk lean: gentle tilt off-vertical (visible but not extreme)
  let trunkLean = Math.max(0, Math.min(0.20,
    0.12 - genome.rootPriority * 0.08 - genome.defense * 0.05 + genome.seedInvestment * 0.06));

  // Fork fraction: where multi-stems diverge (only used when stemCount > 1)
  let forkFrac = Math.max(0.15, Math.min(0.45,
    0.25 + genome.rootPriority * 0.15 - genome.leafSize * 0.1));

  // ── Shrub blending ──
  const shrubiness = computeShrubiness(genome);
  if (shrubiness > 0.15) {
    const s = (shrubiness - 0.15) / 0.85; // normalized 0-1 within active range
    stemCount = Math.min(5, stemCount + Math.round(s * 2));
    forkFrac = forkFrac + (0.05 - forkFrac) * s; // pull toward ground-level fork
    trunkH *= 1 - s * 0.45; // shorter
    trunkThickness *= 1 - s * 0.75; // thin wispy canes
    canopyX *= 1 + s * 0.35; // wider
    canopyY *= 1 - s * 0.30; // flatter
    trunkLean += s * 0.04; // slight organic lean
  }

  return { trunkH, trunkThickness, canopyX, canopyY, canopyZ: canopyX,
    branchVisibility, stemCount, trunkLean, forkFrac, shrubiness };
}

export function computeSucculence(genome: Genome, terrain?: TerrainType): number {
  if (genome.waterStorage < 0.5) return 0;
  if (terrain !== undefined && terrain !== TerrainType.Arid && terrain !== TerrainType.Hill) return 0;
  return Math.max(0, Math.min(1,
    genome.waterStorage * 0.7
    + (1 - genome.heightPriority) * 0.1
    + (1 - genome.leafSize) * 0.1
    + genome.rootPriority * 0.1
  ));
}

export interface SucculentSilhouette {
  bodyH: number;
  bodyRadius: number;
}

export function computeSucculentSilhouette(
  height: number, _rootDepth: number, _leafArea: number, genome: Genome, _succulence: number,
): SucculentSilhouette {
  // Cap height — succulents don't grow as tall as trees
  const cappedH = Math.min(height, 6);

  // Columnar (heightPriority high): tall narrow pillar
  // Barrel (heightPriority low): squat round sphere
  const bodyH = Math.max(0.3, cappedH * (0.2 + genome.heightPriority * 0.4));

  // Width: fatter with more storage, much narrower when columnar
  const bodyRadius = Math.max(0.2,
    0.2 + genome.waterStorage * 0.5
    - genome.heightPriority * 0.5
    + genome.rootPriority * 0.2);

  return { bodyH, bodyRadius };
}

export function computeGrassSilhouette(height: number, rootDepth: number, leafArea: number, genome: Genome) {
  const leafRatio = leafArea / GRASS.MAX_LEAF_AREA;
  const rootRatio = rootDepth / GRASS.MAX_ROOT_DEPTH;

  // Tuft height — grass stays low to the ground, much shorter than shrubs
  const tuftH = Math.min(1.0, Math.max(0.15, height * (0.20 + genome.heightPriority * 0.20)));

  // Per-clump width (smaller since multiple clumps overlap to fill the cell)
  let tuftW = Math.max(0.45, 0.50 + leafRatio * 0.15 + genome.leafSize * 0.10);
  tuftW = Math.min(0.85, tuftW * (1 + genome.waterStorage * 0.15));

  // Clump count: leafy grass is denser, sparse grass has fewer tufts
  const clumpCount = Math.max(2, Math.min(4,
    2 + Math.round(leafRatio * 0.8 + genome.leafSize * 0.8)));

  return { height: tuftH, width: tuftW, clumpCount };
}

export function computeSeasonalFoliageFactor(env: { season: Season; seasonProgress: number }): number {
  const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;
  const foliageAtStart = [0.10, 1.0, 1.0, 0.15]; // Spring, Summer, Autumn, Winter
  const foliageAtEnd   = [1.0, 1.0, 0.15, 0.10];
  const f0 = foliageAtStart[env.season];
  const f1 = foliageAtEnd[env.season];
  return f0 + (f1 - f0) * t;
}

export function makeRoughSphere(radius: number, detail: number, jitter: number): THREE.BufferGeometry {
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
