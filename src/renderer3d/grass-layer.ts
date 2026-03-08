import * as THREE from 'three';
import { GRID_WIDTH, WeatherOverlay } from '../types';
import { RendererState, GRID, HALF, plantHash, easeOutCubic, lerp } from './state';
import { computePlantTint } from './plant-colors';
import { classifySubtype, subtypeArchetype } from '../types/subtypes';

// ── Constants ──

const BLADES_PER_CELL = 48;
const TOTAL_BLADES = GRID * GRID * BLADES_PER_CELL;
const VERTS_PER_BLADE = 4;               // quad: bottom-left, bottom-right, top-left, top-right
const TRIS_PER_BLADE = 2;
const INDICES_PER_BLADE = TRIS_PER_BLADE * 3;  // 6
const TOTAL_VERTS = TOTAL_BLADES * VERTS_PER_BLADE;

// Distance fade parameters (world units)
const FADE_START = 35.0;
const FADE_END = 50.0;

// Per-subtype blade heights at full growth (world units)
const SUBTYPE_BLADE_HEIGHT: number[] = [
  0.12,  // 0: Turfgrass
  0.25,  // 1: Tallgrass
  0.16,  // 2: Bunchgrass
  0.08,  // 3: Bamboo
  0.08,  // 4: Spreading
  0.20,  // 5: Sedge
];

export interface GrassLayer {
  mesh: THREE.Mesh;
  updateCellData: (state: RendererState) => void;
  updateUniforms: (time: number, sunDir: THREE.Vector3, fogColor: THREE.Color, camera: THREE.Camera) => void;
  rebuildElevation: (getCellElevation: (cx: number, cy: number) => number) => void;
}

// ── Shaders ──

