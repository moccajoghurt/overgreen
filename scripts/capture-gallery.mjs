/**
 * Capture the plant gallery as a PNG screenshot via headless Puppeteer.
 *
 * Usage:
 *   node scripts/capture-gallery.mjs [--port 5173]
 *
 * Requires: Vite dev server running (`npm run dev`)
 * Output:   screenshots/gallery.png
 */
import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const PORT = getArg('--port', '5173');
const OUT = 'screenshots';

// Gallery is 2440×5280+ pixels at 1x DPR (13 rows × 400px each + headers)
// We'll let the page determine its size
const W = 2440;
const H = 5500;

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  timeout: 60000,
  args: [
    `--window-size=${W},${H}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--enable-webgl',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

// Log console messages and errors from the page
page.on('console', msg => console.log(`PAGE [${msg.type()}]:`, msg.text()));
page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

const url = `http://localhost:${PORT}/gallery.html`;
console.log(`Navigating to ${url}`);
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

// Wait for gallery to signal readiness, or fallback to timeout
try {
  await page.waitForFunction('window.__galleryReady === true', { timeout: 15000 });
} catch {
  console.log('Readiness signal not received, waiting 3s fallback...');
}
// Extra frames for WebGL to flush
await new Promise(r => setTimeout(r, 1500));

const outPath = `${OUT}/gallery.png`;
await page.screenshot({ path: outPath, type: 'png', fullPage: true });
console.log(`Saved ${outPath}`);

await browser.close();
