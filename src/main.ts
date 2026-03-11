import { GRID_WIDTH, GRID_HEIGHT, SEASON_NAMES, Scenario, CLIMATE_ZONE_COUNT, ZONE_NAMES, ClimateZone } from './types';
import { createWorld, seedSinglePlant, tickWorld, clearFrameEvents, spawnFire, spawnDisease } from './simulation';
import { createRenderer3D } from './renderer3d';
import { initControls } from './controls';
import { updateInspector } from './inspector';
import { createHistory, recordTick, resetHistory } from './history';
import { createGenomePanel } from './genome-panel';
import { createLineagePanel } from './lineage-panel';
import { createCommentary } from './commentary';
import { createDiagnosticLogger } from './diagnostic-logger';
import { createSandboxPanel } from './sandbox-panel';
import { createSpeciesLabelsOverlay } from './species-labels-overlay';
import { createTerrainLabelsOverlay } from './terrain-labels-overlay';
import { createZoneLabelsOverlay } from './zone-labels-overlay';
import { createFFOverlay } from './ff-overlay';
import type { ColorMode } from './types/renderer';
import { loadScenario } from './scenario-loader';
import { SCENARIOS } from './scenarios';
import { genesis } from './scenarios/genesis';
import { createHookPhase } from './hook-phase';
import { PerfTracker } from './perf';
import { createPerfPanel } from './perf-panel';
import { createSystemsOverlay } from './systems-overlay';

const container = document.getElementById('canvas-container')!;
const world = createWorld(GRID_WIDTH, GRID_HEIGHT);

// Load Genesis as the default starting scenario
loadScenario(world, genesis);

const renderer = await createRenderer3D(container, world);
const controls = initControls(renderer.canvas, renderer, world);

let lastTickTime = 0;
let lastUITick = -1;
let lastUISelectedCell: { x: number; y: number } | null = null;
let frameCount = 0;
let lastEventSeq = 0;

// ── Hook phase (curated first-load experience) ──
const hookPhase = createHookPhase({
  container,
  camera: renderer.camera,
  mapControls: renderer.mapControls,
  controls,
  onRevealComplete: () => {
    // Force UI refresh
    lastUITick = -1;
    updateUI();
  },
});

// Start with natural colors
renderer.setColorMode('natural');

// ── Performance tracking ──
const perfTracker = new PerfTracker();
// Register all labels in display order
perfTracker.register('simTotal', 'sim');
perfTracker.register('environment', 'sim');
perfTracker.register('rechargeWater', 'sim');
perfTracker.register('calculateLight', 'sim');
perfTracker.register('updatePlants', 'sim');
perfTracker.register('herbivores', 'sim');
perfTracker.register('death', 'sim');
perfTracker.register('decomposition', 'sim');
perfTracker.register('germination', 'sim');
perfTracker.register('renderTotal', 'render');
perfTracker.register('terrainColors', 'render');
perfTracker.register('plants', 'render');
perfTracker.register('grass', 'render');
perfTracker.register('seeds', 'render');
perfTracker.register('weather', 'render');
perfTracker.register('herbivoresR', 'render');
perfTracker.register('fire', 'render');
perfTracker.register('drought', 'render');
perfTracker.register('disease', 'render');
perfTracker.register('glDraw', 'render');
perfTracker.register('frame', 'frame');
const perfPanel = createPerfPanel(container, perfTracker);

// --- View drawer expand/collapse ---
const viewExpandBtn = document.getElementById('btn-view-expand') as HTMLButtonElement;
const viewDrawer = document.getElementById('view-drawer')!;
viewExpandBtn.addEventListener('click', () => {
  const open = viewDrawer.classList.toggle('hidden') === false;
  viewExpandBtn.textContent = open ? '−' : '+';
});

// --- View toggles ---
function setupViewCheckbox(id: string, onToggle: (checked: boolean) => void) {
  const el = document.getElementById(id) as HTMLInputElement;
  el.addEventListener('change', () => onToggle(el.checked));
  return el;
}

const speciesLabels = createSpeciesLabelsOverlay(container, renderer);
const terrainLabels = createTerrainLabelsOverlay(container, renderer, world);
const zoneLabels = createZoneLabelsOverlay(container, renderer, world);

