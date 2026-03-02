import { World, TerrainType } from '../types';
import { GRID, ELEV_SCALE } from './state';

// Deterministic pseudo-random from seed
function srand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface RockCluster {
  cells: { col: number; row: number }[];
  centerCol: number;
  centerRow: number;
}

/** BFS flood-fill to find connected rock clusters */
function findRockClusters(world: World): RockCluster[] {
  const visited = new Uint8Array(GRID * GRID);
  const clusters: RockCluster[] = [];

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const idx = row * GRID + col;
      if (visited[idx] || world.grid[row][col].terrainType !== TerrainType.Rock) continue;

      // BFS
      const cells: { col: number; row: number }[] = [];
      const queue: { col: number; row: number }[] = [{ col, row }];
      visited[idx] = 1;

      while (queue.length > 0) {
        const cell = queue.shift()!;
        cells.push(cell);

        // 4-connected neighbors
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = cell.col + dc;
          const nr = cell.row + dr;
          if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) continue;
          const ni = nr * GRID + nc;
          if (visited[ni] || world.grid[nr][nc].terrainType !== TerrainType.Rock) continue;
          visited[ni] = 1;
          queue.push({ col: nc, row: nr });
        }
      }

      // Compute center
      let sumC = 0, sumR = 0;
      for (const c of cells) { sumC += c.col; sumR += c.row; }
      clusters.push({
        cells,
        centerCol: sumC / cells.length,
        centerRow: sumR / cells.length,
      });
    }
  }

  return clusters;
}

/** Compute per-cell distance to cluster edge (0 = edge, higher = interior) */
function computeEdgeDistances(cluster: RockCluster): Map<string, number> {
  const cellSet = new Set(cluster.cells.map(c => `${c.col},${c.row}`));
  const distances = new Map<string, number>();

  // BFS from edge cells inward
  const queue: { col: number; row: number; dist: number }[] = [];

  for (const cell of cluster.cells) {
    let isEdge = false;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cell.col + dc;
      const nr = cell.row + dr;
      if (!cellSet.has(`${nc},${nr}`)) {
        isEdge = true;
        break;
      }
    }
    if (isEdge) {
      queue.push({ col: cell.col, row: cell.row, dist: 0 });
      distances.set(`${cell.col},${cell.row}`, 0);
    }
  }

  while (queue.length > 0) {
    const { col, row, dist } = queue.shift()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = col + dc;
      const nr = row + dr;
      const key = `${nc},${nr}`;
      if (!cellSet.has(key) || distances.has(key)) continue;
      distances.set(key, dist + 1);
      queue.push({ col: nc, row: nr, dist: dist + 1 });
    }
  }

  return distances;
}

export interface RockFormations {
  heightOverlay: Float32Array;
}

export function createRockFormations(world: World): RockFormations {
  const heightOverlay = new Float32Array(GRID * GRID);

  const clusters = findRockClusters(world);
  if (clusters.length === 0) return { heightOverlay };

  // ── A. Compute height overlay ──
  for (const cluster of clusters) {
    const edgeDists = computeEdgeDistances(cluster);
    let maxDist = 0;
    for (const d of edgeDists.values()) {
      if (d > maxDist) maxDist = d;
    }

    for (const cell of cluster.cells) {
      const key = `${cell.col},${cell.row}`;
      const edgeDist = edgeDists.get(key) ?? 0;
      // Normalize to 0-1 (0 = edge, 1 = deep interior)
      const normalizedDist = maxDist > 0 ? edgeDist / maxDist : 0;

      // Height boost: smooth ramp from edge to center
      // Small clusters (1-2 cells) still get a modest bump
      const baseBoost = 0.3 + normalizedDist * 0.9;

      // Seeded noise for irregularity
      const seed = cell.col * 7 + cell.row * 13;
      const noise = (srand(seed) - 0.5) * 0.3;

      heightOverlay[cell.row * GRID + cell.col] = (baseBoost + noise) * ELEV_SCALE;
    }
  }

  return { heightOverlay };
}
