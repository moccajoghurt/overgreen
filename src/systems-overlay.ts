import { World, History, Genome, TerrainType, SEASON_NAMES, CLIMATE_ZONE_COUNT } from './types';
import { getEffectiveEnv, diagnoseTraitEffects, CellEnvironment } from './simulation/trait-effects';
import { TRAITS } from './trait-defs';
import { createPopulationChart } from './population-chart';
import { createTraitChart } from './trait-chart';
import { createEventTicker } from './event-ticker';

export interface SystemsOverlay {
  show(): void;
  hide(): void;
  update(world: World, history: History): void;
  toggle(): void;
  isVisible(): boolean;
  reset(): void;
}

// ── Helpers ──

function fmt(n: number, d = 1): string { return n.toFixed(d); }
function pct(n: number): string { return (n * 100).toFixed(0) + '%'; }
function comma(n: number): string { return n.toLocaleString(); }

function makeSection(title: string, color: string, fullWidth?: boolean): { wrap: HTMLDivElement; body: HTMLDivElement } {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:4px;' + (fullWidth ? 'grid-column:1/-1;' : '');

  const hdr = document.createElement('div');
  hdr.style.cssText = `color:${color};font-weight:bold;font-size:11px;letter-spacing:1px;border-bottom:1px solid ${color}44;padding-bottom:1px;margin-bottom:2px;`;
  hdr.textContent = title;
  wrap.appendChild(hdr);

  const body = document.createElement('div');
  body.style.cssText = 'padding-left:2px;';
  wrap.appendChild(body);

  return { wrap, body };
}

type Spans = Record<string, HTMLSpanElement>;

function kvRow(parent: HTMLElement, spans: Spans, pairs: [string, string][]): void {
  const r = document.createElement('div');
  r.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px 12px;';
  for (const [label, key] of pairs) {
    const sp = document.createElement('span');
    const val = document.createElement('span');
    val.style.color = '#e8e8e8';
    sp.textContent = label + ' ';
    sp.style.color = '#999';
    sp.appendChild(val);
    r.appendChild(sp);
    spans[key] = val;
  }
  parent.appendChild(r);
}

interface StressBar {
  val: HTMLSpanElement;
  bar: HTMLSpanElement;
}

function stressRow(parent: HTMLElement, label: string): StressBar {
  const r = document.createElement('div');
  r.style.cssText = 'display:flex;align-items:center;gap:4px;';

  const lbl = document.createElement('span');
  lbl.style.cssText = 'width:48px;color:#999;';
  lbl.textContent = label;
  r.appendChild(lbl);

  const val = document.createElement('span');
  val.style.cssText = 'width:28px;text-align:right;color:#e8e8e8;';
  r.appendChild(val);

  const bar = document.createElement('span');
  bar.style.cssText = 'display:inline-block;width:48px;height:7px;border-radius:2px;background:#333;';
  r.appendChild(bar);

  parent.appendChild(r);
  return { val, bar };
}

// ── Sparkline ring buffer + renderer ──

const HISTORY_LEN = 200;

class RingBuf {
  data = new Float64Array(HISTORY_LEN);
  len = 0;
  idx = 0;

  push(v: number): void {
    this.data[this.idx] = v;
    this.idx = (this.idx + 1) % HISTORY_LEN;
    if (this.len < HISTORY_LEN) this.len++;
  }

  /** oldest → newest */
  each(fn: (v: number, i: number) => void): void {
    const start = this.len < HISTORY_LEN ? 0 : this.idx;
    for (let i = 0; i < this.len; i++) {
      fn(this.data[(start + i) % HISTORY_LEN], i);
    }
  }

  reset(): void { this.len = 0; this.idx = 0; }
}

function makeSparkCanvas(h = 18): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.style.cssText = `width:100%;height:${h}px;display:block;margin:3px 0 1px;border-radius:2px;background:#1a1a1a;`;
  return c;
}

