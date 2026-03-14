import { GRID_WIDTH, GRID_HEIGHT } from './types';
import { createWorld, clearFrameEvents, tickWorld, spawnFire, spawnDisease } from './simulation';
import { createRenderer3D } from './renderer3d';
import { initControls } from './controls';
import { createCellCardOverlay } from './cell-card-overlay';
import { createHistory, recordTick } from './history';
import { createGenomePanel } from './genome-panel';
import { createLineagePanel } from './lineage-panel';
import { createCommentary } from './commentary';
import { createDiagnosticLogger } from './diagnostic-logger';
import { createSandboxPanel } from './sandbox-panel';
import { createSpeciesLabelsOverlay } from './species-labels-overlay';
import { createTerrainLabelsOverlay } from './terrain-labels-overlay';
import { createZoneLabelsOverlay } from './zone-labels-overlay';
import { createFFOverlay } from './ff-overlay';
import type { Genome } from './types/core';
import { loadScenario } from './scenario-loader';
import { genesis } from './scenarios/genesis';
import { createHookPhase } from './hook-phase';
import { PerfTracker } from './perf';
import { createPerfPanel } from './perf-panel';
import { createSystemsOverlay } from './systems-overlay';
import { createPlantCardOverlay } from './plant-card-overlay';
import { createExperimentRunner } from './experiment-runner';
import { createExperimentOverlay } from './experiment-overlay';
import { naturalSelection101 } from './experiments/natural-selection';
import { initUIWiring } from './ui-wiring';
import { initScenarioManager } from './scenario-manager';
import { startFrameLoop } from './frame-loop';

// ── Create world & renderer ──
const container = document.getElementById('canvas-container')!;
const world = createWorld(GRID_WIDTH, GRID_HEIGHT);
loadScenario(world, genesis);

const renderer = await createRenderer3D(container, world);
const controls = initControls(renderer.canvas, renderer);
renderer.setColorMode('natural');

// ── Performance tracking ──
const perfTracker = new PerfTracker();
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

// ── Create overlays & panels ──
const speciesLabels = createSpeciesLabelsOverlay(container, renderer);
const terrainLabels = createTerrainLabelsOverlay(container, renderer, world);
const zoneLabels = createZoneLabelsOverlay(container, renderer, world);
const plantCard = createPlantCardOverlay(container, renderer);
const cellCard = createCellCardOverlay(container, renderer, () => { controls.selectedCell = null; });
const ffOverlay = createFFOverlay(container);
const systemsOverlay = createSystemsOverlay(container);
const history = createHistory();
const diagLogger = createDiagnosticLogger();
const genomePanel = createGenomePanel(document.getElementById('genomes-container')!, container, renderer);
const lineagePanel = createLineagePanel(document.getElementById('lineage-container')!, container, renderer);
const commentary = createCommentary(container);
const sandboxPanel = createSandboxPanel(
  document.getElementById('sandbox-panel')!,
  world, controls, renderer.canvas,
  () => renderer.markPlantsDirty(),
);

