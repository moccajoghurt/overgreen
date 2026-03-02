import * as THREE from 'three';
import { Environment, Season } from '../types';

// Seasonal colors for hills (HSL)
const SEASON_HILL_COLORS: [h: number, s: number, l: number][] = [
  [120 / 360, 0.35, 0.28], // Spring: green
  [130 / 360, 0.40, 0.22], // Summer: deep green
  [35 / 360, 0.40, 0.25],  // Autumn: orange-brown
  [210 / 360, 0.05, 0.72], // Winter: snow-capped pale blue-white
];

// Seasonal river water colors
const SEASON_RIVER_COLORS: [h: number, s: number, l: number][] = [
  [195 / 360, 0.45, 0.32], // Spring
  [200 / 360, 0.40, 0.35], // Summer
  [210 / 360, 0.40, 0.28], // Autumn
  [215 / 360, 0.20, 0.30], // Winter
];

export interface DistantEnvironment {
  update: (env: Environment) => void;
}

// Seeded random for deterministic placement
function srand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createDistantEnvironment(scene: THREE.Scene): DistantEnvironment {
  // ── Distant hills ring ──
  const hillSegments = 64;
  const hillRings = 8;
  const innerR = 50;
  const outerR = 130;
  const hillGeo = new THREE.RingGeometry(innerR, outerR, hillSegments, hillRings);
  hillGeo.rotateX(-Math.PI / 2);

  const hillPos = hillGeo.attributes.position;
  const hillVertCount = hillPos.count;
  const hillColorArr = new Float32Array(hillVertCount * 3);
  const hillColorAttr = new THREE.BufferAttribute(hillColorArr, 3);
  hillColorAttr.setUsage(THREE.DynamicDrawUsage);
  hillGeo.setAttribute('color', hillColorAttr);

  for (let i = 0; i < hillVertCount; i++) {
    const x = hillPos.getX(i);
    const z = hillPos.getZ(i);
    const dist = Math.sqrt(x * x + z * z);
    const angle = Math.atan2(z, x);

    const radialT = Math.max(0, Math.min(1, (dist - innerR) / (outerR - innerR)));
    const angularHeight = (
      Math.sin(angle * 3) * 5 +
      Math.sin(angle * 7 + 1.3) * 3 +
      Math.sin(angle * 11 + 2.7) * 2
    );
    const radialBell = Math.sin(radialT * Math.PI);
    const y = Math.max(0, angularHeight * radialBell + 3 * radialBell);
    hillPos.setY(i, y);
  }
  hillPos.needsUpdate = true;
  hillGeo.computeVertexNormals();

  const hillMat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: true });
  const hillMesh = new THREE.Mesh(hillGeo, hillMat);
  hillMesh.position.y = -0.5;
  scene.add(hillMesh);

  // ── Meandering river streams across the grassland ──
  const riverMats: THREE.MeshLambertMaterial[] = [];

  const riverDefs = [
    { startAngle: 0.8, endAngle: 3.5, startR: 42, endR: 115, width: 1.8, freq: 3.0, amp: 8, seed: 0 },
    { startAngle: 4.2, endAngle: 6.8, startR: 44, endR: 105, width: 1.2, freq: 4.0, amp: 6, seed: 100 },
  ];

  for (const def of riverDefs) {
    const segments = 60;
    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = def.startAngle + (def.endAngle - def.startAngle) * t;
      const r = def.startR + (def.endR - def.startR) * t;

      const meander = Math.sin(t * def.freq * Math.PI + def.seed) * def.amp * t;

      const cx = Math.cos(angle) * r + Math.sin(angle) * meander;
      const cz = Math.sin(angle) * r - Math.cos(angle) * meander;

      const dt = 0.01;
      const t2 = Math.min(1, t + dt);
      const angle2 = def.startAngle + (def.endAngle - def.startAngle) * t2;
      const r2 = def.startR + (def.endR - def.startR) * t2;
      const meander2 = Math.sin(t2 * def.freq * Math.PI + def.seed) * def.amp * t2;
      const cx2 = Math.cos(angle2) * r2 + Math.sin(angle2) * meander2;
      const cz2 = Math.sin(angle2) * r2 - Math.cos(angle2) * meander2;

      const dx = cx2 - cx;
      const dz = cz2 - cz;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const px = -dz / len;
      const pz = dx / len;

      const halfW = def.width * 0.5 * (0.5 + t * 0.5);

      positions.push(cx + px * halfW, -0.15, cz + pz * halfW);
      positions.push(cx - px * halfW, -0.15, cz - pz * halfW);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1);
        indices.push(base + 1, base + 2, base + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ fog: true, color: 0x4488aa });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    riverMats.push(mat);
  }

  const tmpColor = new THREE.Color();

  function updateColors(env: Environment): void {
    const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;

    // ── Hill colors ──
    const h0 = SEASON_HILL_COLORS[env.season];
    const h1 = SEASON_HILL_COLORS[(env.season + 1) % 4];
    const hh = h0[0] + (h1[0] - h0[0]) * t;
    const hs = h0[1] + (h1[1] - h0[1]) * t;
    const hl = h0[2] + (h1[2] - h0[2]) * t;

    for (let i = 0; i < hillVertCount; i++) {
      const variation = srand(i * 31) * 0.06 - 0.03;
      tmpColor.setHSL(hh + variation * 0.1, hs + variation, hl + variation);
      hillColorArr[i * 3] = tmpColor.r;
      hillColorArr[i * 3 + 1] = tmpColor.g;
      hillColorArr[i * 3 + 2] = tmpColor.b;
    }
    hillColorAttr.needsUpdate = true;

    // ── River colors ──
    const rv0 = SEASON_RIVER_COLORS[env.season];
    const rv1 = SEASON_RIVER_COLORS[(env.season + 1) % 4];
    tmpColor.setHSL(
      rv0[0] + (rv1[0] - rv0[0]) * t,
      rv0[1] + (rv1[1] - rv0[1]) * t,
      rv0[2] + (rv1[2] - rv0[2]) * t,
    );
    for (const mat of riverMats) {
      mat.color.copy(tmpColor);
    }
  }

  // Initial color update
  updateColors({ season: Season.Spring, seasonProgress: 0 } as Environment);

  return {
    update: updateColors,
  };
}
