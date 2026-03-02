import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Environment } from '../types';

// Seasonal sky parameters: [sunElevation°, turbidity, rayleigh, mieCoefficient, cloudCoverage, cloudDensity]
const SEASON_SKY = [
  { sunEl: 55, turbidity: 2.5, rayleigh: 1.5, mie: 0.005, cloudCov: 0.35, cloudDens: 0.35 }, // Spring
  { sunEl: 70, turbidity: 3.5, rayleigh: 1.2, mie: 0.008, cloudCov: 0.20, cloudDens: 0.25 }, // Summer
  { sunEl: 45, turbidity: 4.0, rayleigh: 2.0, mie: 0.006, cloudCov: 0.40, cloudDens: 0.40 }, // Autumn
  { sunEl: 25, turbidity: 1.8, rayleigh: 3.0, mie: 0.003, cloudCov: 0.55, cloudDens: 0.50 }, // Winter
];

// Seasonal fog/horizon colors (HSL)
const SEASON_FOG: [h: number, s: number, l: number][] = [
  [200 / 360, 0.35, 0.72], // Spring: soft blue-white
  [40 / 360, 0.40, 0.78],  // Summer: warm golden haze
  [25 / 360, 0.35, 0.62],  // Autumn: warm amber
  [210 / 360, 0.15, 0.68], // Winter: pale grey
];

export interface SkyDome {
  mesh: THREE.Object3D;
  update: (env: Environment, cameraPos: THREE.Vector3) => void;
  getSunDirection: () => THREE.Vector3;
  getFogColor: () => THREE.Color;
}

export function createSkyDome(scene: THREE.Scene): SkyDome {
  const sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  const uniforms = sky.material.uniforms;
  uniforms['up'].value.set(0, 1, 0);

  // Cloud defaults
  uniforms['cloudScale'].value = 0.0002;
  uniforms['cloudSpeed'].value = 0.00008;
  uniforms['cloudElevation'].value = 0.5;

  // Fog — near/far tuned so terrain fades gracefully
  const fog = new THREE.Fog(0x88aacc, 60, 140);
  scene.fog = fog;

  const sunDirection = new THREE.Vector3();
  const fogColor = new THREE.Color();
  let cloudTime = 0;

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  function update(env: Environment, _cameraPos: THREE.Vector3): void {
    const s0 = SEASON_SKY[env.season];
    const s1 = SEASON_SKY[(env.season + 1) % 4];
    const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;

    // Interpolate sky parameters
    const sunEl = lerp(s0.sunEl, s1.sunEl, t);
    const turbidity = lerp(s0.turbidity, s1.turbidity, t);
    const rayleigh = lerp(s0.rayleigh, s1.rayleigh, t);
    const mie = lerp(s0.mie, s1.mie, t);
    const cloudCov = lerp(s0.cloudCov, s1.cloudCov, t);
    const cloudDens = lerp(s0.cloudDens, s1.cloudDens, t);

    // Sun position from elevation angle (azimuth fixed at ~south)
    const phi = THREE.MathUtils.degToRad(90 - sunEl);
    const theta = THREE.MathUtils.degToRad(180);
    sunDirection.setFromSphericalCoords(1, phi, theta);

    uniforms['sunPosition'].value.copy(sunDirection);
    uniforms['turbidity'].value = turbidity;
    uniforms['rayleigh'].value = rayleigh;
    uniforms['mieCoefficient'].value = mie;
    uniforms['mieDirectionalG'].value = 0.8;
    uniforms['cloudCoverage'].value = cloudCov;
    uniforms['cloudDensity'].value = cloudDens;

    // Animate clouds
    cloudTime += 16; // ~1 frame at 60fps in ms
    uniforms['time'].value = cloudTime;

    // Interpolate fog color
    const f0 = SEASON_FOG[env.season];
    const f1 = SEASON_FOG[(env.season + 1) % 4];
    fogColor.setHSL(
      lerp(f0[0], f1[0], t),
      lerp(f0[1], f1[1], t),
      lerp(f0[2], f1[2], t),
    );
    fog.color.copy(fogColor);
  }

  return {
    mesh: sky,
    update,
    getSunDirection: () => sunDirection.clone(),
    getFogColor: () => fogColor.clone(),
  };
}
