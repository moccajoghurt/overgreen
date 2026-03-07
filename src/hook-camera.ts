import * as THREE from 'three';
import type { MapControls } from 'three/addons/controls/MapControls.js';

/**
 * Hook-phase camera choreography (time-based, independent of sim speed).
 *
 * 0-2s:        Hold close-up near ground level, very slow orbit
 * 2-6s:        easeOutCubic dolly out + pitch up to mid view
 * 6s+:         Hold steady at mid view
 * On reveal:   Smooth animate to default view, re-enable controls
 */

interface HookCameraOpts {
  camera: THREE.PerspectiveCamera;
  mapControls: MapControls;
  worldCenter: { x: number; z: number };
}

const CLOSE_DISTANCE = 12;   // much closer to seed
const MID_DISTANCE = 55;     // ~70% of max (120), never shows full map
const DEFAULT_DISTANCE = 70; // where controls end up after reveal
const CLOSE_PITCH = 0.4;    // ~23° elevation, near ground level
const MID_PITCH = 0.9;      // ~52° elevation angle
const ORBIT_SPEED = 0.002;  // radians per frame (slower for intimacy)
const HOLD_MS = 2000;        // hold close-up before dolly begins
const DOLLY_MS = 4000;       // dolly duration (reach mid-view at 6s)
const REVEAL_DURATION_MS = 1200;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function createHookCamera(opts: HookCameraOpts) {
  const { camera, mapControls, worldCenter } = opts;
  let orbitAngle = Math.PI * 1.75; // start from NE, looking SW toward sea for delta reveal
  let active = false;
  let revealing = false;
  let startTime = 0;
  let revealStart = 0;
  let revealStartPos: THREE.Vector3 | null = null;
  let revealStartTarget: THREE.Vector3 | null = null;

  // Compute default camera position for post-reveal
  const defaultTarget = new THREE.Vector3(worldCenter.x, 0, worldCenter.z);
  const defaultOffset = new THREE.Vector3(0, DEFAULT_DISTANCE * 0.7, DEFAULT_DISTANCE * 0.5);

  function start(): void {
    active = true;
    revealing = false;
    startTime = performance.now();
    mapControls.enabled = false;

    // Position camera close and low, looking at world center
    const cx = worldCenter.x + Math.cos(orbitAngle) * CLOSE_DISTANCE * Math.cos(CLOSE_PITCH);
    const cy = CLOSE_DISTANCE * Math.sin(CLOSE_PITCH);
    const cz = worldCenter.z + Math.sin(orbitAngle) * CLOSE_DISTANCE * Math.cos(CLOSE_PITCH);

    mapControls.target.set(worldCenter.x, 0, worldCenter.z);
    camera.position.set(cx, cy, cz);
    camera.lookAt(mapControls.target);
  }

  // Target distance/pitch computed from elapsed time; actual values lerp toward them each frame
  let targetDist = CLOSE_DISTANCE;
  let currentDist = CLOSE_DISTANCE;
  let targetPitch = CLOSE_PITCH;
  let currentPitch = CLOSE_PITCH;

  function update(): void {
    if (!active) return;

    if (revealing) {
      updateReveal();
      return;
    }

    const elapsed = performance.now() - startTime;

    // Compute target distance and pitch from elapsed time
    if (elapsed < HOLD_MS) {
      targetDist = CLOSE_DISTANCE;
      targetPitch = CLOSE_PITCH;
    } else if (elapsed < HOLD_MS + DOLLY_MS) {
      const t = (elapsed - HOLD_MS) / DOLLY_MS;
      const ease = easeOutCubic(t);
      targetDist = CLOSE_DISTANCE + (MID_DISTANCE - CLOSE_DISTANCE) * ease;
      targetPitch = CLOSE_PITCH + (MID_PITCH - CLOSE_PITCH) * ease;
    } else {
      targetDist = MID_DISTANCE;
      targetPitch = MID_PITCH;
    }

    // Smooth lerp toward target every frame (~60fps)
    currentDist += (targetDist - currentDist) * 0.04;
    currentPitch += (targetPitch - currentPitch) * 0.04;

    // Slow orbit
    orbitAngle += ORBIT_SPEED;

    const cx = worldCenter.x + Math.cos(orbitAngle) * currentDist * Math.cos(currentPitch);
    const cy = currentDist * Math.sin(currentPitch);
    const cz = worldCenter.z + Math.sin(orbitAngle) * currentDist * Math.cos(currentPitch);

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
    active = true;
    revealing = true;
    revealStart = performance.now();
    revealStartPos = camera.position.clone();
    revealStartTarget = mapControls.target.clone();
    mapControls.enabled = false; // take back control for reveal animation
  }

  function handOver(): void {
    active = false;
    revealing = false;
    mapControls.enabled = true;
    // Keep camera where it is — user takes over from current position
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
    handOver,
    skip,
    get active() { return active; },
  };
}
