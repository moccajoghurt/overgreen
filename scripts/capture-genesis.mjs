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

import { join } from 'path';
import {
  getArg, launchBrowser, navigateToApp, pauseSim, loadScenario,
  advanceToTick, getWorldStats, captureScreenshot, buildContactSheet,
} from './capture-utils.mjs';

// ── Config ──

const args = process.argv.slice(2);
const PORT = getArg(args, '--port', '5173');
const WIDTH = parseInt(getArg(args, '--width', '1024'), 10);
const HEIGHT = parseInt(getArg(args, '--height', '768'), 10);
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

console.log(`Launching browser at ${WIDTH}x${HEIGHT}...`);
const { browser, page } = await launchBrowser(WIDTH, HEIGHT);

try {
  await navigateToApp(page, PORT);
  await pauseSim(page);
  await loadScenario(page, 'genesis');

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
    await advanceToTick(page, kf.tick);

    const stats = await getWorldStats(page);
    console.log(`  Tick ${stats.tick}: ${stats.plants} plants, ${stats.species.length} species: ${stats.species.map(s => `${s.name}(${s.count})`).join(', ')}`);

    const filename = `genesis-tick-${String(kf.tick).padStart(5, '0')}.jpg`;
    const filepath = join(OUT, filename);
    await captureScreenshot(page, filepath);
    framePaths.push({ path: filepath, label: `Tick ${kf.tick}: ${kf.label}` });
    console.log(`  Captured ${filename} — ${kf.label}`);
  }

  console.log('\nBuilding contact sheet...');
  await buildContactSheet(framePaths, {
    cols: 3,
    width: WIDTH,
    height: HEIGHT,
    outPath: join(OUT, 'genesis-contact-sheet.jpg'),
  });

} finally {
  await browser.close();
}

console.log(`Done! Output in ${OUT}/`);
