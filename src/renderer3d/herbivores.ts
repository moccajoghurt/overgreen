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

  // Legs first — deer legs are long and slender
  // Leg height determines body position
  const legH = 0.28;
  const bodyY = legH + 0.08; // body center height

  // 4 Legs: long, tapered cylinders
  const legPositions = [
    [0.12, 0, 0.07],    // front-left
    [0.12, 0, -0.07],   // front-right
    [-0.14, 0, 0.065],  // back-left
    [-0.14, 0, -0.065], // back-right
  ];
  for (const [lx, , lz] of legPositions) {
    const leg = new THREE.CylinderGeometry(0.018, 0.022, legH, 6);
    leg.translate(lx, legH / 2, lz);
    parts.push(leg);
    // Small hoof
    const hoof = new THREE.CylinderGeometry(0.024, 0.020, 0.02, 6);
    hoof.translate(lx, 0.01, lz);
    parts.push(hoof);
  }

  // Body: slender ellipsoid, slightly deeper
  const body = new THREE.SphereGeometry(1, 7, 5);
  body.scale(0.22, 0.12, 0.09);
  body.translate(0, bodyY, 0);
  parts.push(body);

  // Chest: slight bulge at front
  const chest = new THREE.SphereGeometry(1, 5, 4);
  chest.scale(0.09, 0.10, 0.08);
  chest.translate(0.13, bodyY + 0.02, 0);
  parts.push(chest);

  // Haunch: slight bulge at rear, extends further back
  const haunch = new THREE.SphereGeometry(1, 5, 4);
  haunch.scale(0.09, 0.09, 0.07);
  haunch.translate(-0.14, bodyY + 0.01, 0);
  parts.push(haunch);

  // Neck: long, angled upward — overlaps body to avoid gap
  const neckAngle = 0.65;
  const neckLen = 0.20;
  const neck = new THREE.CylinderGeometry(0.04, 0.065, neckLen, 6);
  neck.rotateZ(-neckAngle);
  const neckBaseX = 0.16;
  const neckBaseY = bodyY + 0.05;
  const neckX = neckBaseX + Math.sin(neckAngle) * neckLen * 0.5;
  const neckY = neckBaseY + Math.cos(neckAngle) * neckLen * 0.5;
  neck.translate(neckX, neckY, 0);
  parts.push(neck);

  // Head: elongated sphere — sized to anchor antlers visibly
  const headX = neckBaseX + Math.sin(neckAngle) * neckLen;
  const headY = neckBaseY + Math.cos(neckAngle) * neckLen;
  const head = new THREE.SphereGeometry(1, 6, 5);
  head.scale(0.08, 0.058, 0.052);
  head.translate(headX, headY, 0);
  parts.push(head);

  // Snout: shorter, more compact
  const snout = new THREE.CylinderGeometry(0.020, 0.035, 0.045, 5);
  snout.rotateZ(-Math.PI / 2);
  snout.translate(headX + 0.065, headY - 0.012, 0);
  parts.push(snout);

  // Ears: angled up and outward — visible from front and side
  for (const side of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.015, 0.04, 4);
    ear.rotateX(side * 0.5);  // splay outward
    ear.rotateZ(-0.15);       // tilt slightly backward
    ear.translate(headX - 0.015, headY + 0.05, side * 0.038);
    parts.push(ear);
  }

  // Antlers: outward-sweeping beams with two tines each
  for (const side of [-1, 1]) {
    // Main beam — sweeps outward and slightly backward
    const beam = new THREE.CylinderGeometry(0.008, 0.012, 0.10, 4);
    beam.rotateZ(0.25 * side);  // outward splay
    beam.rotateX(0.12);         // slight backward sweep
    beam.translate(headX - 0.01, headY + 0.09, side * 0.02);
    parts.push(beam);
    // Lower tine — forward prong at mid-beam
    const tine1 = new THREE.CylinderGeometry(0.005, 0.007, 0.035, 4);
    tine1.rotateZ(-0.65);
    tine1.translate(headX + 0.005, headY + 0.10, side * 0.03);
    parts.push(tine1);
    // Upper tine — shorter prong near beam tip, angled up-forward
    const tine2 = new THREE.CylinderGeometry(0.004, 0.006, 0.03, 4);
    tine2.rotateZ(-0.4);
    tine2.translate(headX + 0.003, headY + 0.13, side * 0.038);
    parts.push(tine2);
  }

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