const grassVertexShader = /* glsl */`
  uniform sampler2D uCellData;
  uniform sampler2D uElevation;
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec3 uCameraPos;
  uniform float uFadeStart;
  uniform float uFadeEnd;

  attribute vec2 aCellCoord;
  attribute vec2 aLocalOffset;
  attribute float aYaw;
  attribute float aHeightVar;
  attribute float aBladeWidth;
  attribute float aVertexId;

  varying float vHeight01;
  varying vec3 vTint;
  varying vec3 vWorldPos;

  void main() {
    // World XZ position (grid → world coords) at the blade's actual position
    float wx = aCellCoord.x + aLocalOffset.x - ${HALF.toFixed(1)} + 0.5;
    float wz = aCellCoord.y + aLocalOffset.y - ${HALF.toFixed(1)} + 0.5;

    // Distance fade — cull distant blades early
    float dist = length(vec2(wx, wz) - uCameraPos.xz);
    if (dist > uFadeEnd) {
      gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      vHeight01 = 0.0;
      vTint = vec3(0.0);
      vWorldPos = vec3(0.0);
      return;
    }
    float fadeFactor = 1.0 - smoothstep(uFadeStart, uFadeEnd, dist);

    // Sample cell data at blade's actual world position (bilinear-filtered)
    vec2 cellUV = (vec2(wx, wz) + ${HALF.toFixed(1)}) / ${GRID.toFixed(1)};
    vec4 cellData = texture2D(uCellData, cellUV);
    float bladeHeight = cellData.r;
    vTint = cellData.gba;

    // Collapse to degenerate triangle if no grass
    if (bladeHeight < 0.001) {
      gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      vHeight01 = 0.0;
      vWorldPos = vec3(0.0);
      return;
    }

    // Sample elevation at blade's actual world position (bilinear-filtered)
    float elev = texture2D(uElevation, cellUV).r;

    // Blade height with per-blade variation and distance fade
    float h = bladeHeight * aHeightVar * fadeFactor;

    // Vertex ID: 0=bottom-left, 1=bottom-right, 2=top-left, 3=top-right (tip)
    float vid = aVertexId;
    float isTop = step(1.5, vid); // 1.0 for top verts (2,3), 0.0 for bottom verts (0,1)

    // Yaw direction vectors
    float cy = cos(aYaw);
    float sy = sin(aYaw);
    float perpX = -sy;
    float perpZ = cy;

    // Side offset: 0=left(-1), 1=right(+1), 2=left(-1 tapered), 3=right(+1 tapered)
    float isLeft = 1.0 - 2.0 * step(0.5, mod(vid, 2.0)); // -1 for even(left), +1 for odd(right)
    // Taper: top verts are narrower (degenerate at very tip for natural look)
    float taper = mix(1.0, 0.15, isTop);
    float baseOffX = perpX * aBladeWidth * isLeft * taper;
    float baseOffZ = perpZ * aBladeWidth * isLeft * taper;

    // Tip: slightly lean in yaw direction for natural look
    float tipLean = 0.03 * h;
    float tipOffX = cy * tipLean * isTop;
    float tipOffZ = sy * tipLean * isTop;

    // Wind: only affects top vertices
    float windPhase = wx * 1.5 + wz * 1.3 + uTime * 2.5;
    float windBend = sin(windPhase) * uWindStrength * h * isTop;
    float windBend2 = sin(wx * 0.7 - wz * 1.1 + uTime * 1.8) * uWindStrength * 0.3 * h * isTop;

    // Final position
    float finalX = wx + baseOffX + tipOffX + windBend * 0.7 + windBend2 * 0.3;
    float finalZ = wz + baseOffZ + tipOffZ + windBend * 0.3 + windBend2 * 0.7;
    float finalY = elev + 0.005 + h * isTop;

    vec3 worldPos = vec3(finalX, finalY, finalZ);
    vWorldPos = worldPos;
    vHeight01 = isTop;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const grassFragmentShader = /* glsl */`
  uniform vec3 uSunDirection;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying float vHeight01;
  varying vec3 vTint;
  varying vec3 vWorldPos;

  void main() {
    // Fake AO: darken blade base
    float ao = mix(0.5, 1.0, vHeight01);

    // Approximate blade normal (pointing up + slightly outward)
    vec3 bladeNormal = normalize(vec3(0.0, 1.0, 0.0));

    // Diffuse lighting
    float NdotL = max(dot(bladeNormal, uSunDirection), 0.0);
    float diffuse = 0.55 + NdotL * 0.45;

    // Base grass green, modulated by tint multiplier
    vec3 baseGreen = vec3(0.28, 0.52, 0.18);
    vec3 color = baseGreen * vTint * ao * diffuse;

    // Fog
    float fogDepth = length(vWorldPos - cameraPosition);
    float fogFactor = smoothstep(uFogNear, uFogFar, fogDepth);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Factory ──

export function createGrassLayer(
  getCellElevation: (cx: number, cy: number) => number,
): GrassLayer {
  // ── Build indexed geometry ──
  const positions = new Float32Array(TOTAL_VERTS * 3);
  const cellCoords = new Float32Array(TOTAL_VERTS * 2);
  const localOffsets = new Float32Array(TOTAL_VERTS * 2);
  const yaws = new Float32Array(TOTAL_VERTS);
  const heightVars = new Float32Array(TOTAL_VERTS);
  const bladeWidths = new Float32Array(TOTAL_VERTS);
  const vertexIds = new Float32Array(TOTAL_VERTS);
  const indices = new Uint32Array(TOTAL_BLADES * INDICES_PER_BLADE);

  let vi = 0; // vertex index
  let ii = 0; // index index
  for (let cy = 0; cy < GRID; cy++) {
    for (let cx = 0; cx < GRID; cx++) {
      const cellIdx = cy * GRID + cx;
      for (let b = 0; b < BLADES_PER_CELL; b++) {
        const ox = (plantHash(cellIdx, 100 + b) - 0.5) * 1.6;  // ±0.8
        const oz = (plantHash(cellIdx, 200 + b) - 0.5) * 1.6;
        const yaw = plantHash(cellIdx, 300 + b) * Math.PI * 2;
        const hv = 0.7 + plantHash(cellIdx, 400 + b) * 0.6;    // [0.7, 1.3]
        const bw = 0.03 + plantHash(cellIdx, 500 + b) * 0.04;  // [0.03, 0.07]

        const baseVert = vi;
        // 4 vertices per blade quad
        for (let v = 0; v < VERTS_PER_BLADE; v++) {
          const idx2 = vi * 2;
          cellCoords[idx2] = cx;
          cellCoords[idx2 + 1] = cy;
          localOffsets[idx2] = ox;
          localOffsets[idx2 + 1] = oz;
          yaws[vi] = yaw;
          heightVars[vi] = hv;
          bladeWidths[vi] = bw;
          vertexIds[vi] = v;  // 0=BL, 1=BR, 2=TL, 3=TR
          vi++;
        }

        // Two triangles: BL-BR-TL, BR-TR-TL
        indices[ii++] = baseVert + 0;
        indices[ii++] = baseVert + 1;
        indices[ii++] = baseVert + 2;
        indices[ii++] = baseVert + 1;
        indices[ii++] = baseVert + 3;
        indices[ii++] = baseVert + 2;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aCellCoord', new THREE.BufferAttribute(cellCoords, 2));
  geometry.setAttribute('aLocalOffset', new THREE.BufferAttribute(localOffsets, 2));
  geometry.setAttribute('aYaw', new THREE.BufferAttribute(yaws, 1));
  geometry.setAttribute('aHeightVar', new THREE.BufferAttribute(heightVars, 1));
  geometry.setAttribute('aBladeWidth', new THREE.BufferAttribute(bladeWidths, 1));
  geometry.setAttribute('aVertexId', new THREE.BufferAttribute(vertexIds, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  // ── DataTextures (bilinear filtered for smooth cross-cell blending) ──
  const cellDataArray = new Float32Array(GRID * GRID * 4);
  const cellDataTex = new THREE.DataTexture(
    cellDataArray, GRID, GRID,
    THREE.RGBAFormat, THREE.FloatType,
  );
  cellDataTex.minFilter = THREE.LinearFilter;
  cellDataTex.magFilter = THREE.LinearFilter;
  cellDataTex.needsUpdate = true;

  const elevArray = new Float32Array(GRID * GRID * 4); // RGBA but we only use R
  const elevTex = new THREE.DataTexture(
    elevArray, GRID, GRID,
    THREE.RGBAFormat, THREE.FloatType,
  );
  elevTex.minFilter = THREE.LinearFilter;
  elevTex.magFilter = THREE.LinearFilter;

  // Fill initial elevation
  fillElevation(elevArray, getCellElevation);
  elevTex.needsUpdate = true;

  // ── Uniforms ──
  const uniforms = {
    uCellData: { value: cellDataTex },
    uElevation: { value: elevTex },
    uTime: { value: 0 },
    uWindStrength: { value: 0.15 },
    uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
    uFogColor: { value: new THREE.Color(0x88aacc) },
    uFogNear: { value: 60 },
    uFogFar: { value: 140 },
    uCameraPos: { value: new THREE.Vector3() },
    uFadeStart: { value: FADE_START },
    uFadeEnd: { value: FADE_END },
  };

  // ── Material ──
  const material = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    uniforms,
    side: THREE.DoubleSide,
    fog: false,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  // ── Track dirty state to skip redundant updates ──
  let lastTick = -1;
  let lastColorMode = '';
  let lastHighlightedSpecies: Set<number> | null = null;
  let lastHighlightedLineageRoot: number | null = null;

  // ── updateCellData: per-tick CPU update ──
  function updateCellData(state: RendererState): void {
    const { world } = state;

    // Check if update is needed
    const tickChanged = world.tick !== lastTick;
    const colorModeChanged = state.colorMode !== lastColorMode;
    const highlightChanged = state.highlightedSpecies !== lastHighlightedSpecies
      || state.highlightedLineageRoot !== lastHighlightedLineageRoot;

    if (!tickChanged && !colorModeChanged && !highlightChanged && !state.plantsDirty) return;

    lastTick = world.tick;
    lastColorMode = state.colorMode;
    lastHighlightedSpecies = state.highlightedSpecies;
    lastHighlightedLineageRoot = state.highlightedLineageRoot;

    // Clear all cell data
    cellDataArray.fill(0);

    const env = world.environment;
    const { growingPlants, maturityHeights } = state;

    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;

      // Only grass archetype (subtypes 0-5)
      const subtype = world.speciesSubtypes?.get(plant.speciesId)
        ?? classifySubtype(plant.genome);
      if (subtypeArchetype(subtype) !== 0) continue;

      const matH = maturityHeights[subtype];

      // Growth animation scale
      let growScale = 1.0;
      const growing = growingPlants.get(plant.id);
      if (growing) {
        if (growing.progress < 0) {
          growScale = 0;
        } else if (growing.progress < 1) {
          growScale = Math.max(0.05, easeOutCubic(growing.progress));
        }
      }

      const bladeHeight = SUBTYPE_BLADE_HEIGHT[subtype] * (plant.height / matH) * growScale;

      // Compute tint (reuses same cache as accent plants)
      const tint = computePlantTint(
        state, plant.id, plant.speciesId, plant.genome,
        0, // archetype = grass
        env,
      );

      let { r: tr, g: tg, b: tb } = tint;

      // Disease overlay
      if (env.weatherOverlay[plant.y * GRID_WIDTH + plant.x] === WeatherOverlay.Diseased) {
        tr = lerp(tr, 0.55, 0.4);
        tg = lerp(tg, 0.50, 0.4);
        tb = lerp(tb, 0.15, 0.4);
      }

      // Highlighted species/lineage glow / dim
      if (state.highlightedLineageRoot !== null) {
        if (plant.lineageRoot === state.highlightedLineageRoot) {
          tr = Math.min(tr * 1.4, 1.5);
          tg = Math.min(tg * 1.4, 1.5);
          tb = Math.min(tb * 1.4, 1.5);
        } else {
          tr *= 0.55; tg *= 0.55; tb *= 0.55;
        }
      } else if (state.highlightedSpecies !== null) {
        if (state.highlightedSpecies.has(plant.speciesId)) {
          tr = Math.min(tr * 1.4, 1.5);
          tg = Math.min(tg * 1.4, 1.5);
          tb = Math.min(tb * 1.4, 1.5);
        } else {
          tr *= 0.55; tg *= 0.55; tb *= 0.55;
        }
      }

      const offset = (plant.y * GRID + plant.x) * 4;
      cellDataArray[offset] = bladeHeight;
      cellDataArray[offset + 1] = tr;
      cellDataArray[offset + 2] = tg;
      cellDataArray[offset + 3] = tb;
    }

    cellDataTex.needsUpdate = true;
  }

  // ── updateUniforms: per-frame ──
  function updateUniforms(time: number, sunDir: THREE.Vector3, fogColor: THREE.Color, camera: THREE.Camera): void {
    uniforms.uTime.value = time;
    uniforms.uSunDirection.value.copy(sunDir);
    uniforms.uFogColor.value.copy(fogColor);
    uniforms.uCameraPos.value.copy(camera.position);
  }

  // ── rebuildElevation: on terrain rebuild ──
  function rebuildElevation(newGetCellElevation: (cx: number, cy: number) => number): void {
    fillElevation(elevArray, newGetCellElevation);
    elevTex.needsUpdate = true;
    // Force cell data refresh on next tick
    lastTick = -1;
  }

  return { mesh, updateCellData, updateUniforms, rebuildElevation };
}

// ── Helpers ──

function fillElevation(
  arr: Float32Array,
  getCellElevation: (cx: number, cy: number) => number,
): void {
  for (let cy = 0; cy < GRID; cy++) {
    for (let cx = 0; cx < GRID; cx++) {
      const offset = (cy * GRID + cx) * 4;
      arr[offset] = getCellElevation(cx, cy);
      arr[offset + 1] = 0;
      arr[offset + 2] = 0;
      arr[offset + 3] = 1;
    }
  }
}
