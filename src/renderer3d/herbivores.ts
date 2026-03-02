import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RendererState, HALF, lerp, easeOutCubic } from './state';

export const MAX_HERBIVORE_INSTANCES = 200;
export const HERBIVORE_DEATH_FRAMES = 60;
export const HERBIVORE_MOVE_FRAMES = 20; // ~0.33s at 60fps

export interface HerbivoreSnapshot {
  x: number;
  y: number;
  facing: number;
}

export interface DyingHerbivore {
  x: number;
  y: number;
  facing: number;
  progress: number;
}

export interface MovingHerbivore {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromFacing: number;
  toFacing: number;
  progress: number;
}

/** Lerp between two angles via the shortest arc. */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function createDeerGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Body: ellipsoid (sphere scaled to oval)
  const body = new THREE.SphereGeometry(1, 6, 5);
  body.scale(0.32, 0.16, 0.14);
  body.translate(0, 0.3, 0);
  parts.push(body);

  // Shoulder: slightly bulkier sphere at front of body
  const shoulder = new THREE.SphereGeometry(1, 5, 4);
  shoulder.scale(0.14, 0.14, 0.12);
  shoulder.translate(0.18, 0.34, 0);
  parts.push(shoulder);

  // Neck: tilted cylinder connecting shoulder to head
  const neck = new THREE.CylinderGeometry(0.055, 0.07, 0.15, 6);
  neck.rotateZ(-0.6); // tilt forward
  neck.translate(0.27, 0.42, 0);
  parts.push(neck);

  // Head: sphere with more segments for roundness
  const head = new THREE.SphereGeometry(0.09, 6, 5);
  head.translate(0.33, 0.50, 0);
  parts.push(head);

  // Snout: tapered cylinder
  const snout = new THREE.CylinderGeometry(0.025, 0.04, 0.09, 5);
  snout.rotateZ(-Math.PI / 2); // point forward
  snout.translate(0.42, 0.47, 0);
  parts.push(snout);

  // 4 Legs: 6-sided cylinders (look round), slightly tapered
  const legPositions = [
    [0.15, 0.10, 0.08],   // front-left
    [0.15, 0.10, -0.08],  // front-right
    [-0.18, 0.10, 0.08],  // back-left
    [-0.18, 0.10, -0.08], // back-right
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.CylinderGeometry(0.02, 0.028, 0.20, 6);
    leg.translate(lx, ly, lz);
    parts.push(leg);
  }

  // 2 Antlers: 5-sided cones tilted outward
  const antlerL = new THREE.ConeGeometry(0.025, 0.14, 5);
  antlerL.translate(0.30, 0.62, 0.05);
  antlerL.rotateZ(-0.3);
  parts.push(antlerL);

  const antlerR = new THREE.ConeGeometry(0.025, 0.14, 5);
  antlerR.translate(0.30, 0.62, -0.05);
  antlerR.rotateZ(0.3);
  parts.push(antlerR);

  // Tail: small cone at back
  const tail = new THREE.ConeGeometry(0.02, 0.06, 3);
  tail.translate(-0.32, 0.38, 0);
  tail.rotateZ(Math.PI / 4);
  parts.push(tail);

  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();

  return merged!;
}

export function createHerbivoreMesh(): THREE.InstancedMesh {
  const geo = createDeerGeometry();
  const mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_HERBIVORE_INSTANCES);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_HERBIVORE_INSTANCES * 3), 3,
  );
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  return mesh;
}

