import * as THREE from 'three';
import { World, TerrainType, Environment } from '../types';
import { GRID, HALF, ELEV_SCALE } from './state';
import { createWaterNormalMap } from './water-normals';

export interface WaterSurface {
  mesh: THREE.Mesh;
  update: (env: Environment, sunDirection: THREE.Vector3, fogColor: THREE.Color) => void;
}

const WATER_OFFSET = 0.45;

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
  // ── Step 1: Collect river cells and find connected components via BFS ──
  const riverCells: [number, number][] = [];
  const visited = new Uint8Array(GRID * GRID);

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (world.grid[row][col].terrainType === TerrainType.River) {
        riverCells.push([row, col]);
      }
    }
  }

  if (riverCells.length === 0) {
    const emptyGeo = new THREE.BufferGeometry();
    const emptyMesh = new THREE.Mesh(emptyGeo);
    emptyMesh.visible = false;
    return { mesh: emptyMesh, update: () => {} };
  }

  // BFS to find connected river components
  const components: [number, number][][] = [];
  for (const [r, c] of riverCells) {
    if (visited[r * GRID + c]) continue;
    const comp: [number, number][] = [];
    const queue: [number, number][] = [[r, c]];
    visited[r * GRID + c] = 1;
    while (queue.length > 0) {
      const [cr, cc] = queue.pop()!;
      comp.push([cr, cc]);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = cr + dr, nc = cc + dc;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID
          && !visited[nr * GRID + nc]
          && world.grid[nr][nc].terrainType === TerrainType.River) {
          visited[nr * GRID + nc] = 1;
          queue.push([nr, nc]);
        }
      }
    }
    components.push(comp);
  }

  // ── Corner elevation helper (shared across components) ──
  const cornerSize = GRID + 1;
  const corners = new Float32Array(cornerSize * cornerSize);
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
      corners[cy * cornerSize + cx] = (sum / count) * ELEV_SCALE;
    }
  }

  // Bilinear elevation interpolation at arbitrary (row, col) — fractional coords in grid space
  function getElevAt(row: number, col: number): number {
    const cx = Math.max(0, Math.min(GRID, col));
    const cy = Math.max(0, Math.min(GRID, row));
    const ix = Math.min(Math.floor(cx), GRID - 1);
    const iy = Math.min(Math.floor(cy), GRID - 1);
    const fx = cx - ix;
    const fy = cy - iy;
    const e00 = corners[iy * cornerSize + ix];
    const e10 = corners[iy * cornerSize + ix + 1];
    const e01 = corners[(iy + 1) * cornerSize + ix];
    const e11 = corners[(iy + 1) * cornerSize + ix + 1];
    return e00 * (1 - fx) * (1 - fy) + e10 * fx * (1 - fy)
      + e01 * (1 - fx) * fy + e11 * fx * fy;
  }

  // ── Step 2–4: Build ribbon geometry for each component ──
  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const allUvs: number[] = [];

  function pushVert(x: number, y: number, z: number, u: number, v: number): void {
    allPositions.push(x, y, z);
    allNormals.push(0, 1, 0);
    allUvs.push(u, v);
  }

  for (const comp of components) {
    // ── Step 2: Determine primary axis and extract centerline ──
    let minRow = GRID, maxRow = 0, minCol = GRID, maxCol = 0;
    for (const [r, c] of comp) {
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
      if (c < minCol) minCol = c;
      if (c > maxCol) maxCol = c;
    }

    const colExtent = maxCol - minCol;
    const rowExtent = maxRow - minRow;
    const horizontal = colExtent >= rowExtent;

    // Group cells by primary axis coordinate
    const groups = new Map<number, number[]>();
    for (const [r, c] of comp) {
      const key = horizontal ? c : r;
      const perp = horizontal ? r : c;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(perp);
    }

    // Sort by primary axis and compute centroid + halfWidth per group
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);
    const centerPoints: THREE.Vector3[] = [];
    const halfWidths: number[] = [];

    for (const key of sortedKeys) {
      const perps = groups.get(key)!;
      const minP = Math.min(...perps);
      const maxP = Math.max(...perps);
      const centroid = (minP + maxP) / 2 + 0.5; // center of cell range
      const hw = (maxP - minP + 1) / 2;

      if (horizontal) {
        centerPoints.push(new THREE.Vector3(key + 0.5, 0, centroid));
      } else {
        centerPoints.push(new THREE.Vector3(centroid, 0, key + 0.5));
      }
      halfWidths.push(hw);
    }

    if (centerPoints.length < 2) continue;

    // ── Step 3: Smooth halfWidths and extrapolate ends ──
    const smoothed = halfWidths.slice();
    for (let pass = 0; pass < 5; pass++) {
      const tmp = smoothed.slice();
      for (let i = 1; i < tmp.length - 1; i++) {
        smoothed[i] = (tmp[i - 1] + tmp[i] + tmp[i + 1]) / 3;
      }
    }

    // Extrapolate 2 points at each end along first/last tangent
    const firstPt = centerPoints[0];
    const secondPt = centerPoints[1];
    const lastPt = centerPoints[centerPoints.length - 1];
    const prevLastPt = centerPoints[centerPoints.length - 2];

    const startTan = new THREE.Vector3().subVectors(secondPt, firstPt).normalize();
    const endTan = new THREE.Vector3().subVectors(lastPt, prevLastPt).normalize();

    for (let i = 2; i >= 1; i--) {
      centerPoints.unshift(new THREE.Vector3(
        firstPt.x - startTan.x * i, 0, firstPt.z - startTan.z * i,
      ));
      smoothed.unshift(smoothed[0]);
    }
    for (let i = 1; i <= 2; i++) {
      centerPoints.push(new THREE.Vector3(
        lastPt.x + endTan.x * i, 0, lastPt.z + endTan.z * i,
      ));
      smoothed.push(smoothed[smoothed.length - 1]);
    }

    // Build spline through all points
    const spline = new THREE.CatmullRomCurve3(centerPoints, false, 'catmullrom', 0.5);

    // ── Step 4: Sample spline → ribbon geometry ──
    const N = Math.max(centerPoints.length * 4, 80);

    type CrossSection = { x: number; z: number; perpX: number; perpZ: number; hw: number; elev: number };
    const sections: CrossSection[] = [];
    const tmpPos = new THREE.Vector3();
    const tmpTan = new THREE.Vector3();

    for (let i = 0; i <= N; i++) {
      const t = i / N;
      spline.getPoint(t, tmpPos);
      spline.getTangent(t, tmpTan);

      const perpX = -tmpTan.z;
      const perpZ = tmpTan.x;
      const pLen = Math.sqrt(perpX * perpX + perpZ * perpZ) || 1;

      const fIdx = t * (smoothed.length - 1);
      const iIdx = Math.min(Math.floor(fIdx), smoothed.length - 2);
      const frac = fIdx - iIdx;
      const hw = smoothed[iIdx] * (1 - frac) + smoothed[iIdx + 1] * frac;

      const elev = getElevAt(tmpPos.z, tmpPos.x) + WATER_OFFSET;

      sections.push({
        x: tmpPos.x, z: tmpPos.z,
        perpX: perpX / pLen, perpZ: perpZ / pLen,
        hw, elev,
      });
    }

    // Generate ribbon: 1 quad per segment (left bank → right bank)
    for (let i = 0; i < sections.length - 1; i++) {
      const s0 = sections[i];
      const s1 = sections[i + 1];

      const l0x = s0.x + s0.perpX * s0.hw - HALF;
      const l0z = s0.z + s0.perpZ * s0.hw - HALF;
      const r0x = s0.x - s0.perpX * s0.hw - HALF;
      const r0z = s0.z - s0.perpZ * s0.hw - HALF;

      const l1x = s1.x + s1.perpX * s1.hw - HALF;
      const l1z = s1.z + s1.perpZ * s1.hw - HALF;
      const r1x = s1.x - s1.perpX * s1.hw - HALF;
      const r1z = s1.z - s1.perpZ * s1.hw - HALF;

      const e0 = s0.elev;
      const e1 = s1.elev;

      // Quad: 2 triangles
      pushVert(l0x, e0, l0z, 0, 0);
      pushVert(r0x, e0, r0z, 0, 0);
      pushVert(l1x, e1, l1z, 0, 0);
      pushVert(r0x, e0, r0z, 0, 0);
      pushVert(r1x, e1, r1z, 0, 0);
      pushVert(l1x, e1, l1z, 0, 0);
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
