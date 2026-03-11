import { World, History, TerrainType, SEASON_NAMES, CLIMATE_ZONE_COUNT } from './types';
import { getEffectiveEnv } from './simulation/trait-effects';
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

function makeSection(title: string, color: string): { wrap: HTMLDivElement; body: HTMLDivElement } {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:8px;';

  const hdr = document.createElement('div');
  hdr.style.cssText = `color:${color};font-weight:bold;font-size:11px;letter-spacing:1px;border-bottom:1px solid ${color}44;padding-bottom:2px;margin-bottom:3px;`;
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
  r.style.cssText = 'display:flex;align-items:center;gap:6px;';

  const lbl = document.createElement('span');
  lbl.style.cssText = 'width:64px;color:#999;';
  lbl.textContent = label;
  r.appendChild(lbl);

  const val = document.createElement('span');
  val.style.cssText = 'width:32px;text-align:right;color:#e8e8e8;';
  r.appendChild(val);

  const bar = document.createElement('span');
  bar.style.cssText = 'display:inline-block;width:64px;height:7px;border-radius:2px;background:#333;';
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

function makeSparkCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 28;
  c.style.cssText = 'width:160px;height:28px;display:block;margin:3px 0 1px;border-radius:2px;background:#1a1a1a;';
  return c;
}

