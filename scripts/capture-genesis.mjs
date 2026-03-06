/**
 * Capture keyframe screenshots of the Genesis scenario.
 *
 * Usage:
 *   node scripts/capture-genesis.mjs [--port 5173] [--width 1024] [--height 768]
 *
 * Requires: Vite dev server running (`npm run dev`)
 * Output:   screenshots/genesis-contact-sheet.jpg  (grid of keyframes)
 *           screenshots/genesis-tick-*.jpg          (individual frames)
 */

import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

// ── Config ──

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const PORT = getArg('--port', '5173');
const WIDTH = parseInt(getArg('--width', '1024'), 10);
const HEIGHT = parseInt(getArg('--height', '768'), 10);
const URL = `http://localhost:${PORT}`;
const OUT = 'screenshots';

const KEYFRAMES = [
  { tick: 0,    label: 'Opening' },
  { tick: 50,   label: 'First growth' },
  { tick: 150,  label: 'Expanding' },
  { tick: 300,  label: 'Speciation' },
  { tick: 600,  label: 'Competition' },
  { tick: 1000, label: 'Mature' },
];

// ── Main ──

await mkdir(OUT, { recursive: true });

console.log(`Launching browser at ${WIDTH}x${HEIGHT}...`);
const browser = await puppeteer.launch({
  headless: true,
  timeout: 60000,
  args: [
    `--window-size=${WIDTH},${HEIGHT}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--enable-webgl',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: HEIGHT });

console.log(`Navigating to ${URL}...`);
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForSelector('canvas', { timeout: 10000 });

// Immediately pause the sim so we control advancement
await page.evaluate(() => {
  // Access controls through the pause button state
  const btn = document.getElementById('btn-play-pause');
  if (btn && btn.textContent.trim() === 'Pause') btn.click(); // pause if running
});
await new Promise(r => setTimeout(r, 500));

// Reload Genesis fresh so we start at tick 0
await page.evaluate(() => {
  const btn = document.getElementById('btn-load-scenario');
  const sel = document.getElementById('scenario-select');
  sel.value = 'genesis';
  btn.click();
});
await new Promise(r => setTimeout(r, 1000));

// Enable species colors + labels for visual richness
await page.evaluate(() => {
  const colorToggle = document.getElementById('color-mode-toggle');
  if (colorToggle && !colorToggle.checked) colorToggle.click();
  const labelsToggle = document.getElementById('labels-toggle');
  if (labelsToggle && !labelsToggle.checked) labelsToggle.click();
});
await new Promise(r => setTimeout(r, 300));

const framePaths = [];

for (const kf of KEYFRAMES) {
  // Advance sim to target tick using __doTick (batch of ticks, no rendering needed)
  const currentTick = await page.evaluate(() => window.__world.tick);
  const ticksNeeded = kf.tick - currentTick;

  if (ticksNeeded > 0) {
    console.log(`  Advancing ${ticksNeeded} ticks to ${kf.tick}...`);
    await page.evaluate((n) => {
      for (let i = 0; i < n; i++) window.__doTick();
      window.__updateUI();
    }, ticksNeeded);
  }

  // Let the renderer draw the current state
  await new Promise(r => setTimeout(r, 800));

  // Log world state
  const stats = await page.evaluate(() => ({
    tick: window.__world.tick,
    plants: window.__world.plants.size,
    species: [...window.__world.speciesNames.entries()].map(([id, name]) => {
      let count = 0;
      for (const p of window.__world.plants.values()) {
        if (p.speciesId === id && p.alive) count++;
      }
      return { id, name, count };
    }).filter(s => s.count > 0),
  }));
  console.log(`  Tick ${stats.tick}: ${stats.plants} plants, ${stats.species.length} species: ${stats.species.map(s => `${s.name}(${s.count})`).join(', ')}`);

  await captureFrame(page, kf, framePaths);
}

console.log('\nBuilding contact sheet...');
await buildContactSheet(framePaths);

await browser.close();
console.log(`Done! Output in ${OUT}/`);

// ── Helpers ──

async function captureFrame(page, kf, framePaths) {
  const filename = `genesis-tick-${String(kf.tick).padStart(5, '0')}.jpg`;
  const filepath = join(OUT, filename);
  await page.screenshot({ path: filepath, type: 'jpeg', quality: 85 });
  framePaths.push({ path: filepath, label: `Tick ${kf.tick}: ${kf.label}` });
  console.log(`  Captured ${filename} — ${kf.label}`);
}

async function buildContactSheet(frames) {
  const cols = 3;
  const rows = Math.ceil(frames.length / cols);
  const labelH = 30;
  const cellW = WIDTH;
  const cellH = HEIGHT + labelH;
  const sheetW = cols * cellW;
  const sheetH = rows * cellH;

  const composites = [];
  for (let i = 0; i < frames.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const labelSvg = Buffer.from(`
      <svg width="${cellW}" height="${labelH}">
        <rect width="100%" height="100%" fill="#1a1a1a"/>
        <text x="10" y="20" font-family="monospace" font-size="14" fill="#8f8">
          ${frames[i].label}
        </text>
      </svg>
    `);

    composites.push({
      input: await sharp(frames[i].path).resize(cellW, HEIGHT).toBuffer(),
      left: col * cellW,
      top: row * cellH + labelH,
    });
    composites.push({
      input: await sharp(labelSvg).png().toBuffer(),
      left: col * cellW,
      top: row * cellH,
    });
  }

  await sharp({
    create: { width: sheetW, height: sheetH, channels: 3, background: '#1a1a1a' },
  })
    .composite(composites)
    .jpeg({ quality: 85 })
    .toFile(join(OUT, 'genesis-contact-sheet.jpg'));

  console.log(`  Saved genesis-contact-sheet.jpg (${sheetW}x${sheetH})`);
}