const colorModeSelect = document.getElementById('color-mode-select') as HTMLSelectElement;
colorModeSelect.addEventListener('change', () => {
  renderer.setColorMode(colorModeSelect.value as ColorMode);
});
const speciesCardsToggle = setupViewCheckbox('toggle-species-cards', (on) => speciesLabels.setVisible(on));
const terrainToggle = setupViewCheckbox('toggle-terrain', (on) => terrainLabels.setVisible(on));
const climateToggle = setupViewCheckbox('toggle-climate', (on) => zoneLabels.setVisible(on));
setupViewCheckbox('toggle-lineage-cards', (on) => speciesLabels.setLineageVisible(on));
const systemsToggle = setupViewCheckbox('toggle-systems', (on) => {
  if (on) systemsOverlay.show(); else systemsOverlay.hide();
});

const ffOverlay = createFFOverlay(container);
const systemsOverlay = createSystemsOverlay(container);

const history = createHistory();
const diagLogger = createDiagnosticLogger();
// Expose for programmatic access (experiments)
(window as any).__diagLogger = diagLogger;
(window as any).__world = world;
(window as any).__doTick = () => { clearFrameEvents(world); tickWorld(world); recordTick(history, world); diagLogger.recordTick(world); };
(window as any).__updateUI = () => { lastUITick = -1; updateUI(); };
(window as any).__perfTracker = perfTracker;
(window as any).__setCamera = (pos: {x:number,y:number,z:number}, target: {x:number,y:number,z:number}) => {
  renderer.camera.position.set(pos.x, pos.y, pos.z);
  renderer.mapControls.target.set(target.x, target.y, target.z);
  renderer.mapControls.update();
};
(window as any).__getCamera = () => {
  const p = renderer.camera.position;
  const t = renderer.mapControls.target;
  return { position: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) }, target: { x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2) } };
};
const genomePanel = createGenomePanel(document.getElementById('genomes-container')!, container, renderer);
const lineagePanel = createLineagePanel(document.getElementById('lineage-container')!, container, renderer);
const commentary = createCommentary(container);
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
const btnSystems = document.getElementById('btn-systems') as HTMLButtonElement;
btnSystems.addEventListener('click', () => {
  systemsOverlay.toggle();
  systemsToggle.checked = systemsOverlay.isVisible();
});

// Map buttons — featured maps shown as full buttons, experiments in dev dropdown
const mapButtonsContainer = document.getElementById('map-buttons')!;
const mapButtons: HTMLButtonElement[] = [];
const FEATURED_IDS = new Set(['genesis', 'lindenvale']);

function setActiveMapButton(activeId: string | null): void {
  for (const btn of mapButtons) {
    btn.classList.toggle('active', btn.dataset.scenarioId === activeId);
  }
}

function createMapButton(id: string, name: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'map-btn';
  btn.dataset.scenarioId = id;
  btn.title = name;
  const img = document.createElement('img');
  img.className = 'map-btn-img';
  img.alt = name;
  img.src = `maps/${id}.png`;
  img.onerror = () => {
    const fallback = document.createElement('div');
    fallback.className = 'map-btn-fallback';
    fallback.textContent = name;
    img.replaceWith(fallback);
  };
  btn.appendChild(img);
  btn.addEventListener('click', () => { onClick(); setActiveMapButton(id); });
  return btn;
}

// Featured map buttons
for (const s of SCENARIOS) {
  if (!FEATURED_IDS.has(s.id)) continue;
  const btn = createMapButton(s.id, s.name, () => doLoadScenario(s));
  if (s.id === 'genesis') btn.classList.add('active');
  mapButtonsContainer.appendChild(btn);
  mapButtons.push(btn);
}

// Random button (always last in featured)
{
  const btn = createMapButton('__random__', 'Random', () => doLoadRandom());
  btn.querySelector('img')!.src = 'maps/random.png';
  btn.classList.add('map-btn-random');
  const badge = document.createElement('span');
  badge.className = 'map-btn-badge';
  badge.textContent = '\u{1F3B2}';
  btn.appendChild(badge);
  mapButtonsContainer.appendChild(btn);
  mapButtons.push(btn);
}

// Dev scenarios dropdown (···)
const devDropdown = document.getElementById('dev-scenario-dropdown')!;
const btnDevScenarios = document.getElementById('btn-dev-scenarios')!;
btnDevScenarios.addEventListener('click', () => {
  devDropdown.classList.toggle('hidden');
});

for (const s of SCENARIOS) {
  if (FEATURED_IDS.has(s.id)) continue;
  const btn = document.createElement('button');
  btn.textContent = s.name;
  btn.addEventListener('click', () => {
    doLoadScenario(s);
    setActiveMapButton(null);
    devDropdown.classList.add('hidden');
  });
  devDropdown.appendChild(btn);
}