export function updateHerbivores(state: RendererState): void {
  const { world, dummy, getCellElevation } = state;
  const mesh = state.herbivoreMesh;
  const mtx = mesh.instanceMatrix.array as Float32Array;
  const clr = mesh.instanceColor!.array as Float32Array;

  const prevSnapshots = state.prevHerbivoreSnapshots;
  const dyingMap = state.dyingHerbivores;
  const movingMap = state.movingHerbivores;

  const isTick = world.tick !== state.lastHerbivoreTick;

  // ── On new simulation tick ──
  if (isTick) {
    state.lastHerbivoreTick = world.tick;

    // Detect deaths: in prev snapshot but not in world anymore
    for (const [id, snap] of prevSnapshots) {
      if (!world.herbivores.has(id)) {
        dyingMap.set(id, { ...snap, progress: 0 });
        movingMap.delete(id); // stop interpolating dead deer
      }
    }

    // Detect movement for living herbivores
    for (const h of world.herbivores.values()) {
      if (!h.alive) continue;

      const prev = prevSnapshots.get(h.id);
      if (!prev) continue; // newborn — no previous position to lerp from

      const moved = prev.x !== h.x || prev.y !== h.y;
      if (moved) {
        const existing = movingMap.get(h.id);
        if (existing && existing.progress < 1) {
          // Chain from current interpolated position
          const et = easeOutCubic(existing.progress);
          existing.fromX = lerp(existing.fromX, existing.toX, et);
          existing.fromY = lerp(existing.fromY, existing.toY, et);
          existing.fromFacing = lerpAngle(existing.fromFacing, existing.toFacing, et);
          existing.toX = h.x;
          existing.toY = h.y;
          existing.toFacing = h.facing;
          existing.progress = 0;
        } else {
          movingMap.set(h.id, {
            fromX: prev.x,
            fromY: prev.y,
            toX: h.x,
            toY: h.y,
            fromFacing: prev.facing,
            toFacing: h.facing,
            progress: 0,
          });
        }
      }
    }
  }

  // ── Every frame: advance movement progress ──
  const step = 1 / HERBIVORE_MOVE_FRAMES;
  const toRemoveMoving: number[] = [];
  for (const [id, mv] of movingMap) {
    mv.progress += step;
    if (mv.progress >= 1) {
      toRemoveMoving.push(id);
    }
  }
  for (const id of toRemoveMoving) movingMap.delete(id);

  // ── Build new snapshots + render alive herbivores ──
  const newSnapshots = new Map<number, HerbivoreSnapshot>();
  let idx = 0;

  for (const h of world.herbivores.values()) {
    if (!h.alive) continue;
    if (idx >= MAX_HERBIVORE_INSTANCES) break;

    newSnapshots.set(h.id, { x: h.x, y: h.y, facing: h.facing });

    let posX: number, posY: number, facing: number;
    let bob = 0;

    const mv = movingMap.get(h.id);
    if (mv) {
      const et = easeOutCubic(mv.progress);
      posX = lerp(mv.fromX, mv.toX, et);
      posY = lerp(mv.fromY, mv.toY, et);
      facing = lerpAngle(mv.fromFacing, mv.toFacing, et);
      // Subtle vertical bob during movement
      bob = Math.sin(mv.progress * Math.PI) * 0.04;
    } else {
      posX = h.x;
      posY = h.y;
      facing = h.facing;
    }

    const wx = posX - HALF + 0.5;
    const wz = posY - HALF + 0.5;

    // Interpolate elevation between cells during movement
    let baseY: number;
    if (mv) {
      const et = easeOutCubic(mv.progress);
      const fromElev = getCellElevation(
        Math.round(mv.fromX), Math.round(mv.fromY),
      );
      const toElev = getCellElevation(
        Math.round(mv.toX), Math.round(mv.toY),
      );
      baseY = lerp(fromElev, toElev, et) + bob;
    } else {
      baseY = getCellElevation(h.x, h.y);
    }

    dummy.position.set(wx, baseY, wz);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, -facing + Math.PI / 2, 0);
    dummy.updateMatrix();
    dummy.matrix.toArray(mtx, idx * 16);

    // Warm brown color tinted by genome
    const ci = idx * 3;
    clr[ci]     = 0.55 + h.genome.speed * 0.15;
    clr[ci + 1] = 0.35 + h.genome.appetite * 0.10;
    clr[ci + 2] = 0.15 + h.genome.herdInstinct * 0.10;
    idx++;
  }

  state.prevHerbivoreSnapshots = newSnapshots;

  // ── Render dying herbivores (fall-over + fade) ──
  const toRemove: number[] = [];
  for (const [id, dh] of dyingMap) {
    dh.progress += 1 / HERBIVORE_DEATH_FRAMES;
    if (dh.progress >= 1) { toRemove.push(id); continue; }
    if (idx >= MAX_HERBIVORE_INSTANCES) continue;

    const wx = dh.x - HALF + 0.5;
    const wz = dh.y - HALF + 0.5;
    const baseY = getCellElevation(dh.x, dh.y);

    // Fall over on side
    const tiltProgress = Math.min(1, dh.progress * 2);
    const tiltAngle = tiltProgress * (Math.PI / 2);
    const shrink = 1 - dh.progress * 0.5;

    dummy.position.set(wx, baseY, wz);
    dummy.scale.set(shrink, shrink, shrink);
    dummy.rotation.set(0, -dh.facing + Math.PI / 2, tiltAngle);
    dummy.updateMatrix();
    dummy.matrix.toArray(mtx, idx * 16);

    // Fade to dark
    const ci = idx * 3;
    const fade = 1 - dh.progress;
    clr[ci]     = 0.45 * fade;
    clr[ci + 1] = 0.30 * fade;
    clr[ci + 2] = 0.15 * fade;
    idx++;
  }
  for (const id of toRemove) dyingMap.delete(id);

  mesh.count = idx;
  if (idx > 0) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
  }
}
