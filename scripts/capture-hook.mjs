/**
 * Capture the hook / intro experience.
 *
 * Two modes:
 *   --mode card      (default) Captures the context card overlay that first-time visitors see
 *   --mode cinematic           Captures the cinematic camera choreography (via ?hook)
 *
 * Usage:
 *   node scripts/capture-hook.mjs [--mode card|cinematic] [--port 5173]
 */

import { join } from 'path';
import {
  getArg, launchBrowser, navigateToApp, captureScreenshot, buildContactSheet,
} from './capture-utils.mjs';

// ── Config ──

const args = process.argv.slice(2);
const PORT = getArg(args, '--port', '5173');
const MODE = getArg(args, '--mode', 'card');
const WIDTH = 1280;
const HEIGHT = 960;
const OUT = 'screenshots';

// Cinematic keyframes (seconds after page load)
// Hook runs at 5x (~15 ticks/sec), camera reaches mid-view by tick 180 (~12s)
const CINEMATIC_KEYFRAMES = [
  { sec: 0,  label: 'First paint — close-up, near ground' },
  { sec: 2,  label: '2s — title card: "Overgreen"' },
  { sec: 5,  label: '5s — subtitle, colony sprouting' },
  { sec: 8,  label: '8s — camera pulling back, spreading' },
  { sec: 12, label: '12s — mid-view, biome differentiation' },
  { sec: 17, label: '17s — moneyshot: river green, arid empty' },
  { sec: 22, label: '22s — reveal expected' },
  { sec: 30, label: '30s — post-reveal, full UI' },
];

// Card keyframes (seconds after page load)
const CARD_KEYFRAMES = [
  { sec: 1,  label: 'Context card over Genesis terrain' },
  { sec: 3,  label: 'Context card fully visible' },
];

const KEYFRAMES = MODE === 'cinematic' ? CINEMATIC_KEYFRAMES : CARD_KEYFRAMES;
const prefix = MODE === 'cinematic' ? 'hook-cinematic' : 'hook-card';

// ── Main ──

console.log(`Mode: ${MODE} | Launching browser at ${WIDTH}x${HEIGHT}...`);
const { browser, page } = await launchBrowser(WIDTH, HEIGHT);

try {
  // Clear localStorage so hook/intro runs fresh
  await navigateToApp(page, PORT);
  await page.evaluate(() => localStorage.removeItem('overgreen-hook-seen'));

  if (MODE === 'cinematic') {
    // Reload with ?hook to trigger cinematic mode
    console.log('Reloading with ?hook for cinematic experience...');
    await page.goto(`http://localhost:${PORT}/?hook`, { waitUntil: 'networkidle0', timeout: 30000 });
  } else {
    // Reload for fresh intro card experience
    console.log('Reloading for fresh intro card...');
    await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  }
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
      hookActive: document.body.classList.contains('hook-active'),
      introCardVisible: !document.getElementById('hook-intro-card')?.classList.contains('hidden'),
    }));
    console.log(`  [${kf.sec}s] Tick ${stats.tick}, ${stats.plants} plants | hook: ${stats.hookActive ? 'active' : 'done'}, card: ${stats.introCardVisible ? 'yes' : 'no'}`);

    const filename = `${prefix}-${String(kf.sec).padStart(3, '0')}s.jpg`;
    const filepath = join(OUT, filename);
    await captureScreenshot(page, filepath, 90);
    framePaths.push({ path: filepath, label: kf.label });
    console.log(`  Captured ${filename}`);
  }

  console.log(`\nBuilding ${prefix} contact sheet...`);
  await buildContactSheet(framePaths, {
    cols: MODE === 'cinematic' ? 4 : 2,
    width: WIDTH,
    height: HEIGHT,
    outPath: join(OUT, `${prefix}-contact-sheet.jpg`),
  });

} finally {
  await browser.close();
}

console.log('Done!');
