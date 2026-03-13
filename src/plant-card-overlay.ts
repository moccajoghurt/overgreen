import { SIM, World, Renderer, Plant } from './types';
import { speciesColorToRgb } from './ui-utils';
import { hexToRgba } from './ui-utils';
import { TRAITS } from './trait-defs';

/**
 * Floating plant info card — appears on hover, shows individual plant vitals/economy/genome.
 */
export function createPlantCardOverlay(
  mapContainer: HTMLElement,
  renderer: Renderer,
) {
  let currentPlantId: number | null = null;
  let plantX = 0;
  let plantY = 0;

  // ── Build DOM ──
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute; top:0; left:0; width:100%; height:100%;
    pointer-events:none; z-index:10; overflow:hidden;
  `;
  mapContainer.appendChild(overlay);

  const card = document.createElement('div');
  card.style.cssText = `
    position:absolute; display:none;
    transform:translate(20px, -100%);
    background:rgba(0,0,0,0.7); backdrop-filter:blur(6px);
    border-left:3px solid #888;
    padding:6px 10px; border-radius:0 4px 4px 0;
    font-family:monospace; font-size:11px; color:#ddd;
    white-space:nowrap;
    text-shadow:0 1px 2px rgba(0,0,0,0.8);
    line-height:1.4;
  `;
  overlay.appendChild(card);

  // Header
  const headerEl = document.createElement('div');
  headerEl.style.cssText = `font-size:13px; font-weight:bold; margin-bottom:2px;`;
  card.appendChild(headerEl);

  const subHeaderEl = document.createElement('div');
  subHeaderEl.style.cssText = `font-size:10px; color:rgba(255,255,255,0.6); margin-bottom:4px;`;
  card.appendChild(subHeaderEl);

  // Vitals section
  card.appendChild(sectionLabel('VITALS'));
  const healthRow = createBarRow('Health');
  const energyRow = createBarRow('Energy');
  const waterRow = createBarRow('Water');
  card.appendChild(healthRow.row);
  card.appendChild(energyRow.row);
  card.appendChild(waterRow.row);

  // Economy section
  card.appendChild(sectionLabel('ECONOMY'));
  const econEl = document.createElement('div');
  econEl.style.cssText = `font-size:10px; color:#ccc;`;
  card.appendChild(econEl);

  // Growth section
  card.appendChild(sectionLabel('GROWTH'));
  const growthEl = document.createElement('div');
  growthEl.style.cssText = `font-size:10px; color:#ccc;`;
  card.appendChild(growthEl);

  // Genome bars
  card.appendChild(sectionLabel('GENOME'));
  const barsContainer = document.createElement('div');
  barsContainer.style.cssText = `display:flex; gap:2px; width:120px; height:20px; margin-top:1px;`;
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
      background:${hexToRgba(trait.color, 0.6)};
      border-radius:2px 2px 0 0;
      transition:height 0.15s ease;
    `;
    fill.style.height = '0%';
    col.appendChild(fill);
    barFills.push(fill);

    const lbl = document.createElement('div');
    lbl.style.cssText = `
      position:absolute; bottom:1px; left:0; width:100%;
      text-align:center; font-size:6px; line-height:1;
      color:rgba(255,255,255,0.4);
    `;
    lbl.textContent = trait.label[0];
    col.appendChild(lbl);

    barsContainer.appendChild(col);
  }
  card.appendChild(barsContainer);

  // Status flags
  const statusEl = document.createElement('div');
  statusEl.style.cssText = `font-size:9px; margin-top:3px; color:#e66;`;
  card.appendChild(statusEl);

  // ── Helpers ──

  function sectionLabel(text: string): HTMLElement {
    const lbl = document.createElement('div');
    lbl.style.cssText = `font-size:8px; font-weight:normal; color:rgba(255,255,255,0.35); margin-top:4px; letter-spacing:0.5px;`;
    lbl.textContent = text;
    return lbl;
  }

  function createBarRow(label: string) {
    const row = document.createElement('div');
    row.style.cssText = `display:flex; align-items:center; gap:4px; height:12px; margin-top:1px;`;

    const labelEl = document.createElement('span');
    labelEl.style.cssText = `font-size:9px; color:rgba(255,255,255,0.5); width:38px; text-align:right;`;
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const barBg = document.createElement('div');
    barBg.style.cssText = `flex:1; height:8px; background:rgba(255,255,255,0.08); border-radius:2px; position:relative; min-width:60px;`;
    const barFill = document.createElement('div');
    barFill.style.cssText = `position:absolute; top:0; left:0; height:100%; border-radius:2px; transition:width 0.15s ease, background 0.15s ease;`;
    barFill.style.width = '0%';
    barBg.appendChild(barFill);
    row.appendChild(barBg);

    const valueEl = document.createElement('span');
    valueEl.style.cssText = `font-size:9px; color:#ccc; min-width:48px; text-align:right;`;
    row.appendChild(valueEl);

    return { row, barFill, valueEl };
  }

  function healthColor(t: number): string {
    // green (high health) → yellow → red (low health)
    if (t > 0.5) {
      const f = (t - 0.5) * 2; // 0→1 as health goes 0.5→1
      const r = Math.round(255 * (1 - f));
      return `rgb(${r},200,60)`;
    } else {
      const f = t * 2; // 0→1 as health goes 0→0.5
      const g = Math.round(200 * f);
      return `rgb(230,${g},40)`;
    }
  }

  function tierName(world: World, plant: Plant): string {
    const cell = world.grid[plant.y]?.[plant.x];
    if (!cell) return '?';
    if (cell.canopyId === plant.id) return 'Canopy';
    if (cell.understoryId === plant.id) return 'Understory';
    if (cell.groundId === plant.id) return 'Ground';
    return '—';
  }

  function archetypeLabel(woodiness: number): string {
    if (woodiness < 0.25) return 'Herb';
    if (woodiness < 0.5) return 'Shrubby';
    if (woodiness < 0.75) return 'Woody';
    return 'Tree';
  }

  // ── Public API ──

  function update(world: World, plantId: number | null): void {
    if (plantId === null) {
      card.style.display = 'none';
      currentPlantId = null;
      return;
    }

    const plant = world.plants.get(plantId);
    if (!plant || !plant.alive) {
      card.style.display = 'none';
      currentPlantId = null;
      return;
    }

    currentPlantId = plantId;
    plantX = plant.x;
    plantY = plant.y;

    // Species color for border
    const sc = world.species.get(plant.speciesId)?.color;
    const rgb = sc ? speciesColorToRgb(sc) : '#888';
    card.style.borderLeftColor = rgb;

    // Header
    const spName = world.species.get(plant.speciesId)?.name ?? `Sp ${plant.speciesId}`;
    const arch = archetypeLabel(plant.genome.woodiness);
    headerEl.textContent = `${spName}  #${plant.id}`;
    headerEl.style.color = rgb;
    subHeaderEl.textContent = `${arch} · Age ${plant.age} · Gen ${plant.generation} · ${plant.offspringCount} offspring`;

    // Vitals — Health
    const h = plant.healthEMA;
    healthRow.barFill.style.width = `${(h * 100).toFixed(1)}%`;
    healthRow.barFill.style.background = healthColor(h);
    healthRow.valueEl.textContent = h.toFixed(2);

    // Vitals — Energy
    const eFrac = plant.peakEnergy > 0 ? Math.min(1, plant.energy / plant.peakEnergy) : 0;
    energyRow.barFill.style.width = `${(eFrac * 100).toFixed(1)}%`;
    energyRow.barFill.style.background = plant.energy > 0 ? '#6a6' : '#c44';
    energyRow.valueEl.textContent = plant.energy.toFixed(1);

    // Vitals — Water (satisfaction ratio: absorbed / needed)
    const wSat = plant.lastWaterSatisfaction;
    waterRow.barFill.style.width = `${(wSat * 100).toFixed(1)}%`;
    waterRow.barFill.style.background = wSat > 0.5 ? '#6bc' : '#c86';
    waterRow.valueEl.textContent = `${(wSat * 100).toFixed(0)}%`;

    // Economy
    const wsCap = plant.genome.waterStorage * SIM.WATER_STORAGE_CAPACITY;
    const net = plant.lastEnergyProduced - plant.lastMaintenanceCost;
    const netColor = net >= 0 ? '#6c6' : '#e66';
    const netSign = net >= 0 ? '+' : '';
    econEl.innerHTML =
      `Light ${plant.lastLightReceived.toFixed(2)} → Eff ${plant.effectiveLight.toFixed(2)}`
      + `<br>Water ${plant.lastWaterAbsorbed.toFixed(2)}`
      + (wsCap > 0.01 ? `  Tank ${plant.storedWater.toFixed(1)}/${wsCap.toFixed(1)}` : '')
      + `<br>Prod <span style="color:#6c6">+${plant.lastEnergyProduced.toFixed(2)}</span>`
      + `  Maint <span style="color:#e66">-${plant.lastMaintenanceCost.toFixed(2)}</span>`
      + `<br>Net <span style="color:${netColor}">${netSign}${net.toFixed(2)}</span>`
      + `  TraitMod <span style="color:#cc9">×${plant.lastTraitModifier.toFixed(2)}</span>`;

    // Growth
    const tier = tierName(world, plant);
    growthEl.textContent = `H ${plant.height.toFixed(1)}  R ${plant.rootDepth.toFixed(1)}  L ${plant.leafArea.toFixed(1)}  [${tier}]`;

    // Genome bars
    for (let i = 0; i < TRAITS.length; i++) {
      const val = plant.genome[TRAITS[i].genomeKey];
      barFills[i].style.height = `${(val * 100).toFixed(1)}%`;
    }

    // Status
    const flags: string[] = [];
    if (plant.isDiseased) flags.push('DISEASED');
    statusEl.textContent = flags.join(' · ');
    statusEl.style.display = flags.length > 0 ? '' : 'none';

    card.style.display = '';
  }

  function updatePosition(): void {
    if (currentPlantId === null) return;
    const screen = renderer.projectToScreen(plantX, plantY);
    if (screen) {
      card.style.left = `${screen.x}px`;
      card.style.top = `${screen.y}px`;
    } else {
      card.style.display = 'none';
    }
  }

  function reset(): void {
    currentPlantId = null;
    card.style.display = 'none';
  }

  return { update, updatePosition, reset };
}
