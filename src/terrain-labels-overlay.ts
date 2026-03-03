import { World, TerrainType, Renderer } from './types';

const MIN_REGION_SIZE = 15;

// Terrain types to label (skip River/Rock — too narrow)
const LABELED_TYPES = new Set([
  TerrainType.Soil,
  TerrainType.Hill,
  TerrainType.Wetland,
  TerrainType.Arid,
]);

const TERRAIN_NAMES: Record<number, string> = {
  [TerrainType.Soil]: 'SOIL',
  [TerrainType.Hill]: 'HILL',
  [TerrainType.Wetland]: 'WETLAND',
  [TerrainType.Arid]: 'ARID',
};

// Bold terrain palette matching terrain-colors.ts terrain mode
const TERRAIN_LABEL_COLORS: Record<number, string> = {
  [TerrainType.Soil]: 'hsl(30, 55%, 65%)',
  [TerrainType.Hill]: 'hsl(35, 50%, 72%)',
  [TerrainType.Wetland]: 'hsl(160, 55%, 55%)',
  [TerrainType.Arid]: 'hsl(42, 60%, 75%)',
};

interface TerrainRegion {
  type: TerrainType;
  centroidX: number;
  centroidY: number;
}

interface LabelEl {
  el: HTMLElement;
  gridX: number;
  gridY: number;
}

/** BFS flood-fill to find connected components of each terrain type. */
function findTerrainRegions(world: World): TerrainRegion[] {
  const W = world.width;
  const H = world.height;
  const visited = new Uint8Array(W * H);
  const regions: TerrainRegion[] = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (visited[idx]) continue;
      const tt = world.grid[y][x].terrainType;
      if (!LABELED_TYPES.has(tt)) { visited[idx] = 1; continue; }

      // BFS
      const queue: number[] = [idx];
      visited[idx] = 1;
      let sumX = 0, sumY = 0, count = 0;
      let qi = 0;

      while (qi < queue.length) {
        const ci = queue[qi++];
        const cy = (ci / W) | 0;
        const cx = ci - cy * W;
        sumX += cx;
        sumY += cy;
        count++;

        // 4-connected neighbors
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (visited[ni]) continue;
          if (world.grid[ny][nx].terrainType !== tt) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }

      if (count >= MIN_REGION_SIZE) {
        regions.push({
          type: tt,
          centroidX: sumX / count,
          centroidY: sumY / count,
        });
      }
    }
  }

  return regions;
}

export function createTerrainLabelsOverlay(
  mapContainer: HTMLElement,
  renderer: Renderer,
  world: World,
) {
  let visible = false;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute; top:0; left:0; width:100%; height:100%;
    pointer-events:none; z-index:8; overflow:hidden;
  `;
  mapContainer.appendChild(overlay);

  // Compute regions once at creation
  const regions = findTerrainRegions(world);
  const labels: LabelEl[] = [];

  for (const region of regions) {
    const color = TERRAIN_LABEL_COLORS[region.type] ?? '#888';
    const name = TERRAIN_NAMES[region.type] ?? '?';

    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute; transform:translate(-50%, -50%);
      font-family:monospace; font-size:13px; font-weight:bold;
      text-transform:uppercase; letter-spacing:1px;
      color:${color}; opacity:0.85;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.5);
      white-space:nowrap; display:none;
    `;
    el.textContent = name;
    overlay.appendChild(el);

    labels.push({ el, gridX: region.centroidX, gridY: region.centroidY });
  }

  function setVisible(show: boolean): void {
    visible = show;
    if (!show) {
      for (const lbl of labels) lbl.el.style.display = 'none';
    }
  }

  function updatePositions(): void {
    if (!visible) return;
    for (const lbl of labels) {
      const screen = renderer.projectToScreen(lbl.gridX, lbl.gridY);
      if (screen) {
        lbl.el.style.left = `${screen.x}px`;
        lbl.el.style.top = `${screen.y}px`;
        lbl.el.style.display = '';
      } else {
        lbl.el.style.display = 'none';
      }
    }
  }

  return { setVisible, updatePositions };
}
