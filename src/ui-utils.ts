import { SpeciesColor, World } from './types';
import { TRAITS } from './trait-defs';

/** Tick-scoped cache: computes all centroids in a single pass on first call per tick */
let _centroidCache: Map<number, { x: number; y: number }> = new Map();
let _centroidTick = -1;

export function speciesCentroid(world: World, speciesId: number): { x: number; y: number } | null {
  if (world.tick !== _centroidTick) {
    _centroidCache.clear();
    _centroidTick = world.tick;
    const sums = new Map<number, { sx: number; sy: number; count: number }>();
    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;
      let s = sums.get(plant.speciesId);
      if (!s) { s = { sx: 0, sy: 0, count: 0 }; sums.set(plant.speciesId, s); }
      s.sx += plant.x;
      s.sy += plant.y;
      s.count++;
    }
    for (const [sid, s] of sums) {
      _centroidCache.set(sid, { x: s.sx / s.count, y: s.sy / s.count });
    }
  }
  return _centroidCache.get(speciesId) ?? null;
}

/** Tick-scoped cache for lineage centroids */
let _lineageCentroidCache: Map<number, { x: number; y: number }> = new Map();
let _lineageCentroidTick = -1;

export function lineageCentroid(world: World, lineageRoot: number): { x: number; y: number } | null {
  if (world.tick !== _lineageCentroidTick) {
    _lineageCentroidCache.clear();
    _lineageCentroidTick = world.tick;
    const sums = new Map<number, { sx: number; sy: number; count: number }>();
    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;
      let s = sums.get(plant.lineageRoot);
      if (!s) { s = { sx: 0, sy: 0, count: 0 }; sums.set(plant.lineageRoot, s); }
      s.sx += plant.x;
      s.sy += plant.y;
      s.count++;
    }
    for (const [rid, s] of sums) {
      _lineageCentroidCache.set(rid, { x: s.sx / s.count, y: s.sy / s.count });
    }
  }
  return _lineageCentroidCache.get(lineageRoot) ?? null;
}

/** Convert a SpeciesColor (0-1 floats) to an rgb() CSS string */
export function speciesColorToRgb(sc: SpeciesColor): string {
  return `rgb(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)})`;
}

/** Convert a SpeciesColor to an rgba() CSS string */
export function speciesColorToRgba(sc: SpeciesColor, alpha: number): string {
  return `rgba(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)},${alpha})`;
}

/** Compute a "nice" axis step size for chart grid lines */
export function niceStep(range: number, targetLines: number): number {
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

/** Convert a hex color (#rgb or #rrggbb) to an rgba() CSS string */
export function hexToRgba(hex: string, alpha: number): string {
  let r: number, g: number, b: number;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Shared overlay DOM helpers ──

/** Tiny section header label (VITALS, GENOME, etc.) used by overlay cards. */
export function sectionLabel(text: string): HTMLElement {
  const lbl = document.createElement('div');
  lbl.style.cssText = `font-size:8px; font-weight:normal; color:rgba(255,255,255,0.35); margin-top:4px; letter-spacing:0.5px;`;
  lbl.textContent = text;
  return lbl;
}

/** Horizontal labeled stat bar with fill + value display. */
export function createBarRow(
  label: string,
  opts?: {
    labelWidth?: number;
    barHeight?: number;
    barMinWidth?: number;
    barColor?: string;
    valueWidth?: number;
    valueColor?: string;
  },
): { row: HTMLElement; barFill: HTMLElement; valueEl: HTMLElement } {
  const lw = opts?.labelWidth ?? 32;
  const bh = opts?.barHeight ?? 6;
  const bmw = opts?.barMinWidth ?? 50;
  const vc = opts?.valueColor ?? '#aaa';
  const vw = opts?.valueWidth ?? 28;

  const row = document.createElement('div');
  row.style.cssText = `display:flex; align-items:center; gap:4px; height:12px; margin-top:1px;`;

  const labelEl = document.createElement('span');
  labelEl.style.cssText = `font-size:9px; color:rgba(255,255,255,0.5); width:${lw}px; text-align:right;`;
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const barBg = document.createElement('div');
  barBg.style.cssText = `flex:1; height:${bh}px; background:rgba(255,255,255,0.08); border-radius:2px; position:relative; min-width:${bmw}px;`;
  const barFill = document.createElement('div');
  barFill.style.cssText = `position:absolute; top:0; left:0; height:100%; border-radius:2px; transition:width 0.15s ease;`;
  if (opts?.barColor) {
    barFill.style.background = opts.barColor;
  }
  barFill.style.width = '0%';
  barBg.appendChild(barFill);
  row.appendChild(barBg);

  const valueEl = document.createElement('span');
  valueEl.style.cssText = `font-size:9px; color:${vc}; min-width:${vw}px; text-align:right;`;
  row.appendChild(valueEl);

  return { row, barFill, valueEl };
}

/** Vertical equalizer bars for genome traits. */
export function createGenomeEqualizer(
  opts?: {
    width?: number;
    height?: number;
    fillAlpha?: number;
    transitionMs?: number;
    labelSize?: number;
  },
): { container: HTMLElement; barFills: HTMLElement[] } {
  const w = opts?.width ?? 120;
  const h = opts?.height ?? 20;
  const fa = opts?.fillAlpha ?? 0.6;
  const tm = opts?.transitionMs ?? 150;
  const ls = opts?.labelSize ?? 6;

  const container = document.createElement('div');
  container.style.cssText = `display:flex; gap:2px; width:${w}px; height:${h}px; margin-top:1px;`;
  const barFills: HTMLElement[] = [];

  for (const trait of TRAITS) {
    const col = document.createElement('div');
    col.style.cssText = `
      flex:1; position:relative;
      background:rgba(255,255,255,0.06);
      border-radius:2px 2px 0 0;
    `;
    const fill = document.createElement('div');
    fill.style.cssText = `
      position:absolute; bottom:0; left:0; width:100%;
      background:${hexToRgba(trait.color, fa)};
      border-radius:2px 2px 0 0;
      transition:height ${tm / 1000}s ease;
    `;
    fill.style.height = '0%';
    col.appendChild(fill);
    barFills.push(fill);

    const lbl = document.createElement('div');
    lbl.style.cssText = `
      position:absolute; bottom:1px; left:0; width:100%;
      text-align:center; font-size:${ls}px; line-height:1;
      color:rgba(255,255,255,0.4);
    `;
    lbl.textContent = trait.label[0];
    col.appendChild(lbl);

    container.appendChild(col);
  }

  return { container, barFills };
}
