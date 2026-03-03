import { History, SpeciesColor, SEASON_LENGTH, YEAR_LENGTH } from './types';
import { speciesColorToRgba } from './ui-utils';

const TOP_N = 8;
const STICKY_TICKS = 50;
const GRID_COLOR = 'rgba(255,255,255,0.07)';
const LABEL_COLOR = 'rgba(255,255,255,0.35)';
const LABEL_FONT = '10px monospace';
const SEASON_LABELS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SEASON_COLORS = [
  'rgba(100,200,100,0.08)', // Spring — green tint
  'rgba(230,200,50,0.08)',  // Summer — yellow tint
  'rgba(200,130,50,0.08)',  // Autumn — orange tint
  'rgba(130,170,230,0.10)', // Winter — blue tint
];

interface TrackedSpecies {
  speciesId: number;
  lastInTop: number; // tick when last seen in top N
}

export function createPopulationChart(container: HTMLElement) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  let w = 0, h = 0;
  const tracked: Map<number, TrackedSpecies> = new Map();
  let lastRenderedTick = -1;

  function resize() {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastRenderedTick = -1; // force redraw
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function update(history: History, speciesColors: Map<number, SpeciesColor>): void {
    const snaps = history.snapshots;
    if (snaps.length === 0) return;

    const currentTick = snaps[snaps.length - 1].tick;
    if (currentTick === lastRenderedTick) return;
    lastRenderedTick = currentTick;

    // Determine which species to chart (top N by latest count, sticky)
    const latest = snaps[snaps.length - 1].populations;
    const sorted = [...latest.entries()].sort((a, b) => b[1] - a[1]);
    const topIds = new Set(sorted.slice(0, TOP_N).map(e => e[0]));

    // Update tracked set
    for (const id of topIds) {
      const t = tracked.get(id);
      if (t) {
        t.lastInTop = currentTick;
      } else {
        tracked.set(id, { speciesId: id, lastInTop: currentTick });
      }
    }
    // Remove species that have been out of top N for too long
    for (const [id, t] of tracked) {
      if (currentTick - t.lastInTop > STICKY_TICKS && !topIds.has(id)) {
        tracked.delete(id);
      }
    }

    // Order: largest population at bottom of stack
    const chartSpecies = [...tracked.keys()].sort((a, b) => {
      return (latest.get(b) ?? 0) - (latest.get(a) ?? 0);
    });

    // Find max total for Y scaling
    let maxTotal = 1;
    for (const snap of snaps) {
      let total = 0;
      for (const id of chartSpecies) {
        total += snap.populations.get(id) ?? 0;
      }
      if (total > maxTotal) maxTotal = total;
    }
    maxTotal = Math.ceil(maxTotal * 1.1); // 10% padding

    const pad = { left: 30, right: 8, top: 6, bottom: 16 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    if (plotW <= 0 || plotH <= 0) return;

    const xScale = snaps.length > 1 ? plotW / (snaps.length - 1) : plotW;
    const yScale = plotH / maxTotal;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Season background bands
    const firstTick = snaps[0].tick;
    const lastTick = snaps[snaps.length - 1].tick;
    const tickRange = lastTick - firstTick;
    if (tickRange > 0) {
      // Find the first season boundary at or before firstTick
      const firstSeasonStart = Math.floor(firstTick / SEASON_LENGTH) * SEASON_LENGTH;
      for (let sTick = firstSeasonStart; sTick < lastTick; sTick += SEASON_LENGTH) {
        const sEnd = sTick + SEASON_LENGTH;
        const clampStart = Math.max(sTick, firstTick);
        const clampEnd = Math.min(sEnd, lastTick);
        if (clampStart >= clampEnd) continue;

        const x0 = pad.left + ((clampStart - firstTick) / tickRange) * plotW;
        const x1 = pad.left + ((clampEnd - firstTick) / tickRange) * plotW;
        const seasonIdx = Math.floor((sTick % YEAR_LENGTH) / SEASON_LENGTH);

        // Background band
        ctx.fillStyle = SEASON_COLORS[seasonIdx];
        ctx.fillRect(x0, pad.top, x1 - x0, plotH);

        // Label at center of visible portion
        const bandW = x1 - x0;
        if (bandW > 40) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(SEASON_LABELS[seasonIdx], x0 + bandW / 2, pad.top + 2);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.font = LABEL_FONT;
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const gridStep = niceStep(maxTotal, 4);
    for (let v = gridStep; v < maxTotal; v += gridStep) {
      const y = pad.top + plotH - v * yScale;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), pad.left - 4, y);
    }

    // Stacked areas — draw from top of stack to bottom so bottom species paints last (on top visually)
    // Build cumulative arrays
    const cumulative: number[][] = new Array(chartSpecies.length);
    for (let s = 0; s < chartSpecies.length; s++) {
      cumulative[s] = new Array(snaps.length);
    }

    for (let i = 0; i < snaps.length; i++) {
      let cum = 0;
      for (let s = 0; s < chartSpecies.length; s++) {
        cum += snaps[i].populations.get(chartSpecies[s]) ?? 0;
        cumulative[s][i] = cum;
      }
    }

    // Draw from last species to first (so bottom = largest species draws on top)
    for (let s = chartSpecies.length - 1; s >= 0; s--) {
      const speciesId = chartSpecies[s];
      const sc = speciesColors.get(speciesId);

      ctx.beginPath();
      // Top edge (this species' cumulative line)
      for (let i = 0; i < snaps.length; i++) {
        const x = pad.left + i * xScale;
        const y = pad.top + plotH - cumulative[s][i] * yScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // Bottom edge (previous species' cumulative, or zero line)
      for (let i = snaps.length - 1; i >= 0; i--) {
        const x = pad.left + i * xScale;
        const below = s > 0 ? cumulative[s - 1][i] : 0;
        const y = pad.top + plotH - below * yScale;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = sc ? speciesColorToRgba(sc, 0.7) : 'rgba(128,128,128,0.7)';
      ctx.fill();
    }

    // Tick labels on X axis
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xStep = niceStep(tickRange, 5);
    if (xStep > 0) {
      const startLabel = Math.ceil(firstTick / xStep) * xStep;
      for (let t = startLabel; t <= lastTick; t += xStep) {
        const i = snaps.length > 1
          ? ((t - firstTick) / tickRange) * (snaps.length - 1)
          : 0;
        const x = pad.left + i * xScale;
        ctx.fillText(String(t), x, pad.top + plotH + 3);
      }
    }
  }

  function destroy(): void {
    ro.disconnect();
    canvas.remove();
  }

  return { update, destroy };
}

function niceStep(range: number, targetLines: number): number {
  if (range <= 0) return 1;
  const rough = range / targetLines;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3.5) step = 2;
  else if (norm < 7.5) step = 5;
  else step = 10;
  return step * mag;
}
