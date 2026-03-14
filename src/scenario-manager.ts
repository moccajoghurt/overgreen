import { GRID_WIDTH, GRID_HEIGHT, Scenario, World } from './types';
import { createWorld, seedSinglePlant } from './simulation';
import { loadScenario } from './scenario-loader';
import { SCENARIOS } from './scenarios';
import { resetHistory } from './history';
import { naturalSelection101 } from './experiments/natural-selection';
import type { Experiment } from './types/experiment';
import type { Controls } from './controls';
import type { History } from './types';

export interface ScenarioManagerDeps {
  world: World;
  controls: Controls;
  hookPhase: { skip(): void };
  experimentRunner: {
    active: boolean;
    stop(): void;
    start(experiment: Experiment): void;
    totalSteps: number;
  };
  experimentOverlay: { hide(): void };
  sandboxPanel: { reset(): void };
  renderer: {
    rebuildTerrain(): void;
    rebuildWater(): void;
    moveTo(x: number, y: number): void;
  };
  history: History;
  diagLogger: { reset(): void };
  commentary: { reset(): void };
  speciesLabels: { reset(): void };
  plantCard: { reset(): void };
  cellCard: { reset(): void };
  genomePanel: { reset(): void };
  lineagePanel: { reset(): void };
  systemsOverlay: { reset(): void };
  terrainLabels: { rebuild(world: World): void };
  zoneLabels: { rebuild(world: World): void };
  updateUI: () => void;
  updateZoneLabel: () => void;
  resetLastUITick: () => void;
  resetLastEventSeq: () => void;
}

export function initScenarioManager(deps: ScenarioManagerDeps) {
  const {
    world, controls, hookPhase, experimentRunner, experimentOverlay,
    sandboxPanel, renderer, history, diagLogger, commentary,
    speciesLabels, plantCard, cellCard, genomePanel, lineagePanel,
    systemsOverlay, terrainLabels, zoneLabels,
  } = deps;

  function resetAllState(): void {
    // Exit warp mode if active
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
    deps.resetLastEventSeq();
    diagLogger.reset();
    commentary.reset();
    speciesLabels.reset();
    plantCard.reset();
    cellCard.reset();
    genomePanel.reset();
    lineagePanel.reset();
    systemsOverlay.reset();
    renderer.rebuildTerrain();
    renderer.rebuildWater();
    terrainLabels.rebuild(world);
    zoneLabels.rebuild(world);
    deps.updateZoneLabel();
    deps.resetLastUITick();
    deps.updateUI();
    renderer.moveTo(world.width / 2, world.height / 2);
  }

  function doLoadScenario(scenario: Scenario): void {
    hookPhase.skip();
    if (experimentRunner.active) { experimentRunner.stop(); experimentOverlay.hide(); }
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
    if (experimentRunner.active) { experimentRunner.stop(); experimentOverlay.hide(); }
    controls.paused = false;
    const btn = document.getElementById('btn-play-pause')!;
    btn.textContent = '\u25B6 Running';
    btn.classList.remove('paused');
    sandboxPanel.reset();
    controls.selectedCell = null;
    controls.hoveredSpecies = null;

    const fresh = createWorld(GRID_WIDTH, GRID_HEIGHT);
    seedSinglePlant(fresh);
    Object.assign(world, fresh);

    resetAllState();
  }

  function doStartExperiment(experiment: Experiment): void {
    experimentRunner.stop();
    experimentOverlay.hide();
    doLoadScenario(experiment.scenario);
    experimentRunner.start(experiment);
  }

  // --- Map buttons ---
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

  // Random button
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

  // Dev scenarios dropdown
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

  // Experiment buttons
  const EXPERIMENTS: Experiment[] = [naturalSelection101];
  const experimentButtonsContainer = document.getElementById('experiment-buttons')!;
  for (const exp of EXPERIMENTS) {
    const btn = document.createElement('button');
    btn.textContent = exp.name;
    btn.title = exp.description;
    btn.style.cssText = 'font-family:monospace; font-size:11px; padding:5px 8px; background:#1a2a1a; color:#8f8; border:1px solid #3a5a3a; border-radius:3px; cursor:pointer; text-align:left;';
    btn.addEventListener('click', () => {
      doStartExperiment(exp);
      setActiveMapButton(null);
    });
    btn.addEventListener('mouseenter', () => { btn.style.background = '#2a3a2a'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#1a2a1a'; });
    experimentButtonsContainer.appendChild(btn);
  }

  return { doLoadScenario, doLoadRandom, doStartExperiment, setActiveMapButton };
}
