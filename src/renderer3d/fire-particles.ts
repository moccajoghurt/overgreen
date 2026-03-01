import {
  RendererState, HALF, GRID,
  FIRE_PARTICLE_COUNT, DUST_PARTICLE_COUNT,
  lerp,
} from './state';

export function updateFireParticles(state: RendererState): void {
  const { world, dummy, camera, fireMesh, emberMesh, fireParticles, emberParticles, burningPlants, getCellElevation } = state;
  const env = world.environment;

  // Collect all burning cell positions
  const sources: Array<{ wx: number; wz: number; baseY: number }> = [];
  for (const fire of env.fires) {
    for (const [key] of fire.cells) {
      const [fx, fy] = key.split(',').map(Number);
      sources.push({
        wx: fx - HALF + 0.5,
        wz: fy - HALF + 0.5,
        baseY: getCellElevation(fx, fy),
      });
    }
  }
  // Also include burning plant positions (renderer-only state)
  for (const [, bp] of burningPlants) {
    sources.push({
      wx: bp.x - HALF + 0.5,
      wz: bp.y - HALF + 0.5,
      baseY: getCellElevation(bp.x, bp.y),
    });
  }

  if (sources.length === 0) {
    fireMesh.count = 0;
    emberMesh.count = 0;
    return;
  }

  // ── Flame particles ──
  const fMtx = fireMesh.instanceMatrix.array as Float32Array;
  const fClr = fireMesh.instanceColor!.array as Float32Array;
  let fIdx = 0;
  const spawnRate = Math.min(sources.length * 3, FIRE_PARTICLE_COUNT);

  for (let i = 0; i < FIRE_PARTICLE_COUNT; i++) {
    const p = fireParticles[i];
    if (p.life <= 0 && i < spawnRate) {
      const src = sources[Math.floor(Math.random() * sources.length)];
      p.x = src.wx + (Math.random() - 0.5) * 0.4;
      p.z = src.wz + (Math.random() - 0.5) * 0.4;
      p.y = src.baseY + Math.random() * 0.5;
      p.vx = (Math.random() - 0.5) * 0.01;
      p.vy = 0.04 + Math.random() * 0.06;
      p.vz = (Math.random() - 0.5) * 0.01;
      p.maxLife = 0.5 + Math.random() * 0.5;
      p.life = p.maxLife;
    }
    if (p.life <= 0) continue;

    p.x += p.vx + Math.sin(performance.now() * 0.02 + i) * 0.005;
    p.y += p.vy;
    p.z += p.vz;
    p.life -= 0.02;
    if (fIdx >= FIRE_PARTICLE_COUNT) continue;

    dummy.position.set(p.x, p.y, p.z);
    dummy.quaternion.copy(camera.quaternion);
    const scale = 0.5 + (p.life / p.maxLife) * 0.5;
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    dummy.matrix.toArray(fMtx, fIdx * 16);

    // Yellow → orange → dark red
    const t = 1 - (p.life / p.maxLife);
    const ci = fIdx * 3;
    fClr[ci]     = lerp(1.0, 0.6, t);
    fClr[ci + 1] = lerp(0.9, 0.1, t);
    fClr[ci + 2] = lerp(0.3, 0.02, t);
    fIdx++;
  }

  fireMesh.count = fIdx;
  if (fIdx > 0) {
    fireMesh.instanceMatrix.needsUpdate = true;
    fireMesh.instanceColor!.needsUpdate = true;
  }

  // ── Ember particles ──
  const eMtx = emberMesh.instanceMatrix.array as Float32Array;
  const eClr = emberMesh.instanceColor!.array as Float32Array;
  let eIdx = 0;
  const emberSpawnRate = Math.min(sources.length * 2, FIRE_PARTICLE_COUNT);

  for (let i = 0; i < FIRE_PARTICLE_COUNT; i++) {
    const p = emberParticles[i];
    if (p.life <= 0 && i < emberSpawnRate) {
      const src = sources[Math.floor(Math.random() * sources.length)];
      p.x = src.wx + (Math.random() - 0.5) * 0.6;
      p.z = src.wz + (Math.random() - 0.5) * 0.6;
      p.y = src.baseY + 0.5 + Math.random() * 1.5;
      p.vx = (Math.random() - 0.5) * 0.03;
      p.vy = 0.02 + Math.random() * 0.04;
      p.vz = (Math.random() - 0.5) * 0.03;
      p.maxLife = 1.0 + Math.random() * 1.0;
      p.life = p.maxLife;
    }
    if (p.life <= 0) continue;

    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.vx += (Math.random() - 0.5) * 0.002;
    p.vz += (Math.random() - 0.5) * 0.002;
    p.life -= 0.01;
    if (eIdx >= FIRE_PARTICLE_COUNT) continue;

    dummy.position.set(p.x, p.y, p.z);
    dummy.quaternion.copy(camera.quaternion);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    dummy.matrix.toArray(eMtx, eIdx * 16);

    // Twinkling bright orange/white
    const twinkle = Math.sin(performance.now() * 0.05 + i * 3) * 0.5 + 0.5;
    const ci = eIdx * 3;
    eClr[ci]     = 1.0;
    eClr[ci + 1] = 0.4 + twinkle * 0.4;
    eClr[ci + 2] = twinkle * 0.2;
    eIdx++;
  }

  emberMesh.count = eIdx;
  if (eIdx > 0) {
    emberMesh.instanceMatrix.needsUpdate = true;
    emberMesh.instanceColor!.needsUpdate = true;
  }
}

