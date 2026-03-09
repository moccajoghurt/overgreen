/**
 * Render a scenario as a top-down terrain map image.
 * Usage: npx tsx scripts/render-topdown.ts [scenario-id]
 * Default: genesis
 * Output: screenshots/<scenario-id>-topdown.png
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { genesis } from '../src/scenarios/genesis';
import { lindenvale } from '../src/scenarios/lindenvale';
import { TerrainType } from '../src/types';
import type { Scenario } from '../src/types';

const SCENARIOS: Record<string, Scenario> = { genesis, lindenvale };
const scenarioId = process.argv[2] ?? 'genesis';
const scenario = SCENARIOS[scenarioId];
if (!scenario) {
  console.error(`Unknown scenario "${scenarioId}". Available: ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}

const CELL_PX = 10; // pixels per cell
const size = scenario.size;
const imgW = size * CELL_PX;
const imgH = size * CELL_PX;

// Terrain colors (R, G, B)
const TERRAIN_COLORS: Record<number, [number, number, number]> = {
  [TerrainType.Soil]:    [139, 119, 83],   // warm brown
  [TerrainType.River]:   [41,  98, 168],   // deep blue
  [TerrainType.Rock]:    [120, 115, 105],  // grey
  [TerrainType.Hill]:    [160, 140, 100],  // tan/elevated
  [TerrainType.Wetland]: [72,  130, 100],  // murky green
  [TerrainType.Arid]:    [194, 170, 120],  // sandy
};

// Build terrain grid (default + overrides)
const grid: { terrain: TerrainType; elevation: number }[][] = [];
for (let y = 0; y < size; y++) {
  const row = [];
  for (let x = 0; x < size; x++) {
    row.push({
      terrain: scenario.defaultTerrain,
      elevation: scenario.defaultElevation ?? 0.5,
    });
  }
  grid.push(row);
}

for (const cell of scenario.cells) {
  if (cell.x >= 0 && cell.x < size && cell.y >= 0 && cell.y < size) {
    grid[cell.y][cell.x] = {
      terrain: cell.terrain,
      elevation: cell.elevation ?? scenario.defaultElevation ?? 0.5,
    };
  }
}

// Collect seed positions with species color
const seeds: { x: number; y: number; name: string; color: [number, number, number] }[] = [];
for (const sp of scenario.species) {
  const c: [number, number, number] = [
    Math.round(sp.color.r * 255),
    Math.round(sp.color.g * 255),
    Math.round(sp.color.b * 255),
  ];
  for (const pos of sp.placements) {
    seeds.push({ x: pos.x, y: pos.y, name: sp.name, color: c });
  }
}

// Generate raw pixel buffer
const buf = Buffer.alloc(imgW * imgH * 3);

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const cell = grid[y][x];
    const base = TERRAIN_COLORS[cell.terrain] ?? [128, 128, 128];

    // Darken/lighten by elevation for depth
    const elevFactor = 0.7 + cell.elevation * 0.6;
    const r = Math.min(255, Math.round(base[0] * elevFactor));
    const g = Math.min(255, Math.round(base[1] * elevFactor));
    const b = Math.min(255, Math.round(base[2] * elevFactor));

    // Fill the cell's pixels
    for (let py = 0; py < CELL_PX; py++) {
      for (let px = 0; px < CELL_PX; px++) {
        const ix = ((y * CELL_PX + py) * imgW + (x * CELL_PX + px)) * 3;
        buf[ix] = r;
        buf[ix + 1] = g;
        buf[ix + 2] = b;
      }
    }
  }
}

// Draw seed positions as bright markers
for (const seed of seeds) {
  const cx = seed.x * CELL_PX + CELL_PX / 2;
  const cy = seed.y * CELL_PX + CELL_PX / 2;
  const radius = CELL_PX * 1.5;

  for (let py = -radius; py <= radius; py++) {
    for (let px = -radius; px <= radius; px++) {
      if (px * px + py * py <= radius * radius) {
        const ix = Math.round(cy + py);
        const iy = Math.round(cx + px);
        if (ix >= 0 && ix < imgH && iy >= 0 && iy < imgW) {
          const idx = (ix * imgW + iy) * 3;
          buf[idx] = seed.color[0];
          buf[idx + 1] = seed.color[1];
          buf[idx + 2] = seed.color[2];
        }
      }
    }
  }
}

// Draw grid lines every 20 cells for orientation
for (let y = 0; y < imgH; y++) {
  for (let x = 0; x < imgW; x++) {
    if (x % (20 * CELL_PX) === 0 || y % (20 * CELL_PX) === 0) {
      const idx = (y * imgW + x) * 3;
      // Subtle dark overlay
      buf[idx] = Math.round(buf[idx] * 0.7);
      buf[idx + 1] = Math.round(buf[idx + 1] * 0.7);
      buf[idx + 2] = Math.round(buf[idx + 2] * 0.7);
    }
  }
}

// Build legend as SVG overlay
const legendH = 60;
const legendSvg = Buffer.from(`
<svg width="${imgW}" height="${legendH}">
  <rect width="100%" height="100%" fill="#1a1a1a"/>
  <circle cx="20" cy="20" r="6" fill="rgb(139,119,83)"/><text x="32" y="25" font-family="monospace" font-size="13" fill="white">Soil</text>
  <circle cx="100" cy="20" r="6" fill="rgb(41,98,168)"/><text x="112" y="25" font-family="monospace" font-size="13" fill="white">River/Sea</text>
  <circle cx="230" cy="20" r="6" fill="rgb(120,115,105)"/><text x="242" y="25" font-family="monospace" font-size="13" fill="white">Rock</text>
  <circle cx="310" cy="20" r="6" fill="rgb(160,140,100)"/><text x="322" y="25" font-family="monospace" font-size="13" fill="white">Hill</text>
  <circle cx="385" cy="20" r="6" fill="rgb(72,130,100)"/><text x="397" y="25" font-family="monospace" font-size="13" fill="white">Wetland</text>
  <circle cx="490" cy="20" r="6" fill="rgb(194,170,120)"/><text x="502" y="25" font-family="monospace" font-size="13" fill="white">Arid</text>
  ${scenario.species.map((sp, i) => {
    const cx = 570 + i * 120;
    const cr = Math.round(sp.color.r * 255), cg = Math.round(sp.color.g * 255), cb = Math.round(sp.color.b * 255);
    return `<circle cx="${cx}" cy="20" r="6" fill="rgb(${cr},${cg},${cb})"/><text x="${cx + 12}" y="25" font-family="monospace" font-size="13" fill="white">${sp.name}</text>`;
  }).join('\n  ')}
  <text x="20" y="48" font-family="monospace" font-size="12" fill="#888">${scenario.name} ${size}x${size} | Grid lines every 20 cells | N=top</text>
</svg>
`);

await mkdir('screenshots', { recursive: true });

const terrainImg = sharp(buf, { raw: { width: imgW, height: imgH, channels: 3 } }).png();
const legendImg = sharp(legendSvg).png().resize(imgW, legendH);

const finalImg = sharp({
  create: { width: imgW, height: imgH + legendH, channels: 3, background: '#1a1a1a' },
})
  .composite([
    { input: await legendImg.toBuffer(), left: 0, top: 0 },
    { input: await terrainImg.toBuffer(), left: 0, top: legendH },
  ])
  .png();

const outFile = `screenshots/${scenarioId}-topdown.png`;
await finalImg.toFile(outFile);
console.log(`Saved ${outFile} (${imgW}x${imgH + legendH})`);
