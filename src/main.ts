import { GRID_WIDTH, GRID_HEIGHT } from './types';
import { createWorld, seedInitialPlants, tickWorld } from './simulation';
import { createRenderer } from './renderer';
import { initControls, updateInspector, Controls } from './controls';

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

function loop(): void {
  const ext = controls as Controls & { stepRequested?: boolean };

  if (!controls.paused) {
    for (let i = 0; i < controls.ticksPerFrame; i++) {
      tickWorld(world);
    }
  } else if (ext.stepRequested) {
    tickWorld(world);
    ext.stepRequested = false;
  }

  renderer.render(controls.selectedCell);
  updateUI();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
