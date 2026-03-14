/**
 * Capture the full Natural Selection 101 experiment flow.
 * Clicks through every step, screenshots each, builds a contact sheet.
 *
 * Usage: node scripts/capture-experiment.mjs [--port 5173]
 */

import { join } from 'path';
import {
  getArg, launchBrowser, captureScreenshot, buildContactSheet,
} from './capture-utils.mjs';

const args = process.argv.slice(2);
const PORT = getArg(args, '--port', '5173');
const WIDTH = 1280;
const HEIGHT = 960;
const OUT = 'screenshots';

console.log(`Launching browser at ${WIDTH}x${HEIGHT}...`);
const { browser, page } = await launchBrowser(WIDTH, HEIGHT);

async function waitForExperimentCard(timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const visible = await page.evaluate(() => {
      const card = document.querySelector('.experiment-card');
      return card && card.style.display !== 'none';
    });
    if (visible) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function getExperimentState() {
  return page.evaluate(() => {
    const card = document.querySelector('.experiment-card');
    if (!card || card.style.display === 'none') return null;
    const title = card.querySelector('.experiment-title')?.textContent ?? '';
    const body = card.querySelector('.experiment-body')?.textContent ?? '';
    const step = card.querySelector('.experiment-step-indicator')?.textContent ?? '';
    const continueBtn = card.querySelector('.experiment-continue');
    const hasContinue = continueBtn && continueBtn.style.display !== 'none';
    return { title, body: body.substring(0, 100), step, hasContinue };
  });
}

async function clickContinue() {
  await page.evaluate(() => {
    const btn = document.querySelector('.experiment-continue');
    if (btn) btn.click();
  });
}

async function waitForStepChange(prevStep, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const state = await getExperimentState();
    if (!state) {
      // Card might have hidden (wrapUp or complete)
      await new Promise(r => setTimeout(r, 500));
      const recheck = await getExperimentState();
      if (recheck && recheck.step !== prevStep) return recheck;
      if (!recheck) return null; // experiment ended
    } else if (state.step !== prevStep) {
      return state;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`  Timeout waiting for step change from "${prevStep}"`);
  return null;
}

async function getWorldInfo() {
  return page.evaluate(() => ({
    tick: window.__world?.tick ?? 0,
    plants: window.__world?.plants?.size ?? 0,
    species: window.__world?.species?.size ?? 0,
  }));
}

try {
  // Navigate fresh
  const url = `http://localhost:${PORT}`;
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 10000 });

  // Clear localStorage for fresh intro
  await page.evaluate(() => localStorage.removeItem('overgreen-hook-seen'));
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));

  const framePaths = [];

  // ── Frame 0: Intro card ──
  console.log('\n[0] Intro card');
  await captureScreenshot(page, join(OUT, 'exp-00-intro-card.jpg'), 90);
  framePaths.push({ path: join(OUT, 'exp-00-intro-card.jpg'), label: '0: Intro card' });

  // ── Click "Natural Selection 101" ──
  console.log('\n[1] Clicking "Natural Selection 101"...');
  await page.evaluate(() => {
    document.getElementById('hook-btn-experiment')?.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Wait for experiment card to appear
  const cardVisible = await waitForExperimentCard(10000);
  if (!cardVisible) {
    console.log('ERROR: Experiment card did not appear!');
    throw new Error('Experiment card not visible');
  }

  let stepNum = 1;
  let prevStepLabel = '';

  // Loop through all steps
  while (true) {
    const state = await getExperimentState();
    if (!state) {
      console.log('  Experiment card hidden — checking if complete...');
      await new Promise(r => setTimeout(r, 1000));
      const recheck = await getExperimentState();
      if (!recheck) {
        console.log('  Experiment complete (no card visible).');
        break;
      }
    }

    const info = await getWorldInfo();
    const label = state ? state.step : 'Complete';
    console.log(`\n[${stepNum}] ${label} | "${state?.title}" | Tick ${info.tick}, ${info.plants} plants, ${info.species} species`);
    if (state?.body) console.log(`  Body: ${state.body}...`);

    // Wait a moment for any animations/renders to settle
    await new Promise(r => setTimeout(r, 500));

    const filename = `exp-${String(stepNum).padStart(2, '0')}-${(state?.title ?? 'complete').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;
    await captureScreenshot(page, join(OUT, filename), 90);
    framePaths.push({ path: join(OUT, filename), label: `${stepNum}: ${state?.title ?? 'Complete'}` });

    prevStepLabel = state?.step ?? '';

    if (state?.step === 'Complete') {
      // This is the wrapUp — we're done
      break;
    }

    if (state?.hasContinue) {
      console.log('  Clicking Continue...');
      await clickContinue();
      await new Promise(r => setTimeout(r, 500));

      // Wait for next step (may need to wait for sim trigger)
      console.log('  Waiting for next step...');
      const next = await waitForStepChange(prevStepLabel, 120000);
      if (!next) {
        // Could be wrapUp with no step indicator change
        await new Promise(r => setTimeout(r, 2000));
      }
    } else {
      // No continue button — waiting for trigger
      console.log('  No Continue button — waiting for trigger...');
      const next = await waitForStepChange(prevStepLabel, 120000);
      if (!next) {
        console.log('  Timeout or experiment ended.');
        break;
      }
    }

    stepNum++;

    if (stepNum > 15) {
      console.log('  Safety limit reached.');
      break;
    }
  }

  // Build contact sheet
  console.log(`\nBuilding experiment contact sheet (${framePaths.length} frames)...`);
  await buildContactSheet(framePaths, {
    cols: 3,
    width: WIDTH,
    height: HEIGHT,
    outPath: join(OUT, 'experiment-flow-contact-sheet.jpg'),
  });

} finally {
  await browser.close();
}

console.log('Done!');
