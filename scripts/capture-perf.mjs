/**
 * Performance benchmark with camera presets.
 *
 * Loads a scenario, advances to a target tick, then captures screenshots
 * from multiple camera angles with per-subsystem performance data.
 *
 * Usage:
 *   node scripts/capture-perf.mjs [options]
 *     --port 5173          Dev server port
 *     --scenario genesis   Scenario to load (default: genesis)
 *     --tick 300           Target tick (default: 300)
 *     --cameras all        Presets: "all" or comma-separated names (default: DEFAULT_PRESETS)
 *     --pos x,y,z          Ad-hoc camera position (overrides --cameras)
 *     --target x,y,z       Ad-hoc camera target (requires --pos)
 *     --warmup 120         Frames to render per camera for EMA warmup (default: 120)
 *     --width 1280         Viewport width
 *     --height 960         Viewport height
 *
 * Requires: Vite dev server running (`npm run dev`)
 * Output:   screenshots/perf-contact-sheet.jpg  (grid of views)
 *           screenshots/perf-*.jpg               (individual frames)
 *           stdout: performance summary table
 */

import { join } from 'path';
import {
  getArg, launchBrowser, navigateToApp, pauseSim, loadScenario,
  advanceToTick, setCamera, getWorldStats, getPerfData,
  captureScreenshot, buildContactSheet, warmupFrames,
} from './capture-utils.mjs';
import { PRESETS, DEFAULT_PRESETS } from './camera-presets.mjs';

// ── Config ──

const args = process.argv.slice(2);
const PORT = getArg(args, '--port', '5173');
const SCENARIO = getArg(args, '--scenario', 'genesis');
const TICK = parseInt(getArg(args, '--tick', '300'), 10);
const CAMERAS_ARG = getArg(args, '--cameras', '');
const POS_ARG = getArg(args, '--pos', '');
const TARGET_ARG = getArg(args, '--target', '');
const HEATMAP = getArg(args, '--heatmap', '');
const WARMUP = parseInt(getArg(args, '--warmup', '120'), 10);
const WIDTH = parseInt(getArg(args, '--width', '1280'), 10);
const HEIGHT = parseInt(getArg(args, '--height', '960'), 10);
const OUT = 'screenshots';

function parseVec3(str) {
  const parts = str.split(',').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.error(`Invalid vector: "${str}". Expected x,y,z (e.g. 5,8,8)`);
    process.exit(1);
  }
  return { x: parts[0], y: parts[1], z: parts[2] };
}

// Ad-hoc camera position or presets
let cameraList; // array of { key, name, position, target }

if (POS_ARG) {
  const pos = parseVec3(POS_ARG);
  const target = TARGET_ARG ? parseVec3(TARGET_ARG) : { x: 0, y: 0, z: 0 };
  cameraList = [{ key: 'adhoc', name: `Ad-hoc (${POS_ARG})`, position: pos, target }];
} else {
  // Resolve preset keys
  let cameraKeys;
  if (!CAMERAS_ARG || CAMERAS_ARG === 'all') {
    cameraKeys = Object.keys(PRESETS);
  } else if (CAMERAS_ARG === 'default') {
    cameraKeys = DEFAULT_PRESETS;
  } else {
    cameraKeys = CAMERAS_ARG.split(',').map(s => s.trim());
  }

  // Validate presets
  for (const key of cameraKeys) {
    if (!PRESETS[key]) {
      console.error(`Unknown camera preset: "${key}". Available: ${Object.keys(PRESETS).join(', ')}`);
      process.exit(1);
    }
  }

  cameraList = cameraKeys.map(key => ({ key, ...PRESETS[key] }));
}

// ── Main ──

console.log(`Perf benchmark: scenario=${SCENARIO}, tick=${TICK}, cameras=${cameraList.map(c => c.key).join(',')}`);
console.log(`Launching browser at ${WIDTH}x${HEIGHT}...`);

