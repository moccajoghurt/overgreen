import * as THREE from 'three';
import { World, TerrainType, Environment } from '../types';
import { GRID, HALF, ELEV_SCALE } from './state';
import { createWaterNormalMap } from './water-normals';

export interface WaterSurface {
  mesh: THREE.Mesh;
  update: (env: Environment, sunDirection: THREE.Vector3, fogColor: THREE.Color) => void;
}

const WATER_OFFSET = 0.08;

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

    // Fog
    float fogDepth = length(vWorldPos - cameraPosition);
    float fogFactor = smoothstep(fogNear, fogFar, fogDepth);
    finalColor = mix(finalColor, fogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 0.75);
  }
`;

export function createWaterSurface(world: World): WaterSurface {
  // Count river cells
  let riverCellCount = 0;
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (world.grid[row][col].terrainType === TerrainType.River) {
        riverCellCount++;
      }
    }
  }

  if (riverCellCount === 0) {
    const emptyGeo = new THREE.BufferGeometry();
    const emptyMesh = new THREE.Mesh(emptyGeo);
    emptyMesh.visible = false;
    return { mesh: emptyMesh, update: () => {} };
  }

  // Build geometry: 6 vertices (2 triangles) per river cell
  const vertCount = riverCellCount * 6;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  // Corner elevation helper
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

  let vi = 0;
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (world.grid[row][col].terrainType !== TerrainType.River) continue;

      const x0 = col - HALF;
      const x1 = col - HALF + 1;
      const z0 = row - HALF;
      const z1 = row - HALF + 1;

      const eTL = corners[row * cornerSize + col] + WATER_OFFSET;
      const eTR = corners[row * cornerSize + col + 1] + WATER_OFFSET;
      const eBL = corners[(row + 1) * cornerSize + col] + WATER_OFFSET;
      const eBR = corners[(row + 1) * cornerSize + col + 1] + WATER_OFFSET;

      // Triangle 1: TL, BL, TR
      setVertex(vi++, x0, eTL, z0, col / GRID, row / GRID);
      setVertex(vi++, x0, eBL, z1, col / GRID, (row + 1) / GRID);
      setVertex(vi++, x1, eTR, z0, (col + 1) / GRID, row / GRID);

      // Triangle 2: BL, BR, TR
      setVertex(vi++, x0, eBL, z1, col / GRID, (row + 1) / GRID);
      setVertex(vi++, x1, eBR, z1, (col + 1) / GRID, (row + 1) / GRID);
      setVertex(vi++, x1, eTR, z0, (col + 1) / GRID, row / GRID);
    }
  }

  function setVertex(idx: number, x: number, y: number, z: number, u: number, v: number): void {
    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;
    normals[idx * 3] = 0;
    normals[idx * 3 + 1] = 1;
    normals[idx * 3 + 2] = 0;
    uvs[idx * 2] = u;
    uvs[idx * 2 + 1] = v;
  }

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
    fog: false, // We handle fog manually in the shader
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;

  const tmpColor = new THREE.Color();

  function update(env: Environment, sunDirection: THREE.Vector3, fogColor: THREE.Color): void {
    const time = performance.now() * 0.001;
    waterUniforms.time.value = time;

    // Update sun direction
    waterUniforms.sunDirection.value.copy(sunDirection);

    // Update fog color
    waterUniforms.fogColor.value.copy(fogColor);

    // Seasonal water color interpolation
    const s0 = SEASON_WATER[env.season];
    const s1 = SEASON_WATER[(env.season + 1) % 4];
    const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;

    // Body color
    tmpColor.setHSL(
      s0.bodyH + (s1.bodyH - s0.bodyH) * t,
      s0.bodyS + (s1.bodyS - s0.bodyS) * t,
      s0.bodyL + (s1.bodyL - s0.bodyL) * t,
    );
    waterUniforms.waterColor.value.copy(tmpColor);

    // Sky reflection color
    tmpColor.setHSL(
      s0.skyH + (s1.skyH - s0.skyH) * t,
      s0.skyS + (s1.skyS - s0.skyS) * t,
      s0.skyL + (s1.skyL - s0.skyL) * t,
    );
    waterUniforms.skyColor.value.copy(tmpColor);
  }

  return { mesh, update };
}
