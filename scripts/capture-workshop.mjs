/**
 * Capture a plant workshop screenshot via headless Puppeteer.
 *
 * Usage:
 *   node scripts/capture-workshop.mjs [--subtype 6] [--port 5173]
 *
 * Requires: Vite dev server running (`npm run dev`)
 * Output:   screenshots/workshop.png
 */
import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const PORT = getArg('--port', '5173');
const SUBTYPE = getArg('--subtype', '6');
const ANGLES = getArg('--angles', '4');
const OUT = 'screenshots';
const CELL = 400;
const W = parseInt(ANGLES, 10) * CELL;
const H = CELL;

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  timeout: 30000,
  args: [
    `--window-size=${W},${H}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--enable-webgl',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });

const url = `http://localhost:${PORT}/workshop.html?subtype=${SUBTYPE}&angles=${ANGLES}`;
console.log(`Navigating to ${url}`);
await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });

// Wait for workshop to signal readiness
await page.waitForFunction('window.__workshopReady === true', { timeout: 10000 });
// Extra frame for WebGL to flush
await new Promise(r => setTimeout(r, 300));

const outPath = `${OUT}/workshop.png`;
await page.screenshot({ path: outPath, type: 'png' });
console.log(`Saved ${outPath}`);

await browser.close();
