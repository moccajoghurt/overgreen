import * as THREE from 'three';
import { Season, Environment } from '../types';
import {
  RendererState, WeatherParticle, WeatherType,
  SNOW_PARTICLE_COUNT, RAIN_PARTICLE_COUNT, MOTE_PARTICLE_COUNT, LEAF_PARTICLE_COUNT,
  WEATHER_SPREAD,
} from './state';

function getSeasonIntensity(targetSeason: Season, env: Environment): number {
  if (env.season === targetSeason) {
    return Math.sin(env.seasonProgress * Math.PI);
  }
  const nextSeason = (targetSeason + 1) % 4 as Season;
  if (env.season === nextSeason && env.seasonProgress < 0.15) {
    return (0.15 - env.seasonProgress) / 0.15 * 0.3;
  }
  return 0;
}

function respawnParticle(p: WeatherParticle, camTarget: THREE.Vector3, type: WeatherType): void {
  p.x = camTarget.x + (Math.random() - 0.5) * WEATHER_SPREAD * 2;
  p.z = camTarget.z + (Math.random() - 0.5) * WEATHER_SPREAD * 2;
  p.y = 2 + Math.random() * 23;
  p.life = 1.0;
  p.phase = Math.random() * Math.PI * 2;
  switch (type) {
    case 'snow':
      p.vx = (Math.random() - 0.5) * 0.02;
      p.vy = -0.03 - Math.random() * 0.02;
      p.vz = (Math.random() - 0.5) * 0.02;
      break;
    case 'rain':
      p.vx = 0.01;
      p.vy = -0.4 - Math.random() * 0.1;
      p.vz = 0.005;
      break;
    case 'mote':
      p.vx = (Math.random() - 0.5) * 0.01;
      p.vy = -0.005 - Math.random() * 0.005;
      p.vz = (Math.random() - 0.5) * 0.01;
      break;
    case 'leaf':
      p.vx = 0.02 + Math.random() * 0.02;
      p.vy = -0.04 - Math.random() * 0.03;
      p.vz = (Math.random() - 0.5) * 0.015;
      break;
  }
}

function updateOneEffect(
  state: RendererState,
  particles: WeatherParticle[],
  mesh: THREE.InstancedMesh,
  intensity: number,
  maxCount: number,
  camTarget: THREE.Vector3,
  type: WeatherType,
): void {
  if (intensity < 0.01) {
    mesh.count = 0;
    return;
  }

  (mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, intensity * 0.8 + 0.2);

  const activeCount = Math.floor(maxCount * intensity);
  const mtx = mesh.instanceMatrix.array as Float32Array;
  const clr = mesh.instanceColor!.array as Float32Array;
  const { dummy, camera } = state;
  const camQuat = camera.quaternion;
  let idx = 0;

  for (let i = 0; i < activeCount; i++) {
    const p = particles[i];

    if (p.life <= 0 || p.y < -1) {
      respawnParticle(p, camTarget, type);
    }

    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.life -= 0.003;
    p.phase += 0.05;

    if (type === 'snow') {
      p.x += Math.sin(p.phase) * 0.008;
      p.z += Math.cos(p.phase * 0.7) * 0.006;
    } else if (type === 'leaf') {
      p.x += Math.sin(p.phase * 1.2) * 0.012;
      p.z += Math.cos(p.phase * 0.8) * 0.008;
    }

    dummy.position.set(p.x, p.y, p.z);

    if (type === 'leaf') {
      dummy.rotation.set(p.phase, p.phase * 0.7, p.phase * 0.3);
      dummy.scale.setScalar(1);
    } else {
      dummy.quaternion.copy(camQuat);
      dummy.scale.setScalar(1);
    }

    dummy.updateMatrix();
    dummy.matrix.toArray(mtx, idx * 16);

    const ci = idx * 3;
    if (type === 'leaf') {
      const hue = Math.sin(p.phase * 137) * 0.5 + 0.5;
      clr[ci]     = 0.6 + hue * 0.3;
      clr[ci + 1] = 0.2 + hue * 0.2;
      clr[ci + 2] = 0.05;
    } else if (type === 'snow') {
      clr[ci] = 0.95; clr[ci + 1] = 0.97; clr[ci + 2] = 1.0;
    } else if (type === 'rain') {
      clr[ci] = 0.5; clr[ci + 1] = 0.7; clr[ci + 2] = 0.85;
    } else {
      clr[ci] = 1.0; clr[ci + 1] = 0.95; clr[ci + 2] = 0.6;
    }

    idx++;
  }

  mesh.count = idx;
  if (idx > 0) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
  }
}

export function updateWeatherParticles(state: RendererState): void {
  const env = state.world.environment;
  const camTarget = state.controls.target;

  updateOneEffect(state, state.snowParticles, state.snowMesh, getSeasonIntensity(Season.Winter, env), SNOW_PARTICLE_COUNT, camTarget, 'snow');
  updateOneEffect(state, state.rainParticles, state.rainMesh, getSeasonIntensity(Season.Spring, env), RAIN_PARTICLE_COUNT, camTarget, 'rain');
  updateOneEffect(state, state.moteParticles, state.moteMesh, getSeasonIntensity(Season.Summer, env), MOTE_PARTICLE_COUNT, camTarget, 'mote');
  updateOneEffect(state, state.leafParticles, state.leafMesh, getSeasonIntensity(Season.Autumn, env), LEAF_PARTICLE_COUNT, camTarget, 'leaf');
}
