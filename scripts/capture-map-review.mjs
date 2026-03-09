/**
 * Map review capture — screenshots of all 40 plant subtypes on Genesis terrain.
 *
 * Loads the showcase scenario (frozen), then captures screenshots from
 * showcase camera presets. Builds a contact sheet for visual review.
 *
 * Usage:
 *   node scripts/capture-map-review.mjs [options]
 *     --port 5173          Dev server port
 *     --cameras all        Presets: "all" or comma-separated names (default: SHOWCASE_PRESETS)
 *     --width 1280         Viewport width
 *     --height 960         Viewport height
 *
 * Requires: Vite dev server running (`npm run dev`)
 * Output:   screenshots/map-review-contact-sheet.jpg
 *           screenshots/map-review-*.jpg
 */

import { join } from 'path';
import {
  getArg, launchBrowser, navigateToApp, pauseSim, loadScenario,
  setCamera, captureScreenshot, buildContactSheet, warmupFrames,
} from './capture-utils.mjs';
import { PRESETS, SHOWCASE_PRESETS } from './camera-presets.mjs';

// ── Config ──

const args = process.argv.slice(2);
const PORT = getArg(args, '--port', '5173');
const CAMERAS_ARG = getArg(args, '--cameras', '');
const WIDTH = parseInt(getArg(args, '--width', '1280'), 10);
const HEIGHT = parseInt(getArg(args, '--height', '960'), 10);
const WARMUP = 30;
const OUT = 'screenshots';

// Resolve camera presets
let cameraKeys;
if (!CAMERAS_ARG || CAMERAS_ARG === 'all') {
  cameraKeys = SHOWCASE_PRESETS;
} else {
  cameraKeys = CAMERAS_ARG.split(',').map(s => s.trim());
}

for (const key of cameraKeys) {
  if (!PRESETS[key]) {
    console.error(`Unknown camera preset: "${key}". Available showcase presets: ${SHOWCASE_PRESETS.join(', ')}`);
    process.exit(1);
  }
}

const cameraList = cameraKeys.map(key => ({ key, ...PRESETS[key] }));

// ── Main ──

console.log(`Map review: cameras=${cameraList.map(c => c.key).join(',')}`);
console.log(`Launching browser at ${WIDTH}x${HEIGHT}...`);

const { browser, page } = await launchBrowser(WIDTH, HEIGHT);

try {
  await navigateToApp(page, PORT);
  await pauseSim(page);

  // Load showcase scenario (name match in dev dropdown)
  console.log('Loading showcase scenario...');
  await loadScenario(page, 'Plant Showcase');

  // Wait for models to build
  await new Promise(r => setTimeout(r, 2000));

  const framePaths = [];

  for (const cam of cameraList) {
    console.log(`\n  Camera: ${cam.name} (${cam.key})`);

    await setCamera(page, cam.position, cam.target);

    // Warmup frames for rendering to settle
    console.log(`    Warming up (${WARMUP} frames)...`);
    await warmupFrames(page, WARMUP);

    // Capture screenshot
    const filename = `map-review-${cam.key}.jpg`;
    const filepath = join(OUT, filename);
    await captureScreenshot(page, filepath, 95);

    framePaths.push({ path: filepath, label: cam.name });
    console.log(`    Captured ${filename}`);
  }

  // Build contact sheet
  console.log('\nBuilding contact sheet...');
  await buildContactSheet(framePaths, {
    cols: Math.min(cameraList.length, 3),
    width: WIDTH,
    height: HEIGHT,
    outPath: join(OUT, 'map-review-contact-sheet.jpg'),
  });

} finally {
  await browser.close();
}

console.log(`\nDone! Output in ${OUT}/`);