function doLoadScenario(scenario: Scenario): void {
  hookPhase.skip();
  controls.paused = false;
  const btn = document.getElementById('btn-play-pause')!;
  btn.textContent = '\u25B6 Running';
  btn.classList.remove('paused');
  sandboxPanel.reset();
  controls.selectedCell = null;
  controls.hoveredSpecies = null;
  loadScenario(world, scenario);
  resetAllState();
  if (scenario.frozen) {
    controls.paused = true;
    btn.textContent = '\u23F8 PAUSED';
    btn.classList.add('paused');
  }
}

function doLoadRandom(): void {
  hookPhase.skip();
  controls.paused = false;
  const btn = document.getElementById('btn-play-pause')!;
  btn.textContent = '\u25B6 Running';
  btn.classList.remove('paused');
  sandboxPanel.reset();
  controls.selectedCell = null;
  controls.hoveredSpecies = null;

  const fresh = createWorld(GRID_WIDTH, GRID_HEIGHT);
  seedSinglePlant(fresh);

  // Copy all fields into existing world object
  Object.assign(world, fresh);

  resetAllState();
}

function resetAllState(): void {
  // Exit warp mode if active — reset to 1x
  if (controls.renderSkip > 0) {
    controls.renderSkip = 0;
    controls.tickInterval = 500;
    controls.tickBudgetMs = 0;
    document.querySelectorAll<HTMLButtonElement>('.speed-btn')
      .forEach(b => {
        b.classList.toggle('active', b.dataset.preset === 'play');
        b.classList.remove('warp');
      });
    document.getElementById('btn-play-pause')!.classList.remove('warp-active');
  }
  resetHistory(history);
  lastEventSeq = 0;
  diagLogger.reset();
  commentary.reset();
  speciesLabels.reset();
  genomePanel.reset();
  lineagePanel.reset();
  systemsOverlay.reset();
  renderer.rebuildTerrain();
  renderer.rebuildWater();
  terrainLabels.rebuild(world);
  zoneLabels.rebuild(world);
  updateZoneLabel();
  lastUITick = -1;
  updateUI();
  renderer.moveTo(world.width / 2, world.height / 2);
}

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
  zoneLabel.textContent = parts.join(' · ');
}
updateZoneLabel();

function updateUI(): void {
  tickLabel.textContent = String(world.tick);
  plantCount.textContent = String(world.plants.size);
  herbivoreCount.textContent = String(world.herbivores.size);
  seasonLabel.textContent = SEASON_NAMES[world.environment.season];
  yearLabel.textContent = String(world.environment.yearCount + 1);
  if (controls.selectedCell) {
    updateInspector(world, controls);
  }
  genomePanel.update(world);
  lineagePanel.update(world);
  commentary.update(history, world.speciesColors, world, renderer);
  sandboxPanel.update(world);
  speciesLabels.update(world, history);
  systemsOverlay.update(world, history);
}


function doTick(hooks?: import('./perf').TimingHooks): void {
  tickWorld(world, hooks);
  recordTick(history, world);
  diagLogger.recordTick(world);

  // Forward new events to hook phase
  if (hookPhase.active && history.events.length > lastEventSeq) {
    for (let i = lastEventSeq; i < history.events.length; i++) {
      const ev = history.events[i];
      if (ev.type === 'population_record' || ev.type === 'dominance_shift'
        || ev.type === 'extinction' || ev.type === 'speciation'
        || ev.type === 'mass_extinction') {
        hookPhase.handleEvent(ev);
      }
    }
    lastEventSeq = history.events.length;
  }
}

const WARP_BUDGET_MS = 15;  // max ms to spend ticking per frame in warp mode (no rendering)
const TARGET_FRAME_MS = 15; // target frame time (leaves ~1.6ms margin for 60fps)
const SAFETY_MARGIN_MS = 3; // headroom for GC, compositor, etc.
let wasWarpActive = false;
let lastRenderMs = 4;       // rolling estimate of render cost

