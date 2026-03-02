import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RendererState, HALF } from './state';

export const MAX_HERBIVORE_INSTANCES = 200;
export const HERBIVORE_DEATH_FRAMES = 60;

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

export function createDeerGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Body: box raised on legs
  const body = new THREE.BoxGeometry(0.6, 0.3, 0.28);
  body.translate(0, 0.3, 0);
  parts.push(body);

  // Head: sphere at front
  const head = new THREE.SphereGeometry(0.1, 5, 5);
  head.translate(0.35, 0.42, 0);
  parts.push(head);

  // Snout: small box
  const snout = new THREE.BoxGeometry(0.1, 0.06, 0.06);
  snout.translate(0.45, 0.38, 0);
  parts.push(snout);

  // 4 Legs
  const legPositions = [
    [0.2, 0.075, 0.1],
    [0.2, 0.075, -0.1],
    [-0.2, 0.075, 0.1],
    [-0.2, 0.075, -0.1],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.CylinderGeometry(0.025, 0.03, 0.2, 4);
    leg.translate(lx, ly, lz);
    parts.push(leg);
  }

  // 2 Antlers: cones tilted outward
  const antlerL = new THREE.ConeGeometry(0.03, 0.14, 4);
  antlerL.translate(0.32, 0.55, 0.06);
  antlerL.rotateZ(-0.3);
  parts.push(antlerL);

  const antlerR = new THREE.ConeGeometry(0.03, 0.14, 4);
  antlerR.translate(0.32, 0.55, -0.06);
  antlerR.rotateZ(0.3);
  parts.push(antlerR);

  // Tail: small cone at back
  const tail = new THREE.ConeGeometry(0.02, 0.06, 3);
  tail.translate(-0.32, 0.38, 0);
  tail.rotateZ(Math.PI / 4);
  parts.push(tail);

  const merged = mergeGeometries(parts);
  // Dispose individual parts
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

  // Detect deaths: in prev snapshot but not in world anymore
  for (const [id, snap] of prevSnapshots) {
    if (!world.herbivores.has(id)) {
      dyingMap.set(id, { ...snap, progress: 0 });
    }
  }

  // Build new snapshots + render alive herbivores
  const newSnapshots = new Map<number, HerbivoreSnapshot>();
  let idx = 0;

  for (const h of world.herbivores.values()) {
    if (!h.alive) continue;
    if (idx >= MAX_HERBIVORE_INSTANCES) break;

    newSnapshots.set(h.id, { x: h.x, y: h.y, facing: h.facing });

    const wx = h.x - HALF + 0.5;
    const wz = h.y - HALF + 0.5;
    const baseY = getCellElevation(h.x, h.y);

    dummy.position.set(wx, baseY, wz);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, -h.facing + Math.PI / 2, 0);
    dummy.updateMatrix();
    dummy.matrix.toArray(mtx, idx * 16);

    // Warm brown color tinted by genome
    const ci = idx * 3;
    clr[ci]     = 0.55 + h.genome.speed * 0.15;     // reddish-brown
    clr[ci + 1] = 0.35 + h.genome.appetite * 0.10;   // warm mid
    clr[ci + 2] = 0.15 + h.genome.herdInstinct * 0.10;
    idx++;
  }

  state.prevHerbivoreSnapshots = newSnapshots;

  // Render dying herbivores (fall-over + fade)
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
