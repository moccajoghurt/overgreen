import * as THREE from 'three';
import { World, TerrainType, Environment } from '../types';
import { GRID, HALF, ELEV_SCALE } from './state';
import { createWaterNormalMap } from './water-normals';

export interface WaterSurface {
  mesh: THREE.Mesh;
  update: (env: Environment, sunDirection: THREE.Vector3, fogColor: THREE.Color) => void;
}

const WATER_OFFSET = 0.45;     // sea: visible depth above seabed
const RIVER_OFFSET = 0.05;     // rivers: just above terrain to avoid z-fighting
const SEA_ELEV_THRESHOLD = 0.15;

// Seasonal water body color + sky reflection color (HSL)
const SEASON_WATER: { bodyH: number; bodyS: number; bodyL: number; skyH: number; skyS: number; skyL: number }[] = [
  { bodyH: 195 / 360, bodyS: 0.55, bodyL: 0.18, skyH: 200 / 360, skyS: 0.40, skyL: 0.65 }, // Spring
  { bodyH: 200 / 360, bodyS: 0.45, bodyL: 0.20, skyH: 210 / 360, skyS: 0.50, skyL: 0.70 }, // Summer
  { bodyH: 210 / 360, bodyS: 0.50, bodyL: 0.15, skyH: 215 / 360, skyS: 0.30, skyL: 0.55 }, // Autumn
  { bodyH: 215 / 360, bodyS: 0.25, bodyL: 0.15, skyH: 210 / 360, skyS: 0.15, skyL: 0.60 }, // Winter
];

// ── Shaders ──

