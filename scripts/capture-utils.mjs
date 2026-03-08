/**
 * Shared utilities for capture scripts (Puppeteer + Sharp).
 *
 * Used by: capture-genesis.mjs, capture-hook.mjs, capture-perf.mjs
 */

import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

// ── CLI helpers ──

export function getArg(args, name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

// ── Browser lifecycle ──

export async function launchBrowser(width, height) {
  await mkdir('screenshots', { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    timeout: 60000,
    args: [
      `--window-size=${width},${height}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  return { browser, page };
}

export async function navigateToApp(page, port) {
  const url = `http://localhost:${port}`;
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 10000 });
}

// ── Sim control ──

export async function pauseSim(page) {
  await page.evaluate(() => {
    const btn = document.getElementById('btn-play-pause');
    if (btn && btn.textContent.trim().includes('Running')) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));
}

export async function loadScenario(page, scenarioId) {
  await page.evaluate((id) => {
    // Try featured map buttons first
    const btn = document.querySelector(`button[data-scenario-id="${id}"]`);
    if (btn) { btn.click(); return; }
    // Try dev dropdown buttons
    const dropdown = document.getElementById('dev-scenario-dropdown');
    if (dropdown) {
      const devBtns = dropdown.querySelectorAll('button');
      for (const b of devBtns) {
        if (b.textContent.trim().toLowerCase() === id.toLowerCase()) { b.click(); return; }
      }
    }
    throw new Error(`Scenario "${id}" not found`);
  }, scenarioId);
  await new Promise(r => setTimeout(r, 1000));
}

export async function advanceToTick(page, targetTick) {
  const currentTick = await page.evaluate(() => window.__world.tick);
  const ticksNeeded = targetTick - currentTick;

  if (ticksNeeded > 0) {
    console.log(`  Advancing ${ticksNeeded} ticks to ${targetTick}...`);
    await page.evaluate((n) => {
      for (let i = 0; i < n; i++) window.__doTick();
      window.__updateUI();
    }, ticksNeeded);
  }

  // Let the renderer draw the current state
  await new Promise(r => setTimeout(r, 800));
}

// ── Camera control ──

export async function setCamera(page, position, target) {
  await page.evaluate((pos, tgt) => {
    window.__setCamera(pos, tgt);
  }, position, target);
  // Let the renderer settle after camera move
  await new Promise(r => setTimeout(r, 200));
}

// ── Stats ──

export async function getWorldStats(page) {
  return page.evaluate(() => ({
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
}

export async function getPerfData(page) {
  return page.evaluate(() => {
    const pt = window.__perfTracker;
    if (!pt) return null;
    return {
      fps: pt.getFps(),
      frameMs: pt.getFrameMs(),
      entries: pt.getEntries(),
    };
  });
}

// ── Screenshot ──

export async function captureScreenshot(page, filepath, quality = 85) {
  await page.screenshot({ path: filepath, type: 'jpeg', quality });
}

// ── Contact sheet ──

export async function buildContactSheet(frames, { cols, width, height, outPath }) {
  const rows = Math.ceil(frames.length / cols);
  const labelH = 30;
  const cellW = width;
  const cellH = height + labelH;
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
      input: await sharp(frames[i].path).resize(cellW, height).toBuffer(),
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
    .toFile(outPath);

  console.log(`  Saved ${outPath} (${sheetW}x${sheetH})`);
}

// ── Warmup ──

/** Render N frames and wait for perf tracker EMA to stabilize. */
export async function warmupFrames(page, count) {
  await page.evaluate((n) => {
    return new Promise((resolve) => {
      let rendered = 0;
      function frame() {
        rendered++;
        if (rendered >= n) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }, count);
}
