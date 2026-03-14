import { SIM, World, WeatherOverlay } from './types';
import { speciesColorToRgb } from './ui-utils';

const TERRAIN_NAMES = ['Soil', 'River', 'Rock', 'Hill', 'Wetland', 'Arid'];
const TERRAIN_COLORS = ['#8a7', '#58c', '#999', '#a96', '#5a8', '#ca6'];
const ZONE_NAMES = ['Temperate', 'Tropical', 'Mediterranean', 'Desert'];
const ZONE_COLORS = ['#7a9', '#ac6', '#ca8', '#c96'];

/**
 * Cell info card — appears on cell click, anchored bottom-left of canvas.
 * Shows cell-level data: terrain, environment, plants by tier, seeds, herbivores.
 */
export function createCellCardOverlay(mapContainer: HTMLElement) {

  // ── Build DOM ──
  const card = document.createElement('div');
  card.style.cssText = `
    position:absolute; bottom:12px; left:12px;
    display:none; z-index:10;
    background:rgba(0,0,0,0.7); backdrop-filter:blur(6px);
    border-left:3px solid #666;
    padding:6px 10px; border-radius:0 4px 4px 0;
    font-family:monospace; font-size:11px; color:#ddd;
    text-shadow:0 1px 2px rgba(0,0,0,0.8);
    line-height:1.4;
    min-width:160px; max-width:220px;
    pointer-events:auto;
  `;
  mapContainer.appendChild(card);

  // Header: coordinates
  const headerEl = document.createElement('div');
  headerEl.style.cssText = `font-size:12px; font-weight:bold; margin-bottom:2px; color:#aaa;`;
  card.appendChild(headerEl);

  // Badges row: terrain + climate
  const badgesEl = document.createElement('div');
  badgesEl.style.cssText = `display:flex; gap:4px; margin-bottom:4px;`;
  card.appendChild(badgesEl);

  // Weather status
  const weatherEl = document.createElement('div');
  weatherEl.style.cssText = `font-size:10px; color:#e66; margin-bottom:3px;`;
  card.appendChild(weatherEl);

  // Environment section
  card.appendChild(sectionLabel('ENVIRONMENT'));
  const waterRow = createBarRow('Water', '#6bc');
  const nutrientsRow = createBarRow('Nutr', '#ac6');
  const lightRow = createBarRow('Light', '#ee8');
  card.appendChild(waterRow.row);
  card.appendChild(nutrientsRow.row);
  card.appendChild(lightRow.row);

  const elevEl = document.createElement('div');
  elevEl.style.cssText = `font-size:9px; color:rgba(255,255,255,0.4); margin-top:1px;`;
  card.appendChild(elevEl);

  // Plants section
  const plantsLabel = sectionLabel('PLANTS');
  card.appendChild(plantsLabel);
  const plantsEl = document.createElement('div');
  plantsEl.style.cssText = `font-size:10px;`;
  card.appendChild(plantsEl);

  // Seeds section
  const seedsEl = document.createElement('div');
  seedsEl.style.cssText = `font-size:9px; color:rgba(255,255,255,0.4); margin-top:3px;`;
  card.appendChild(seedsEl);

  // Herbivores section
  const herbEl = document.createElement('div');
  herbEl.style.cssText = `font-size:9px; color:rgba(255,255,255,0.5); margin-top:3px;`;
  card.appendChild(herbEl);

  // ── Helpers ──

  function sectionLabel(text: string): HTMLElement {
    const lbl = document.createElement('div');
    lbl.style.cssText = `font-size:8px; font-weight:normal; color:rgba(255,255,255,0.35); margin-top:5px; letter-spacing:0.5px;`;
    lbl.textContent = text;
    return lbl;
  }

  function createBarRow(label: string, color: string) {
    const row = document.createElement('div');
    row.style.cssText = `display:flex; align-items:center; gap:4px; height:12px; margin-top:1px;`;

    const labelEl = document.createElement('span');
    labelEl.style.cssText = `font-size:9px; color:rgba(255,255,255,0.5); width:32px; text-align:right;`;
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const barBg = document.createElement('div');
    barBg.style.cssText = `flex:1; height:6px; background:rgba(255,255,255,0.08); border-radius:2px; position:relative; min-width:50px;`;
    const barFill = document.createElement('div');
    barFill.style.cssText = `position:absolute; top:0; left:0; height:100%; border-radius:2px; background:${color}; transition:width 0.15s ease;`;
    barFill.style.width = '0%';
    barBg.appendChild(barFill);
    row.appendChild(barBg);

    const valueEl = document.createElement('span');
    valueEl.style.cssText = `font-size:9px; color:#aaa; min-width:28px; text-align:right;`;
    row.appendChild(valueEl);

    return { row, barFill, valueEl };
  }

  function makeBadge(text: string, color: string): HTMLElement {
    const badge = document.createElement('span');
    badge.style.cssText = `
      font-size:9px; padding:1px 5px; border-radius:2px;
      background:${color}22; color:${color}; border:1px solid ${color}44;
    `;
    badge.textContent = text;
    return badge;
  }

  function healthDot(h: number): string {
    const color = h > 0.6 ? '#6a6' : h > 0.3 ? '#cc6' : '#c44';
    return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-right:3px;vertical-align:middle;"></span>`;
  }

  // ── Public API ──

  function update(world: World, cell: { x: number; y: number } | null): void {
    if (!cell) {
      card.style.display = 'none';
      return;
    }

    card.style.display = '';

    const c = world.grid[cell.y][cell.x];

    // Header
    headerEl.textContent = `Cell (${cell.x}, ${cell.y})`;

    // Badges
    badgesEl.innerHTML = '';
    badgesEl.appendChild(makeBadge(TERRAIN_NAMES[c.terrainType], TERRAIN_COLORS[c.terrainType]));
    badgesEl.appendChild(makeBadge(ZONE_NAMES[c.climateZone], ZONE_COLORS[c.climateZone]));

    // Weather overlay
    const env = world.environment;
    const ov = env.weatherOverlay[cell.y * world.width + cell.x];
    const weatherLabels: Record<number, string> = {
      [WeatherOverlay.Drought]: 'DROUGHT',
      [WeatherOverlay.Burning]: 'BURNING',
      [WeatherOverlay.Scorched]: 'SCORCHED',
      [WeatherOverlay.Parched]: 'PARCHED',
      [WeatherOverlay.Diseased]: 'DISEASED',
      [WeatherOverlay.Blighted]: 'BLIGHTED',
    };
    const wLabel = weatherLabels[ov];
    weatherEl.textContent = wLabel ?? '';
    weatherEl.style.display = wLabel ? '' : 'none';

    // Environment bars
    const wFrac = c.waterLevel / SIM.MAX_WATER;
    waterRow.barFill.style.width = `${(wFrac * 100).toFixed(1)}%`;
    waterRow.valueEl.textContent = `${c.waterLevel.toFixed(1)}`;

    // Nutrients don't have a fixed max; use 3.0 as reference
    const nFrac = Math.min(1, c.nutrients / 3.0);
    nutrientsRow.barFill.style.width = `${(nFrac * 100).toFixed(1)}%`;
    nutrientsRow.valueEl.textContent = c.nutrients.toFixed(1);

    lightRow.barFill.style.width = `${(c.lightLevel * 100).toFixed(1)}%`;
    lightRow.valueEl.textContent = c.lightLevel.toFixed(2);

    elevEl.textContent = `Elev ${c.elevation.toFixed(2)}  Recharge ${c.waterRechargeRate.toFixed(2)}`;

    // Plants by tier
    const tierLabels = ['Ground', 'Understory', 'Canopy'];
    const tierIds = [c.groundId, c.understoryId, c.canopyId];
    let plantsHtml = '';
    let hasPlant = false;
    for (let t = tierIds.length - 1; t >= 0; t--) {
      const pid = tierIds[t];
      if (pid === null) continue;
      const plant = world.plants.get(pid);
      if (!plant) continue;
      hasPlant = true;
      const spName = world.species.get(plant.speciesId)?.name ?? `Sp ${plant.speciesId}`;
      const sc = world.species.get(plant.speciesId)?.color;
      const rgb = sc ? speciesColorToRgb(sc) : '#888';
      const dot = healthDot(plant.healthEMA);
      plantsHtml += `<div style="margin-top:2px;">${dot}<span style="color:${rgb}">${spName}</span> <span style="color:rgba(255,255,255,0.35);font-size:9px">[${tierLabels[t]}]</span></div>`;
    }
    if (!hasPlant) {
      plantsHtml = '<div style="color:rgba(255,255,255,0.3);">Empty</div>';
      if (c.lastSpeciesId !== null) {
        const lastName = world.species.get(c.lastSpeciesId!)?.name ?? `Sp ${c.lastSpeciesId}`;
        plantsHtml += `<div style="color:rgba(255,255,255,0.25);font-size:9px;">Last: ${lastName}</div>`;
      }
    }
    plantsEl.innerHTML = plantsHtml;

    // Seeds
    if (c.seeds.length > 0) {
      seedsEl.textContent = `${c.seeds.length} dormant seed${c.seeds.length > 1 ? 's' : ''}`;
      seedsEl.style.display = '';
    } else {
      seedsEl.style.display = 'none';
    }

    // Herbivores
    let herbHtml = '';
    for (const h of world.herbivores.values()) {
      if (h.x === cell.x && h.y === cell.y && h.alive) {
        herbHtml += `<div>Deer #${h.id}  E:${h.energy.toFixed(0)}</div>`;
      }
    }
    herbEl.innerHTML = herbHtml;
    herbEl.style.display = herbHtml ? '' : 'none';
  }

  function reset(): void {
    card.style.display = 'none';
  }

  return { update, reset };
}