const waterVertexShader = /* glsl */`
  uniform float time;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Gentle wave displacement
    float wave = sin(pos.x * 2.0 + time * 1.5) * 0.03
               + sin(pos.z * 3.0 + time * 1.2) * 0.02
               + sin((pos.x + pos.z) * 1.5 + time * 0.8) * 0.015;
    pos.y += wave;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const waterFragmentShader = /* glsl */`
  uniform sampler2D normalMap;
  uniform float time;
  uniform vec3 sunDirection;
  uniform vec3 waterColor;
  uniform vec3 skyColor;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    // Dual normal map sampling at different UV offsets/speeds
    vec2 uv1 = vWorldPos.xz * 0.08 + vec2(time * 0.015, time * 0.01);
    vec2 uv2 = vWorldPos.xz * 0.12 + vec2(-time * 0.008, time * 0.018);

    vec3 n1 = texture2D(normalMap, uv1).rgb * 2.0 - 1.0;
    vec3 n2 = texture2D(normalMap, uv2).rgb * 2.0 - 1.0;

    // Blend normals (average in tangent space)
    vec3 perturbedNormal = normalize(vec3(
      n1.x + n2.x,
      n1.y + n2.y,
      n1.z + n2.z
    ));

    // Transform perturbed normal to world space (approximation — water is ~horizontal)
    vec3 worldNormal = normalize(vec3(
      perturbedNormal.x * 0.3,
      1.0,
      perturbedNormal.y * 0.3
    ));

    // View direction
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // Fresnel: reflect more at grazing angles
    float fresnel = pow(1.0 - max(dot(viewDir, worldNormal), 0.0), 3.0);
    fresnel = clamp(fresnel, 0.15, 0.85);

    // Mix water body color with sky reflection based on Fresnel
    vec3 baseColor = mix(waterColor, skyColor, fresnel);

    // Sun specular highlight
    vec3 halfDir = normalize(sunDirection + viewDir);
    float spec = pow(max(dot(worldNormal, halfDir), 0.0), 128.0);
    vec3 specColor = vec3(1.0, 0.95, 0.85) * spec * 0.8;

    // Diffuse lighting from sun
    float diffuse = max(dot(worldNormal, sunDirection), 0.0) * 0.3 + 0.7;

    vec3 finalColor = baseColor * diffuse + specColor;

    float alpha = 0.75;

    // Fog
    float fogDepth = length(vWorldPos - cameraPosition);
    float fogFactor = smoothstep(fogNear, fogFar, fogDepth);
    finalColor = mix(finalColor, fogColor, fogFactor);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createWaterSurface(world: World): WaterSurface {
  // ── Step 1: Classify water cells by elevation (sea vs river) ──
  const seaCells: [number, number][] = [];
  const riverCells: [number, number][] = [];

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (world.grid[row][col].terrainType === TerrainType.River) {
        if (world.grid[row][col].elevation <= SEA_ELEV_THRESHOLD) {
          seaCells.push([row, col]);
        } else {
          riverCells.push([row, col]);
        }
      }
    }
  }

  if (seaCells.length === 0 && riverCells.length === 0) {
    const emptyGeo = new THREE.BufferGeometry();
    const emptyMesh = new THREE.Mesh(emptyGeo);
    emptyMesh.visible = false;
    return { mesh: emptyMesh, update: () => {} };
  }

  // ── Corner elevation helper ──
  const cornerSize = GRID + 1;
  const elevCorners = new Float32Array(cornerSize * cornerSize);
  for (let cy = 0; cy <= GRID; cy++) {
    for (let cx = 0; cx <= GRID; cx++) {
      let sum = 0, count = 0;
      for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
          sum += world.grid[gy][gx].elevation;
          count++;
        }
      }
      elevCorners[cy * cornerSize + cx] = (sum / count) * ELEV_SCALE;
    }
  }

  function getElevAt(row: number, col: number): number {
    const cx = Math.max(0, Math.min(GRID, col));
    const cy = Math.max(0, Math.min(GRID, row));
    const ix = Math.min(Math.floor(cx), GRID - 1);
    const iy = Math.min(Math.floor(cy), GRID - 1);
    const fx = cx - ix;
    const fy = cy - iy;
    const e00 = elevCorners[iy * cornerSize + ix];
    const e10 = elevCorners[iy * cornerSize + ix + 1];
    const e01 = elevCorners[(iy + 1) * cornerSize + ix];
    const e11 = elevCorners[(iy + 1) * cornerSize + ix + 1];
    return e00 * (1 - fx) * (1 - fy) + e10 * fx * (1 - fy)
      + e01 * (1 - fx) * fy + e11 * fx * fy;
  }

  // ── Build geometry ──
  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const allUvs: number[] = [];

  function pushVert(x: number, y: number, z: number): void {
    allPositions.push(x, y, z);
    allNormals.push(0, 1, 0);
    allUvs.push(0, 0);
  }

  // ── Shared marching squares table + interpolation ──
  // Vertices: 0=TL 1=TR 2=BR 3=BL 4=T(edge) 5=R(edge) 6=B(edge) 7=L(edge)
  const MS_TRI: number[][] = [
    /* 0:  0000 */ [],
    /* 1:  0001 BL          */ [7, 3, 6],
    /* 2:  0010 BR          */ [6, 2, 5],
    /* 3:  0011 BL+BR       */ [7, 3, 2, 7, 2, 5],
    /* 4:  0100 TR          */ [4, 1, 5],
    /* 5:  0101 TR+BL       */ [4, 1, 5, 4, 5, 6, 4, 6, 3, 4, 3, 7],
    /* 6:  0110 TR+BR       */ [4, 1, 2, 4, 2, 6],
    /* 7:  0111 TR+BR+BL    */ [4, 1, 2, 4, 2, 3, 4, 3, 7],
    /* 8:  1000 TL          */ [0, 4, 7],
    /* 9:  1001 TL+BL       */ [0, 4, 6, 0, 6, 3],
    /* 10: 1010 TL+BR       */ [0, 4, 5, 0, 5, 2, 0, 2, 6, 0, 6, 7],
    /* 11: 1011 TL+BL+BR    */ [0, 4, 5, 0, 5, 2, 0, 2, 3],
    /* 12: 1100 TL+TR       */ [0, 1, 5, 0, 5, 7],
    /* 13: 1101 TL+TR+BL    */ [0, 1, 5, 0, 5, 6, 0, 6, 3],
    /* 14: 1110 TL+TR+BR    */ [0, 1, 2, 0, 2, 6, 0, 6, 7],
    /* 15: 1111             */ [0, 1, 2, 0, 2, 3],
  ];

  const TH = 0.5;
  function msLerp(a: number, b: number, va: number, vb: number): number {
    const d = vb - va;
    if (Math.abs(d) < 1e-6) return (a + b) / 2;
    return a + (TH - va) / d * (b - a);
  }

  const CELL_OFFSETS: [number, number][] = [[0, 0], [-1, 0], [0, -1], [-1, -1]];

  // ── Sea mesh: marching squares for smooth coastline ──
  if (seaCells.length > 0) {
    let elevSum = 0;
    for (const [r, c] of seaCells) elevSum += world.grid[r][c].elevation;
    const seaY = (elevSum / seaCells.length) * ELEV_SCALE + WATER_OFFSET;

    // Sea cell lookup
    const isSea = new Uint8Array(GRID * GRID);
    for (const [r, c] of seaCells) isSea[r * GRID + c] = 1;

    // Corner scalar field: fraction of adjacent cells that are sea
    const csz = GRID + 1;
    const seaCorner = new Float32Array(csz * csz);
    for (let cy = 0; cy <= GRID; cy++) {
      for (let cx = 0; cx <= GRID; cx++) {
        let s = 0, t = 0;
        for (const [dr, dc] of CELL_OFFSETS) {
          const gr = cy + dr, gc = cx + dc;
          if (gr >= 0 && gr < GRID && gc >= 0 && gc < GRID) {
            t++;
            if (isSea[gr * GRID + gc]) s++;
          }
        }
        seaCorner[cy * csz + cx] = t > 0 ? s / t : 0;
      }
    }

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const vTL = seaCorner[r * csz + c];
        const vTR = seaCorner[r * csz + c + 1];
        const vBR = seaCorner[(r + 1) * csz + c + 1];
        const vBL = seaCorner[(r + 1) * csz + c];

        const caseIdx = (vTL >= TH ? 8 : 0) | (vTR >= TH ? 4 : 0)
                      | (vBR >= TH ? 2 : 0) | (vBL >= TH ? 1 : 0);
        const tris = MS_TRI[caseIdx];
        if (tris.length === 0) continue;

        // 8 vertex positions in grid space [col, row]
        const tX = msLerp(c, c + 1, vTL, vTR);
        const rZ = msLerp(r, r + 1, vTR, vBR);
        const bX = msLerp(c, c + 1, vBL, vBR);
        const lZ = msLerp(r, r + 1, vTL, vBL);

        const vx = [c, c + 1, c + 1, c, tX, c + 1, bX, c];
        const vz = [r, r, r + 1, r + 1, r, rZ, r + 1, lZ];

        for (let i = 0; i < tris.length; i += 3) {
          pushVert(vx[tris[i]] - HALF, seaY, vz[tris[i]] - HALF);
          pushVert(vx[tris[i + 1]] - HALF, seaY, vz[tris[i + 1]] - HALF);
          pushVert(vx[tris[i + 2]] - HALF, seaY, vz[tris[i + 2]] - HALF);
        }
      }
    }
  }

  // ── River mesh: marching squares for smooth edges ──
  if (riverCells.length > 0) {
    const isRiver = new Uint8Array(GRID * GRID);
    for (const [r, c] of riverCells) isRiver[r * GRID + c] = 1;

    const csz = GRID + 1;
    const riverCorner = new Float32Array(csz * csz);
    for (let cy = 0; cy <= GRID; cy++) {
      for (let cx = 0; cx <= GRID; cx++) {
        let s = 0, t = 0;
        for (const [dr, dc] of CELL_OFFSETS) {
          const gr = cy + dr, gc = cx + dc;
          if (gr >= 0 && gr < GRID && gc >= 0 && gc < GRID) {
            t++;
            if (isRiver[gr * GRID + gc]) s++;
          }
        }
        riverCorner[cy * csz + cx] = t > 0 ? s / t : 0;
      }
    }

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const vTL = riverCorner[r * csz + c];
        const vTR = riverCorner[r * csz + c + 1];
        const vBR = riverCorner[(r + 1) * csz + c + 1];
        const vBL = riverCorner[(r + 1) * csz + c];

        const caseIdx = (vTL >= TH ? 8 : 0) | (vTR >= TH ? 4 : 0)
                      | (vBR >= TH ? 2 : 0) | (vBL >= TH ? 1 : 0);
        const tris = MS_TRI[caseIdx];
        if (tris.length === 0) continue;

        const tX = msLerp(c, c + 1, vTL, vTR);
        const rZ = msLerp(r, r + 1, vTR, vBR);
        const bX = msLerp(c, c + 1, vBL, vBR);
        const lZ = msLerp(r, r + 1, vTL, vBL);

        const vx = [c, c + 1, c + 1, c, tX, c + 1, bX, c];
        const vz = [r, r, r + 1, r + 1, r, rZ, r + 1, lZ];

        for (let i = 0; i < tris.length; i += 3) {
          for (let j = 0; j < 3; j++) {
            const px = vx[tris[i + j]];
            const pz = vz[tris[i + j]];
            const y = getElevAt(pz, px) + RIVER_OFFSET;
            pushVert(px - HALF, y, pz - HALF);
          }
        }
      }
    }
  }

  const positions = new Float32Array(allPositions);
  const normals = new Float32Array(allNormals);
  const uvs = new Float32Array(allUvs);

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  // Procedural normal map
  const normalMap = createWaterNormalMap();

  const waterUniforms = {
    normalMap: { value: normalMap },
    time: { value: 0 },
    sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    waterColor: { value: new THREE.Color(0x1a5566) },
    skyColor: { value: new THREE.Color(0x88aacc) },
    fogColor: { value: new THREE.Color(0x88aacc) },
    fogNear: { value: 60 },
    fogFar: { value: 140 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: waterUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;

  const tmpColor = new THREE.Color();

  function update(env: Environment, sunDirection: THREE.Vector3, fogColor: THREE.Color): void {
    const time = performance.now() * 0.001;
    waterUniforms.time.value = time;
    waterUniforms.sunDirection.value.copy(sunDirection);
    waterUniforms.fogColor.value.copy(fogColor);

    const s0 = SEASON_WATER[env.season];
    const s1 = SEASON_WATER[(env.season + 1) % 4];
    const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;

    tmpColor.setHSL(
      s0.bodyH + (s1.bodyH - s0.bodyH) * t,
      s0.bodyS + (s1.bodyS - s0.bodyS) * t,
      s0.bodyL + (s1.bodyL - s0.bodyL) * t,
    );
    waterUniforms.waterColor.value.copy(tmpColor);

    tmpColor.setHSL(
      s0.skyH + (s1.skyH - s0.skyH) * t,
      s0.skyS + (s1.skyS - s0.skyS) * t,
      s0.skyL + (s1.skyL - s0.skyL) * t,
    );
    waterUniforms.skyColor.value.copy(tmpColor);
  }

  return { mesh, update };
}
