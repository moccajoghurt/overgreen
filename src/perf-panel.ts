import { PerfTracker } from './perf';

export function createPerfPanel(container: HTMLElement, tracker: PerfTracker) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.85);color:#ccc;' +
    'font:11px/1.4 monospace;padding:8px 10px;border-radius:4px;pointer-events:none;' +
    'z-index:100;white-space:pre;display:none;';
  container.appendChild(el);

  let visible = false;
  let lastUpdate = 0;

  function update(): void {
    if (!visible) return;
    const now = performance.now();
    if (now - lastUpdate < 500) return;
    lastUpdate = now;

    const fps = tracker.getFps();
    const frameMs = tracker.getFrameMs();
    const entries = tracker.getEntries();

    // Compute child sums and "other" per category
    const totalMs = new Map<string, number>();  // from simTotal/renderTotal
    const childSum = new Map<string, number>(); // sum of children
    for (const e of entries) {
      if (e.label === 'simTotal') totalMs.set('sim', e.avgMs);
      else if (e.label === 'renderTotal') totalMs.set('render', e.avgMs);
      else if (e.label !== 'frame') {
        childSum.set(e.category, (childSum.get(e.category) ?? 0) + e.avgMs);
      }
    }

    // Find max for bar scaling (exclude totals and frame, include "other")
    let maxMs = 0.1;
    for (const e of entries) {
      if (e.label === 'frame' || e.label === 'simTotal' || e.label === 'renderTotal') continue;
      if (e.avgMs > maxMs) maxMs = e.avgMs;
    }
    for (const cat of ['sim', 'render']) {
      const other = Math.max(0, (totalMs.get(cat) ?? 0) - (childSum.get(cat) ?? 0));
      if (other > maxMs) maxMs = other;
    }

    // Find hottest per category
    const hottest = new Map<string, string>();
    const catMax = new Map<string, number>();
    for (const e of entries) {
      if (e.label === 'frame' || e.label === 'simTotal' || e.label === 'renderTotal') continue;
      const prev = catMax.get(e.category) ?? 0;
      if (e.avgMs > prev) {
        catMax.set(e.category, e.avgMs);
        hottest.set(e.category, e.label);
      }
    }

    let text = `${Math.round(fps)} FPS | ${frameMs.toFixed(1)}ms\n`;
    let currentCat = '';

    function appendOtherRow(cat: string): void {
      const other = Math.max(0, (totalMs.get(cat) ?? 0) - (childSum.get(cat) ?? 0));
      const barLen = other > 0.005 ? Math.max(1, Math.round((other / maxMs) * 20)) : 0;
      const bar = '\u25AE'.repeat(barLen);
      const padLabel = 'other'.padEnd(15);
      const padMs = other.toFixed(2).padStart(6) + 'ms';
      const warn = other > 0.5 ? ' \u2190 untracked!' : '';
      text += `  <span style="color:#888">${padLabel}${padMs} ${bar}</span>${warn}\n`;
    }

    for (const e of entries) {
      if (e.label === 'frame') continue;

      if (e.label === 'simTotal') {
        if (currentCat) appendOtherRow(currentCat);
        text += `\x1b[1mSIM\x1b[0m (${e.avgMs.toFixed(1)}ms)\n`;
        currentCat = 'sim';
        continue;
      }
      if (e.label === 'renderTotal') {
        if (currentCat) appendOtherRow(currentCat);
        text += `\x1b[1mRENDER\x1b[0m (${e.avgMs.toFixed(1)}ms)\n`;
        currentCat = 'render';
        continue;
      }

      const barLen = Math.max(1, Math.round((e.avgMs / maxMs) * 20));
      const bar = '\u25AE'.repeat(barLen);
      const isHot = hottest.get(e.category) === e.label && e.avgMs > 0.05;
      const padLabel = e.label.padEnd(15);
      const padMs = e.avgMs.toFixed(2).padStart(6) + 'ms';
      const hotMark = isHot ? ' \u2190 hot' : '';
      text += `  ${padLabel}${padMs} ${bar}${hotMark}\n`;
    }
    if (currentCat) appendOtherRow(currentCat);

    // Use innerHTML for color support
    // Protect existing <span> tags by replacing them with placeholders
    const spans: string[] = [];
    const withPlaceholders = text.replace(/<span[^>]*>.*?<\/span>/g, (m) => {
      spans.push(m);
      return `__SPAN${spans.length - 1}__`;
    });
    let escaped = withPlaceholders
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/\u2190 hot/g, '<span style="color:#f90">\u2190 hot</span>')
      .replace(/\u2190 untracked!/g, '<span style="color:#f44">\u2190 untracked!</span>');
    // Restore protected spans
    for (let i = 0; i < spans.length; i++) {
      escaped = escaped.replace(`__SPAN${i}__`, spans[i]);
    }
    // Strip ANSI codes and use simple category headers
    el.innerHTML = escaped
      .replace(/\x1b\[1m/g, '<b style="color:#fff">')
      .replace(/\x1b\[0m/g, '</b>');
  }

  function toggle(): void {
    visible = !visible;
    el.style.display = visible ? '' : 'none';
    if (visible) lastUpdate = 0; // force immediate refresh
  }

  function isVisible(): boolean {
    return visible;
  }

  return { update, toggle, isVisible };
}