export function updateDroughtParticles(state: RendererState): void {
  const { world, dummy, camera, dustMesh, dustParticles, controls, getCellElevation } = state;
  const env = world.environment;
  if (env.droughts.length === 0) {
    dustMesh.count = 0;
    return;
  }

  // Collect drought cell positions near camera
  const camTarget = controls.target;
  const sources: Array<{ wx: number; wz: number; baseY: number }> = [];
  const overlay = env.weatherOverlay;

  const cx = Math.round(camTarget.x + HALF - 0.5);
  const cz = Math.round(camTarget.z + HALF - 0.5);
  const range = 20;
  for (let dy = -range; dy <= range; dy += 2) {
    for (let dx = -range; dx <= range; dx += 2) {
      const gx = cx + dx;
      const gy = cz + dy;
      if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) continue;
      if (overlay[gy * GRID + gx] === 1) {
        sources.push({
          wx: gx - HALF + 0.5,
          wz: gy - HALF + 0.5,
          baseY: getCellElevation(gx, gy),
        });
      }
    }
  }

  if (sources.length === 0) {
    dustMesh.count = 0;
    return;
  }

  const dMtx = dustMesh.instanceMatrix.array as Float32Array;
  const dClr = dustMesh.instanceColor!.array as Float32Array;
  let dIdx = 0;
  const dustSpawnRate = Math.min(sources.length, DUST_PARTICLE_COUNT);

  for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
    const p = dustParticles[i];
    if (p.life <= 0 && i < dustSpawnRate) {
      const src = sources[Math.floor(Math.random() * sources.length)];
      p.x = src.wx + (Math.random() - 0.5) * 1.0;
      p.z = src.wz + (Math.random() - 0.5) * 1.0;
      p.y = src.baseY + Math.random() * 0.3;
      p.vx = (Math.random() - 0.5) * 0.008;
      p.vy = 0.008 + Math.random() * 0.015;
      p.vz = (Math.random() - 0.5) * 0.008;
      p.maxLife = 1.5 + Math.random() * 1.5;
      p.life = p.maxLife;
    }
    if (p.life <= 0) continue;

    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.vx += (Math.random() - 0.5) * 0.001;
    p.vz += (Math.random() - 0.5) * 0.001;
    p.life -= 0.006;
    if (dIdx >= DUST_PARTICLE_COUNT) continue;

    dummy.position.set(p.x, p.y, p.z);
    dummy.quaternion.copy(camera.quaternion);
    dummy.scale.setScalar(0.6 + (p.life / p.maxLife) * 0.4);
    dummy.updateMatrix();
    dummy.matrix.toArray(dMtx, dIdx * 16);

    // Earthy brownish-tan
    const ci = dIdx * 3;
    const fade = p.life / p.maxLife;
    dClr[ci]     = 0.6 * fade;
    dClr[ci + 1] = 0.45 * fade;
    dClr[ci + 2] = 0.25 * fade;
    dIdx++;
  }

  dustMesh.count = dIdx;
  if (dIdx > 0) {
    dustMesh.instanceMatrix.needsUpdate = true;
    dustMesh.instanceColor!.needsUpdate = true;
  }
}
