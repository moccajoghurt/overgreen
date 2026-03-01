import { GRID_WIDTH, GRID_HEIGHT } from './types';
import { createWorld, seedInitialPlants, tickWorld } from './simulation';
import { createRenderer3D } from './renderer3d';
import { initControls, updateInspector } from './controls';
import { updateLeaderboard } from './leaderboard';

const container = document.getElementById('canvas-container')!;
const world = createWorld(GRID_WIDTH, GRID_HEIGHT);
seedInitialPlants(world, 40);

const renderer = createRenderer3D(container, world);
const controls = initControls(renderer.canvas, renderer, world);

const tickLabel = document.getElementById('tick-label')!;
const plantCount = document.getElementById('plant-count')!;

let lastLeaderboardTick = -1;

function updateUI(): void {
  tickLabel.textContent = String(world.tick);
  plantCount.textContent = String(world.plants.size);
  if (controls.selectedCell) {
    updateInspector(world, controls);
  }
  if (world.tick !== lastLeaderboardTick) {
    updateLeaderboard(world);
    lastLeaderboardTick = world.tick;
  }
}

let lastTickTime = 0;

function loop(now: number): void {
  if (!controls.paused) {
    if (now - lastTickTime >= controls.tickInterval) {
      tickWorld(world);
      lastTickTime = now;
    }
  } else if (controls.stepRequested) {
    tickWorld(world);
    controls.stepRequested = false;
    lastTickTime = now;
  }

  renderer.render(controls.selectedCell);
  updateUI();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