function drawSparkline(canvas: HTMLCanvasElement, buf: RingBuf, color: string, zero = false): void {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
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
    position:absolute;top:8px;right:8px;width:480px;
    max-height:calc(100% - 16px);overflow-y:auto;
    background:rgba(0,0,0,0.85);color:#ccc;
    font:11px/1.5 monospace;padding:10px 12px;
    border-radius:4px;pointer-events:auto;
    z-index:30;display:none;
    scrollbar-width:thin;scrollbar-color:#444 transparent;
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

  // ── Water ──
  const water = makeSection('WATER', '#4a90d9');
  kvRow(water.body, spans, [['Avg', 'wAvg'], ['Min', 'wMin'], ['Max', 'wMax']]);
  kvRow(water.body, spans, [['Cells <1', 'wLow'], ['Droughts', 'wDroughts']]);
  const waterSpark = makeSparkCanvas();
  water.body.appendChild(waterSpark);
  el.appendChild(water.wrap);

  // ── Light ──
  const light = makeSection('LIGHT', '#d4c95a');
  kvRow(light.body, spans, [['Avg', 'lAvg'], ['Shadowed', 'lShaded'], ['Season', 'lMult']]);
  el.appendChild(light.wrap);

  // ── Tiers ──
  const tiers = makeSection('TIERS', '#7bc47b');
  kvRow(tiers.body, spans, [['Canopy', 'tCan'], ['Understory', 'tUnd'], ['Ground', 'tGnd']]);
  kvRow(tiers.body, spans, [['Empty cells', 'tEmpty'], ['Multi-plant', 'tMulti']]);
  const tierBar = makePropBar();
  // legend
  const tierLegend = document.createElement('div');
  tierLegend.style.cssText = 'display:flex;gap:8px;font-size:9px;color:#888;margin-top:1px;';
  tierLegend.innerHTML = '<span><span style="color:#5a9e5a">\u25A0</span> Can</span><span><span style="color:#8bc48b">\u25A0</span> Und</span><span><span style="color:#c4b870">\u25A0</span> Gnd</span><span><span style="color:#333">\u25A0</span> Empty</span>';
  tiers.body.appendChild(tierBar.el);
  tiers.body.appendChild(tierLegend);
  el.appendChild(tiers.wrap);

  // ── Energy Flow ──
  const energy = makeSection('ENERGY FLOW', '#e89040');
  kvRow(energy.body, spans, [['Prod', 'eProd'], ['Maint', 'eMaint']]);
  kvRow(energy.body, spans, [['Net', 'eNet'], ['Avg', 'eAvg']]);
  const energySpark = makeSparkCanvas();
  energy.body.appendChild(energySpark);
  el.appendChild(energy.wrap);

  // ── Environment Stress ──
  const envSec = makeSection('ENVIRONMENT STRESS', '#c57070');
  const stressBars: Record<string, StressBar> = {};
  for (const [key, label] of [
    ['droughtStress', 'Drought'], ['frostRisk', 'Frost'], ['diseasePressure', 'Disease'],
    ['windExposure', 'Wind'], ['waterlogging', 'Waterlog'], ['heatStress', 'Heat'],
  ] as const) {
    stressBars[key] = stressRow(envSec.body, label);
  }
  el.appendChild(envSec.wrap);

  // ── Reproduction ──
  const repro = makeSection('REPRODUCTION', '#b080d0');
  kvRow(repro.body, spans, [['Attempted', 'rAttempt'], ['Germinated', 'rGerm']]);
  kvRow(repro.body, spans, [['Rate', 'rRate'], ['Seed bank', 'rBank']]);
  el.appendChild(repro.wrap);

  // ── Herbivores ──
  const herb = makeSection('HERBIVORES', '#a0826a');
  kvRow(herb.body, spans, [['Pop', 'hPop'], ['Births', 'hBirth'], ['Deaths', 'hDeath']]);
  kvRow(herb.body, spans, [['Grazing', 'hGraze']]);
  const herbSpark = makeSparkCanvas();
  herb.body.appendChild(herbSpark);
  el.appendChild(herb.wrap);

  // ── Active Events ──
  const events = makeSection('ACTIVE EVENTS', '#e06060');
  const eventsBody = events.body;
  el.appendChild(events.wrap);

  // ── Deaths ──
  const deaths = makeSection('DEATHS THIS TICK', '#888');
  kvRow(deaths.body, spans, [['Starved', 'dStarve'], ['Age', 'dAge']]);
  kvRow(deaths.body, spans, [['Fire', 'dFire'], ['Disease', 'dDisease']]);
  el.appendChild(deaths.wrap);

  // ── Population ──
  const pop = makeSection('POPULATION', '#8cb4ff');
  kvRow(pop.body, spans, [['Plants', 'pTotal'], ['Species', 'pSpecies']]);
  const popSpark = makeSparkCanvas();
  pop.body.appendChild(popSpark);
  el.appendChild(pop.wrap);

  // ── Population History chart ──
  const popChartSec = makeSection('POPULATION HISTORY', '#8cb4ff');
  const popChartContainer = document.createElement('div');
  popChartContainer.style.cssText = 'width:100%;height:140px;position:relative;overflow:hidden;';
  popChartSec.body.appendChild(popChartContainer);
  el.appendChild(popChartSec.wrap);
  const popChart = createPopulationChart(popChartContainer);

  // ── Trait History chart ──
  const traitChartSec = makeSection('TRAIT HISTORY', '#b080d0');
  const traitChartContainer = document.createElement('div');
  traitChartContainer.style.cssText = 'width:100%;height:140px;position:relative;overflow:hidden;';
  traitChartSec.body.appendChild(traitChartContainer);
  el.appendChild(traitChartSec.wrap);
  const traitChartInst = createTraitChart(traitChartContainer);

  // ── Event Log ──
  const tickerSec = makeSection('EVENT LOG', '#8f8');
  const tickerContainer = document.createElement('div');
  tickerContainer.className = 'sys-ticker';
  tickerContainer.style.cssText = 'width:100%;height:160px;overflow-y:auto;font-size:11px;line-height:1.4;scrollbar-width:thin;scrollbar-color:#444 transparent;';
  tickerSec.body.appendChild(tickerContainer);
  el.appendChild(tickerSec.wrap);
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
  const histSpecies = new RingBuf();
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
    histPop.reset(); histSpecies.reset(); histNetEnergy.reset();
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
    for (const p of world.plants.values()) {
      if (!p.alive) continue;
      alive++;
      sumEnergy += p.energy;
      sumProd += p.lastEnergyProduced;
      sumMaint += p.lastMaintenanceCost;
      speciesSet.add(p.speciesId);
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
    ] as const) {
      const v = avg[key];
      const bar = stressBars[key];
      bar.val.textContent = fmt(v, 2);
      const p = Math.min(100, v * 100);
      const barColor = p > 60 ? '#e06060' : p > 30 ? '#d4c95a' : '#7bc47b';
      bar.bar.style.background = `linear-gradient(to right, ${barColor} ${p}%, #333 ${p}%)`;
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
    const env = world.environment;
    const parts: string[] = [];
    if (env.fires.length > 0) {
      let burning = 0;
      for (const f of env.fires) burning += f.cells.size;
      parts.push(`Fires: ${env.fires.length} (${burning} cells)`);
    }
    if (env.droughts.length > 0) {
      parts.push(`Droughts: ${env.droughts.length}`);
    }
    if (env.aridDrySpell) {
      parts.push(`Arid dry spell (${env.aridDrySpell.ticksRemaining}t)`);
    }
    if (env.diseases.length > 0) {
      let kills = 0;
      for (const d of env.diseases) kills += d.killCount;
      parts.push(`Diseases: ${env.diseases.length} (${kills} kills)`);
    }
    if (parts.length === 0) parts.push('None');
    eventsBody.textContent = parts.join(' \u00b7 ');

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

    // ── Population ──
    spans.pTotal.textContent = comma(alive);
    spans.pSpecies.textContent = String(speciesSet.size);

    // ── Push history + draw sparklines ──
    histPop.push(alive);
    histSpecies.push(speciesSet.size);
    histNetEnergy.push(net);
    histAvgWater.push(sumWater / cells);
    histHerbPop.push(world.herbivores.size);

    drawSparkline(popSpark, histPop, '#8cb4ff');
    drawSparkline(energySpark, histNetEnergy, '#e89040', true);
    drawSparkline(waterSpark, histAvgWater, '#4a90d9');
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
