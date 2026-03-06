import { GRID_WIDTH, GRID_HEIGHT, SEASON_NAMES, Scenario } from './types';
import { ERA_NAMES } from './simulation/eras';
import { createWorld, seedInitialPlants, tickWorld, spawnFire, spawnDisease } from './simulation';
import { createRenderer3D } from './renderer3d';
import { initControls } from './controls';
import { updateInspector } from './inspector';
import { createHistory, recordTick, resetHistory } from './history';
import { createPopulationChart } from './population-chart';
import { createTraitChart } from './trait-chart';
import { createGenomePanel } from './genome-panel';
import { createEventTicker } from './event-ticker';
import { createCommentary } from './commentary';
import { createDiagnosticLogger } from './diagnostic-logger';
import { createShowcase } from './species-showcase';
import { createSandboxPanel } from './sandbox-panel';
import { createSpeciesLabelsOverlay } from './species-labels-overlay';
import { createTerrainLabelsOverlay } from './terrain-labels-overlay';
import { createFFOverlay } from './ff-overlay';
import { loadScenario } from './scenario-loader';
import { SCENARIOS } from './scenarios';

const container = document.getElementById('canvas-container')!;
const world = createWorld(GRID_WIDTH, GRID_HEIGHT);
seedInitialPlants(world, 40);

const renderer = createRenderer3D(container, world);
const controls = initControls(renderer.canvas, renderer, world);

const colorToggle = document.getElementById('color-mode-toggle') as HTMLInputElement;
colorToggle.addEventListener('change', () => {
  renderer.setColorMode(colorToggle.checked ? 'species' : 'natural');
});

const speciesLabels = createSpeciesLabelsOverlay(container, renderer);
const labelsToggle = document.getElementById('labels-toggle') as HTMLInputElement;
labelsToggle.addEventListener('change', () => {
  speciesLabels.setVisible(labelsToggle.checked);
});

const terrainLabels = createTerrainLabelsOverlay(container, renderer, world);
const terrainToggle = document.getElementById('terrain-view-toggle') as HTMLInputElement;
terrainToggle.addEventListener('change', () => {
  terrainLabels.setVisible(terrainToggle.checked);
});

const ffOverlay = createFFOverlay(container);

const history = createHistory();
const diagLogger = createDiagnosticLogger();
// Expose for programmatic access (experiments)
(window as any).__diagLogger = diagLogger;
(window as any).__world = world;
(window as any).__doTick = () => { tickWorld(world); recordTick(history, world); diagLogger.recordTick(world); };
(window as any).__updateUI = () => { lastUITick = -1; updateUI(); };
const genomePanel = createGenomePanel(document.getElementById('genomes-container')!, container, renderer);
const chart = createPopulationChart(document.getElementById('population-container')!);
const traitChart = createTraitChart(document.getElementById('traits-container')!);
const ticker = createEventTicker(document.getElementById('ticker-list')!);
const commentary = createCommentary(container);
const showcase = createShowcase(document.getElementById('showcase')!, world, renderer, container, history);

const sandboxPanel = createSandboxPanel(
  document.getElementById('sandbox-panel')!,
  world, controls, renderer.canvas,
  () => renderer.markPlantsDirty(),
);
const btnSandbox = document.getElementById('btn-sandbox') as HTMLButtonElement;
btnSandbox.addEventListener('click', () => {
  const next = !sandboxPanel.isVisible();
  sandboxPanel.setVisible(next);
});

// Scenario selector
const scenarioSelect = document.getElementById('scenario-select') as HTMLSelectElement;
for (const s of SCENARIOS) {
  const opt = document.createElement('option');
  opt.value = s.id;
  opt.textContent = s.name;
  scenarioSelect.appendChild(opt);
}

const btnLoadScenario = document.getElementById('btn-load-scenario') as HTMLButtonElement;
btnLoadScenario.addEventListener('click', () => {
  const id = scenarioSelect.value;
  if (id === '') {
    doLoadRandom();
  } else {
    const scenario = SCENARIOS.find(s => s.id === id);
    if (scenario) doLoadScenario(scenario);
  }
});

function doLoadScenario(scenario: Scenario): void {
  controls.paused = true;
  const btn = document.getElementById('btn-play-pause')!;
  btn.textContent = 'Play';
  btn.classList.add('paused');
  sandboxPanel.reset();
  controls.selectedCell = null;
  controls.hoveredSpecies = null;
  loadScenario(world, scenario);
  resetAllState();
}

function doLoadRandom(): void {
  controls.paused = true;
  const btn = document.getElementById('btn-play-pause')!;
  btn.textContent = 'Play';
  btn.classList.add('paused');
  sandboxPanel.reset();
  controls.selectedCell = null;
  controls.hoveredSpecies = null;

  const fresh = createWorld(GRID_WIDTH, GRID_HEIGHT);
  seedInitialPlants(fresh, 40);

  // Copy all fields into existing world object
  Object.assign(world, fresh);

  resetAllState();
}

