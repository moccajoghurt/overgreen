import { SEASON_NAMES, CLIMATE_ZONE_COUNT, ZONE_NAMES, ClimateZone, World } from './types';
import type { ColorMode } from './types/renderer';
import type { Genome } from './types/core';
import type { Controls } from './controls';
import type { Renderer, History } from './types';

export interface UIWiringDeps {
  renderer: Renderer;
  controls: Controls;
  world: World;
  speciesLabels: {
    setVisible(on: boolean): void;
    setLineageVisible(on: boolean): void;
    update(world: World, history: History): void;
  };
  terrainLabels: { setVisible(on: boolean): void };
  zoneLabels: { setVisible(on: boolean): void };
  systemsOverlay: {
    show(): void; hide(): void; toggle(): void; isVisible(): boolean;
    update(world: World, history: History): void;
  };
  cellCard: { update(world: World, cell: { x: number; y: number } | null): void };
  genomePanel: { update(world: World): void };
  lineagePanel: { update(world: World): void };
  commentary: { update(history: History, species: World['species'], world: World, renderer: Renderer): void };
  sandboxPanel: { update(world: World): void; isVisible(): boolean; setVisible(v: boolean): void };
  history: History;
}

export function initUIWiring(deps: UIWiringDeps) {
  const { renderer, controls, world, speciesLabels, terrainLabels, zoneLabels, systemsOverlay } = deps;
  const { cellCard, genomePanel, lineagePanel, commentary, sandboxPanel, history } = deps;

  // --- View drawer expand/collapse ---
  const viewExpandBtn = document.getElementById('btn-view-expand') as HTMLButtonElement;
  const viewDrawer = document.getElementById('view-drawer')!;
  viewExpandBtn.addEventListener('click', () => {
    const open = viewDrawer.classList.toggle('hidden') === false;
    viewExpandBtn.textContent = open ? '\u2212' : '+';
  });

  // --- Mobile menu toggle ---
  const mobileMenuBtn = document.createElement('button');
  mobileMenuBtn.id = 'mobile-menu-btn';
  mobileMenuBtn.textContent = '\u2630';
  document.body.appendChild(mobileMenuBtn);

  const mobileBackdrop = document.createElement('div');
  mobileBackdrop.id = 'mobile-backdrop';
  document.body.appendChild(mobileBackdrop);

  const sidebar = document.getElementById('sidebar')!;
  mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
    mobileBackdrop.classList.toggle('visible');
  });
  mobileBackdrop.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    mobileBackdrop.classList.remove('visible');
  });

  // --- View toggles ---
  function setupViewCheckbox(id: string, onToggle: (checked: boolean) => void) {
    const el = document.getElementById(id) as HTMLInputElement;
    el.addEventListener('change', () => onToggle(el.checked));
    return el;
  }

  // Heatmap button row
  const heatmapRow = document.getElementById('heatmap-row')!;
  const traitSelector = document.getElementById('trait-selector') as HTMLSelectElement;
  heatmapRow.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.heatmap-btn') as HTMLElement | null;
    if (!btn) return;
    const mode = btn.dataset.color as ColorMode;
    heatmapRow.querySelector('.heatmap-btn.active')?.classList.remove('active');
    btn.classList.add('active');
    renderer.setColorMode(mode);
    traitSelector.style.display = mode === 'trait' ? '' : 'none';
  });
  traitSelector.addEventListener('change', () => {
    renderer.setTraitColorTrait(traitSelector.value as keyof Genome);
  });

  const speciesCardsToggle = setupViewCheckbox('toggle-species-cards', (on) => speciesLabels.setVisible(on));
  const terrainToggle = setupViewCheckbox('toggle-terrain', (on) => terrainLabels.setVisible(on));
  const climateToggle = setupViewCheckbox('toggle-climate', (on) => zoneLabels.setVisible(on));
  setupViewCheckbox('toggle-lineage-cards', (on) => speciesLabels.setLineageVisible(on));
  const systemsToggle = setupViewCheckbox('toggle-systems', (on) => {
    if (on) systemsOverlay.show(); else systemsOverlay.hide();
  });

  // Sandbox button
  const btnSandbox = document.getElementById('btn-sandbox') as HTMLButtonElement;
  btnSandbox.addEventListener('click', () => {
    sandboxPanel.setVisible(!sandboxPanel.isVisible());
  });

  // Systems button
  const btnSystems = document.getElementById('btn-systems') as HTMLButtonElement;
  btnSystems.addEventListener('click', () => {
    systemsOverlay.toggle();
    systemsToggle.checked = systemsOverlay.isVisible();
  });

  // Tab switching
  const chartTabs = document.querySelectorAll<HTMLButtonElement>('.chart-tab');
  const chartContainers = document.querySelectorAll<HTMLElement>('#genomes-container, #lineage-container');
  chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      chartTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.chart;
      chartContainers.forEach(c => {
        c.style.display = c.id === which + '-container' ? '' : 'none';
      });
    });
  });

  // Status bar DOM references
  const tickLabel = document.getElementById('tick-label')!;
  const plantCount = document.getElementById('plant-count')!;
  const seasonLabel = document.getElementById('season-label')!;
  const yearLabel = document.getElementById('year-label')!;
  const herbivoreCount = document.getElementById('herbivore-count')!;
  const zoneLabel = document.getElementById('zone-label')!;

  function updateZoneLabel(): void {
    const counts = new Array(CLIMATE_ZONE_COUNT).fill(0);
    let total = 0;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        counts[world.grid[y][x].climateZone]++;
        total++;
      }
    }
    const parts: string[] = [];
    for (let z = 0; z < CLIMATE_ZONE_COUNT; z++) {
      if (counts[z] > 0) {
        const pct = Math.round(100 * counts[z] / total);
        parts.push(`${ZONE_NAMES[z as ClimateZone]} ${pct}%`);
      }
    }
    zoneLabel.textContent = parts.join(' \u00b7 ');
  }

  function updateUI(): void {
    tickLabel.textContent = String(world.tick);
    plantCount.textContent = String(world.plants.size);
    herbivoreCount.textContent = String(world.herbivores.size);
    seasonLabel.textContent = SEASON_NAMES[world.environment.season];
    yearLabel.textContent = String(world.environment.yearCount + 1);
    cellCard.update(world, controls.selectedCell);
    genomePanel.update(world);
    lineagePanel.update(world);
    commentary.update(history, world.species, world, renderer);
    sandboxPanel.update(world);
    speciesLabels.update(world, history);
    systemsOverlay.update(world, history);
  }

  // Initialize zone label
  updateZoneLabel();

  return {
    updateUI,
    updateZoneLabel,
    speciesCardsToggle,
    terrainToggle,
    climateToggle,
    systemsToggle,
    heatmapRow,
    traitSelector,
  };
}
