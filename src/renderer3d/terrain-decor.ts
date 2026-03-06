import * as THREE from 'three';
import { World, TerrainType } from '../types';
import {
  GRID, HALF,
  MAX_DECOR_STONES, MAX_DECOR_REEDS, MAX_DECOR_DRY_BRUSH,
} from './state';

// ── Deterministic hash from cell coords ──

function cellHash(cx: number, cy: number, salt: number): number {
  let h = (cx * 2654435761 + cy * 340573 + salt * 1013904223) | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = (h >> 16) ^ h;
  return (h & 0x7FFFFFFF) / 0x7FFFFFFF;
}

// ── Geometry creation ──

function createStoneGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  // Squash Y slightly for natural pebble look + jitter vertices
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const jitter = 0.85 + Math.sin(x * 7.3 + y * 13.1 + z * 5.7) * 0.15;
    pos.setXYZ(i, x * jitter, y * 0.55 * jitter, z * jitter);
  }
  geo.computeVertexNormals();
  return geo;
}

function createReedGeometry(): THREE.BufferGeometry {
  // Thin tapered cone
  return new THREE.ConeGeometry(0.03, 1, 4);
}

function createDryBrushGeometry(): THREE.BufferGeometry {
  // Two crossed planes (like grass tufts but simpler)
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const PLANES = 2;
  const HALF_W = 0.4;

  // Scraggly dead-looking silhouette
  const topHeights = [0.0, 0.25, 0.55, 0.40, 0.70, 0.85, 0.60, 0.45, 0.0];
  const topN = topHeights.length;

  for (let p = 0; p < PLANES; p++) {
    const angle = (p / PLANES) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = -sin, nz = cos;
    const vBase = vertices.length / 3;

    for (let i = 0; i < topN; i++) {
      const t = i / (topN - 1);
      const localX = (t - 0.5) * 2 * HALF_W;
      const wx = localX * cos;
      const wz = localX * sin;
      vertices.push(wx, 0, wz);
      normals.push(nx, 0, nz);
      vertices.push(wx, topHeights[i], wz);
      normals.push(nx, 0, nz);
    }

    for (let i = 0; i < topN - 1; i++) {
      const bl = vBase + i * 2;
      const tl = bl + 1;
      const br = vBase + (i + 1) * 2;
      const tr = br + 1;
      indices.push(bl, br, tl);
      indices.push(tl, br, tr);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

// ── Mesh creation ──

export interface DecorMeshes {
  stones: THREE.InstancedMesh;
  reeds: THREE.InstancedMesh;
  dryBrush: THREE.InstancedMesh;
}

function createDecorInstancedMesh(
  geo: THREE.BufferGeometry, mat: THREE.Material, maxCount: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, maxCount);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage); // placed once, not per-frame
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(maxCount * 3), 3,
  );
  mesh.instanceColor.setUsage(THREE.StaticDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  return mesh;
}

export function createDecorMeshes(): DecorMeshes {
  const stones = createDecorInstancedMesh(
    createStoneGeometry(),
    new THREE.MeshLambertMaterial({ flatShading: true }),
    MAX_DECOR_STONES,
  );

  const reeds = createDecorInstancedMesh(
    createReedGeometry(),
    new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
    MAX_DECOR_REEDS,
  );

  const dryBrush = createDecorInstancedMesh(
    createDryBrushGeometry(),
    new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
    MAX_DECOR_DRY_BRUSH,
  );

  return { stones, reeds, dryBrush };
}

// ── Terrain-specific decoration configs ──

interface TerrainDecorConfig {
  // Stones
  stoneProbability: number;  // chance per cell to have any stones
  stoneMin: number;          // min count per cell (if has stones)
  stoneMax: number;          // max count per cell
  stoneSizeMin: number;      // min radius scale
  stoneSizeMax: number;      // max radius scale
  stoneColors: [number, number, number][];  // RGB palette options
  // Reeds
  reedProbability: number;
  reedMin: number;
  reedMax: number;
  reedHeightMin: number;   // min height
  reedHeightMax: number;   // max height
  reedThickness?: number;  // XZ scale multiplier (default 1)
  reedColors?: [number, number, number][];  // optional override palette
  // Dry brush (arid only)
  brushProbability: number;
  brushMin: number;
  brushMax: number;
}

const DECOR_CONFIGS: Partial<Record<TerrainType, TerrainDecorConfig>> = {
  [TerrainType.Soil]: {
    stoneProbability: 0.15,
    stoneMin: 1, stoneMax: 1,
    stoneSizeMin: 0.04, stoneSizeMax: 0.08,
    stoneColors: [
      [0.45, 0.40, 0.35],  // warm gray
      [0.50, 0.45, 0.38],  // tan-gray
      [0.38, 0.35, 0.30],  // dark gray-brown
    ],
    reedProbability: 0.12, reedMin: 1, reedMax: 2,
    reedHeightMin: 0.10, reedHeightMax: 0.28,
    reedThickness: 0.4,
    reedColors: [
      [0.25, 0.35, 0.12],  // dark green
      [0.22, 0.30, 0.10],  // deep green
      [0.28, 0.32, 0.14],  // forest green
      [0.20, 0.28, 0.10],  // dark olive
    ],
    brushProbability: 0, brushMin: 0, brushMax: 0,
  },
  [TerrainType.Arid]: {
    stoneProbability: 0.40,
    stoneMin: 1, stoneMax: 2,
    stoneSizeMin: 0.06, stoneSizeMax: 0.14,
    stoneColors: [
      [0.65, 0.55, 0.40],  // sandy tan
      [0.60, 0.50, 0.35],  // dusty brown
      [0.70, 0.60, 0.45],  // light sand
    ],
    reedProbability: 0, reedMin: 0, reedMax: 0,
    reedHeightMin: 0, reedHeightMax: 0,
    brushProbability: 0.08, brushMin: 1, brushMax: 1,
  },
  [TerrainType.Hill]: {
    stoneProbability: 0.20,
    stoneMin: 1, stoneMax: 1,
    stoneSizeMin: 0.12, stoneSizeMax: 0.30,
    stoneColors: [
      [0.50, 0.48, 0.45],  // medium gray
      [0.55, 0.52, 0.48],  // light gray
      [0.42, 0.40, 0.38],  // dark gray
    ],
    reedProbability: 0, reedMin: 0, reedMax: 0,
    reedHeightMin: 0, reedHeightMax: 0,
    brushProbability: 0, brushMin: 0, brushMax: 0,
  },
  [TerrainType.Rock]: {
    stoneProbability: 0.30,
    stoneMin: 1, stoneMax: 2,
    stoneSizeMin: 0.05, stoneSizeMax: 0.10,
    stoneColors: [
      [0.40, 0.38, 0.36],  // dark gray
      [0.48, 0.46, 0.43],  // medium gray
    ],
    reedProbability: 0, reedMin: 0, reedMax: 0,
    reedHeightMin: 0, reedHeightMax: 0,
    brushProbability: 0, brushMin: 0, brushMax: 0,
  },
  [TerrainType.Wetland]: {
    stoneProbability: 0.15,
    stoneMin: 1, stoneMax: 1,
    stoneSizeMin: 0.04, stoneSizeMax: 0.08,
    stoneColors: [
      [0.30, 0.28, 0.25],  // dark brown
    ],
    reedProbability: 0.20,
    reedMin: 1, reedMax: 2,
    reedHeightMin: 0.4, reedHeightMax: 1.2,
    brushProbability: 0, brushMin: 0, brushMax: 0,
  },
};

// Reed color palette (green-brown tones)
const REED_COLORS: [number, number, number][] = [
  [0.35, 0.45, 0.20],  // olive green
  [0.40, 0.50, 0.25],  // yellow-green
  [0.30, 0.40, 0.18],  // dark green
  [0.45, 0.42, 0.25],  // dried green-brown
];

// Dry brush color palette (warm orange-sand tones)
const BRUSH_COLORS: [number, number, number][] = [
  [0.72, 0.52, 0.30],  // warm orange-sand
  [0.68, 0.48, 0.25],  // burnt orange
  [0.75, 0.55, 0.32],  // golden orange
  [0.70, 0.50, 0.28],  // dusty orange
];

// ── Placement ──

export function placeTerrainDecor(
  world: World,
  getCellElevation: (cx: number, cy: number) => number,
  meshes: DecorMeshes,
): void {
  const dummy = new THREE.Object3D();
  const stoneMtx = meshes.stones.instanceMatrix.array as Float32Array;
  const stoneClr = meshes.stones.instanceColor!.array as Float32Array;
  const reedMtx = meshes.reeds.instanceMatrix.array as Float32Array;
  const reedClr = meshes.reeds.instanceColor!.array as Float32Array;
  const brushMtx = meshes.dryBrush.instanceMatrix.array as Float32Array;
  const brushClr = meshes.dryBrush.instanceColor!.array as Float32Array;

  let stoneIdx = 0;
  let reedIdx = 0;
  let brushIdx = 0;

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const cell = world.grid[row][col];
      const config = DECOR_CONFIGS[cell.terrainType];
      if (!config) continue;

      const wx = col - HALF + 0.5;
      const wz = row - HALF + 0.5;
      const baseY = getCellElevation(col, row);

      // ── Stones ──
      if (config.stoneProbability > 0 && cellHash(col, row, 0) < config.stoneProbability) {
        const count = config.stoneMin + Math.floor(
          cellHash(col, row, 1) * (config.stoneMax - config.stoneMin + 1),
        );
        for (let i = 0; i < count && stoneIdx < MAX_DECOR_STONES; i++) {
          const ox = (cellHash(col, row, 10 + i * 3) - 0.5) * 0.85;
          const oz = (cellHash(col, row, 11 + i * 3) - 0.5) * 0.85;
          const size = config.stoneSizeMin +
            cellHash(col, row, 12 + i * 3) * (config.stoneSizeMax - config.stoneSizeMin);
          const colorIdx = Math.floor(cellHash(col, row, 20 + i) * config.stoneColors.length);
          const [cr, cg, cb] = config.stoneColors[Math.min(colorIdx, config.stoneColors.length - 1)];
          // Slight color variation per stone
          const cVar = 0.85 + cellHash(col, row, 30 + i) * 0.30;

          dummy.position.set(wx + ox, baseY + size * 0.3, wz + oz);
          dummy.scale.set(size, size, size);
          dummy.rotation.set(
            cellHash(col, row, 40 + i) * 0.3,
            cellHash(col, row, 41 + i) * Math.PI * 2,
            cellHash(col, row, 42 + i) * 0.3,
          );
          dummy.updateMatrix();
          dummy.matrix.toArray(stoneMtx, stoneIdx * 16);

          const ci = stoneIdx * 3;
          stoneClr[ci] = cr * cVar;
          stoneClr[ci + 1] = cg * cVar;
          stoneClr[ci + 2] = cb * cVar;
          stoneIdx++;
        }
      }

      // ── Reeds ──
      if (config.reedProbability > 0 && cellHash(col, row, 100) < config.reedProbability) {
        const count = config.reedMin + Math.floor(
          cellHash(col, row, 101) * (config.reedMax - config.reedMin + 1),
        );
        const reedPalette = config.reedColors ?? REED_COLORS;
        for (let i = 0; i < count && reedIdx < MAX_DECOR_REEDS; i++) {
          const ox = (cellHash(col, row, 110 + i * 3) - 0.5) * 0.80;
          const oz = (cellHash(col, row, 111 + i * 3) - 0.5) * 0.80;
          const h = config.reedHeightMin + cellHash(col, row, 112 + i * 3) * (config.reedHeightMax - config.reedHeightMin);
          const colorIdx = Math.floor(cellHash(col, row, 120 + i) * reedPalette.length);
          const [cr, cg, cb] = reedPalette[Math.min(colorIdx, reedPalette.length - 1)];
          const cVar = 0.85 + cellHash(col, row, 130 + i) * 0.30;

          // Slight lean
          const leanX = (cellHash(col, row, 140 + i) - 0.5) * 0.15;
          const leanZ = (cellHash(col, row, 141 + i) - 0.5) * 0.15;

          const thick = config.reedThickness ?? 1;
          dummy.position.set(wx + ox, baseY + h * 0.5, wz + oz);
          dummy.scale.set(thick, h, thick);
          dummy.rotation.set(leanX, cellHash(col, row, 142 + i) * Math.PI * 2, leanZ);
          dummy.updateMatrix();
          dummy.matrix.toArray(reedMtx, reedIdx * 16);

          const ci = reedIdx * 3;
          reedClr[ci] = cr * cVar;
          reedClr[ci + 1] = cg * cVar;
          reedClr[ci + 2] = cb * cVar;
          reedIdx++;
        }
      }

      // ── Dry brush (arid) ──
      if (config.brushProbability > 0 && cellHash(col, row, 200) < config.brushProbability) {
        const count = config.brushMin + Math.floor(
          cellHash(col, row, 201) * (config.brushMax - config.brushMin + 1),
        );
        for (let i = 0; i < count && brushIdx < MAX_DECOR_DRY_BRUSH; i++) {
          const ox = (cellHash(col, row, 210 + i * 3) - 0.5) * 0.80;
          const oz = (cellHash(col, row, 211 + i * 3) - 0.5) * 0.80;
          const s = 0.20 + cellHash(col, row, 212 + i * 3) * 0.30; // scale 0.2–0.5
          const colorIdx = Math.floor(cellHash(col, row, 220 + i) * BRUSH_COLORS.length);
          const [cr, cg, cb] = BRUSH_COLORS[Math.min(colorIdx, BRUSH_COLORS.length - 1)];
          const cVar = 0.85 + cellHash(col, row, 230 + i) * 0.30;

          // Tilted/leaning for dead-plant look
          const leanX = (cellHash(col, row, 240 + i) - 0.5) * 0.40;
          const leanZ = (cellHash(col, row, 241 + i) - 0.5) * 0.40;

          dummy.position.set(wx + ox, baseY, wz + oz);
          dummy.scale.set(s, s, s);
          dummy.rotation.set(leanX, cellHash(col, row, 242 + i) * Math.PI * 2, leanZ);
          dummy.updateMatrix();
          dummy.matrix.toArray(brushMtx, brushIdx * 16);

          const ci = brushIdx * 3;
          brushClr[ci] = cr * cVar;
          brushClr[ci + 1] = cg * cVar;
          brushClr[ci + 2] = cb * cVar;
          brushIdx++;
        }
      }
    }
  }

  // Finalize instance counts and mark for upload
  meshes.stones.count = stoneIdx;
  meshes.stones.instanceMatrix.needsUpdate = true;
  meshes.stones.instanceColor!.needsUpdate = true;

  meshes.reeds.count = reedIdx;
  meshes.reeds.instanceMatrix.needsUpdate = true;
  meshes.reeds.instanceColor!.needsUpdate = true;

  meshes.dryBrush.count = brushIdx;
  meshes.dryBrush.instanceMatrix.needsUpdate = true;
  meshes.dryBrush.instanceColor!.needsUpdate = true;
}
