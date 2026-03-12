import * as THREE from 'three';
import { GRID_WIDTH, TERRAIN_PROPS, WeatherOverlay } from '../types';
import { isHeatmapMode } from '../types/renderer';
import { RendererState, GRID, HALF, plantHash, easeOutCubic, lerp } from './state';
import { computePlantTint } from './plant-colors';
import { classifySubtype, SHADER_GRASS_SUBTYPES } from '../types/subtypes';
import { normalizeResource, heatmapColor, fertilityValue } from './heatmap-colors';

// ── Constants ──

const BLADES_PER_CELL = 96;
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
  0.22,  // 0: Turfgrass — short lawn
  0.55,  // 1: Tallgrass — tall prairie grass
  0.35,  // 2: Bunchgrass — medium bunchy
  0.16,  // 3: Bamboo — low ground cover
  0.14,  // 4: Spreading/Ryegrass — carpet-like
  0.40,  // 5: Sedge — medium-tall
];

// Per-subtype color tint multipliers — bold hue shifts so each grass species
// is visually distinct even at full zoom-out (~20+ degree hue separation)
const SUBTYPE_COLOR_TINT: [number, number, number][] = [
  [1.05, 1.08, 0.55],  // 0: Turfgrass — warm green lawn
  [1.45, 0.95, 0.35],  // 1: Tallgrass — golden prairie
  [0.55, 0.75, 0.50],  // 2: Bunchgrass — dark forest green
  [0.65, 1.25, 0.50],  // 3: Bamboo — fresh bamboo green
  [0.50, 1.40, 1.15],  // 4: Spreading/Ryegrass — cool blue-green
  [1.80, 0.65, 0.25],  // 5: Sedge — rusty bronze-green
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
  varying float vBladeRand;

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

    // Sample cell data at blade's world position with linear filter
    // Blades near species boundaries get smoothly blended colors
    vec2 bladeUV = (vec2(wx, wz) + ${HALF.toFixed(1)}) / ${GRID.toFixed(1)};
    vec4 cellData = texture2D(uCellData, bladeUV);
    float bladeHeight = cellData.r;
    vTint = cellData.gba;

    // Collapse to degenerate triangle if no/very sparse grass
    // (linear filter creates partial values at patch edges)
    if (bladeHeight < 0.015) {
      gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      vHeight01 = 0.0;
      vWorldPos = vec3(0.0);
      return;
    }

    // Sample elevation at blade world position (bilinear → smooth terrain)
    float elev = texture2D(uElevation, bladeUV).r;

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

    // Camera-facing flip: if blade normal faces away from camera, reverse winding
    // This gives full blade density with FrontSide (no DoubleSide perf cost)
    vec2 toCamera2D = uCameraPos.xz - vec2(wx, wz);
    float faceDot = perpX * toCamera2D.x + perpZ * toCamera2D.y;
    float flipSign = step(0.0, faceDot) * 2.0 - 1.0;

    // Side offset: 0=left(-1), 1=right(+1), flipped when facing away from camera
    float isLeft = flipSign * (1.0 - 2.0 * step(0.5, mod(vid, 2.0)));
    // Taper: top verts narrower but retain width for leaf-like blade shape
    float taper = mix(1.0, 0.3, isTop);
    float baseOffX = perpX * aBladeWidth * isLeft * taper;
    float baseOffZ = perpZ * aBladeWidth * isLeft * taper;

    // Prevailing wind lean: all blades share a directional bias
    // plus per-blade random lean for organic variation
    float leanAmount = (0.08 + aHeightVar * 0.08) * h;
    float prevailingLeanX = 0.12 * h; // slight consistent lean in +X direction
    float prevailingLeanZ = 0.06 * h; // slight consistent lean in +Z direction
    float tipOffX = cy * leanAmount * isTop + prevailingLeanX * isTop;
    float tipOffZ = sy * leanAmount * isTop + prevailingLeanZ * isTop;

    // Wind: only affects top vertices
    float windPhase = wx * 1.5 + wz * 1.3 + uTime * 2.5;
    float windBend = sin(windPhase) * uWindStrength * h * isTop;
    float windBend2 = sin(wx * 0.7 - wz * 1.1 + uTime * 1.8) * uWindStrength * 0.3 * h * isTop;

    // Final position
    float finalX = wx + baseOffX + tipOffX + windBend * 0.7 + windBend2 * 0.3;
    float finalZ = wz + baseOffZ + tipOffZ + windBend * 0.3 + windBend2 * 0.7;
    // Sink base slightly below terrain so blades emerge FROM ground
    float finalY = elev - 0.01 + (h + 0.015) * isTop;

    vec3 worldPos = vec3(finalX, finalY, finalZ);
    vWorldPos = worldPos;
    vHeight01 = isTop;
    // Per-blade random (0-1) for color variation in fragment shader
    vBladeRand = fract(aHeightVar * 3.7 + aYaw * 1.3);

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const grassFragmentShader = /* glsl */`
  uniform vec3 uSunDirection;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uHeatmap;

  varying float vHeight01;
  varying vec3 vTint;
  varying vec3 vWorldPos;
  varying float vBladeRand;

  void main() {
    // Subtle alpha fade at blade base — soft ground transition
    float alpha = smoothstep(0.0, 0.14, vHeight01);
    if (alpha < 0.05) discard;

    // Very gentle AO: minor darkening at ground contact only
    float ao = mix(0.88, 1.0, smoothstep(0.0, 0.25, vHeight01));

    // Wrap-around diffuse: half-Lambert so blades are never dark
    vec3 bladeNormal = normalize(vec3(0.0, 1.0, 0.0));
    float NdotL = dot(bladeNormal, uSunDirection) * 0.5 + 0.5;
    float diffuse = 0.85 + NdotL * 0.15;

    vec3 color;

    if (uHeatmap > 0.5) {
      // Heatmap mode: use vTint directly as the color (pure resource gradient)
      color = vTint * ao * diffuse;
    } else {
    // Translucency: sunlight shining through thin blades
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float backLight = max(dot(-viewDir, uSunDirection), 0.0);
    float translucency = pow(backLight, 3.0) * 0.30 * vHeight01;
    diffuse += translucency;

    // Bright tips catching sunlight
    float tipBrightness = mix(1.0, 1.12, vHeight01);

    // Landscape-scale brightness variation (~5 cell period)
    float brightnessMod = 1.0 + sin(vWorldPos.x * 0.22 + 1.3) * sin(vWorldPos.z * 0.18 + 0.7) * 0.15;

    // Landscape-scale hue patches (~2-3 cell period) for visible tuft-level variation
    float patchNoise = sin(vWorldPos.x * 1.8 + 0.5) * sin(vWorldPos.z * 2.1 + 1.2);
    float patchWarm = patchNoise * 0.35; // -0.35 to +0.35

    // Per-blade hue variation on top of landscape patches
    float hueShift = (vBladeRand - 0.5) * 0.3 + patchWarm;
    // ~4% fully dried/golden blades + 6% dried tips
    float isFullyDry = step(0.96, vBladeRand);
    float isDryTip = step(0.90, vBladeRand) * (1.0 - isFullyDry);

    // Base-to-tip color shift: medium green base → warm bright tips
    vec3 baseColor = vec3(0.24, 0.44, 0.16);   // medium green at roots
    vec3 tipColor  = vec3(0.38, 0.60, 0.24);   // warm green at tips
    // Shift tip hue per blade + landscape patch
    tipColor.r += hueShift * 0.5;
    tipColor.g += hueShift * 0.15;
    tipColor.b -= hueShift * 0.25;
    // Dried blade tips: shift toward straw/yellow-brown
    vec3 dryTip = vec3(0.62, 0.54, 0.18);
    tipColor = mix(tipColor, dryTip, isDryTip * 0.8 * vHeight01);
    // Fully dried blades: entire blade is straw-golden
    vec3 dryBlade = vec3(0.55, 0.48, 0.18);
    baseColor = mix(baseColor, dryBlade * 0.5, isFullyDry);
    tipColor = mix(tipColor, dryBlade, isFullyDry);

    vec3 bladeColor = mix(baseColor, tipColor, smoothstep(0.0, 0.8, vHeight01));

    // Luminance-preserving tint: shift hue without darkening
    // Normalize vTint so its perceived brightness ≈ 1.0, then multiply
    float tintLum = dot(vTint, vec3(0.299, 0.587, 0.114));
    vec3 normTint = vTint / max(tintLum, 0.01);
    color = bladeColor * normTint * ao * diffuse * tipBrightness * brightnessMod;
    }

    // Fog
    float fogDepth = length(vWorldPos - cameraPosition);
    float fogFactor = smoothstep(uFogNear, uFogFar, fogDepth);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, alpha);
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
      // Pre-compute tuft centers for clumping (8 tufts per cell)
      // Tufts can straddle cell boundaries for organic overlap
      const TUFTS = 8;
      const tuftCX: number[] = [];
      const tuftCZ: number[] = [];
      for (let t = 0; t < TUFTS; t++) {
        tuftCX.push((plantHash(cellIdx, 600 + t) - 0.5) * 1.6);
        tuftCZ.push((plantHash(cellIdx, 700 + t) - 0.5) * 1.6);
      }
      for (let b = 0; b < BLADES_PER_CELL; b++) {
        // Assign blade to nearest tuft, with scatter
        const tuftIdx = b % TUFTS;
        const scatter = 0.32;
        const ox = tuftCX[tuftIdx] + (plantHash(cellIdx, 100 + b) - 0.5) * scatter;
        const oz = tuftCZ[tuftIdx] + (plantHash(cellIdx, 200 + b) - 0.5) * scatter;
        const yaw = plantHash(cellIdx, 300 + b) * Math.PI * 2;
        // Mix of hero blades (tall) and filler blades (short) for lush tufts
        const raw = plantHash(cellIdx, 400 + b);
        const hv = raw < 0.4 ? 0.25 + raw * 1.0 : 0.6 + raw * 1.4;  // bimodal: [0.25-0.65] or [0.6-2.0]
        const bw = 0.07 + plantHash(cellIdx, 500 + b) * 0.10;  // [0.07, 0.17]

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
    uHeatmap: { value: 0.0 },
  };

  // ── Material ──
  const material = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    uniforms,
    side: THREE.FrontSide,
    fog: false,
    depthWrite: true,
    transparent: true,
    alphaTest: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  // ── Track dirty state to skip redundant updates ──
  let lastTick = -1;
  let lastColorMode = '';
  let lastTraitColorTrait = '';
  let lastHighlightedSpecies: Set<number> | null = null;
  let lastHighlightedLineageRoot: number | null = null;
  let lastHighlightedPlantId: number | null = null;

  // ── updateCellData: per-tick CPU update ──
  function updateCellData(state: RendererState): void {
    const { world } = state;

    // Check if update is needed
    const tickChanged = world.tick !== lastTick;
    const colorModeChanged = state.colorMode !== lastColorMode;
    const traitChanged = state.colorMode === 'trait' && state.traitColorTrait !== lastTraitColorTrait;
    const highlightChanged = state.highlightedSpecies !== lastHighlightedSpecies
      || state.highlightedLineageRoot !== lastHighlightedLineageRoot
      || state.highlightedPlantId !== lastHighlightedPlantId;

    if (!tickChanged && !colorModeChanged && !traitChanged && !highlightChanged && !state.plantsDirty) return;

    lastTick = world.tick;
    lastColorMode = state.colorMode;
    lastTraitColorTrait = state.traitColorTrait;
    lastHighlightedSpecies = state.highlightedSpecies;
    lastHighlightedLineageRoot = state.highlightedLineageRoot;
    lastHighlightedPlantId = state.highlightedPlantId;

    // Set heatmap uniform for shader
    uniforms.uHeatmap.value = isHeatmapMode(state.colorMode) ? 1.0 : 0.0;

    // Clear all cell data
    cellDataArray.fill(0);

    const env = world.environment;
    const { growingPlants, maturityHeights } = state;

    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;

      // Only shader-grass subtypes (0-4)
      const subtype = world.speciesSubtypes?.get(plant.speciesId)
        ?? classifySubtype(plant.genome);
      if (!SHADER_GRASS_SUBTYPES.has(subtype)) continue;

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

      let tr: number, tg: number, tb: number;

      // Heatmap mode: pass pure gradient color (shader uses it directly)
      if (isHeatmapMode(state.colorMode)) {
        const mode = state.colorMode;
        if (mode === 'species') {
          const sc = world.speciesColors.get(plant.speciesId);
          if (sc) { tr = sc.r; tg = sc.g; tb = sc.b; }
          else { tr = 0.5; tg = 0.5; tb = 0.5; }
        } else if (mode === 'health') {
          [tr, tg, tb] = heatmapColor('health', plant.healthEMA);
        } else if (mode === 'trait') {
          const raw = plant.genome[state.traitColorTrait];
          const range = state.traitMax - state.traitMin;
          const nt = range > 0.001 ? (raw - state.traitMin) / range : 0.5;
          [tr, tg, tb] = heatmapColor('trait', nt);
        } else {
          const cell = world.grid[plant.y][plant.x];
          const value = mode === 'fertility' ? fertilityValue(cell.waterRechargeRate, cell.lightLevel, TERRAIN_PROPS[cell.terrainType].nutrientMax)
            : mode === 'water' ? cell.waterRechargeRate
            : mode === 'light' ? cell.lightLevel
            : TERRAIN_PROPS[cell.terrainType].nutrientMax;
          const ht = mode === 'fertility' ? value : normalizeResource(mode, value);
          [tr, tg, tb] = heatmapColor(mode, ht);
        }
      } else {
      // Compute tint (reuses same cache as accent plants)
      const tint = computePlantTint(
        state, plant.id, plant.genome,
      );

      tr = tint.r;
      tg = tint.g;
      tb = tint.b;

      // Per-subtype color shift — gives each grass species a distinct hue
      const subtypeTint = SUBTYPE_COLOR_TINT[subtype] ?? [1, 1, 1];
      tr *= subtypeTint[0];
      tg *= subtypeTint[1];
      tb *= subtypeTint[2];

      // Disease overlay
      if (env.weatherOverlay[plant.y * GRID_WIDTH + plant.x] === WeatherOverlay.Diseased) {
        tr = lerp(tr, 0.55, 0.4);
        tg = lerp(tg, 0.50, 0.4);
        tb = lerp(tb, 0.15, 0.4);
      }

      // Highlighted plant/species/lineage glow / dim
      if (state.highlightedPlantId !== null) {
        if (plant.id === state.highlightedPlantId) {
          tr = Math.min(tr * 1.4, 1.5);
          tg = Math.min(tg * 1.4, 1.5);
          tb = Math.min(tb * 1.4, 1.5);
        } else {
          tr *= 0.55; tg *= 0.55; tb *= 0.55;
        }
      } else if (state.highlightedLineageRoot !== null) {
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
      } // end !heatmap

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
