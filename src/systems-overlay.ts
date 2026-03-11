import { World, TerrainType, SEASON_NAMES, CLIMATE_ZONE_COUNT } from './types';
import { getEffectiveEnv, CellEnvironment } from './simulation/trait-effects';

export interface SystemsOverlay {
  show(): void;
  hide(): void;
  update(world: World): void;
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

function row(...parts: string[]): HTMLDivElement {
  const r = document.createElement('div');
  r.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 14px;';
  for (const text of parts) {
    const sp = document.createElement('span');
    sp.textContent = text;
    r.appendChild(sp);
  }
  return r;
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

// ── Main factory ──

const TERRAIN_COUNT = 6;

export function createSystemsOverlay(container: HTMLElement): SystemsOverlay {
  const el = document.createElement('div');
  el.style.cssText = `
    position:absolute;top:8px;right:8px;width:340px;
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
  el.appendChild(water.wrap);

  // ── Light ──
  const light = makeSection('LIGHT', '#d4c95a');
  kvRow(light.body, spans, [['Avg', 'lAvg'], ['Shadowed', 'lShaded'], ['Season', 'lMult']]);
  el.appendChild(light.wrap);

  // ── Tiers ──
  const tiers = makeSection('TIERS', '#7bc47b');
  kvRow(tiers.body, spans, [['Canopy', 'tCan'], ['Understory', 'tUnd'], ['Ground', 'tGnd']]);
  kvRow(tiers.body, spans, [['Empty cells', 'tEmpty'], ['Multi-plant', 'tMulti']]);
  el.appendChild(tiers.wrap);

  // ── Energy Flow ──
  const energy = makeSection('ENERGY FLOW', '#e89040');
  kvRow(energy.body, spans, [['Prod', 'eProd'], ['Maint', 'eMaint']]);
  kvRow(energy.body, spans, [['Net', 'eNet'], ['Avg', 'eAvg']]);
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
  el.appendChild(pop.wrap);

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
  function reset(): void { histDirty = true; }

  function update(world: World): void {
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
  }

  return { show, hide, update, toggle, isVisible, reset };
}
