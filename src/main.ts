import { GRID_WIDTH, GRID_HEIGHT } from './types';
import { createWorld, seedInitialPlants, tickWorld } from './simulation';
import { createRenderer } from './renderer';
import { initControls, updateInspector } from './controls';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const world = createWorld(GRID_WIDTH, GRID_HEIGHT);
seedInitialPlants(world, 40);

const renderer = createRenderer(canvas, world);
const controls = initControls(canvas, renderer, world);

const tickLabel = document.getElementById('tick-label')!;
const plantCount = document.getElementById('plant-count')!;

function updateUI(): void {
  tickLabel.textContent = String(world.tick);
  plantCount.textContent = String(world.plants.size);
  if (controls.selectedCell) {
    updateInspector(world, controls);
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
