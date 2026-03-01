import { GRID_WIDTH, GRID_HEIGHT, SEASON_NAMES } from './types';
import { createWorld, seedInitialPlants, tickWorld, spawnFire } from './simulation';
import { createRenderer3D } from './renderer3d';
import { initControls, updateInspector } from './controls';
import { updateLeaderboard } from './leaderboard';
import { createHistory, recordTick } from './history';
import { createPopulationChart } from './population-chart';
import { createTraitChart } from './trait-chart';
import { createGenomePanel } from './genome-panel';
import { createEventTicker } from './event-ticker';
import { createCommentary } from './commentary';

const container = document.getElementById('canvas-container')!;
const world = createWorld(GRID_WIDTH, GRID_HEIGHT);
seedInitialPlants(world, 40);

const renderer = createRenderer3D(container, world);
const controls = initControls(renderer.canvas, renderer, world);

const history = createHistory();
const genomePanel = createGenomePanel(document.getElementById('genomes-container')!);
const chart = createPopulationChart(document.getElementById('population-container')!);
const traitChart = createTraitChart(document.getElementById('traits-container')!);
const ticker = createEventTicker(document.getElementById('ticker-list')!);
const commentary = createCommentary(container);

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

let lastLeaderboardTick = -1;

function updateUI(): void {
  tickLabel.textContent = String(world.tick);
  plantCount.textContent = String(world.plants.size);
  seasonLabel.textContent = SEASON_NAMES[world.environment.season];
  yearLabel.textContent = String(world.environment.yearCount + 1);
  if (controls.selectedCell) {
    updateInspector(world, controls);
  }
  if (world.tick !== lastLeaderboardTick) {
    updateLeaderboard(world);
    lastLeaderboardTick = world.tick;
  }
  genomePanel.update(world);
  chart.update(history, world.speciesColors);
  traitChart.update(history);
  ticker.update(history, world.speciesColors);
  commentary.update(history, world.speciesColors, world, renderer);
}

let lastTickTime = 0;

function loop(now: number): void {
  if (!controls.paused) {
    if (now - lastTickTime >= controls.tickInterval) {
      tickWorld(world);
      recordTick(history, world);
      lastTickTime = now;
    }
  } else if (controls.stepRequested) {
    tickWorld(world);
    recordTick(history, world);
    controls.stepRequested = false;
    lastTickTime = now;
  }

  renderer.render(controls.selectedCell);
  updateUI();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Debug: press F to spawn a fire
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    spawnFire(world);
  }
});
