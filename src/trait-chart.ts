import { History } from './types';
import { TRAITS } from './trait-defs';
import { niceStep } from './ui-utils';

const GRID_COLOR = 'rgba(255,255,255,0.07)';
const LABEL_COLOR = 'rgba(255,255,255,0.35)';
const LABEL_FONT = '10px monospace';

export function createTraitChart(container: HTMLElement) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  let w = 0, h = 0;
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
    lastRenderedTick = -1;
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function update(history: History): void {
    const snaps = history.snapshots;
    if (snaps.length === 0) return;

    const currentTick = snaps[snaps.length - 1].tick;
    if (currentTick === lastRenderedTick) return;
    lastRenderedTick = currentTick;

    const pad = { left: 30, right: 8, top: 6, bottom: 16 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    if (plotW <= 0 || plotH <= 0) return;

    const xScale = snaps.length > 1 ? plotW / (snaps.length - 1) : plotW;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Y grid lines (0 to 1 range)
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.font = LABEL_FONT;
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let v = 0.2; v <= 0.8; v += 0.2) {
      const y = pad.top + plotH - v * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(1), pad.left - 4, y);
    }

    // Draw trait lines
    for (const trait of TRAITS) {
      ctx.beginPath();
      ctx.strokeStyle = trait.color;
      ctx.lineWidth = 1.5;

      for (let i = 0; i < snaps.length; i++) {
        const val = snaps[i].traitAverages[trait.shortKey];
        const x = pad.left + i * xScale;
        const y = pad.top + plotH - val * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Legend (top-right)
    const legendX = pad.left + plotW - 4;
    let legendY = pad.top + 4;
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    for (const trait of TRAITS) {
      ctx.fillStyle = trait.color;
      ctx.fillText(trait.label, legendX, legendY);
      legendY += 12;
    }

    // X-axis tick labels
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const firstTick = snaps[0].tick;
    const lastTick = snaps[snaps.length - 1].tick;
    const tickRange = lastTick - firstTick;
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

  function reset(): void {
    lastRenderedTick = -1;
  }

  return { update, destroy, reset };
}

