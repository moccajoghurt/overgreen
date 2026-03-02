import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { SIM, Genome, World, Season } from '../types';
import type { SkyDome } from './sky';
import type { WaterSurface } from './water';
import type { DistantEnvironment } from './environment';
import type { RockFormations } from './rocks';

// ── Constants ──

export const GRID = 80;
export const HALF = GRID / 2;
export const ELEV_SCALE = 4.0;
export const DEATH_ANIM_FRAMES = 90;
export const MAX_DYING = 200;
export const MAX_INSTANCES = GRID * GRID + MAX_DYING;
export const GROWTH_ANIM_FRAMES = 60;
export const SEED_FLIGHT_FRAMES = 36;
export const MAX_SEEDS = 400;
export const BURN_ANIM_FRAMES = 40;
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

export type WeatherType = 'snow' | 'rain' | 'mote' | 'leaf';

// ── Renderer state (shared across all update functions) ──

export interface RendererState {
  colorMode: 'natural' | 'species';
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
  canopies2: THREE.InstancedMesh;
  branches1: THREE.InstancedMesh;
  branches2: THREE.InstancedMesh;
  branches3: THREE.InstancedMesh;

  // Seed mesh
  seeds: THREE.InstancedMesh;

  // Plant animation state
  prevSnapshots: Map<number, PlantSnapshot>;
  dyingPlants: Map<number, DyingPlant>;
  burningPlants: Map<number, BurningPlant>;
  growingPlants: Map<number, GrowingPlant>;
  flyingSeeds: FlyingSeed[];
  lastProcessedTick: number;

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

export function computeSilhouette(height: number, rootDepth: number, leafArea: number, genome: Genome) {
  const leafRatio = leafArea / SIM.MAX_LEAF_AREA;
  const rootRatio = rootDepth / SIM.MAX_ROOT_DEPTH;

  // Taller plants = taller trunks; deep roots = thick trunk (baobab effect)
  const trunkH = Math.max(0.1, height * 0.4);
  const trunkThickness = 0.4 + rootRatio * 2.0;

  // Canopy size driven by actual leaf growth
  const canopyBase = 0.05 + leafRatio * 2.0;

  // Canopy shape driven by genome strategy:
  // High leafSize → wide & flat (acacia/umbrella)
  // High heightPriority → narrow & tall (spruce/conical)
  const spread = Math.max(0.25, 0.6 + genome.leafSize * 0.9 - genome.heightPriority * 0.5);
  const canopyX = canopyBase * spread;
  const canopyY = canopyBase / spread;

  // Leafy plants get fuller, multi-blob canopy; others are sparser
  const blob2 = 0.1 + genome.leafSize * 0.7;

  // ── Branches ──
  // Length scales with trunk height and leaf spread
  const branchLength = trunkH * (0.15 + genome.leafSize * 0.25);
  // Thickness proportional to trunk, boosted by root investment
  const branchThickness = trunkThickness * (0.15 + genome.rootPriority * 0.15);
  // Tilt angle (radians from vertical): leafy = outward, tall = upward
  const branchTilt = Math.max(0.5, Math.min(1.2,
    0.6 + genome.leafSize * 0.5 - genome.heightPriority * 0.35));
  // Hide branches on seedlings/small plants
  const branchVisibility = Math.max(0, Math.min(1, (trunkH - 0.2) * 3));

  return { trunkH, trunkThickness, canopyX, canopyY, canopyZ: canopyX, blob2,
    branchLength, branchThickness, branchTilt, branchVisibility };
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
