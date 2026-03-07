import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Genome, World, ColorMode } from '../types';
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
export const GROWTH_ANIM_FRAMES = 60;
export const SEED_FLIGHT_FRAMES = 36;
export const MAX_SEEDS = 800;
export const BURN_ANIM_FRAMES = 40;
export const SNOW_PARTICLE_COUNT = 1200;
export const RAIN_PARTICLE_COUNT = 800;
export const MOTE_PARTICLE_COUNT = 500;
export const LEAF_PARTICLE_COUNT = 600;
export const WEATHER_SPREAD = 50;
export const FIRE_PARTICLE_COUNT = 400;
export const DUST_PARTICLE_COUNT = 300;
export const SPORE_PARTICLE_COUNT = 250;
export const MAX_DECOR_STONES = 6000;
export const MAX_DECOR_REEDS = 5000;
export const MAX_DECOR_DRY_BRUSH = 2000;

// ── Animation interfaces ──

export interface PlantSnapshot {
  x: number; y: number;
  height: number; rootDepth: number; leafArea: number;
  speciesId: number; genome: Genome;
  woodiness: number;
  subtype: number;
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
  // Per-seed randomization for wind-blown animation
  spinSpeed: number;      // rotation speed (radians/frame)
  spinAxis: number;       // tumble axis angle
  driftAmp: number;       // lateral wobble amplitude
  driftFreq: number;      // wobble frequency (cycles over flight)
  driftPhase: number;     // random phase offset
  scaleFactor: number;    // size variation (0.7-1.3)
  flightFrames: number;   // per-seed flight duration
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

  // Plant meshes (24 subtypes — one InstancedMesh per subtype)
  subtypeMeshes: THREE.InstancedMesh[];
  maturityHeights: Float32Array;

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
  highlightedSpecies: Set<number> | null;
  lastHighlightedSpecies: Set<number> | null;

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

  // Terrain decorations (static, placed once at terrain build)
  decorStones: THREE.InstancedMesh;
  decorReeds: THREE.InstancedMesh;
  decorDryBrush: THREE.InstancedMesh;
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