function resetAllState(): void {
  // Exit FF mode if active
  if (controls.renderSkip > 0) {
    controls.renderSkip = 0;
    controls.tickInterval = 200;
    controls.ticksPerFrame = 0;
    document.querySelectorAll<HTMLButtonElement>('.speed-btn')
      .forEach(b => b.classList.toggle('active', b.dataset.preset === '2x'));
    document.getElementById('btn-play-pause')!.classList.remove('ff-active');
  }
  resetHistory(history);
  diagLogger.reset();
  ticker.reset();
  commentary.reset();
  showcase.reset();
  speciesLabels.reset();
  genomePanel.reset();
  chart.reset();
  traitChart.reset();
  renderer.rebuildTerrain();
  renderer.rebuildWater();
  terrainLabels.rebuild(world);
  lastUITick = -1;
  updateUI();
  renderer.moveTo(world.width / 2, world.height / 2);
}

// Tab switching
const chartTabs = document.querySelectorAll<HTMLButtonElement>('.chart-tab');
const chartContainers = document.querySelectorAll<HTMLElement>('#genomes-container, #population-container, #traits-container');
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

const tickLabel = document.getElementById('tick-label')!;
const plantCount = document.getElementById('plant-count')!;
const seasonLabel = document.getElementById('season-label')!;
const yearLabel = document.getElementById('year-label')!;
const eraLabel = document.getElementById('era-label')!;
const herbivoreCount = document.getElementById('herbivore-count')!;

function updateUI(): void {
  tickLabel.textContent = String(world.tick);
  plantCount.textContent = String(world.plants.size);
  herbivoreCount.textContent = String(world.herbivores.size);
  seasonLabel.textContent = SEASON_NAMES[world.environment.season];
  yearLabel.textContent = String(world.environment.yearCount + 1);
  eraLabel.textContent = ERA_NAMES[world.environment.era.current];
  if (controls.selectedCell) {
    updateInspector(world, controls);
  }
  genomePanel.update(world);
  chart.update(history, world.speciesColors);
  traitChart.update(history);
  ticker.update(history, world.speciesColors);
  commentary.update(history, world.speciesColors, world, renderer);
  showcase.update(world);
  sandboxPanel.update(world);
  speciesLabels.update(world, history);
}

let lastTickTime = 0;
let lastUITick = -1;
let lastUISelectedCell: { x: number; y: number } | null = null;
let frameCount = 0;

function doTick(): void {
  tickWorld(world);
  recordTick(history, world);
  diagLogger.recordTick(world);
}

const FF_BUDGET_MS = 15;  // max ms to spend ticking per frame in ff mode (no rendering)
let wasFFActive = false;

function loop(now: number): void {
  frameCount++;
  const ffActive = controls.renderSkip > 0 && !controls.paused;

  // FF mode transitions
  if (ffActive && !wasFFActive) {
    ffOverlay.show();
    speciesLabels.setVisible(false);
    terrainLabels.setVisible(false);
  } else if (!ffActive && wasFFActive) {
    ffOverlay.hide();
    speciesLabels.setVisible(labelsToggle.checked);
    terrainLabels.setVisible(terrainToggle.checked);
    lastUITick = -1; // force full UI refresh
  }
  wasFFActive = ffActive;

  const shouldRender = !ffActive;

  if (!controls.paused) {
    if (controls.renderSkip > 0) {
      // FF: time-budgeted, no rendering
      const deadline = performance.now() + FF_BUDGET_MS;
      while (performance.now() < deadline) {
        doTick();
      }
      lastTickTime = now;
      ffOverlay.update(world);
    } else if (controls.ticksPerFrame > 0) {
      for (let i = 0; i < controls.ticksPerFrame; i++) doTick();
      lastTickTime = now;
    } else if (now - lastTickTime >= controls.tickInterval) {
      doTick();
      lastTickTime = now;
    }
  }

  if (shouldRender) {
    renderer.setHoveredSpecies(controls.hoveredSpecies);
    renderer.render(controls.selectedCell);
    speciesLabels.setHoveredSpecies(controls.hoveredSpecies);
    speciesLabels.updatePositions();
    terrainLabels.updatePositions();
  }

  // Only update UI when rendering and simulation has ticked or selected cell changed
  const selChanged = controls.selectedCell !== lastUISelectedCell;
  if (shouldRender && (world.tick !== lastUITick || selChanged)) {
    lastUITick = world.tick;
    lastUISelectedCell = controls.selectedCell;
    updateUI();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Debug shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    spawnFire(world);
  }
  if (e.key === 'd' || e.key === 'D') {
    diagLogger.downloadReport();
  }
  if (e.key === 'b' || e.key === 'B') {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    spawnDisease(world, { x: cx, y: cy });
  }
});
