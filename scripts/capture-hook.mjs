/**
 * Capture the hook phase experience (time-based, not tick-based).
 * Takes screenshots at real-time intervals to see what a new user sees.
 *
 * Usage: node scripts/capture-hook.mjs [--port 5173]
 */

import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const PORT = getArg('--port', '5173');
const WIDTH = 1280;
const HEIGHT = 960;
const URL = `http://localhost:${PORT}`;
const OUT = 'screenshots';

// Time-based keyframes (seconds after page load)
const KEYFRAMES = [
  { sec: 0,  label: 'First paint — close-up, near ground' },
  { sec: 2,  label: '2s — title card: "Overgreen"' },
  { sec: 5,  label: '5s — post-card, growth starting' },
  { sec: 10, label: '10s — colony expanding' },
  { sec: 20, label: '20s — approaching speciation' },
  { sec: 35, label: '35s — speciation commentary' },
  { sec: 50, label: '50s — reveal expected' },
  { sec: 65, label: '65s — post-reveal' },
];

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

// Clear localStorage so hook runs fresh
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => localStorage.removeItem('overgreen-hook-seen'));

// Reload to get a fresh hook experience
console.log('Reloading for fresh hook experience...');
await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForSelector('canvas', { timeout: 10000 });

const startTime = Date.now();
const framePaths = [];

for (const kf of KEYFRAMES) {
  const waitMs = kf.sec * 1000 - (Date.now() - startTime);
  if (waitMs > 0) {
    console.log(`  Waiting ${(waitMs / 1000).toFixed(1)}s for ${kf.label}...`);
    await new Promise(r => setTimeout(r, waitMs));
  }

  // Log world state
  const stats = await page.evaluate(() => ({
    tick: window.__world?.tick ?? '?',
    plants: window.__world?.plants?.size ?? '?',
    species: window.__world?.speciesNames?.size ?? '?',
    hookActive: document.body.classList.contains('hook-active'),
    hookOverlayVisible: !document.getElementById('hook-overlay')?.classList.contains('hidden'),
  }));
  console.log(`  [${kf.sec}s] Tick ${stats.tick}, ${stats.plants} plants, ${stats.species} species | hook: ${stats.hookActive ? 'active' : 'done'}, overlay: ${stats.hookOverlayVisible ? 'yes' : 'no'}`);

  const filename = `hook-${String(kf.sec).padStart(3, '0')}s.jpg`;
  const filepath = join(OUT, filename);
  await page.screenshot({ path: filepath, type: 'jpeg', quality: 90 });
  framePaths.push({ path: filepath, label: kf.label });
  console.log(`  Captured ${filename}`);
}

// Build contact sheet
console.log('\nBuilding hook contact sheet...');
const cols = 4;
const rows = Math.ceil(framePaths.length / cols);
const labelH = 30;
const cellW = WIDTH;
const cellH = HEIGHT + labelH;
const sheetW = cols * cellW;
const sheetH = rows * cellH;

const composites = [];
for (let i = 0; i < framePaths.length; i++) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const labelSvg = Buffer.from(`
    <svg width="${cellW}" height="${labelH}">
      <rect width="100%" height="100%" fill="#1a1a1a"/>
      <text x="10" y="20" font-family="monospace" font-size="14" fill="#8f8">
        ${framePaths[i].label}
      </text>
    </svg>
  `);
  composites.push({
    input: await sharp(framePaths[i].path).resize(cellW, HEIGHT).toBuffer(),
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
  .toFile(join(OUT, 'hook-contact-sheet.jpg'));

console.log(`  Saved hook-contact-sheet.jpg (${sheetW}x${sheetH})`);

await browser.close();
console.log('Done!');