function loop(now: number): void {
  perfTracker.markFrame(now);
  perfTracker.begin('frame');
  frameCount++;
  const warpActive = controls.renderSkip > 0 && !controls.paused;

  // Warp mode transitions
  if (warpActive && !wasWarpActive) {
    ffOverlay.show();
    speciesLabels.setVisible(false);
    speciesLabels.setLineageVisible(false);
    terrainLabels.setVisible(false);
    zoneLabels.setVisible(false);
    systemsOverlay.hide();
  } else if (!warpActive && wasWarpActive) {
    ffOverlay.hide();
    speciesLabels.setVisible(speciesCardsToggle.checked);
    terrainLabels.setVisible(terrainToggle.checked);
    zoneLabels.setVisible(climateToggle.checked);
    if (systemsToggle.checked) systemsOverlay.show();
    lastUITick = -1; // force full UI refresh
  }
  wasWarpActive = warpActive;

  const shouldRender = !warpActive;

  const perfHooks = perfTracker;

  if (!controls.paused) {
    // Clear event arrays once per frame so all ticks in a batch accumulate events
    clearFrameEvents(world);
    perfTracker.begin('simTotal');
    if (controls.renderSkip > 0) {
      // Warp: time-budgeted, no rendering
      const deadline = performance.now() + WARP_BUDGET_MS;
      while (performance.now() < deadline) {
        doTick(perfHooks);
      }
      lastTickTime = now;
      ffOverlay.update(world);
    } else if (controls.tickBudgetMs > 0) {
      // Fast: adaptive budget based on how long rendering takes
      const tickBudget = Math.max(2, TARGET_FRAME_MS - lastRenderMs - SAFETY_MARGIN_MS);
      const deadline = performance.now() + tickBudget;
      do { doTick(perfHooks); } while (performance.now() < deadline);
      lastTickTime = now;
    } else if (now - lastTickTime >= controls.tickInterval) {
      doTick(perfHooks);
      lastTickTime = now;
    }
    perfTracker.end('simTotal');
  }

  // Update hook phase
  if (hookPhase.active) {
    hookPhase.update(world, history);
  }

  if (shouldRender) {
    const renderStart = performance.now();
    let highlightSet: Set<number> | null = null;
    const hoveredPlant = controls.hoveredPlantId !== null ? world.plants.get(controls.hoveredPlantId) : null;
    if (controls.hoverLineageEnabled && hoveredPlant?.alive) {
      renderer.setHighlightedLineageRoot(hoveredPlant.lineageRoot);
      renderer.setHighlightedSpecies(null);
    } else {
      renderer.setHighlightedLineageRoot(null);
      if (controls.hoverEnabled && controls.hoveredSpecies !== null) {
        highlightSet = new Set([controls.hoveredSpecies]);
      }
      renderer.setHighlightedSpecies(highlightSet);
    }
    perfTracker.begin('renderTotal');
    renderer.render(controls.selectedCell, perfHooks);
    if (!hookPhase.active) {
      const hoveredPlantPos = hoveredPlant?.alive ? { x: hoveredPlant.x, y: hoveredPlant.y } : null;
      speciesLabels.setHoveredSpecies(controls.hoverLineageEnabled ? null : controls.hoveredSpecies, hoveredPlantPos);
      speciesLabels.setHoveredLineageRoot(
        controls.hoverLineageEnabled && hoveredPlant?.alive
          ? hoveredPlant.lineageRoot
          : null,
      );
      speciesLabels.updatePositions();
      terrainLabels.updatePositions();
      zoneLabels.updatePositions();
    }
    perfTracker.end('renderTotal');
    // Smooth render time estimate for adaptive tick budgeting
    lastRenderMs = lastRenderMs * 0.8 + (performance.now() - renderStart) * 0.2;
  }

  // Only update UI when rendering and simulation has ticked or selected cell changed
  // Throttle in fast mode: update every ~4th tick to save 5-10ms/frame
  const selChanged = controls.selectedCell !== lastUISelectedCell;
  const isFastMode = controls.tickBudgetMs > 0;
  if (shouldRender && (world.tick !== lastUITick || selChanged)) {
    const skipUI = isFastMode && !selChanged && (world.tick % 8 !== 0);
    if (!skipUI) {
      lastUITick = world.tick;
      lastUISelectedCell = controls.selectedCell;
      if (!hookPhase.active) {
        updateUI();
      }
    }
  }

  perfTracker.end('frame');
  perfPanel.update();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Debug shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === 'F3') {
    e.preventDefault();
    perfPanel.toggle();
  }
  if (e.key === 'F4') {
    e.preventDefault();
    systemsOverlay.toggle();
    systemsToggle.checked = systemsOverlay.isVisible();
  }
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

// Auto-start hook for Genesis (after all declarations are initialized)
hookPhase.start();
