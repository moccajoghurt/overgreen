import { CELL_PX, SIM, World } from './types';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h},${s}%,${l}%)`;
}

// Pre-compute soil palette: 21 water levels × 11 nutrient levels
const SOIL_PALETTE: string[][] = [];
for (let w = 0; w <= 20; w++) {
  SOIL_PALETTE[w] = [];
  const waterRatio = w / 20;
  for (let n = 0; n <= 10; n++) {
    const nutrientRatio = n / 10;
    const h = lerp(30, 25, waterRatio) - nutrientRatio * 5;
    const s = lerp(40, 50, waterRatio);
    const l = lerp(55, 25, waterRatio) - nutrientRatio * 5;
    SOIL_PALETTE[w][n] = hsl(h, s, Math.max(10, l));
  }
}

// Pre-compute plant palette: 21 height levels
const PLANT_PALETTE: string[] = [];
for (let h = 0; h <= 20; h++) {
  const heightRatio = h / 20;
  PLANT_PALETTE[h] = hsl(120, 70, lerp(50, 20, heightRatio));
}

export interface Renderer {
  render(selectedCell: { x: number; y: number } | null): void;
  cellAt(canvasX: number, canvasY: number): { x: number; y: number } | null;
}

export function createRenderer(canvas: HTMLCanvasElement, world: World): Renderer {
  const w = world.width * CELL_PX;
  const h = world.height * CELL_PX;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  const ctx = canvas.getContext('2d')!;

  function render(selectedCell: { x: number; y: number } | null): void {
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const cell = world.grid[y][x];
        const px = x * CELL_PX;
        const py = y * CELL_PX;

        // Soil layer
        const wi = Math.round((cell.waterLevel / SIM.MAX_WATER) * 20);
        const ni = Math.round((cell.nutrients / SIM.MAX_NUTRIENTS) * 10);
        ctx.fillStyle = SOIL_PALETTE[Math.min(20, Math.max(0, wi))][Math.min(10, Math.max(0, ni))];
        ctx.fillRect(px, py, CELL_PX, CELL_PX);

        // Plant layer
        if (cell.plantId !== null) {
          const plant = world.plants.get(cell.plantId);
          if (plant && plant.alive) {
            const sizeRatio = plant.leafArea / SIM.MAX_LEAF_AREA;
            const size = CELL_PX * (0.3 + 0.7 * sizeRatio);
            const offset = (CELL_PX - size) / 2;

            const hi = Math.round((plant.height / SIM.MAX_HEIGHT) * 20);
            ctx.fillStyle = PLANT_PALETTE[Math.min(20, Math.max(0, hi))];
            ctx.fillRect(px + offset, py + offset, size, size);
          }
        }

        // Shadow overlay
        if (cell.lightLevel < SIM.BASE_LIGHT) {
          const shadowAlpha = (1 - cell.lightLevel / SIM.BASE_LIGHT) * 0.3;
          ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
          ctx.fillRect(px, py, CELL_PX, CELL_PX);
        }
      }
    }

    // Selection highlight
    if (selectedCell) {
      const px = selectedCell.x * CELL_PX;
      const py = selectedCell.y * CELL_PX;
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, CELL_PX - 1, CELL_PX - 1);
    }
  }

  function cellAt(canvasX: number, canvasY: number): { x: number; y: number } | null {
    const x = Math.floor(canvasX / CELL_PX);
    const y = Math.floor(canvasY / CELL_PX);
    if (x < 0 || x >= world.width || y < 0 || y >= world.height) return null;
    return { x, y };
  }

  return { render, cellAt };
}