// ── Experiment system ──
const experimentOverlay = createExperimentOverlay(container);
const experimentRunner = createExperimentRunner({
  onStepActivated: (index, step) => experimentOverlay.showStep(index, experimentRunner.totalSteps, step),
  onWaiting: (nextIndex, hint) => experimentOverlay.showWaiting(nextIndex, experimentRunner.totalSteps, hint),
  onComplete: (wrapUp) => wrapUp ? experimentOverlay.showWrapUp(wrapUp) : experimentOverlay.hide(),
  onPauseRequested: () => {
    controls.paused = true;
    const btn = document.getElementById('btn-play-pause')!;
    btn.textContent = '\u23F8 PAUSED';
    btn.classList.add('paused');
  },
  onResumeRequested: () => {
    controls.paused = false;
    const btn = document.getElementById('btn-play-pause')!;
    btn.textContent = '\u25B6 Running';
    btn.classList.remove('paused');
  },
  onColorModeRequested: (mode, trait) => {
    renderer.setColorMode(mode);
    uiRefs.heatmapRow.querySelector('.heatmap-btn.active')?.classList.remove('active');
    uiRefs.heatmapRow.querySelector(`.heatmap-btn[data-color="${mode}"]`)?.classList.add('active');
    uiRefs.traitSelector.style.display = mode === 'trait' ? '' : 'none';
    if (trait) {
      renderer.setTraitColorTrait(trait as keyof Genome);
      uiRefs.traitSelector.value = trait;
    }
  },
  onSpeedRequested: (speed) => {
    if (speed === 'play') {
      controls.tickInterval = 500; controls.tickBudgetMs = 0; controls.renderSkip = 0;
    } else {
      controls.tickInterval = 0; controls.tickBudgetMs = 1; controls.renderSkip = 0;
    }
    document.querySelectorAll<HTMLButtonElement>('.speed-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.preset === speed);
      b.classList.remove('warp');
    });
  },
});
experimentOverlay.onContinue = () => experimentRunner.continueStep();
experimentOverlay.onClose = () => { experimentRunner.stop(); experimentOverlay.hide(); };

// ── UI wiring (view toggles, status bar, etc.) ──
const uiRefs = initUIWiring({
  renderer, controls, world,
  speciesLabels, terrainLabels, zoneLabels, systemsOverlay,
  cellCard, genomePanel, lineagePanel, commentary, sandboxPanel,
  history,
});

// ── Hook phase (curated first-load experience) ──
// Declared after uiRefs so callbacks can reference updateUI and scenario manager
let scenarioMgr: ReturnType<typeof initScenarioManager>;
const hookPhase = createHookPhase({
  container,
  camera: renderer.camera,
  mapControls: renderer.mapControls,
  controls,
  onRevealComplete: () => {
    loopHandles.resetLastUITick();
    uiRefs.updateUI();
  },
  onStartExperiment: () => {
    scenarioMgr.doStartExperiment(naturalSelection101);
  },
});

// ── Frame loop ──
const loopHandles = startFrameLoop({
  world, controls, perfTracker, perfPanel, renderer,
  hookPhase, experimentRunner,
  ffOverlay, speciesLabels, terrainLabels, zoneLabels, systemsOverlay,
  plantCard, cellCard,
  history, diagLogger,
  updateUI: uiRefs.updateUI,
  speciesCardsToggle: uiRefs.speciesCardsToggle,
  terrainToggle: uiRefs.terrainToggle,
  climateToggle: uiRefs.climateToggle,
  systemsToggle: uiRefs.systemsToggle,
});

// ── Scenario manager (map buttons, experiments, load/reset) ──
scenarioMgr = initScenarioManager({
  world, controls, hookPhase, experimentRunner, experimentOverlay,
  sandboxPanel, renderer, history, diagLogger, commentary,
  speciesLabels, plantCard, cellCard, genomePanel, lineagePanel,
  systemsOverlay, terrainLabels, zoneLabels,
  updateUI: uiRefs.updateUI,
  updateZoneLabel: uiRefs.updateZoneLabel,
  resetLastUITick: loopHandles.resetLastUITick,
  resetLastEventSeq: loopHandles.resetLastEventSeq,
});

// ── Window globals (programmatic access / experiments) ──
(window as any).__diagLogger = diagLogger;
(window as any).__world = world;
(window as any).__doTick = () => { clearFrameEvents(world); tickWorld(world); recordTick(history, world); diagLogger.recordTick(world); };
(window as any).__updateUI = () => { loopHandles.resetLastUITick(); uiRefs.updateUI(); };
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

// ── Debug shortcuts ──
window.addEventListener('keydown', (e) => {
  if (e.key === 'F3') {
    e.preventDefault();
    perfPanel.toggle();
  }
  if (e.key === 'F4') {
    e.preventDefault();
    systemsOverlay.toggle();
    uiRefs.systemsToggle.checked = systemsOverlay.isVisible();
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

// Auto-start hook for Genesis
hookPhase.start();