const { browser, page } = await launchBrowser(WIDTH, HEIGHT);

try {
  await navigateToApp(page, PORT);
  await pauseSim(page);
  await loadScenario(page, SCENARIO);

  console.log(`Advancing to tick ${TICK}...`);
  await advanceToTick(page, TICK);

  // Unpause so renderer runs continuously for perf measurement
  await page.evaluate(() => {
    const btn = document.getElementById('btn-play-pause');
    if (btn && btn.textContent.trim().includes('PAUSED')) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // Activate heatmap mode if requested
  if (HEATMAP) {
    await page.evaluate((mode) => {
      const select = document.getElementById('color-mode-select');
      if (select) { select.value = mode; select.dispatchEvent(new Event('change')); }
    }, HEATMAP);
    await new Promise(r => setTimeout(r, 200));
  }

  const stats = await getWorldStats(page);
  console.log(`Tick ${stats.tick}: ${stats.plants} plants, ${stats.species.length} species`);

  const framePaths = [];
  const perfResults = [];

  for (const cam of cameraList) {
    console.log(`\n  Camera: ${cam.name} (${cam.key})`);

    await setCamera(page, cam.position, cam.target);

    // Warmup: render frames so perf tracker EMA stabilizes
    console.log(`    Warming up (${WARMUP} frames)...`);
    await warmupFrames(page, WARMUP);

    // Collect perf data
    const perf = await getPerfData(page);
    if (perf) {
      perfResults.push({ camera: cam.name, ...perf });
      console.log(`    FPS: ${perf.fps.toFixed(1)}, Frame: ${perf.frameMs.toFixed(1)}ms`);
    }

    // Capture screenshot
    const filename = `perf-${cam.key}.jpg`;
    const filepath = join(OUT, filename);
    await captureScreenshot(page, filepath);

    const label = perf
      ? `${cam.name}  |  ${perf.fps.toFixed(0)} FPS  ${perf.frameMs.toFixed(1)}ms`
      : cam.name;
    framePaths.push({ path: filepath, label });
    console.log(`    Captured ${filename}`);
  }

  // Contact sheet
  console.log('\nBuilding contact sheet...');
  await buildContactSheet(framePaths, {
    cols: Math.min(cameraList.length, 3),
    width: WIDTH,
    height: HEIGHT,
    outPath: join(OUT, 'perf-contact-sheet.jpg'),
  });

  // Print summary table
  if (perfResults.length > 0) {
    console.log('\n── Performance Summary ──\n');

    // Collect all labels that have non-trivial time in any camera
    const allLabels = perfResults[0].entries.map(e => e.label);
    const visibleLabels = allLabels.filter(label =>
      perfResults.some(r => {
        const e = r.entries.find(e => e.label === label);
        return e && e.avgMs >= 0.05;
      })
    );

    // Header
    const colW = { camera: 16, fps: 7, frame: 9 };
    const subCols = visibleLabels.map(l => ({ label: l, width: Math.max(l.length + 2, 9) }));

    let header = 'Camera'.padEnd(colW.camera) + 'FPS'.padStart(colW.fps) + 'Frame'.padStart(colW.frame);
    for (const sc of subCols) header += sc.label.padStart(sc.width);
    console.log(header);
    console.log('-'.repeat(header.length));

    for (const r of perfResults) {
      let line = r.camera.padEnd(colW.camera);
      line += r.fps.toFixed(1).padStart(colW.fps);
      line += (r.frameMs.toFixed(1) + 'ms').padStart(colW.frame);

      for (const sc of subCols) {
        const entry = r.entries.find(e => e.label === sc.label);
        const val = entry ? (entry.avgMs.toFixed(1) + 'ms') : '-';
        line += val.padStart(sc.width);
      }
      console.log(line);
    }
    console.log();
  }

} finally {
  await browser.close();
}

console.log(`Done! Output in ${OUT}/`);