function drawSparkline(canvas: HTMLCanvasElement, buf: RingBuf, color: string, zero = false): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.round(rect.width * dpr);
  const ch = Math.round(rect.height * dpr);
  if (cw <= 0 || ch <= 0) return;
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;

  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = rect.width, H = rect.height;
  ctx.clearRect(0, 0, W, H);
  if (buf.len < 2) return;

  let min = Infinity, max = -Infinity;
  buf.each(v => { if (v < min) min = v; if (v > max) max = v; });
  if (zero && min > 0) min = 0;
  const range = max - min || 1;

  // zero line
  if (zero && min < 0 && max > 0) {
    const zy = H - 2 - ((0 - min) / range) * (H - 4);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, zy); ctx.lineTo(W, zy); ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const step = W / (buf.len - 1);
  buf.each((v, i) => {
    const x = i * step;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function makePropBar(): { el: HTMLDivElement; segments: HTMLSpanElement[] } {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;height:8px;border-radius:2px;overflow:hidden;margin:3px 0 1px;background:#1a1a1a;';
  const colors = ['#5a9e5a', '#8bc48b', '#c4b870', '#333'];
  const segments: HTMLSpanElement[] = [];
  for (const c of colors) {
    const s = document.createElement('span');
    s.style.cssText = `height:100%;background:${c};transition:width 0.3s;`;
    s.style.width = '0%';
    el.appendChild(s);
    segments.push(s);
  }
  return { el, segments };
}

// ── Main factory ──

const TERRAIN_COUNT = 6;

export function createSystemsOverlay(container: HTMLElement): SystemsOverlay {
  const el = document.createElement('div');
  el.style.cssText = `
    position:absolute;top:8px;right:8px;width:700px;
    max-height:calc(100% - 16px);overflow-y:hidden;
    background:rgba(0,0,0,0.85);color:#ccc;
    font:11px/1.4 monospace;padding:8px 10px;
    border-radius:4px;pointer-events:auto;
    z-index:30;display:none;
  `;
  container.appendChild(el);

  // ── Title ──
  const title = document.createElement('div');
  title.style.cssText = 'color:#8cb4ff;font-weight:bold;font-size:12px;letter-spacing:2px;margin-bottom:4px;display:flex;justify-content:space-between;';
  title.innerHTML = 'SYSTEMS DASHBOARD <span style="color:#555;font-size:10px;font-weight:normal">F4</span>';
  el.appendChild(title);

  const spans: Spans = {};

  // ── Header ──
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'margin-bottom:8px;color:#aaa;border-bottom:1px solid #333;padding-bottom:4px;';
  kvRow(headerRow, spans, [['', 'season'], ['Tick', 'tick'], ['Year', 'year']]);
  el.appendChild(headerRow);

  // ── Grid ──
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;';
  el.appendChild(grid);

  // ── Row 1L: Water ──
  const water = makeSection('WATER', '#4a90d9');
  kvRow(water.body, spans, [['Avg', 'wAvg'], ['Min', 'wMin'], ['Max', 'wMax'], ['Lo', 'wLow'], ['Dr', 'wDroughts']]);
  const waterSpark = makeSparkCanvas();
  water.body.appendChild(waterSpark);
  grid.appendChild(water.wrap);

  // ── Row 1R: Light / Tiers ──
  const lightTiers = makeSection('LIGHT / TIERS', '#7bc47b');
  kvRow(lightTiers.body, spans, [['Avg', 'lAvg'], ['Shade', 'lShaded'], ['Seas', 'lMult']]);
  kvRow(lightTiers.body, spans, [['Can', 'tCan'], ['Und', 'tUnd'], ['Gnd', 'tGnd'], ['Ety', 'tEmpty'], ['Mul', 'tMulti']]);
  const tierBar = makePropBar();
  const tierLegend = document.createElement('div');
  tierLegend.style.cssText = 'display:flex;gap:8px;font-size:9px;color:#888;margin-top:1px;';
  tierLegend.innerHTML = '<span><span style="color:#5a9e5a">\u25A0</span> Can</span><span><span style="color:#8bc48b">\u25A0</span> Und</span><span><span style="color:#c4b870">\u25A0</span> Gnd</span><span><span style="color:#333">\u25A0</span> Empty</span>';
  lightTiers.body.appendChild(tierBar.el);
  lightTiers.body.appendChild(tierLegend);
  grid.appendChild(lightTiers.wrap);

  // ── Row 2L: Energy Flow ──
  const energy = makeSection('ENERGY FLOW', '#e89040');
  kvRow(energy.body, spans, [['Prod', 'eProd'], ['Maint', 'eMaint'], ['Net', 'eNet'], ['Avg', 'eAvg']]);
  const energySpark = makeSparkCanvas();
  energy.body.appendChild(energySpark);
  grid.appendChild(energy.wrap);

  // ── Row 2R: Environment Stress ──
  const envSec = makeSection('ENVIRONMENT STRESS', '#c57070');
  envSec.body.style.cssText = 'padding-left:2px;display:grid;grid-template-columns:1fr 1fr;gap:1px 6px;';
  const stressBars: Record<string, StressBar> = {};
  for (const [key, label] of [
    ['droughtStress', 'Drought'], ['frostRisk', 'Frost'], ['diseasePressure', 'Disease'],
    ['windExposure', 'Wind'], ['waterlogging', 'Waterlog'], ['heatStress', 'Heat'],
    ['soilFertility', 'Fertility'], ['extremeAridity', 'ExtrArid'],
  ] as const) {
    stressBars[key] = stressRow(envSec.body, label);
  }
  grid.appendChild(envSec.wrap);

  // ── Row 3 (F): Trait Effects ──
  const traitLookup = new Map<string, { label: string; color: string }>();
  for (const t of TRAITS) traitLookup.set(t.genomeKey, { label: t.label, color: t.color });

  const traitFx = makeSection('TRAIT EFFECTS', '#c0a060', true);
  const traitFxHint = document.createElement('div');
  traitFxHint.style.cssText = 'color:#777;font-size:9px;margin-bottom:3px;';
  traitFxHint.textContent = 'Which traits help (green) or hurt (red) photosynthesis right now';
  traitFx.body.appendChild(traitFxHint);
  const traitFxTotal = document.createElement('div');
  traitFxTotal.style.cssText = 'margin-bottom:4px;font-size:10px;';
  traitFx.body.appendChild(traitFxTotal);
  const traitFxRows = document.createElement('div');
  traitFxRows.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:1px 8px;';
  traitFx.body.appendChild(traitFxRows);
  grid.appendChild(traitFx.wrap);

  // ── Row 4L: Reproduction / Pop ──
  const repro = makeSection('REPRODUCTION / POP', '#b080d0');
  kvRow(repro.body, spans, [['Att', 'rAttempt'], ['Germ', 'rGerm'], ['Rate', 'rRate'], ['Bank', 'rBank']]);
  kvRow(repro.body, spans, [['Plants', 'pTotal'], ['Species', 'pSpecies']]);
  grid.appendChild(repro.wrap);

  // ── Row 4R: Herbivores ──
  const herb = makeSection('HERBIVORES', '#a0826a');
  kvRow(herb.body, spans, [['Pop', 'hPop'], ['Births', 'hBirth'], ['Deaths', 'hDeath'], ['Graze', 'hGraze']]);
  const herbSpark = makeSparkCanvas();
  herb.body.appendChild(herbSpark);
  grid.appendChild(herb.wrap);

  // ── Row 5 (F): Events / Deaths ──
  const evDeaths = makeSection('EVENTS / DEATHS', '#e06060', true);
  evDeaths.body.style.cssText = 'padding-left:2px;display:flex;gap:16px;';
  const eventsText = document.createElement('div');
  eventsText.style.cssText = 'flex:1;';
  evDeaths.body.appendChild(eventsText);
  const deathKVs = document.createElement('div');
  kvRow(deathKVs, spans, [['Starved', 'dStarve'], ['Age', 'dAge'], ['Fire', 'dFire'], ['Dis', 'dDisease']]);
  evDeaths.body.appendChild(deathKVs);
  grid.appendChild(evDeaths.wrap);

  // ── Row 6 (F): Population History chart ──
  const popChartSec = makeSection('POPULATION HISTORY', '#8cb4ff', true);
  const popChartContainer = document.createElement('div');
  popChartContainer.style.cssText = 'width:100%;height:90px;position:relative;overflow:hidden;';
  popChartSec.body.appendChild(popChartContainer);
  grid.appendChild(popChartSec.wrap);
  const popChart = createPopulationChart(popChartContainer);

  // ── Row 7 (F): Trait History chart ──
  const traitChartSec = makeSection('TRAIT HISTORY', '#b080d0', true);
  const traitChartContainer = document.createElement('div');
  traitChartContainer.style.cssText = 'width:100%;height:90px;position:relative;overflow:hidden;';
  traitChartSec.body.appendChild(traitChartContainer);
  grid.appendChild(traitChartSec.wrap);
  const traitChartInst = createTraitChart(traitChartContainer);

  // ── Row 8 (F): Event Log ──
  const tickerSec = makeSection('EVENT LOG', '#8f8', true);
  const tickerContainer = document.createElement('div');
  tickerContainer.className = 'sys-ticker';
  tickerContainer.style.cssText = 'width:100%;height:100px;overflow-y:auto;font-size:11px;line-height:1.4;scrollbar-width:thin;scrollbar-color:#444 transparent;';
  tickerSec.body.appendChild(tickerContainer);
  grid.appendChild(tickerSec.wrap);
  const tickerInst = createEventTicker(tickerContainer);

  // Ticker CSS (scoped to .sys-ticker)
  const tickerStyle = document.createElement('style');
  tickerStyle.textContent = `
    .sys-ticker .event {
      padding: 2px 0; display: flex; align-items: baseline; gap: 4px;
    }
    .sys-ticker .event-dot {
      display: inline-block; width: 6px; height: 6px;
      border-radius: 50%; flex-shrink: 0; margin-top: 3px;
    }
    .sys-ticker .event-new {
      animation: sys-ticker-fade 0.6s ease-out;
    }
    @keyframes sys-ticker-fade {
      from { background: rgba(136,255,136,0.12); }
      to { background: transparent; }
    }
  `;
  el.appendChild(tickerStyle);

  // ── History ring buffers ──
  const histPop = new RingBuf();
  const histNetEnergy = new RingBuf();
  const histAvgWater = new RingBuf();
  const histHerbPop = new RingBuf();

  // ── Cell type histogram for O(24) env stress aggregation ──
  const cellHist = new Float64Array(CLIMATE_ZONE_COUNT * TERRAIN_COUNT);
  let plantableCells = 0;
  let histDirty = true;

  function buildHistogram(world: World): void {
    cellHist.fill(0);
    plantableCells = 0;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const c = world.grid[y][x];
        if (c.terrainType === TerrainType.River || c.terrainType === TerrainType.Rock) continue;
        cellHist[c.climateZone * TERRAIN_COUNT + c.terrainType]++;
        plantableCells++;
      }
    }
    histDirty = false;
  }

  // ── State ──
  let visible = false;
  let lastUpdateMs = 0;

  function show(): void { visible = true; el.style.display = ''; }
  function hide(): void { visible = false; el.style.display = 'none'; }
  function toggle(): void { if (visible) hide(); else show(); }
  function isVisible(): boolean { return visible; }
  function reset(): void {
    histDirty = true;
    histPop.reset(); histNetEnergy.reset();
    histAvgWater.reset(); histHerbPop.reset();
    popChart.reset();
    traitChartInst.reset();
    tickerInst.reset();
  }

  function update(world: World, history: History): void {
    if (!visible) return;
    const now = performance.now();
    if (now - lastUpdateMs < 200) return;
    lastUpdateMs = now;

    if (histDirty) buildHistogram(world);

    // ── Header ──
    spans.season.textContent = SEASON_NAMES[world.environment.season];
    spans.tick.textContent = comma(world.tick);
    spans.year.textContent = String(world.environment.yearCount + 1);

    // ── Plants pass ──
    let alive = 0, sumEnergy = 0, sumProd = 0, sumMaint = 0;
    const speciesSet = new Set<number>();
    const genomeSum: Record<string, number> = {};
    let genomeKeys: string[] | null = null;
    for (const p of world.plants.values()) {
      if (!p.alive) continue;
      alive++;
      sumEnergy += p.energy;
      sumProd += p.lastEnergyProduced;
      sumMaint += p.lastMaintenanceCost;
      speciesSet.add(p.speciesId);
      const g = p.genome;
      if (!genomeKeys) genomeKeys = Object.keys(g);
      for (const key of genomeKeys) {
        genomeSum[key] = (genomeSum[key] || 0) + (g as any)[key];
      }
    }
    const avgGenome: Record<string, number> = {};
    for (const key of Object.keys(genomeSum)) {
      avgGenome[key] = alive > 0 ? genomeSum[key] / alive : 0.5;
    }

    // ── Grid pass ──
    let sumWater = 0, sumLight = 0;
    let minW = Infinity, maxW = -Infinity;
    let lowWater = 0, shadowed = 0;
    let canopy = 0, understory = 0, ground = 0, empty = 0, multi = 0;
    let cells = 0;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const c = world.grid[y][x];
        if (c.terrainType === TerrainType.River || c.terrainType === TerrainType.Rock) continue;
        cells++;
        sumWater += c.waterLevel;
        sumLight += c.lightLevel;
        if (c.waterLevel < minW) minW = c.waterLevel;
        if (c.waterLevel > maxW) maxW = c.waterLevel;
        if (c.waterLevel < 1.0) lowWater++;
        if (c.lightLevel < 0.8) shadowed++;

        let slots = 0;
        if (c.canopyId !== null) { canopy++; slots++; }
        if (c.understoryId !== null) { understory++; slots++; }
        if (c.groundId !== null) { ground++; slots++; }
        if (slots === 0) empty++;
        if (slots >= 2) multi++;
      }
    }
    if (cells === 0) cells = 1; // avoid /0

    // ── Water ──
    spans.wAvg.textContent = fmt(sumWater / cells);
    spans.wMin.textContent = fmt(minW === Infinity ? 0 : minW);
    spans.wMax.textContent = fmt(maxW === -Infinity ? 0 : maxW);
    spans.wLow.textContent = comma(lowWater);
    spans.wDroughts.textContent = String(world.environment.droughts.length);

    // ── Light ──
    spans.lAvg.textContent = fmt(sumLight / cells, 2);
    spans.lShaded.textContent = pct(shadowed / cells);
    spans.lMult.textContent = fmt(world.environment.lightMult, 2);

    // ── Tiers ──
    spans.tCan.textContent = comma(canopy);
    spans.tUnd.textContent = comma(understory);
    spans.tGnd.textContent = comma(ground);
    spans.tEmpty.textContent = comma(empty);
    spans.tMulti.textContent = comma(multi);

    // ── Energy ──
    spans.eProd.textContent = '+' + fmt(sumProd);
    spans.eMaint.textContent = '-' + fmt(sumMaint);
    const net = sumProd - sumMaint;
    spans.eNet.textContent = (net >= 0 ? '+' : '') + fmt(net);
    spans.eNet.style.color = net >= 0 ? '#7bc47b' : '#e06060';
    spans.eAvg.textContent = fmt(alive > 0 ? sumEnergy / alive : 0);

    // ── Environment stress (O(24)) ──
    const avg: Record<string, number> = {
      droughtStress: 0, frostRisk: 0, diseasePressure: 0,
      windExposure: 0, waterlogging: 0, heatStress: 0,
      soilFertility: 0, extremeAridity: 0,
    };
    for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
      for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
        const count = cellHist[cz * TERRAIN_COUNT + tt];
        if (count === 0) continue;
        const env = getEffectiveEnv(cz, tt);
        for (const k of Object.keys(avg)) {
          avg[k] += (env as any)[k] * count;
        }
      }
    }
    for (const k of Object.keys(avg)) {
      avg[k] /= plantableCells || 1;
    }
    for (const [key] of [
      ['droughtStress'], ['frostRisk'], ['diseasePressure'],
      ['windExposure'], ['waterlogging'], ['heatStress'],
      ['soilFertility'], ['extremeAridity'],
    ] as const) {
      const v = avg[key];
      const bar = stressBars[key];
      bar.val.textContent = fmt(v, 2);
      const p = Math.min(100, v * 100);
      const positive = key === 'soilFertility';
      const barColor = positive
        ? (p > 60 ? '#7bc47b' : p > 30 ? '#d4c95a' : '#e06060')
        : (p > 60 ? '#e06060' : p > 30 ? '#d4c95a' : '#7bc47b');
      bar.bar.style.background = `linear-gradient(to right, ${barColor} ${p}%, #333 ${p}%)`;
    }

    // ── Trait Effects ──
    traitFxRows.innerHTML = '';
    if (alive > 0) {
      const effects = diagnoseTraitEffects(avgGenome as Genome, avg as unknown as CellEnvironment);
      const grouped = new Map<string, { posSum: number; negSum: number; label: string; color: string }>();
      let totalMod = 0;
      for (const e of effects) {
        const rawTrait = e.trait.startsWith('(1-') ? e.trait.slice(3, -1) : e.trait;
        let g = grouped.get(rawTrait);
        if (!g) {
          const def = traitLookup.get(rawTrait);
          g = { posSum: 0, negSum: 0, label: def?.label ?? rawTrait.slice(0, 5), color: def?.color ?? '#888' };
          grouped.set(rawTrait, g);
        }
        if (e.contribution >= 0) g.posSum += e.contribution;
        else g.negSum += e.contribution;
        totalMod += e.contribution;
      }
      traitFxTotal.innerHTML = `<span style="color:#999">Modifier</span> <span style="color:${totalMod >= 0 ? '#7bc47b' : '#e06060'}">${totalMod >= 0 ? '+' : ''}${totalMod.toFixed(3)}</span> <span style="color:#666">(on avg genome)</span>`;

      let maxMag = 0;
      for (const [, v] of grouped) maxMag = Math.max(maxMag, v.posSum, -v.negSum);
      if (maxMag < 0.001) maxMag = 0.001;

      for (const [, v] of grouped) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:4px;height:14px;';
        const lbl = document.createElement('span');
        lbl.style.cssText = `width:36px;color:${v.color};font-size:10px;text-align:right;flex-shrink:0;`;
        lbl.textContent = v.label;
        row.appendChild(lbl);
        const netVal = v.posSum + v.negSum;
        const netEl = document.createElement('span');
        netEl.style.cssText = `width:44px;text-align:right;font-size:10px;flex-shrink:0;color:${netVal >= 0 ? '#7bc47b' : '#e06060'}`;
        netEl.textContent = (netVal >= 0 ? '+' : '') + netVal.toFixed(3);
        row.appendChild(netEl);
        const barWrap = document.createElement('div');
        barWrap.style.cssText = 'flex:1;height:7px;position:relative;background:#222;border-radius:2px;overflow:hidden;';
        const center = document.createElement('div');
        center.style.cssText = 'position:absolute;left:50%;top:0;width:1px;height:100%;background:#555;';
        barWrap.appendChild(center);
        const posW = (v.posSum / maxMag) * 50;
        const posBar = document.createElement('div');
        posBar.style.cssText = `position:absolute;left:50%;top:0;height:100%;background:#5a9e5a;width:${posW}%;`;
        barWrap.appendChild(posBar);
        const negW = (-v.negSum / maxMag) * 50;
        const negBar = document.createElement('div');
        negBar.style.cssText = `position:absolute;right:50%;top:0;height:100%;background:#c05050;width:${negW}%;`;
        barWrap.appendChild(negBar);
        row.appendChild(barWrap);
        traitFxRows.appendChild(row);
      }
    } else {
      traitFxTotal.innerHTML = '<span style="color:#666">No plants</span>';
    }

    // ── Reproduction ──
    const germinated = world.germinationEvents.length;
    const attempted = world.seedsAttempted;
    spans.rAttempt.textContent = comma(attempted);
    spans.rGerm.textContent = comma(germinated);
    spans.rRate.textContent = attempted > 0 ? pct(germinated / attempted) : '-';
    let seedBank = 0;
    for (const v of world.seedPopulations.values()) seedBank += v;
    spans.rBank.textContent = comma(seedBank);

    // ── Population ──
    spans.pTotal.textContent = comma(alive);
    spans.pSpecies.textContent = String(speciesSet.size);

    // ── Herbivores ──
    let totalGraze = 0;
    for (const h of world.herbivores.values()) {
      if (h.alive) totalGraze += h.lastEnergyGained;
    }
    spans.hPop.textContent = comma(world.herbivores.size);
    spans.hBirth.textContent = String(world.herbivoreBirthEvents.length);
    spans.hDeath.textContent = String(world.herbivoreDeathEvents.length);
    spans.hGraze.textContent = fmt(totalGraze);

    // ── Active Events ──
    const envW = world.environment;
    const parts: string[] = [];
    if (envW.fires.length > 0) {
      let burning = 0;
      for (const f of envW.fires) burning += f.cells.size;
      parts.push(`Fires: ${envW.fires.length} (${burning} cells)`);
    }
    if (envW.droughts.length > 0) {
      parts.push(`Droughts: ${envW.droughts.length}`);
    }
    if (envW.aridDrySpell) {
      parts.push(`Arid dry spell (${envW.aridDrySpell.ticksRemaining}t)`);
    }
    if (envW.diseases.length > 0) {
      let kills = 0;
      for (const d of envW.diseases) kills += d.killCount;
      parts.push(`Diseases: ${envW.diseases.length} (${kills} kills)`);
    }
    if (parts.length === 0) parts.push('None');
    eventsText.textContent = parts.join(' \u00b7 ');

    // ── Deaths ──
    let dStarve = 0, dAge = 0, dFire = 0, dDisease = 0;
    for (const d of world.deathEvents) {
      switch (d.cause) {
        case 'starvation': dStarve++; break;
        case 'age': dAge++; break;
        case 'fire': dFire++; break;
        case 'disease': dDisease++; break;
      }
    }
    spans.dStarve.textContent = String(dStarve);
    spans.dAge.textContent = String(dAge);
    spans.dFire.textContent = String(dFire);
    spans.dDisease.textContent = String(dDisease);

    // ── Push history + draw sparklines ──
    histPop.push(alive);
    histNetEnergy.push(net);
    histAvgWater.push(sumWater / cells);
    histHerbPop.push(world.herbivores.size);

    drawSparkline(waterSpark, histAvgWater, '#4a90d9');
    drawSparkline(energySpark, histNetEnergy, '#e89040', true);
    drawSparkline(herbSpark, histHerbPop, '#a0826a');

    // ── Charts & Ticker ──
    popChart.update(history, world.speciesColors);
    traitChartInst.update(history);
    tickerInst.update(history, world.speciesColors);

    // ── Tier proportional bar ──
    const total = canopy + understory + ground + empty;
    if (total > 0) {
      tierBar.segments[0].style.width = (canopy / total * 100) + '%';
      tierBar.segments[1].style.width = (understory / total * 100) + '%';
      tierBar.segments[2].style.width = (ground / total * 100) + '%';
      tierBar.segments[3].style.width = (empty / total * 100) + '%';
    }
  }

  return { show, hide, update, toggle, isVisible, reset };
}
