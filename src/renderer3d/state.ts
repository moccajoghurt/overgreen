import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { SIM, Genome, World } from '../types';

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
export const WEATHER_PARTICLE_COUNT = 300;
export const WEATHER_SPREAD = 50;
export const FIRE_PARTICLE_COUNT = 400;
export const DUST_PARTICLE_COUNT = 300;

// ── Animation interfaces ──

export interface PlantSnapshot {
  x: number; y: number;
  height: number; rootDepth: number; leafArea: number;
  speciesId: number; genome: Genome;
  causeOfDeath?: 'fire';
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
  fireParticles: EventParticle[];
  emberParticles: EventParticle[];
  dustParticles: EventParticle[];
}

// ── Pure helpers ──

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function computeSilhouette(height: number, rootDepth: number, leafArea: number, leafGenome: number) {
  const leafRatio = leafArea / SIM.MAX_LEAF_AREA;
  const rootRatio = rootDepth / SIM.MAX_ROOT_DEPTH;

  const trunkH = Math.max(0.1, height * 0.35);
  const trunkThickness = 0.8 + rootRatio * 0.9;

  const canopyBase = 0.1 + leafRatio * 1.6;

  const spread = 0.6 + leafGenome * 0.9;
  const canopyX = canopyBase * spread;
  const canopyY = canopyBase * (1.0 / spread);

  const blob2 = 0.2 + leafGenome * 0.6;

  return { trunkH, trunkThickness, canopyX, canopyY, canopyZ: canopyX, blob2 };
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
