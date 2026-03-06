import * as THREE from 'three';
import type { MapControls } from 'three/addons/controls/MapControls.js';

/**
 * Hook-phase camera choreography.
 *
 * Ticks 0-80:   Close zoom on center seed, very slow orbit
 * Ticks 80-250: easeOutCubic dolly to ~70% zoom
 * Ticks 250+:   Hold steady
 * On reveal:    Smooth animate to default view, re-enable controls
 */

interface HookCameraOpts {
  camera: THREE.PerspectiveCamera;
  mapControls: MapControls;
  worldCenter: { x: number; z: number };
}

const CLOSE_DISTANCE = 22;   // close zoom on seed
const MID_DISTANCE = 55;     // ~70% of max (120), never shows full map
const DEFAULT_DISTANCE = 70; // where controls end up after reveal
const ORBIT_SPEED = 0.003;   // radians per frame (~0.17°)
const DOLLY_START_TICK = 80;
const DOLLY_END_TICK = 250;
const REVEAL_DURATION_MS = 1200;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function createHookCamera(opts: HookCameraOpts) {
  const { camera, mapControls, worldCenter } = opts;
  let orbitAngle = Math.PI * 0.25; // start from a nice 45° angle
  let active = false;
  let revealing = false;
  let revealStart = 0;
  let revealStartPos: THREE.Vector3 | null = null;
  let revealStartTarget: THREE.Vector3 | null = null;

  // Compute default camera position for post-reveal
  const defaultTarget = new THREE.Vector3(worldCenter.x, 0, worldCenter.z);
  const defaultOffset = new THREE.Vector3(0, DEFAULT_DISTANCE * 0.7, DEFAULT_DISTANCE * 0.5);

  function start(): void {
    active = true;
    revealing = false;
    mapControls.enabled = false;

    // Position camera close, looking at world center
    const pitch = 0.9; // ~52° elevation angle
    const cx = worldCenter.x + Math.cos(orbitAngle) * CLOSE_DISTANCE * Math.cos(pitch);
    const cy = CLOSE_DISTANCE * Math.sin(pitch);
    const cz = worldCenter.z + Math.sin(orbitAngle) * CLOSE_DISTANCE * Math.cos(pitch);

    mapControls.target.set(worldCenter.x, 0, worldCenter.z);
    camera.position.set(cx, cy, cz);
    camera.lookAt(mapControls.target);
  }

  function update(tick: number): void {
    if (!active) return;

    if (revealing) {
      updateReveal();
      return;
    }

    // Calculate current distance based on tick
    let dist: number;
    if (tick < DOLLY_START_TICK) {
      dist = CLOSE_DISTANCE;
    } else if (tick < DOLLY_END_TICK) {
      const t = (tick - DOLLY_START_TICK) / (DOLLY_END_TICK - DOLLY_START_TICK);
      dist = CLOSE_DISTANCE + (MID_DISTANCE - CLOSE_DISTANCE) * easeOutCubic(t);
    } else {
      dist = MID_DISTANCE;
    }

    // Slow orbit
    orbitAngle += ORBIT_SPEED;

    const pitch = 0.9;
    const cx = worldCenter.x + Math.cos(orbitAngle) * dist * Math.cos(pitch);
    const cy = dist * Math.sin(pitch);
    const cz = worldCenter.z + Math.sin(orbitAngle) * dist * Math.cos(pitch);

    camera.position.set(cx, cy, cz);
    camera.lookAt(mapControls.target);
  }

  function updateReveal(): void {
    const elapsed = performance.now() - revealStart;
    const t = Math.min(1, elapsed / REVEAL_DURATION_MS);
    const ease = easeOutCubic(t);

    if (revealStartPos && revealStartTarget) {
      // Lerp camera position
      camera.position.lerpVectors(revealStartPos, defaultTarget.clone().add(defaultOffset), ease);
      // Lerp target
      const currentTarget = new THREE.Vector3().lerpVectors(revealStartTarget, defaultTarget, ease);
      mapControls.target.copy(currentTarget);
      camera.lookAt(currentTarget);
    }

    if (t >= 1) {
      active = false;
      revealing = false;
      mapControls.enabled = true;
    }
  }

  function beginReveal(): void {
    revealing = true;
    revealStart = performance.now();
    revealStartPos = camera.position.clone();
    revealStartTarget = mapControls.target.clone();
  }

  function skip(): void {
    active = false;
    revealing = false;
    mapControls.enabled = true;
    // Jump to default view
    mapControls.target.copy(defaultTarget);
    camera.position.copy(defaultTarget).add(defaultOffset);
    camera.lookAt(defaultTarget);
  }

  return {
    start,
    update,
    beginReveal,
    skip,
    get active() { return active; },
  };
}
